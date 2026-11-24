import {
  HOSTING_REGION_META,
  LAWFUL_BASIS_META,
  isCrossBorderForJurisdiction,
  isValidContactEmail,
  isValidHostingRegion,
  isValidJurisdiction,
  isValidLawfulBasis,
  isValidSafeguard,
} from './pdplRules.ts';
import type {
  Locale,
  OrganizationPrivacyProfile,
  PdplDossier,
  PdplIssue,
  RopaActivityItem,
  RopaAuditReport,
  RopaCsvAuditReport,
  RopaCsvRowResult,
} from './types.ts';

export type PdplErrorCode =
  | 'EMPTY_CSV'
  | 'INVALID_CSV_HEADER'
  | 'INVALID_ROPA'
  | 'MISSING_INPUT';

export class PdplCoreError extends Error {
  readonly code: PdplErrorCode;

  constructor(code: PdplErrorCode, message: string) {
    super(message);
    this.name = 'PdplCoreError';
    this.code = code;
  }
}

function isNonEmptyHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return /^https?:\/\/[^\s]+$/i.test(trimmed);
}

function makeIssue(
  partial: Omit<PdplIssue, 'id'>,
  sequence: number,
): PdplIssue {
  return {
    id: `ISSUE-${String(sequence).padStart(3, '0')}`,
    ...partial,
  };
}

function validateOrganizationAndActivities(
  org: OrganizationPrivacyProfile,
  activities: RopaActivityItem[],
): void {
  if (!org || typeof org !== 'object') {
    throw new PdplCoreError('MISSING_INPUT', 'Organization privacy profile is required.');
  }
  if (!isValidJurisdiction(org.jurisdiction)) {
    throw new PdplCoreError(
      'INVALID_ROPA',
      `Unsupported jurisdiction scope: ${String(org.jurisdiction)}`,
    );
  }
  if (!Array.isArray(activities) || activities.length === 0) {
    throw new PdplCoreError(
      'INVALID_ROPA',
      'At least one RoPA processing activity is required for auditing.',
    );
  }

  for (const item of activities) {
    if (!item || !item.id.trim()) {
      throw new PdplCoreError('INVALID_ROPA', 'Every RoPA item must have a non-empty id.');
    }
    if (!isValidLawfulBasis(item.lawfulBasis)) {
      throw new PdplCoreError(
        'INVALID_ROPA',
        `Invalid lawfulBasis "${String(item.lawfulBasis)}" on activity "${item.id}".`,
      );
    }
    if (!isValidHostingRegion(item.hostingRegion)) {
      throw new PdplCoreError(
        'INVALID_ROPA',
        `Invalid hostingRegion "${String(item.hostingRegion)}" on activity "${item.id}".`,
      );
    }
    if (!isValidSafeguard(item.transferSafeguard)) {
      throw new PdplCoreError(
        'INVALID_ROPA',
        `Invalid transferSafeguard "${String(item.transferSafeguard)}" on activity "${item.id}".`,
      );
    }
  }
}

