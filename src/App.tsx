import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  ArrowLeft,
  CheckCircle2,
  CopyPlus,
  Database,
  Eye,
  FileCheck2,
  Globe,
  HardDrive,
  Lock,
  Moon,
  PlusCircle,
  Save,
  Share2,
  Shield,
  Sun,
  Trash2,
} from 'lucide-react';
import BreachAndCsvPanel from './components/BreachAndCsvPanel.tsx';
import DossierPreviewAndPrint from './components/DossierPreviewAndPrint.tsx';
import RopaAndOrgPanel from './components/RopaAndOrgPanel.tsx';
import { buildDefaultPdplControls, computePdplSummary } from './core/breachAndNotice.ts';
import {
  PDPLCHECK_LEGAL_DISCLAIMER_AR,
  PDPLCHECK_LEGAL_DISCLAIMER_EN,
  evaluateBreach72hClock,
} from './core/pdplRules.ts';
import { PDPLCHECK_PRESETS, type PdplPreset } from './core/presets.ts';
import { auditPdplRopaAndTransfers } from './core/ropaAuditor.ts';
import type { ControlStatus, Locale } from './core/types.ts';
import {
  createDossierFromPresetApi,
  createProfileApi,
  deleteDossierApi,
  detectServerHealth,
  duplicateDossierApi,
  fetchPresets,
  finalizeDossierApi,
  getDossier,
  getPublicDossier,
  listDossiers,
  listProfilesApi,
  recomputeLocalDossierMetrics,
  saveDossierDraft,
  updateManualControlOverride,
  type DossierBundle,
  type DossierListRecord,
  type OrgProfileRecord,
  type UiPdplDossier,
} from './lib/api.ts';
import { stripBase, withBase } from './lib/basePath.ts';
import { getUiCopy, type ThemeId } from './lib/i18n.ts';

type WorkspaceTab = 'ropa' | 'breach' | 'notice';

const LOCALE_KEY = 'pdplcheck_locale_v1';
const THEME_KEY = 'pdplcheck_theme_v1';

