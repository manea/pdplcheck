import type {
  BreachTriageInput,
  BreachWindowAssessment,
  HostingRegion,
  JurisdictionScope,
  LawfulBasis,
  SafeguardMechanism,
} from './types.ts';

export const UAE_PDPL_CODE = 'UAE-PDPL-45-2021' as const;
export const KSA_PDPL_CODE = 'KSA-SDAIA-PDPL' as const;
export const KSA_BREACH_WINDOW_HOURS = 72;

export const PDPLCHECK_LEGAL_DISCLAIMER_AR =
  'تنبيه النطاق القانوني الإلزامي: أداة «PDPLCheck» بيئة هندسية لتجهيز سجلات أنشطة المعالجة (RoPA)، وفحص مخاطر نقل البيانات عبر الحدود، ومتابعة نافذة الـ 72 ساعة للحوادث، وإعداد مسودات إشعارات الخصوصية وفق نظامي الإمارات (المرسوم بقانون اتحادي 45/2021) والسعودية (SDAIA PDPL). هذه الأداة ليست استشارة قانونية معتمدة ولا بديلاً عن مسؤول حماية بيانات معتمد (DPO)، ولا تمثّل «سدايا» أو «مكتب الإمارات للبيانات»، ولا تُرسل أي بلاغات أو طلبات تصاريح رسمية.';

export const PDPLCHECK_LEGAL_DISCLAIMER_EN =
  'Mandatory Legal Disclaimer: PDPLCheck is an engineering governance studio for RoPA mapping, cross-border transfer risk screening, 72-hour breach triage tracking, and bilingual privacy notice drafting under UAE PDPL (Federal Decree-Law No. 45 of 2021) and KSA SDAIA PDPL. It is NOT legal counsel or an accredited DPO, does NOT represent SDAIA or the UAE Data Office, and does NOT submit live regulatory breach notifications or cross-border transfer permits.';

export interface LawfulBasisMeta {
  code: LawfulBasis;
  labelAr: string;
  labelEn: string;
  allowsSensitiveData: boolean;
}

export const LAWFUL_BASIS_META: Record<LawfulBasis, LawfulBasisMeta> = {
  explicit_consent: {
    code: 'explicit_consent',
    labelAr: 'موافقة صريحة ومستقلة',
    labelEn: 'Explicit Consent',
    allowsSensitiveData: true,
  },
  contract: {
    code: 'contract',
    labelAr: 'تنفيذ عقد مع صاحب البيانات',
    labelEn: 'Performance of a Contract',
    allowsSensitiveData: false,
  },
  legal_obligation: {
    code: 'legal_obligation',
    labelAr: 'التزام نظامي / قانوني',
    labelEn: 'Legal / Statutory Obligation',
    allowsSensitiveData: true,
  },
  vital_interest: {
    code: 'vital_interest',
    labelAr: 'حماية مصلحة حيوية',
    labelEn: 'Vital Interest Protection',
    allowsSensitiveData: true,
  },
  legitimate_interest: {
    code: 'legitimate_interest',
    labelAr: 'مصلحة مشروعة مبررة',
    labelEn: 'Legitimate Interest',
    allowsSensitiveData: false,
  },
};

export interface HostingRegionMeta {
  code: HostingRegion;
  labelAr: string;
  labelEn: string;
  isInsideGcc: boolean;
  isCrossBorderFromKsa: boolean;
  isCrossBorderFromUae: boolean;
}

export const HOSTING_REGION_META: Record<HostingRegion, HostingRegionMeta> = {
  uae_local: {
    code: 'uae_local',
    labelAr: 'استضافة محلية داخل الإمارات',
    labelEn: 'Local UAE Hosting',
    isInsideGcc: true,
    isCrossBorderFromKsa: true,
    isCrossBorderFromUae: false,
  },
  ksa_local: {
    code: 'ksa_local',
    labelAr: 'استضافة محلية داخل السعودية',
    labelEn: 'Local KSA Hosting',
    isInsideGcc: true,
    isCrossBorderFromKsa: false,
    isCrossBorderFromUae: true,
  },
  eu_adequate: {
    code: 'eu_adequate',
    labelAr: 'الاتحاد الأوروبي / دولة كافية حماية',
    labelEn: 'EU / Adequate Jurisdiction',
    isInsideGcc: false,
    isCrossBorderFromKsa: true,
    isCrossBorderFromUae: true,
  },
  us_cloud: {
    code: 'us_cloud',
    labelAr: 'سحابة أمريكية / خوادم خارج الخليج',
    labelEn: 'US Cloud / Extra-GCC',
    isInsideGcc: false,
    isCrossBorderFromKsa: true,
    isCrossBorderFromUae: true,
  },
  other_non_adequate: {
    code: 'other_non_adequate',
    labelAr: 'منطقة خارجية بدون كفاية حماية تلقائية',
    labelEn: 'Other Non-Adequate Jurisdiction',
    isInsideGcc: false,
    isCrossBorderFromKsa: true,
    isCrossBorderFromUae: true,
  },
};