function collectOrganizationIssues(
  org: OrganizationPrivacyProfile,
  activities: RopaActivityItem[],
  startSeq: number,
): PdplIssue[] {
  const issues: PdplIssue[] = [];
  let seq = startSeq;

  if (!isValidContactEmail(org.contactEmail)) {
    issues.push(
      makeIssue(
        {
          severity: 'blocker',
          framework: 'DUAL_GCC',
          code: 'INVALID_DSR_EMAIL',
          messageAr: 'بريد التواصل لحقوق أصحاب البيانات (DSAR / DPO) مفقود أو غير صالح.',
          messageEn: 'DSAR / DPO privacy contact email is missing or invalid.',
        },
        seq++,
      ),
    );
  }

  const hasArabicNotice = isNonEmptyHttpUrl(org.privacyNoticeArUrl);
  const hasEnglishNotice = isNonEmptyHttpUrl(org.privacyNoticeEnUrl);

  if ((org.jurisdiction === 'ksa_pdpl' || org.jurisdiction === 'dual_gcc') && !hasArabicNotice) {
    issues.push(
      makeIssue(
        {
          severity: 'blocker',
          framework: 'KSA_PDPL',
          code: 'MISSING_ARABIC_NOTICE',
          messageAr:
            'رابط إشعار الخصوصية باللغة العربية مفقود — نظام سدايا يشترط توفّر إشعار عربي واضح قبل جمع البيانات.',
          messageEn:
            'Arabic privacy notice URL is missing — KSA SDAIA PDPL requires a clear Arabic notice prior to collection.',
        },
        seq++,
      ),
    );
  }

  if (org.jurisdiction === 'uae_pdpl' && !hasArabicNotice && !hasEnglishNotice) {
    issues.push(
      makeIssue(
        {
          severity: 'blocker',
          framework: 'UAE_PDPL',
          code: 'MISSING_PRIVACY_NOTICE',
          messageAr: 'رابط إشعار الخصوصية مفقود للمنشأة الخاضعة لنظام الإمارات 45/2021.',
          messageEn: 'Privacy notice URL is missing for UAE PDPL 45/2021 compliance.',
        },
        seq++,
      ),
    );
  } else if (org.jurisdiction === 'dual_gcc' && !hasEnglishNotice) {
    issues.push(
      makeIssue(
        {
          severity: 'warning',
          framework: 'UAE_PDPL',
          code: 'MISSING_ENGLISH_NOTICE',
          messageAr: 'يوصى بنشر نسخة إنجليزية لإشعار الخصوصية لعملاء الإمارات والمقيمين.',
          messageEn: 'Publishing an English privacy notice version is recommended for UAE bilingual audiences.',
        },
        seq++,
      ),
    );
  }

  const hasSensitive = activities.some((item) => item.containsSensitiveData);
  if (!org.dpoAppointed && (hasSensitive || activities.length >= 5)) {
    issues.push(
      makeIssue(
        {
          severity: 'warning',
          framework: 'DUAL_GCC',
          code: 'DPO_RECOMMENDED',
          messageAr:
            'مع وجود بيانات حساسة أو تعدد أنشطة المعالجة، يوصى بتعيين وتوثيق مسؤول حماية البيانات (DPO).',
          messageEn:
            'Given sensitive data categories or 5+ processing activities, formal DPO appointment is strongly recommended.',
        },
        seq++,
      ),
    );
  }

  if (!Number.isFinite(org.dsarSlaDays) || org.dsarSlaDays <= 0 || org.dsarSlaDays > 30) {
    issues.push(
      makeIssue(
        {
          severity: 'warning',
          framework: 'DUAL_GCC',
          code: 'DSAR_SLA_EXCEEDS_30_DAYS',
          messageAr: 'يستهدف الامتثال الجيد الرد على طلبات أصحاب البيانات خلال 30 يوماً فأقل.',
          messageEn: 'Target DSAR fulfillment turnaround should stay within 30 calendar days.',
        },
        seq++,
      ),
    );
  }

  return issues;
}