function buildSyncInitialDossier(): UiPdplDossier {
  const preset = PDPLCHECK_PRESETS[0];
  const nowIso = '2026-11-24T10:00:00.000Z';
  const audit = auditPdplRopaAndTransfers(preset.organization, preset.activities, nowIso);
  const breachAssessment = evaluateBreach72hClock(preset.breachTriage, nowIso);
  const controls = buildDefaultPdplControls(
    preset.organization,
    preset.activities,
    audit,
    breachAssessment,
  );
  const summary = computePdplSummary(audit, controls, breachAssessment);
  return {
    id: `seed-${preset.id}`,
    dossierCode: '',
    presetId: preset.id,
    status: 'draft',
    slug: preset.id,
    organization: preset.organization,
    activities: preset.activities,
    breachTriage: preset.breachTriage,
    controls,
    audit,
    breachAssessment,
    summary,
    digestHex: '',
    sealedAtIso: '',
    updatedAtIso: nowIso,
  };
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      return window.localStorage.getItem(LOCALE_KEY) === 'en' ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  });

  const [theme, setTheme] = useState<ThemeId>(() => {
    try {
      return window.localStorage.getItem(THEME_KEY) === 'gulf-obsidian'
        ? 'gulf-obsidian'
        : 'alabaster-teal';
    } catch {
      return 'alabaster-teal';
    }
  });

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('ropa');
  const [serverOnline, setServerOnline] = useState(false);
  const [presets, setPresets] = useState<readonly PdplPreset[]>(PDPLCHECK_PRESETS);
  const [dossiers, setDossiers] = useState<DossierListRecord[]>([]);
  const [profiles, setProfiles] = useState<OrgProfileRecord[]>([]);
  const [activeBundle, setActiveBundle] = useState<DossierBundle | null>(null);
  const [draftDossier, setDraftDossier] = useState<UiPdplDossier>(() =>
    buildSyncInitialDossier(),
  );
  const [publicSlugOrCode, setPublicSlugOrCode] = useState<string | null>(() => {
    const clean = stripBase(window.location.pathname);
    const match = clean.match(/^\/r\/([^/]+)$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  });
  const [publicNotFound, setPublicNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const copy = useMemo(() => getUiCopy(locale), [locale]);
  const isAr = locale === 'ar';

  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = locale === 'ar' ? 'rtl' : 'ltr';
    html.setAttribute('data-theme', theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'gulf-obsidian' ? '#0A0F14' : '#FAF9F6');
    }
    try {
      window.localStorage.setItem(LOCALE_KEY, locale);
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [locale, theme]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const refreshListsAndEnsureDossier = useCallback(
    async (preferredId?: string) => {
      const [listRes, profList] = await Promise.all([listDossiers(), listProfilesApi()]);
      setDossiers(listRes.dossiers);
      setProfiles(profList);

      const targetId = preferredId || listRes.dossiers[0]?.id;
      if (targetId) {
        const bundle = await getDossier(targetId);
        setActiveBundle(bundle);
        setDraftDossier(recomputeLocalDossierMetrics(bundle.dossier));
      } else {
        const created = await createDossierFromPresetApi('gcc-saas-compliant', locale);
        const reloaded = await listDossiers();
        setDossiers(reloaded.dossiers);
        setActiveBundle(created);
        setDraftDossier(recomputeLocalDossierMetrics(created.dossier));
      }
    },
    [locale],
  );

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      const [health, loadedPresets] = await Promise.all([detectServerHealth(), fetchPresets()]);
      if (cancelled) return;
      setServerOnline(health.online);
      setPresets(loadedPresets);

      if (publicSlugOrCode) {
        try {
          const pubBundle = await getPublicDossier(publicSlugOrCode);
          if (!cancelled) {
            setActiveBundle(pubBundle);
            setDraftDossier(recomputeLocalDossierMetrics(pubBundle.dossier));
            setPublicNotFound(false);
          }
        } catch {
          if (!cancelled) setPublicNotFound(true);
        }
        return;
      }

      await refreshListsAndEnsureDossier();
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [publicSlugOrCode, refreshListsAndEnsureDossier]);

  const isLocked =
    activeBundle?.status === 'locked' ||
    draftDossier.status === 'locked' ||
    Boolean(draftDossier.digestHex);

  async function handleSelectDossier(id: string) {
    const bundle = await getDossier(id);
    setActiveBundle(bundle);
    setDraftDossier(recomputeLocalDossierMetrics(bundle.dossier));
  }

  async function handleCreatePreset(presetId: string) {
    const bundle = await createDossierFromPresetApi(presetId, locale);
    await refreshListsAndEnsureDossier(bundle.dossier.id);
    setActiveTab('ropa');
  }

  async function handleSaveDraft() {
    if (isLocked) return;
    setSaving(true);
    try {
      const updated = await saveDossierDraft(draftDossier, locale);
      setActiveBundle(updated);
      setDraftDossier(recomputeLocalDossierMetrics(updated.dossier));
      const listRes = await listDossiers();
      setDossiers(listRes.dossiers);
      showToast(copy.toastSaved);
    } finally {
      setSaving(false);
    }
  }

  async function handleSealDossier() {
    if (isLocked) return;
    setSealing(true);
    try {
      await saveDossierDraft(draftDossier, locale);
      const sealed = await finalizeDossierApi(draftDossier.id);
      setActiveBundle(sealed);
      setDraftDossier(recomputeLocalDossierMetrics(sealed.dossier));
      const listRes = await listDossiers();
      setDossiers(listRes.dossiers);
      showToast(copy.toastSealed);
    } finally {
      setSealing(false);
    }
  }

  async function handleDuplicateDossier() {
    const cloned = await duplicateDossierApi(draftDossier.id);
    await refreshListsAndEnsureDossier(cloned.dossier.id);
    showToast(copy.toastDuplicated);
  }

  async function handleDeleteDraft() {
    if (isLocked) return;
    await deleteDossierApi(draftDossier.id);
    await refreshListsAndEnsureDossier();
    showToast(copy.toastDeleted);
  }

  async function handleSaveProfile() {
    await createProfileApi(draftDossier.organization);
    const profs = await listProfilesApi();
    setProfiles(profs);
    showToast(copy.toastProfileSaved);
  }

  function handleApplyProfile(profileId: string) {
    const found = profiles.find((p) => p.id === profileId);
    if (!found || isLocked) return;
    setDraftDossier((prev) =>
      recomputeLocalDossierMetrics({
        ...prev,
        organization: { ...found.profile },
      }),
    );
  }

  async function handleCopyShareLink() {
    const slugOrCode =
      draftDossier.dossierCode || activeBundle?.slug || draftDossier.slug || draftDossier.id;
    const shareUrl = `${window.location.origin}${withBase(`/r/${encodeURIComponent(slugOrCode)}`)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(copy.toastCopied);
    } catch {
      handleOpenShareView();
    }
  }

  function handleOpenShareView() {
    const slugOrCode =
      draftDossier.dossierCode || activeBundle?.slug || draftDossier.slug || draftDossier.id;
    window.history.pushState({}, '', withBase(`/r/${encodeURIComponent(slugOrCode)}`));
    setPublicSlugOrCode(slugOrCode);
  }

  function exitPublicView() {
    window.history.pushState({}, '', withBase('/'));
    setPublicSlugOrCode(null);
    setPublicNotFound(false);
    refreshListsAndEnsureDossier();
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Top Studio Header */}
      <header className="no-print border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] shadow-sm">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight sm:text-lg">
                {copy.brandTitle}
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">{copy.brandSubtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1 text-xs font-semibold text-[var(--accent-primary)]"
              data-testid="storage-mode-badge"
            >
              {serverOnline ? (
                <Database className="h-3.5 w-3.5" />
              ) : (
                <HardDrive className="h-3.5 w-3.5" />
              )}
              <span>{serverOnline ? copy.storageServer : copy.storageBrowser}</span>
            </span>

            <button
              type="button"
              data-testid="toggle-theme-btn"
              onClick={() =>
                setTheme((t) => (t === 'alabaster-teal' ? 'gulf-obsidian' : 'alabaster-teal'))
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-bold transition hover:bg-[var(--bg-elevated)]"
            >
              {theme === 'alabaster-teal' ? (
                <Moon className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              ) : (
                <Sun className="h-3.5 w-3.5 text-[var(--accent-gold)]" />
              )}
              <span>{theme === 'alabaster-teal' ? copy.themeDark : copy.themeLight}</span>
            </button>

            <button
              type="button"
              data-testid="toggle-locale-btn"
              onClick={() => setLocale((l) => (l === 'ar' ? 'en' : 'ar'))}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-bold text-[var(--accent-primary-fg)] transition hover:bg-[var(--accent-primary-hover)]"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{copy.langSwitch}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        {/* Mandatory Non-Legal-Counsel Disclaimer Banner */}
        <div
          data-testid="mandatory-legal-disclaimer"
          className="mb-5 rounded-2xl border border-[var(--accent-gold)] bg-[var(--accent-gold-soft)] px-4 py-3 text-xs leading-relaxed text-[var(--text-primary)]"
        >
          <strong className="text-[var(--accent-gold)]">{copy.disclaimerLabel}:</strong>{' '}
          {(isAr ? PDPLCHECK_LEGAL_DISCLAIMER_AR : PDPLCHECK_LEGAL_DISCLAIMER_EN).replace(
            /^[^:]+:\s*/,
            '',
          )}
        </div>

        {toast && (
          <div className="no-print mb-4 flex items-center gap-2 rounded-xl border border-[var(--accent-emerald)] bg-[var(--accent-emerald-soft)] px-4 py-2.5 text-xs font-bold text-[var(--accent-emerald)]">
            <CheckCircle2 className="h-4 w-4" />
            <span>{toast}</span>
          </div>
        )}

        {publicSlugOrCode ? (
          <div className="space-y-4">
            <div className="no-print pdpl-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-xs font-bold text-[var(--accent-primary)]">
                  {copy.publicViewBadge}
                </span>
                {activeBundle && (
                  <span
                    data-testid="public-view-count"
                    className="pdpl-mono inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {copy.viewsLabel}: {activeBundle.viewCount}
                  </span>
                )}
              </div>
              <button
                type="button"
                data-testid="back-to-studio-btn"
                onClick={exitPublicView}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3.5 py-2 text-xs font-bold"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{copy.btnBackToStudio}</span>
              </button>
            </div>

            {publicNotFound ? (
              <div className="pdpl-card rounded-2xl p-8 text-center">
                <h2 className="text-lg font-extrabold">{copy.publicNotFoundTitle}</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {copy.publicNotFoundHint}
                </p>
              </div>
            ) : (
              <DossierPreviewAndPrint
                locale={locale}
                copy={copy}
                locked
                readOnlyPublic
                dossier={draftDossier}
                onChangeControlStatus={() => {}}
                onCopySuccess={() => showToast(copy.toastCopied)}
              />
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Presets Quick-Launch + Active Dossier Management Ribbon */}
            <section className="no-print pdpl-card rounded-2xl p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wide text-[var(--text-secondary)]">
                  {copy.presetsHeading}
                </span>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      data-testid={`preset-btn-${p.id}`}
                      onClick={() => handleCreatePreset(p.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-bold transition hover:border-[var(--accent-primary)] hover:bg-[var(--bg-elevated)]"
                    >
                      <PlusCircle className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                      <span>{isAr ? p.nameAr : p.nameEn}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)]">
                    {copy.dossierSelectLabel}:
                  </label>
                  <select
                    className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-bold"
                    value={draftDossier.id}
                    onChange={(e) => handleSelectDossier(e.target.value)}
                  >
                    {dossiers.length === 0 ? (
                      <option value={draftDossier.id}>
                        {isAr
                          ? draftDossier.organization.organizationNameAr
                          : draftDossier.organization.organizationNameEn}
                      </option>
                    ) : (
                      dossiers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.dossierCode ? `[${d.dossierCode}] ` : ''}
                          {isAr
                            ? d.dossier.organization.organizationNameAr
                            : d.dossier.organization.organizationNameEn}
                        </option>
                      ))
                    )}
                  </select>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                      isLocked
                        ? 'bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]'
                        : 'bg-[var(--accent-amber-soft)] text-[var(--accent-amber)]'
                    }`}
                  >
                    {isLocked && <Lock className="h-3 w-3" />}
                    <span>{isLocked ? copy.lockedBadge : copy.draftBadge}</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isLocked && (
                    <>
                      <button
                        type="button"
                        data-testid="save-draft-btn"
                        disabled={saving}
                        onClick={handleSaveDraft}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-bold text-[var(--accent-primary)] transition hover:opacity-90"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>{copy.btnSaveDraft}</span>
                      </button>
                      <button
                        type="button"
                        data-testid="finalize-dossier-btn"
                        disabled={sealing}
                        onClick={handleSealDossier}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-bold text-[var(--accent-primary-fg)] transition hover:bg-[var(--accent-primary-hover)]"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>{copy.btnSealDossier}</span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    data-testid="open-public-brief-btn"
                    onClick={handleOpenShareView}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3 py-2 text-xs font-bold"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>{copy.publicViewBadge}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDuplicateDossier}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3 py-2 text-xs font-bold"
                  >
                    <CopyPlus className="h-3.5 w-3.5" />
                    <span>{copy.btnDuplicate}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3 py-2 text-xs font-bold"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>{copy.btnShareReport}</span>
                  </button>
                  {!isLocked && dossiers.length > 1 && (
                    <button
                      type="button"
                      onClick={handleDeleteDraft}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent-crimson)] bg-[var(--accent-crimson-soft)] px-3 py-2 text-xs font-bold text-[var(--accent-crimson)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{copy.btnDelete}</span>
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Primary Workspace Navigation Tabs */}
            <nav className="no-print flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="tab-ropa"
                onClick={() => setActiveTab('ropa')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
                  activeTab === 'ropa'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] shadow-sm'
                    : 'pdpl-card text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Shield className="h-4 w-4" />
                <span>{copy.tabRopa}</span>
              </button>
              <button
                type="button"
                data-testid="tab-breach"
                onClick={() => setActiveTab('breach')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
                  activeTab === 'breach'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] shadow-sm'
                    : 'pdpl-card text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <AlarmClock className="h-4 w-4" />
                <span>{copy.tabBreach}</span>
              </button>
              <button
                type="button"
                data-testid="tab-notice"
                onClick={() => setActiveTab('notice')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
                  activeTab === 'notice'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] shadow-sm'
                    : 'pdpl-card text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <FileCheck2 className="h-4 w-4" />
                <span>{copy.tabNotice}</span>
              </button>
            </nav>

            {/* Active Workspace Tab View */}
            {activeTab === 'ropa' && (
              <RopaAndOrgPanel
                locale={locale}
                copy={copy}
                locked={isLocked}
                organization={draftDossier.organization}
                activities={draftDossier.activities}
                issues={draftDossier.audit.issues}
                profiles={profiles}
                onChangeOrganization={(organization) =>
                  setDraftDossier((prev) =>
                    recomputeLocalDossierMetrics({ ...prev, organization }),
                  )
                }
                onChangeActivities={(activities) =>
                  setDraftDossier((prev) =>
                    recomputeLocalDossierMetrics({ ...prev, activities }),
                  )
                }
                onSaveProfile={handleSaveProfile}
                onApplyProfile={handleApplyProfile}
              />
            )}

            {activeTab === 'breach' && (
              <BreachAndCsvPanel
                locale={locale}
                copy={copy}
                locked={isLocked}
                organization={draftDossier.organization}
                breachTriage={draftDossier.breachTriage}
                breachAssessment={draftDossier.breachAssessment}
                onChangeBreachTriage={(breachTriage) =>
                  setDraftDossier((prev) =>
                    recomputeLocalDossierMetrics({ ...prev, breachTriage }),
                  )
                }
              />
            )}

            {activeTab === 'notice' && (
              <DossierPreviewAndPrint
                locale={locale}
                copy={copy}
                locked={isLocked}
                dossier={draftDossier}
                onChangeControlStatus={(controlId: string, status: ControlStatus) =>
                  setDraftDossier((prev) => updateManualControlOverride(prev, controlId, status))
                }
                onCopySuccess={() => showToast(copy.toastCopied)}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
