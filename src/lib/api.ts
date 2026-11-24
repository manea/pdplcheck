import {
  buildBilingualPrivacyNoticeHtml,
  buildDefaultPdplControls,
  buildPdplRopaDossierMarkdown,
  computePdplSummary,
} from '../core/breachAndNotice.ts';
import {
  buildExecutiveSummaryText,
  sealPdplDossier,
} from '../core/dossierDigest.ts';
import { evaluateBreach72hClock } from '../core/pdplRules.ts';
import {
  PDPLCHECK_PRESETS,
  createDossierFromPreset,
  type PdplPreset,
} from '../core/presets.ts';
import {
  auditPdplRopaAndTransfers,
  auditRopaCsv,
  exportRopaCsv,
} from '../core/ropaAuditor.ts';
import type {
  ControlStatus,
  Locale,
  OrganizationPrivacyProfile,
  PdplDossier,
  RopaCsvAuditReport,
} from '../core/types.ts';
import { withBase } from './basePath.ts';

export type UiPdplDossier = PdplDossier & {
  status?: 'draft' | 'locked';
  slug?: string;
};

export interface DossierListRecord {
  id: string;
  slug: string;
  dossierCode: string | null;
  status: 'draft' | 'locked';
  jurisdiction: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  dossier: UiPdplDossier;
}

export interface DossierStats {
  totalDossiers: number;
  draftDossiers: number;
  lockedDossiers: number;
  orgProfilesCount: number;
}

export interface DossierBundle {
  dossier: UiPdplDossier;
  status?: 'draft' | 'locked';
  slug?: string;
  viewCount: number;
  publicReportUrl?: string;
  summaryEn?: string;
  summaryAr?: string;
  privacyNoticeHtmlEn?: string;
  privacyNoticeHtmlAr?: string;
  ropaMarkdownEn?: string;
  ropaMarkdownAr?: string;
}

export interface OrgProfileRecord {
  id: string;
  name: string;
  profile: OrganizationPrivacyProfile;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const LOCAL_STORE_KEY = 'pdplcheck_local_store_v1';

interface LocalStoreState {
  seqByYear: Record<string, number>;
  dossiers: Array<{ dossier: UiPdplDossier; viewCount: number }>;
  profiles: OrgProfileRecord[];
}

function readLocalStore(): LocalStoreState {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalStoreState;
      if (parsed && Array.isArray(parsed.dossiers)) {
        return {
          seqByYear: parsed.seqByYear || {},
          dossiers: parsed.dossiers,
          profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
        };
      }
    }
  } catch {
    // ignore storage read errors
  }
  return { seqByYear: {}, dossiers: [], profiles: [] };
}

function writeLocalStore(state: LocalStoreState) {
  try {
    window.localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage write errors
  }
}

function localSlugify(text: string): string {
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'dossier';
}

export function recomputeLocalDossierMetrics(
  dossier: UiPdplDossier,
  preserveControlOverrides = false,
): UiPdplDossier {
  const refIso = dossier.updatedAtIso || new Date().toISOString();
  const safeActivities =
    dossier.activities.length > 0
      ? dossier.activities
      : PDPLCHECK_PRESETS[0].activities;
  const audit = auditPdplRopaAndTransfers(dossier.organization, safeActivities, refIso);
  const breachAssessment = evaluateBreach72hClock(dossier.breachTriage, refIso);
  const computedControls = buildDefaultPdplControls(
    dossier.organization,
    safeActivities,
    audit,
    breachAssessment,
  );

  const controls =
    preserveControlOverrides && Array.isArray(dossier.controls) && dossier.controls.length === 10
      ? computedControls.map((ctrl) => {
          const prev = dossier.controls.find((c) => c.id === ctrl.id);
          if (!prev) return ctrl;
          return {
            ...ctrl,
            status: prev.status,
            noteAr: prev.noteAr || ctrl.noteAr,
            noteEn: prev.noteEn || ctrl.noteEn,
          };
        })
      : computedControls;

  const summary = computePdplSummary(audit, controls, breachAssessment);

  return {
    ...dossier,
    activities: safeActivities,
    audit,
    breachAssessment,
    controls,
    summary,
  };
}