function auditSingleActivity(
  org: OrganizationPrivacyProfile,
  item: RopaActivityItem,
  startSeq: number,
): { issues: PdplIssue[]; isCrossBorder: boolean; unprotectedTransfer: boolean; nextSeq: number } {
  const issues: PdplIssue[] = [];
  let seq = startSeq;

  if (!item.purpose.trim()) {
    issues.push(
      makeIssue(
        {
          activityId: item.id,
          severity: 'blocker',
          framework: 'DUAL_GCC',
          code: 'MISSING_PURPOSE',
          messageAr: `النشاط "${item.activityNameAr || item.id}" يفتقر لتحديد الغرض النظامي للمعالجة.`,
          messageEn: `Activity "${item.activityNameEn || item.id}" is missing a documented processing purpose.`,
        },
        seq++,
      ),
    );
  }

  if (!Number.isFinite(item.retentionDays) || item.retentionDays <= 0) {
    issues.push(
      makeIssue(
        {
          activityId: item.id,
          severity: 'blocker',
          framework: 'DUAL_GCC',
          code: 'MISSING_RETENTION_PERIOD',
          messageAr: `النشاط "${item.activityNameAr || item.id}" لا يحدد مدة الاحتفاظ بالأيام.`,
          messageEn: `Activity "${item.activityNameEn || item.id}" must define a positive retention period in days.`,
        },
        seq++,
      ),
    );
  }

  if (item.isMarketingActivity && !item.explicitMarketingOptIn) {
    issues.push(
      makeIssue(
        {
          activityId: item.id,
          severity: 'blocker',
          framework: 'DUAL_GCC',
          code: 'UNCONSENTED_MARKETING',
          messageAr: `النشاط التسويقي "${item.activityNameAr || item.id}" يفتقر لموافقة صريحة منفصلة (Opt-in).`,
          messageEn: `Marketing activity "${item.activityNameEn || item.id}" requires an explicit, separate opt-in consent.`,
        },
        seq++,
      ),
    );
  }

  if (item.containsSensitiveData && !LAWFUL_BASIS_META[item.lawfulBasis].allowsSensitiveData) {
    issues.push(
      makeIssue(
        {
          activityId: item.id,
          severity: 'blocker',
          framework: 'DUAL_GCC',
          code: 'SENSITIVE_DATA_BASIS_GAP',
          messageAr: `معالجة البيانات الحساسة في "${item.activityNameAr || item.id}" لا تقبل أساس "${LAWFUL_BASIS_META[item.lawfulBasis].labelAr}".`,
          messageEn: `Sensitive data in "${item.activityNameEn || item.id}" cannot rely on "${LAWFUL_BASIS_META[item.lawfulBasis].labelEn}".`,
        },
        seq++,
      ),
    );
  }

  if (!item.processorName.trim()) {
    issues.push(
      makeIssue(
        {
          activityId: item.id,
          severity: 'warning',
          framework: 'DUAL_GCC',
          code: 'MISSING_PROCESSOR_NAME',
          messageAr: `يفضل توثيق اسم المعالج أو مزود الاستضافة للنشاط "${item.activityNameAr || item.id}".`,
          messageEn: `Documenting the sub-processor / hosting vendor for "${item.activityNameEn || item.id}" is recommended.`,
        },
        seq++,
      ),
    );
  }

  const isCrossBorder = isCrossBorderForJurisdiction(org.jurisdiction, item.hostingRegion);
  let unprotectedTransfer = false;

  if (isCrossBorder) {
    const sufficient =
      item.transferSafeguard === 'scc_contract' ||
      item.transferSafeguard === 'explicit_consent_transfer';

    if (!sufficient) {
      unprotectedTransfer = true;
      const framework =
        org.jurisdiction === 'ksa_pdpl'
          ? 'KSA_PDPL'
          : org.jurisdiction === 'uae_pdpl'
            ? 'UAE_PDPL'
            : 'DUAL_GCC';

      issues.push(
        makeIssue(
          {
            activityId: item.id,
            severity: 'blocker',
            framework,
            code: 'CROSS_BORDER_NO_SAFEGUARD',
            messageAr: `النقل الخارجي للبيانات نحو "${HOSTING_REGION_META[item.hostingRegion].labelAr}" في النشاط "${item.activityNameAr || item.id}" يفتقر لضمانات تعاقدية (SCCs).`,
            messageEn: `Cross-border hosting in "${HOSTING_REGION_META[item.hostingRegion].labelEn}" on "${item.activityNameEn || item.id}" lacks valid transfer safeguards (SCCs).`,
          },
          seq++,
        ),
      );
    } else if (
      item.hostingRegion === 'other_non_adequate' &&
      item.transferSafeguard === 'explicit_consent_transfer' &&
      item.containsSensitiveData
    ) {
      issues.push(
        makeIssue(
          {
            activityId: item.id,
            severity: 'warning',
            framework: 'KSA_PDPL',
            code: 'SENSITIVE_CROSS_BORDER_REVIEW',
            messageAr: `نقل البيانات الحساسة لبيئة غير مصنفة بكفاية حماية في "${item.activityNameAr || item.id}" يتطلب تقييم مخاطر وتوثيق SCCs.`,
            messageEn: `Sensitive data transferred to non-adequate hosting on "${item.activityNameEn || item.id}" should be backed by SCCs and a formal transfer risk assessment.`,
          },
          seq++,
        ),
      );
    }
  }

  return { issues, isCrossBorder, unprotectedTransfer, nextSeq: seq };
}

