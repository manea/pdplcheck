import { buildDefaultPdplControls, computePdplSummary } from './breachAndNotice.ts';
import { sealPdplDossier } from './dossierDigest.ts';
import { evaluateBreach72hClock } from './pdplRules.ts';
import { auditPdplRopaAndTransfers } from './ropaAuditor.ts';
import type {
  BreachTriageInput,
  OrganizationPrivacyProfile,
  PdplDossier,
  RopaActivityItem,
} from './types.ts';

export interface PdplPreset {
  id: string;
  nameAr: string;
  nameEn: string;
  summaryAr: string;
  summaryEn: string;
  organization: OrganizationPrivacyProfile;
  activities: RopaActivityItem[];
  breachTriage: BreachTriageInput;
  relativeIncidentAgeHours?: number;
}

export const PDPLCHECK_PRESETS: PdplPreset[] = [
  {
    id: 'gcc-saas-compliant',
    nameAr: 'منصة SaaS خليجية ممتثلة بالكامل',
    nameEn: 'GCC B2B SaaS (Dual PDPL Compliant)',
    summaryAr: 'إشعاران عربي/إنجليزي، ضمانات SCCs للاستضافة، وتسويق بموافقة صريحة منفصلة.',
    summaryEn: 'Bilingual privacy notices, SCC-backed hosting safeguards, and opt-in marketing.',
    organization: {
      organizationNameAr: 'شركة أفق السحابية التقنية ذ.م.م',
      organizationNameEn: 'Ofoq Cloud Technologies LLC',
      jurisdiction: 'dual_gcc',
      contactEmail: 'privacy@ofoqcloud.ae',
      privacyNoticeArUrl: 'https://ofoqcloud.ae/ar/privacy',
      privacyNoticeEnUrl: 'https://ofoqcloud.ae/en/privacy',
      dpoAppointed: true,
      dsarSlaDays: 15,
    },
    activities: [
      {
        id: 'ROPA-01',
        activityNameAr: 'حسابات العملاء والفوترة السحابية',
        activityNameEn: 'Tenant Onboarding & Subscription Billing',
        purpose: 'Provision workspaces, authenticate users, and issue tax invoices.',
        dataCategories: ['identity', 'work_email', 'tax_invoice_id'],
        containsSensitiveData: false,
        isMarketingActivity: false,
        explicitMarketingOptIn: false,
        lawfulBasis: 'contract',
        hostingRegion: 'uae_local',
        transferSafeguard: 'scc_contract',
        retentionDays: 1825,
        processorName: 'UAE Region Cloud HSM',
      },
      {
        id: 'ROPA-02',
        activityNameAr: 'النشرات البريدية وتحديثات المنتجات',
        activityNameEn: 'Opt-In Product & Executive Briefings',
        purpose: 'Send product release notes exclusively to explicitly opted-in subscribers.',
        dataCategories: ['email', 'language_preference'],
        containsSensitiveData: false,
        isMarketingActivity: true,
        explicitMarketingOptIn: true,
        lawfulBasis: 'explicit_consent',
        hostingRegion: 'eu_adequate',
        transferSafeguard: 'scc_contract',
        retentionDays: 730,
        processorName: 'EU Mail Relay (SCC Addendum)',
      },
      {
        id: 'ROPA-03',
        activityNameAr: 'السجلات الأمنية ومنع الاحتيال',
        activityNameEn: 'Security Audit Telemetry & Abuse Prevention',
        purpose: 'Detect unauthorized logins and maintain access audit trails.',
        dataCategories: ['ip_address', 'session_audit_log'],
        containsSensitiveData: false,
        isMarketingActivity: false,
        explicitMarketingOptIn: false,
        lawfulBasis: 'legal_obligation',
        hostingRegion: 'ksa_local',
        transferSafeguard: 'scc_contract',
        retentionDays: 365,
        processorName: 'KSA Tier-1 SIEM Vault',
      },
    ],
    breachTriage: {
      activeIncident: false,
      incidentTitleAr: '',
      incidentTitleEn: '',
      discoveredAtIso: '',
      reportedToRegulator: false,
      reportedAtIso: '',
      riskSeverity: 'none',
      affectedSubjectsCount: 0,
      likelyDataSubjectsNotified: false,
    },
  },
  {
    id: 'ksa-ecommerce-transfer-gaps',
    nameAr: 'متجر إلكتروني سعودي — فجوات نقل وتسويق وإشعار عربي',
    nameEn: 'KSA E-Commerce App (Transfer & Arabic Notice Gaps)',
    summaryAr: 'غياب الإشعار العربي + استضافة أمريكية بدون SCCs + رسائل تسويق بدون Opt-in.',
    summaryEn: 'Missing Arabic privacy notice, US hosting without safeguards, and unconsented marketing.',
    organization: {
      organizationNameAr: 'متجر نجد الرقمي للتجارة',
      organizationNameEn: 'Najd Digital Commerce Co.',
      jurisdiction: 'ksa_pdpl',
      contactEmail: 'invalid-dsr-contact',
      privacyNoticeArUrl: '',
      privacyNoticeEnUrl: 'https://najdstore.example/privacy',
      dpoAppointed: false,
      dsarSlaDays: 45,
    },
    activities: [
      {
        id: 'ROPA-11',
        activityNameAr: 'تحليلات المتصفح والتتبع السلوكي',
        activityNameEn: 'Cross-App Behavioral Analytics',
        purpose: 'Profile shopper clickstreams on US cloud warehouses.',
        dataCategories: ['device_id', 'purchase_history', 'ip_address'],
        containsSensitiveData: false,
        isMarketingActivity: true,
        explicitMarketingOptIn: false,
        lawfulBasis: 'legitimate_interest',
        hostingRegion: 'us_cloud',
        transferSafeguard: 'none',
        retentionDays: 1095,
        processorName: 'US Cloud Analytics Warehouse',
      },
      {
        id: 'ROPA-12',
        activityNameAr: 'التحقق البيومتري للمدفوعات المرتفعة',
        activityNameEn: 'Biometric KYC Verification for High-Value Orders',
        purpose: 'Verify national identity document and selfie scan.',
        dataCategories: ['biometric_face_template', 'national_id'],
        containsSensitiveData: true,
        isMarketingActivity: false,
        explicitMarketingOptIn: false,
        lawfulBasis: 'legitimate_interest',
        hostingRegion: 'other_non_adequate',
        transferSafeguard: 'none',
        retentionDays: 0,
        processorName: '',
      },
    ],
    breachTriage: {
      activeIncident: false,
      incidentTitleAr: '',
      incidentTitleEn: '',
      discoveredAtIso: '',
      reportedToRegulator: false,
      reportedAtIso: '',
      riskSeverity: 'none',
      affectedSubjectsCount: 0,
      likelyDataSubjectsNotified: false,
    },
  },
  {
    id: 'breach-72h-triage-drill',
    nameAr: 'تمرين استجابة حادثة الـ 72 ساعة (سدايا + الإمارات)',
    nameEn: 'Active 72-Hour Breach Notification Drill (SDAIA + UAE)',
    summaryAr: 'حادثة تسريب نشطة منذ 38 ساعة قيد التقييم قبل إغلاق نافذة سدايا البالغة 72 ساعة.',
    summaryEn: 'Active breach discovered 38 hours ago requiring regulator & subject notification.',
    relativeIncidentAgeHours: 38,
    organization: {
      organizationNameAr: 'منصة درهم وريال للتقنية المالية',
      organizationNameEn: 'Dirham & Riyal FinTech Platform',
      jurisdiction: 'dual_gcc',
      contactEmail: 'dpo@dr-fintech.ae',
      privacyNoticeArUrl: 'https://dr-fintech.ae/ar/privacy',
      privacyNoticeEnUrl: 'https://dr-fintech.ae/en/privacy',
      dpoAppointed: true,
      dsarSlaDays: 20,
    },
    activities: [
      {
        id: 'ROPA-21',
        activityNameAr: 'حفظ بيانات عملاء المحفظة الرقمية',
        activityNameEn: 'Wallet Account Ledger & Customer KYC',
        purpose: 'Operate regulated wallet onboarding and settlement records.',
        dataCategories: ['identity', 'iban_masked', 'kyc_status'],
        containsSensitiveData: true,
        isMarketingActivity: false,
        explicitMarketingOptIn: false,
        lawfulBasis: 'legal_obligation',
        hostingRegion: 'uae_local',
        transferSafeguard: 'scc_contract',
        retentionDays: 1825,
        processorName: 'GCC Regulated Cloud Cluster',
      },
    ],
    breachTriage: {
      activeIncident: true,
      incidentTitleAr: 'وصول غير مصرح به إلى أرشيف تذاكر الدعم الفني',
      incidentTitleEn: 'Unauthorized Read Access to Support Attachment Bucket',
      discoveredAtIso: '2026-11-22T20:00:00.000Z',
      reportedToRegulator: false,
      reportedAtIso: '',
      riskSeverity: 'high_harm',
      affectedSubjectsCount: 1420,
      likelyDataSubjectsNotified: false,
    },
  },
];