function enrichBundle(dossier: UiPdplDossier, viewCount = 0): DossierBundle {
  const hydrated = recomputeLocalDossierMetrics(dossier);
  return {
    dossier: hydrated,
    status: hydrated.status || (hydrated.digestHex ? 'locked' : 'draft'),
    slug: hydrated.slug || hydrated.id,
    viewCount,
    summaryEn: buildExecutiveSummaryText(hydrated, 'en'),
    summaryAr: buildExecutiveSummaryText(hydrated, 'ar'),
    privacyNoticeHtmlEn: buildBilingualPrivacyNoticeHtml(hydrated, 'en'),
    privacyNoticeHtmlAr: buildBilingualPrivacyNoticeHtml(hydrated, 'ar'),
    ropaMarkdownEn: buildPdplRopaDossierMarkdown(hydrated, 'en'),
    ropaMarkdownAr: buildPdplRopaDossierMarkdown(hydrated, 'ar'),
    publicReportUrl: `${window.location.origin}${withBase(`/r/${encodeURIComponent(hydrated.dossierCode || hydrated.slug || hydrated.id)}`)}`,
  };
}

function buildLocalStats(state: LocalStoreState): DossierStats {
  const totalDossiers = state.dossiers.length;
  const lockedDossiers = state.dossiers.filter(
    (entry) => entry.dossier.status === 'locked' || Boolean(entry.dossier.digestHex),
  ).length;
  return {
    totalDossiers,
    draftDossiers: totalDossiers - lockedDossiers,
    lockedDossiers,
    orgProfilesCount: state.profiles.length,
  };
}

function isStaticFallbackCandidate(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 404 || err.status === 405 || err.status >= 502;
  }
  return true;
}

async function requestJson<T>(urlPath: string, init?: RequestInit): Promise<T> {
  const res = await fetch(withBase(urlPath), init);
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new ApiError(`Invalid non-JSON response (${res.status})`, res.status);
    }
  }
  if (!res.ok) {
    throw new ApiError(
      String(parsed.error || `Request failed (${res.status})`),
      res.status,
      typeof parsed.code === 'string' ? parsed.code : undefined,
    );
  }
  return parsed as T;
}

export async function detectServerHealth(): Promise<{ online: boolean; version: string }> {
  try {
    const res = await requestJson<{ ok: boolean; service: string; version: string }>('/api/health');
    if (res.ok && res.service === 'pdplcheck') {
      return { online: true, version: res.version };
    }
  } catch {
    // fallback to static browser mode
  }
  return { online: false, version: '0.3.0-local' };
}

export async function fetchPresets(): Promise<readonly PdplPreset[]> {
  try {
    const res = await requestJson<{ presets: PdplPreset[] }>('/api/presets');
    return res.presets;
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    return PDPLCHECK_PRESETS;
  }
}

export async function listDossiers(): Promise<{ dossiers: DossierListRecord[]; stats: DossierStats }> {
  try {
    return await requestJson<{ dossiers: DossierListRecord[]; stats: DossierStats }>('/api/dossiers');
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    return {
      dossiers: state.dossiers.map(({ dossier, viewCount }) => ({
        id: dossier.id,
        slug: dossier.slug || dossier.id,
        dossierCode: dossier.dossierCode || null,
        status: dossier.status || (dossier.digestHex ? 'locked' : 'draft'),
        jurisdiction: dossier.organization.jurisdiction,
        viewCount,
        createdAt: dossier.sealedAtIso || dossier.updatedAtIso,
        updatedAt: dossier.updatedAtIso,
        dossier,
      })),
      stats: buildLocalStats(state),
    };
  }
}