export function auditPdplRopaAndTransfers(
  org: OrganizationPrivacyProfile,
  activities: RopaActivityItem[],
  nowIso: string = new Date().toISOString(),
): RopaAuditReport {
  validateOrganizationAndActivities(org, activities);

  const orgIssues = collectOrganizationIssues(org, activities, 1);
  let seq = orgIssues.length + 1;

  const allIssues: PdplIssue[] = [...orgIssues];
  let compliantActivities = 0;
  let crossBorderActivities = 0;
  let unprotectedTransfers = 0;

  for (const item of activities) {
    const res = auditSingleActivity(org, item, seq);
    seq = res.nextSeq;
    if (res.isCrossBorder) {
      crossBorderActivities += 1;
    }
    if (res.unprotectedTransfer) {
      unprotectedTransfers += 1;
    }
    const hasBlocker = res.issues.some((iss) => iss.severity === 'blocker');
    if (!hasBlocker) {
      compliantActivities += 1;
    }
    allIssues.push(...res.issues);
  }

  const blockersCount = allIssues.filter((iss) => iss.severity === 'blocker').length;
  const warningsCount = allIssues.filter((iss) => iss.severity === 'warning').length;

  const ropaScore = Math.max(0, Math.min(100, 100 - blockersCount * 18 - warningsCount * 6));
  const rawCrossBorderBase =
    crossBorderActivities === 0
      ? 100
      : Math.round(((crossBorderActivities - unprotectedTransfers) / crossBorderActivities) * 100);
  const crossBorderWarnings = allIssues.filter(
    (iss) => iss.code === 'SENSITIVE_CROSS_BORDER_REVIEW',
  ).length;
  const crossBorderScore = Math.max(0, Math.min(100, rawCrossBorderBase - crossBorderWarnings * 5));

  return {
    totalActivities: activities.length,
    compliantActivities,
    crossBorderActivities,
    unprotectedTransfers,
    blockersCount,
    warningsCount,
    ropaScore,
    crossBorderScore,
    issues: allIssues,
    auditedAtIso: nowIso,
  };
}

function parseCsvMatrix(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const normalized = csvText.replace(/^\uFEFF/, '');
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((value) => value.trim().length > 0));
}

function parseBooleanCell(raw: string): boolean {
  const normalized = raw.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'نعم';
}

const DEFAULT_CSV_ORG: OrganizationPrivacyProfile = {
  organizationNameAr: 'منشأة فحص RoPA الجماعي',
  organizationNameEn: 'Batch RoPA Audit Entity',
  jurisdiction: 'dual_gcc',
  contactEmail: 'privacy@example.ae',
  privacyNoticeArUrl: 'https://example.ae/ar/privacy',
  privacyNoticeEnUrl: 'https://example.ae/en/privacy',
  dpoAppointed: true,
  dsarSlaDays: 30,
};

const REQUIRED_CSV_HEADERS = [
  'activity_id',
  'purpose',
  'lawful_basis',
  'hosting_region',
  'transfer_safeguard',
  'retention_days',
] as const;