export interface SafeguardMeta {
  code: SafeguardMechanism;
  labelAr: string;
  labelEn: string;
  sufficientForCrossBorder: boolean;
}

export const SAFEGUARD_META: Record<SafeguardMechanism, SafeguardMeta> = {
  local_residency: {
    code: 'local_residency',
    labelAr: 'توطين محلي للبيانات داخل الدولة',
    labelEn: 'Local In-Country Data Residency',
    sufficientForCrossBorder: false,
  },
  scc_contract: {
    code: 'scc_contract',
    labelAr: 'بنود تعاقدية قياسية معتمدة (SCCs)',
    labelEn: 'Standard Contractual Clauses (SCCs)',
    sufficientForCrossBorder: true,
  },
  explicit_consent_transfer: {
    code: 'explicit_consent_transfer',
    labelAr: 'موافقة صريحة مستنيرة على النقل الخارجي',
    labelEn: 'Explicit Informed Transfer Consent',
    sufficientForCrossBorder: true,
  },
  none: {
    code: 'none',
    labelAr: 'بدون ضمانات نقل موثقة',
    labelEn: 'No Transfer Safeguard',
    sufficientForCrossBorder: false,
  },
};

export function isValidContactEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

export function isValidLawfulBasis(value: string): value is LawfulBasis {
  return Object.prototype.hasOwnProperty.call(LAWFUL_BASIS_META, value);
}

export function isValidHostingRegion(value: string): value is HostingRegion {
  return Object.prototype.hasOwnProperty.call(HOSTING_REGION_META, value);
}

export function isValidSafeguard(value: string): value is SafeguardMechanism {
  return Object.prototype.hasOwnProperty.call(SAFEGUARD_META, value);
}

export function isValidJurisdiction(value: string): value is JurisdictionScope {
  return value === 'uae_pdpl' || value === 'ksa_pdpl' || value === 'dual_gcc';
}

export function isCrossBorderForJurisdiction(
  jurisdiction: JurisdictionScope,
  region: HostingRegion,
): boolean {
  const meta = HOSTING_REGION_META[region];
  if (jurisdiction === 'ksa_pdpl') {
    return meta.isCrossBorderFromKsa;
  }
  if (jurisdiction === 'uae_pdpl') {
    return meta.isCrossBorderFromUae;
  }
  return meta.isCrossBorderFromKsa || meta.isCrossBorderFromUae;
}

function roundTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function evaluateBreach72hClock(
  input: BreachTriageInput,
  referenceIso?: string,
): BreachWindowAssessment {
  if (!input.activeIncident) {
    return {
      state: 'no_incident',
      elapsedHours: 0,
      remainingHours: KSA_BREACH_WINDOW_HOURS,
      windowHours: KSA_BREACH_WINDOW_HOURS,
      overdue: false,
      sdaiaDeadlineIso: null,
      requiresSdaiaNotification: false,
      requiresUaeDataOfficeNotification: false,
      requiresDataSubjectNotification: false,
      slaRiskTier: 'low',
      guidanceAr:
        'لا توجد حادثة تسريب نشطة حالياً. استمر في توثيق خطة الاستجابة ومؤقت الـ 72 ساعة لإشعار سدايا والإخطار الفوري لمكتب الإمارات للبيانات.',
      guidanceEn:
        'No active personal data breach declared. Keep the 72-hour SDAIA triage runbook and UAE Data Office escalation contacts current.',
    };
  }

  const parsedRef = referenceIso ? Date.parse(referenceIso) : Date.now();
  const refMs = Number.isFinite(parsedRef) ? parsedRef : Date.now();
  const parsedDiscovered = Date.parse(input.discoveredAtIso);
  const discoveredMs = Number.isFinite(parsedDiscovered) ? parsedDiscovered : refMs;

  const sdaiaDeadlineIso = new Date(
    discoveredMs + KSA_BREACH_WINDOW_HOURS * 3600 * 1000,
  ).toISOString();

  const parsedReported = input.reportedAtIso ? Date.parse(input.reportedAtIso) : NaN;
  const endpointMs =
    input.reportedToRegulator && Number.isFinite(parsedReported) ? parsedReported : refMs;

  const rawElapsedHours = Math.max(0, (endpointMs - discoveredMs) / (3600 * 1000));
  const elapsedHours = roundTwoDecimals(rawElapsedHours);
  const remainingHours = roundTwoDecimals(Math.max(0, KSA_BREACH_WINDOW_HOURS - elapsedHours));
  const overdue = elapsedHours > KSA_BREACH_WINDOW_HOURS;

  const requiresSdaiaNotification = input.riskSeverity !== 'none';
  const requiresUaeDataOfficeNotification = input.riskSeverity !== 'none';
  const requiresDataSubjectNotification = input.riskSeverity === 'high_harm';

  if (input.reportedToRegulator && !overdue) {
    const needsSubjectFollowup =
      requiresDataSubjectNotification && !input.likelyDataSubjectsNotified;
    return {
      state: 'notified_on_time',
      elapsedHours,
      remainingHours,
      windowHours: KSA_BREACH_WINDOW_HOURS,
      overdue: false,
      sdaiaDeadlineIso,
      requiresSdaiaNotification,
      requiresUaeDataOfficeNotification,
      requiresDataSubjectNotification,
      slaRiskTier: needsSubjectFollowup ? 'elevated' : 'low',
      guidanceAr: needsSubjectFollowup
        ? 'تم الإبلاغ التنظيمي ضمن نافذة الـ 72 ساعة، لكن التأثير الجسيم يستلزم إخطار أصحاب البيانات المتضررين أيضاً.'
        : 'تم توثيق الإبلاغ التنظيمي ضمن مهلة الـ 72 ساعة. استكمل الإجراءات التصحيحية وتوثيق الدروس المستفادة.',
      guidanceEn: needsSubjectFollowup
        ? 'Regulator notified within the 72-hour window, but high-harm severity still requires notifying affected data subjects.'
        : 'Regulatory breach notification recorded within the 72-hour window. Complete containment and post-incident remediation notes.',
    };
  }

  if (overdue) {
    return {
      state: 'overdue',
      elapsedHours,
      remainingHours: 0,
      windowHours: KSA_BREACH_WINDOW_HOURS,
      overdue: true,
      sdaiaDeadlineIso,
      requiresSdaiaNotification,
      requiresUaeDataOfficeNotification,
      requiresDataSubjectNotification,
      slaRiskTier: 'critical',
      guidanceAr:
        'تنبيه حرج: تجاوزت الحادثة مهلة الـ 72 ساعة لإشعار سدايا دون توثيق إبلاغ مستوفٍ؛ يلزم تحضير مبررات التأخير والتصعيد الفوري لمكتب الإمارات للبيانات.',
      guidanceEn:
        'Critical SLA breach: the 72-hour SDAIA notification window has elapsed without confirmed filing; prepare delay justification and escalate to regulators immediately.',
    };
  }

  if (remainingHours <= 12) {
    return {
      state: 'urgent_under_12h',
      elapsedHours,
      remainingHours,
      windowHours: KSA_BREACH_WINDOW_HOURS,
      overdue: false,
      sdaiaDeadlineIso,
      requiresSdaiaNotification,
      requiresUaeDataOfficeNotification,
      requiresDataSubjectNotification,
      slaRiskTier: 'critical',
      guidanceAr:
        'أقل من 12 ساعة متبقية في مهلة الـ 72 ساعة لدى سدايا؛ يجب اعتماد مسودة الإشعار ورفع البلاغ فوراً مع تقييم إشعار أصحاب البيانات.',
      guidanceEn:
        'Under 12 hours remain in the 72-hour SDAIA window; finalize the breach dossier and escalate regulator & data-subject notices immediately.',
    };
  }

  return {
    state: 'within_72h',
    elapsedHours,
    remainingHours,
    windowHours: KSA_BREACH_WINDOW_HOURS,
    overdue: false,
    sdaiaDeadlineIso,
    requiresSdaiaNotification,
    requiresUaeDataOfficeNotification,
    requiresDataSubjectNotification,
    slaRiskTier: input.riskSeverity === 'high_harm' ? 'critical' : 'elevated',
    guidanceAr:
      'الحادثة ضمن نافذة الـ 72 ساعة (سدايا) والإخطار الفوري (مكتب الإمارات للبيانات) — استكمل تقييم الأثر وجاهزية إخطار المتضررين قبل انتهاء الوقت.',
    guidanceEn:
      'Incident is active inside the 72-hour SDAIA & UAE Data Office notification window — complete impact triage and data-subject readiness before expiry.',
  };
}
