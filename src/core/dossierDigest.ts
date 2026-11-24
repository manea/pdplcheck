import type { Locale, PdplDossier } from './types.ts';

export type UnsealedPdplDossier = Omit<
  PdplDossier,
  'digestHex' | 'sealedAtIso' | 'updatedAtIso'
>;

function sortStrings(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function formatDossierCode(sequenceNumber: number, dateIso: string): string {
  const parsed = new Date(dateIso);
  const year = Number.isFinite(parsed.getTime()) ? parsed.getUTCFullYear() : 2026;
  const normalizedSeq = Math.max(1, Math.floor(sequenceNumber));
  return `PDPL-${year}-${String(normalizedSeq).padStart(4, '0')}`;
}

export function buildDossierCanonicalText(dossier: UnsealedPdplDossier): string {
  const canonicalObject = {
    id: dossier.id,
    dossierCode: dossier.dossierCode,
    presetId: dossier.presetId,
    organization: {
      organizationNameAr: dossier.organization.organizationNameAr,
      organizationNameEn: dossier.organization.organizationNameEn,
      jurisdiction: dossier.organization.jurisdiction,
      contactEmail: dossier.organization.contactEmail,
      privacyNoticeArUrl: dossier.organization.privacyNoticeArUrl,
      privacyNoticeEnUrl: dossier.organization.privacyNoticeEnUrl,
      dpoAppointed: dossier.organization.dpoAppointed,
      dsarSlaDays: dossier.organization.dsarSlaDays,
    },
    activities: [...dossier.activities]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((item) => ({
        id: item.id,
        activityNameAr: item.activityNameAr,
        activityNameEn: item.activityNameEn,
        purpose: item.purpose,
        dataCategories: sortStrings(item.dataCategories),
        containsSensitiveData: item.containsSensitiveData,
        isMarketingActivity: item.isMarketingActivity,
        explicitMarketingOptIn: item.explicitMarketingOptIn,
        lawfulBasis: item.lawfulBasis,
        hostingRegion: item.hostingRegion,
        transferSafeguard: item.transferSafeguard,
        retentionDays: item.retentionDays,
        processorName: item.processorName,
      })),
    breachTriage: {
      activeIncident: dossier.breachTriage.activeIncident,
      incidentTitleAr: dossier.breachTriage.incidentTitleAr,
      incidentTitleEn: dossier.breachTriage.incidentTitleEn,
      discoveredAtIso: dossier.breachTriage.discoveredAtIso,
      reportedToRegulator: dossier.breachTriage.reportedToRegulator,
      reportedAtIso: dossier.breachTriage.reportedAtIso,
      riskSeverity: dossier.breachTriage.riskSeverity,
      affectedSubjectsCount: dossier.breachTriage.affectedSubjectsCount,
      likelyDataSubjectsNotified: dossier.breachTriage.likelyDataSubjectsNotified,
    },
    summary: {
      overallScore: dossier.summary.overallScore,
      ropaScore: dossier.summary.ropaScore,
      crossBorderScore: dossier.summary.crossBorderScore,
      breachReadinessScore: dossier.summary.breachReadinessScore,
      readinessTier: dossier.summary.readinessTier,
    },
  };

  return JSON.stringify(canonicalObject);
}

export async function computeDossierDigestHex(canonicalText: string): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalText);
  const digestBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digestBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function sealPdplDossier(
  input: Omit<UnsealedPdplDossier, 'dossierCode'> & {
    dossierCode?: string;
    sequenceNumber?: number;
    sealedAtIso?: string;
  },
): Promise<PdplDossier> {
  const sealedAtIso = input.sealedAtIso ?? new Date().toISOString();
  const dossierCode =
    input.dossierCode?.trim() ||
    formatDossierCode(input.sequenceNumber ?? 1, sealedAtIso);

  const unsealed: UnsealedPdplDossier = {
    id: input.id,
    dossierCode,
    presetId: input.presetId,
    organization: input.organization,
    activities: input.activities,
    breachTriage: input.breachTriage,
    controls: input.controls,
    audit: input.audit,
    breachAssessment: input.breachAssessment,
    summary: input.summary,
  };

  const canonical = buildDossierCanonicalText(unsealed);
  const digestHex = await computeDossierDigestHex(canonical);

  return {
    ...unsealed,
    digestHex,
    sealedAtIso,
    updatedAtIso: sealedAtIso,
  };
}

export async function verifyDossierIntegrity(dossier: PdplDossier): Promise<{
  valid: boolean;
  expectedHex: string;
  actualHex: string;
}> {
  const expectedHex = await computeDossierDigestHex(buildDossierCanonicalText(dossier));
  return {
    valid: expectedHex === dossier.digestHex,
    expectedHex,
    actualHex: dossier.digestHex,
  };
}

export function buildExecutiveSummaryText(
  dossier: PdplDossier,
  locale: Locale = 'ar',
): string {
  if (locale === 'ar') {
    return `${dossier.organization.organizationNameAr} (${dossier.dossierCode}): الجاهزية ${dossier.summary.overallScore}/100 [${dossier.summary.readinessTier}] — الأنشطة السليمة ${dossier.audit.compliantActivities}/${dossier.audit.totalActivities}، العوائق ${dossier.summary.blockersCount}، ساعة الـ 72: ${dossier.breachAssessment.state} (المتبقي ${dossier.breachAssessment.remainingHours} ساعة).`;
  }
  return `${dossier.organization.organizationNameEn} (${dossier.dossierCode}): Overall ${dossier.summary.overallScore}/100 [${dossier.summary.readinessTier}] — Compliant RoPA ${dossier.audit.compliantActivities}/${dossier.audit.totalActivities}, Blockers ${dossier.summary.blockersCount}, 72h Clock: ${dossier.breachAssessment.state} (${dossier.breachAssessment.remainingHours}h remaining).`;
}