export function auditRopaCsv(
  csvText: string,
  orgOverride?: Partial<OrganizationPrivacyProfile>,
): RopaCsvAuditReport {
  if (!csvText || !csvText.trim()) {
    throw new PdplCoreError('EMPTY_CSV', 'CSV input is empty.');
  }

  const matrix = parseCsvMatrix(csvText);
  if (matrix.length === 0) {
    throw new PdplCoreError('EMPTY_CSV', 'CSV input contains no rows.');
  }

  const headerRow = matrix[0].map((col) => col.trim().toLowerCase());
  const headerIndex = new Map<string, number>();
  headerRow.forEach((name, idx) => {
    if (name && !headerIndex.has(name)) {
      headerIndex.set(name, idx);
    }
  });

  for (const requiredCol of REQUIRED_CSV_HEADERS) {
    if (!headerIndex.has(requiredCol)) {
      throw new PdplCoreError(
        'INVALID_CSV_HEADER',
        `Missing required RoPA CSV column "${requiredCol}".`,
      );
    }
  }

  const dataRows = matrix.slice(1);
  if (dataRows.length === 0) {
    throw new PdplCoreError('INVALID_ROPA', 'CSV header is valid, but zero activity rows were found.');
  }

  const org: OrganizationPrivacyProfile = {
    ...DEFAULT_CSV_ORG,
    ...orgOverride,
  };

  const getCell = (row: string[], colName: string): string => {
    const idx = headerIndex.get(colName);
    if (idx === undefined) {
      return '';
    }
    return (row[idx] ?? '').trim();
  };

  const items: RopaActivityItem[] = dataRows.map((row, idx) => {
    const rawBasis = getCell(row, 'lawful_basis');
    const rawRegion = getCell(row, 'hosting_region');
    const rawSafeguard = getCell(row, 'transfer_safeguard');
    const rawRetention = Number(getCell(row, 'retention_days'));
    const activityId = getCell(row, 'activity_id') || `ROPA-${idx + 1}`;
    const nameAr = getCell(row, 'activity_name_ar') || getCell(row, 'activity_name_en') || activityId;
    const nameEn = getCell(row, 'activity_name_en') || getCell(row, 'activity_name_ar') || activityId;
    const rawCategories = getCell(row, 'data_categories');

    if (!isValidLawfulBasis(rawBasis)) {
      throw new PdplCoreError(
        'INVALID_ROPA',
        `Row ${idx + 2}: invalid lawful_basis "${rawBasis}".`,
      );
    }
    if (!isValidHostingRegion(rawRegion)) {
      throw new PdplCoreError(
        'INVALID_ROPA',
        `Row ${idx + 2}: invalid hosting_region "${rawRegion}".`,
      );
    }
    if (!isValidSafeguard(rawSafeguard)) {
      throw new PdplCoreError(
        'INVALID_ROPA',
        `Row ${idx + 2}: invalid transfer_safeguard "${rawSafeguard}".`,
      );
    }

    return {
      id: activityId,
      activityNameAr: nameAr,
      activityNameEn: nameEn,
      purpose: getCell(row, 'purpose'),
      dataCategories: rawCategories
        ? rawCategories.split('|').map((c) => c.trim()).filter(Boolean)
        : ['general_contact'],
      containsSensitiveData: parseBooleanCell(getCell(row, 'contains_sensitive_data')),
      isMarketingActivity: parseBooleanCell(getCell(row, 'is_marketing_activity')),
      explicitMarketingOptIn: parseBooleanCell(getCell(row, 'explicit_marketing_opt_in')),
      lawfulBasis: rawBasis,
      hostingRegion: rawRegion,
      transferSafeguard: rawSafeguard,
      retentionDays: Number.isFinite(rawRetention) ? rawRetention : 0,
      processorName: getCell(row, 'processor_name') || 'Internal Infrastructure',
    };
  });

  const ropaAudit = auditPdplRopaAndTransfers(org, items);
  const rows: RopaCsvRowResult[] = items.map((item, idx) => {
    const rowIssues = ropaAudit.issues.filter((iss) => iss.activityId === item.id);
    const hasBlocker = rowIssues.some((iss) => iss.severity === 'blocker');
    const hasWarning = rowIssues.some((iss) => iss.severity === 'warning');
    return {
      rowNumber: idx + 2,
      activityId: item.id,
      activityName: item.activityNameEn || item.activityNameAr,
      status: hasBlocker ? 'blocker' : hasWarning ? 'warning' : 'pass',
      issues: rowIssues,
      item,
    };
  });

  const passedRows = rows.filter((r) => r.status === 'pass').length;
  const warningRows = rows.filter((r) => r.status === 'warning').length;
  const blockedRows = rows.filter((r) => r.status === 'blocker').length;

  return {
    totalRows: rows.length,
    passedRows,
    warningRows,
    blockedRows,
    rows,
    ropaAudit,
  };
}