export async function createDossierFromPreset(
  presetId: string,
  options?: {
    sequenceNumber?: number;
    referenceIso?: string;
    id?: string;
  },
): Promise<PdplDossier> {
  const preset = PDPLCHECK_PRESETS.find((p) => p.id === presetId) ?? PDPLCHECK_PRESETS[0];
  const refIso = options?.referenceIso ?? '2026-11-24T10:00:00.000Z';

  const breachTriage: BreachTriageInput = preset.relativeIncidentAgeHours
    ? {
        ...preset.breachTriage,
        discoveredAtIso: new Date(
          Date.parse(refIso) - preset.relativeIncidentAgeHours * 3600 * 1000,
        ).toISOString(),
      }
    : { ...preset.breachTriage };

  const audit = auditPdplRopaAndTransfers(preset.organization, preset.activities, refIso);
  const breachAssessment = evaluateBreach72hClock(breachTriage, refIso);
  const controls = buildDefaultPdplControls(
    preset.organization,
    preset.activities,
    audit,
    breachAssessment,
  );
  const summary = computePdplSummary(audit, controls, breachAssessment);

  return sealPdplDossier({
    id: options?.id ?? `dossier-${preset.id}`,
    presetId: preset.id,
    organization: preset.organization,
    activities: preset.activities,
    breachTriage,
    controls,
    audit,
    breachAssessment,
    summary,
    sequenceNumber: options?.sequenceNumber ?? 1,
    sealedAtIso: refIso,
  });
}