export async function createDossierFromPresetApi(
  presetId: string,
  defaultLocale: Locale = 'ar',
): Promise<DossierBundle> {
  const now = new Date().toISOString();
  try {
    return await requestJson<DossierBundle>('/api/dossiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId, defaultLocale, referenceIso: now }),
    });
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const seed = await createDossierFromPreset(presetId, { referenceIso: now });
    const id = `pdpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const dossier = recomputeLocalDossierMetrics(
      {
        ...seed,
        id,
        slug: `${localSlugify(presetId)}-${id.slice(-4)}`,
        dossierCode: '',
        digestHex: '',
        sealedAtIso: '',
        status: 'draft',
        updatedAtIso: now,
      },
      false,
    );
    state.dossiers.unshift({ dossier, viewCount: 0 });
    writeLocalStore(state);
    return enrichBundle(dossier, 0);
  }
}

export async function getDossier(idOrSlug: string): Promise<DossierBundle> {
  try {
    return await requestJson<DossierBundle>(`/api/dossiers/${encodeURIComponent(idOrSlug)}`);
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const found = state.dossiers.find(
      (entry) =>
        entry.dossier.id === idOrSlug ||
        entry.dossier.slug === idOrSlug ||
        entry.dossier.dossierCode === idOrSlug,
    );
    if (!found) throw new ApiError('Dossier not found locally', 404);
    return enrichBundle(found.dossier, found.viewCount);
  }
}

export async function getPublicDossier(slugOrCode: string): Promise<DossierBundle> {
  try {
    return await requestJson<DossierBundle>(`/api/public/reports/${encodeURIComponent(slugOrCode)}`);
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const found = state.dossiers.find(
      (entry) =>
        entry.dossier.slug === slugOrCode ||
        entry.dossier.dossierCode === slugOrCode ||
        entry.dossier.id === slugOrCode,
    );
    if (!found) throw new ApiError('Public dossier not found', 404);
    found.viewCount += 1;
    writeLocalStore(state);
    return enrichBundle(found.dossier, found.viewCount);
  }
}

export async function saveDossierDraft(
  dossier: UiPdplDossier,
  defaultLocale: Locale = 'ar',
): Promise<DossierBundle> {
  const now = new Date().toISOString();
  const payload = {
    defaultLocale,
    referenceIso: now,
    organization: dossier.organization,
    activities: dossier.activities,
    breachTriage: dossier.breachTriage,
    controls: dossier.controls.map((c) => ({
      id: c.id,
      status: c.status,
      noteAr: c.noteAr,
      noteEn: c.noteEn,
    })),
  };
  try {
    return await requestJson<DossierBundle>(`/api/dossiers/${encodeURIComponent(dossier.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const idx = state.dossiers.findIndex((entry) => entry.dossier.id === dossier.id);
    if (idx === -1) throw new ApiError('Dossier not found locally', 404);
    const current = state.dossiers[idx];
    if (!current || current.dossier.status === 'locked') {
      throw new ApiError('Locked dossier cannot be modified', 409, 'DOSSIER_LOCKED');
    }
    const updated = recomputeLocalDossierMetrics({
      ...dossier,
      updatedAtIso: now,
    });
    state.dossiers[idx] = { dossier: updated, viewCount: current.viewCount };
    writeLocalStore(state);
    return enrichBundle(updated, current.viewCount);
  }
}

export async function duplicateDossierApi(id: string): Promise<DossierBundle> {
  try {
    return await requestJson<DossierBundle>(`/api/dossiers/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const src = state.dossiers.find((entry) => entry.dossier.id === id);
    if (!src) throw new ApiError('Dossier not found locally', 404);
    const now = new Date().toISOString();
    const newId = `pdpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const cloned = recomputeLocalDossierMetrics({
      ...src.dossier,
      id: newId,
      slug: `${localSlugify(src.dossier.slug || src.dossier.organization.organizationNameEn)}-copy-${newId.slice(-4)}`,
      dossierCode: '',
      digestHex: '',
      sealedAtIso: '',
      status: 'draft',
      organization: {
        ...src.dossier.organization,
        organizationNameAr: `${src.dossier.organization.organizationNameAr} (نسخة)`,
        organizationNameEn: `${src.dossier.organization.organizationNameEn} (Copy)`,
      },
      updatedAtIso: now,
    });
    state.dossiers.unshift({ dossier: cloned, viewCount: 0 });
    writeLocalStore(state);
    return enrichBundle(cloned, 0);
  }
}

export async function finalizeDossierApi(id: string): Promise<DossierBundle> {
  try {
    return await requestJson<DossierBundle>(`/api/dossiers/${encodeURIComponent(id)}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const idx = state.dossiers.findIndex((entry) => entry.dossier.id === id);
    if (idx === -1) throw new ApiError('Dossier not found locally', 404);
    const current = state.dossiers[idx];
    if (!current || current.dossier.status === 'locked') {
      throw new ApiError('Dossier is already finalized', 409, 'ALREADY_LOCKED');
    }
    const year = String(new Date().getUTCFullYear());
    const nextSeq = (state.seqByYear[year] || 0) + 1;
    state.seqByYear[year] = nextSeq;
    const sealed = await sealPdplDossier({
      ...current.dossier,
      sequenceNumber: nextSeq,
    });
    const locked: UiPdplDossier = {
      ...sealed,
      status: 'locked',
      slug: current.dossier.slug,
    };
    state.dossiers[idx] = { dossier: locked, viewCount: current.viewCount };
    writeLocalStore(state);
    return enrichBundle(locked, current.viewCount);
  }
}

export async function deleteDossierApi(id: string): Promise<{ deleted: boolean; id: string }> {
  try {
    return await requestJson<{ deleted: boolean; id: string }>(
      `/api/dossiers/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const target = state.dossiers.find((entry) => entry.dossier.id === id);
    if (!target) throw new ApiError('Dossier not found locally', 404);
    if (target.dossier.status === 'locked') {
      throw new ApiError('Locked dossier cannot be deleted', 409, 'DOSSIER_LOCKED');
    }
    state.dossiers = state.dossiers.filter((entry) => entry.dossier.id !== id);
    writeLocalStore(state);
    return { deleted: true, id };
  }
}

export async function auditRopaCsvApi(
  csvText: string,
  locale: Locale,
  organization?: OrganizationPrivacyProfile,
): Promise<{ report: RopaCsvAuditReport; csvExport: string }> {
  try {
    return await requestJson<{ report: RopaCsvAuditReport; csvExport: string }>(
      '/api/audit/ropa-csv',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, locale, organization }),
      },
    );
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const report = auditRopaCsv(csvText, organization);
    const csvExport = exportRopaCsv(report, locale);
    return { report, csvExport };
  }
}