export function sanitizeCsvCell(value: string | number | boolean | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(formulaSafe)) {
    return `"${formulaSafe.replace(/"/g, '""')}"`;
  }
  return formulaSafe;
}

function isCsvAuditReport(
  source: RopaCsvAuditReport | PdplDossier | RopaAuditReport,
): source is RopaCsvAuditReport {
  return 'rows' in source && Array.isArray(source.rows);
}

function isDossier(
  source: RopaCsvAuditReport | PdplDossier | RopaAuditReport,
): source is PdplDossier {
  return 'activities' in source && 'audit' in source;
}

export function exportRopaCsv(
  source: RopaCsvAuditReport | PdplDossier | RopaAuditReport,
  locale: Locale = 'ar',
  activitiesOverride?: RopaActivityItem[],
): string {
  const header =
    locale === 'ar'
      ? [
          'معرف_النشاط',
          'اسم_النشاط',
          'الغرض',
          'الأساس_النظامي',
          'منطقة_الاستضافة',
          'ضمانة_النقل',
          'مدة_الاحتفاظ_أيام',
          'حساسة',
          'تسويق',
          'موافقة_تسويق_صريحة',
          'المعالج',
          'الحالة',
          'الملاحظات',
        ]
      : [
          'activity_id',
          'activity_name',
          'purpose',
          'lawful_basis',
          'hosting_region',
          'transfer_safeguard',
          'retention_days',
          'contains_sensitive_data',
          'is_marketing_activity',
          'explicit_marketing_opt_in',
          'processor_name',
          'status',
          'issues',
        ];

  const lines: string[] = [header.map((h) => sanitizeCsvCell(h)).join(',')];

  if (isCsvAuditReport(source)) {
    for (const row of source.rows) {
      const msgList = row.issues
        .map((iss) => (locale === 'ar' ? iss.messageAr : iss.messageEn))
        .join(' | ');
      lines.push(
        [
          row.item.id,
          locale === 'ar' ? row.item.activityNameAr : row.item.activityNameEn,
          row.item.purpose,
          row.item.lawfulBasis,
          row.item.hostingRegion,
          row.item.transferSafeguard,
          row.item.retentionDays,
          row.item.containsSensitiveData,
          row.item.isMarketingActivity,
          row.item.explicitMarketingOptIn,
          row.item.processorName,
          row.status,
          msgList,
        ]
          .map((cell) => sanitizeCsvCell(cell))
          .join(','),
      );
    }
    return `\uFEFF${lines.join('\r\n')}\r\n`;
  }

  const activities = isDossier(source) ? source.activities : (activitiesOverride ?? []);
  const issues = isDossier(source) ? source.audit.issues : source.issues;

  if (activities.length > 0) {
    for (const item of activities) {
      const itemIssues = issues.filter((iss) => iss.activityId === item.id);
      const status = itemIssues.some((iss) => iss.severity === 'blocker')
        ? 'blocker'
        : itemIssues.some((iss) => iss.severity === 'warning')
          ? 'warning'
          : 'pass';
      const msgList = itemIssues
        .map((iss) => (locale === 'ar' ? iss.messageAr : iss.messageEn))
        .join(' | ');

      lines.push(
        [
          item.id,
          locale === 'ar' ? item.activityNameAr : item.activityNameEn,
          item.purpose,
          item.lawfulBasis,
          item.hostingRegion,
          item.transferSafeguard,
          item.retentionDays,
          item.containsSensitiveData,
          item.isMarketingActivity,
          item.explicitMarketingOptIn,
          item.processorName,
          status,
          msgList,
        ]
          .map((cell) => sanitizeCsvCell(cell))
          .join(','),
      );
    }
  } else {
    for (const iss of issues) {
      lines.push(
        [
          iss.activityId ?? 'ORG',
          iss.code,
          iss.framework,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          iss.severity,
          locale === 'ar' ? iss.messageAr : iss.messageEn,
        ]
          .map((cell) => sanitizeCsvCell(cell))
          .join(','),
      );
    }
  }

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