export async function listProfilesApi(): Promise<OrgProfileRecord[]> {
  try {
    const res = await requestJson<{ profiles: OrgProfileRecord[] }>('/api/profiles');
    return res.profiles;
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    return readLocalStore().profiles;
  }
}

export async function createProfileApi(
  input: OrganizationPrivacyProfile,
): Promise<OrgProfileRecord> {
  try {
    const res = await requestJson<{ profile: OrgProfileRecord }>('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return res.profile;
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    const now = new Date().toISOString();
    const created: OrgProfileRecord = {
      id: `org-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: input.organizationNameEn || input.organizationNameAr,
      profile: input,
      createdAt: now,
      updatedAt: now,
    };
    state.profiles.unshift(created);
    writeLocalStore(state);
    return created;
  }
}

export async function deleteProfileApi(id: string): Promise<void> {
  try {
    await requestJson<{ deleted: boolean }>(`/api/profiles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    if (!isStaticFallbackCandidate(err)) throw err;
    const state = readLocalStore();
    state.profiles = state.profiles.filter((item) => item.id !== id);
    writeLocalStore(state);
  }
}

export function triggerTextDownload(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function updateManualControlOverride(
  dossier: UiPdplDossier,
  controlId: string,
  status: ControlStatus,
): UiPdplDossier {
  const controls = dossier.controls.map((c) =>
    c.id === controlId ? { ...c, status } : c,
  );
  const summary = computePdplSummary(
    dossier.audit,
    controls,
    dossier.breachAssessment,
  );
  return {
    ...dossier,
    controls,
    summary,
  };
}
