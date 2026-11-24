import type {
  JurisdictionScope,
  Locale,
  ReadinessTier,
} from '../core/types.ts';

export type ThemeId = 'alabaster-teal' | 'gulf-obsidian';

export interface PdplUiCopy {
  brandTitle: string;
  brandSubtitle: string;
  disclaimerLabel: string;
  storageServer: string;
  storageBrowser: string;
  themeLight: string;
  themeDark: string;
  langSwitch: string;
  tabRopa: string;
  tabBreach: string;
  tabNotice: string;
  presetsHeading: string;
  dossierSelectLabel: string;
  btnNewFromPreset: string;
  btnSaveDraft: string;
  btnSealDossier: string;
  btnDuplicate: string;
  btnDelete: string;
  btnShareReport: string;
  btnBackToStudio: string;
  lockedBadge: string;
  draftBadge: string;
  publicViewBadge: string;
  viewsLabel: string;
  orgSectionTitle: string;
  orgNameArLabel: string;
  orgNameEnLabel: string;
  jurisdictionLabel: string;
  contactEmailLabel: string;
  noticeArUrlLabel: string;
  noticeEnUrlLabel: string;
  dsarSlaLabel: string;
  dpoAppointedLabel: string;
  saveProfileBtn: string;
  loadProfileLabel: string;
  ropaSectionTitle: string;
  addActivityBtn: string;
  activityNameArLabel: string;
  activityNameEnLabel: string;
  purposeLabel: string;
  lawfulBasisLabel: string;
  hostingRegionLabel: string;
  safeguardLabel: string;
  retentionDaysLabel: string;
  processorLabel: string;
  categoriesLabel: string;
  sensitiveToggleLabel: string;
  marketingToggleLabel: string;
  explicitOptInLabel: string;
  breachSectionTitle: string;
  breachActiveToggle: string;
  incidentTitleArLabel: string;
  incidentTitleEnLabel: string;
  discoveredAtLabel: string;
  riskSeverityLabel: string;
  affectedCountLabel: string;
  reportedToRegulatorToggle: string;
  reportedAtLabel: string;
  subjectsNotifiedToggle: string;
  simulate38hBtn: string;
  simulate65hBtn: string;
  simulate80hBtn: string;
  simulateCleanBtn: string;
  elapsedLabel: string;
  remainingLabel: string;
  deadlineLabel: string;
  sdaiaNoticeLabel: string;
  uaeNoticeLabel: string;
  subjectsNoticeLabel: string;
  requiredYes: string;
  requiredNo: string;
  csvBatchTitle: string;
  csvLoadSampleBtn: string;
  csvAuditBtn: string;
  csvDownloadBtn: string;
  controlsMatrixTitle: string;
  noticeHtmlTitle: string;
  previewArBtn: string;
  previewEnBtn: string;
  copyHtmlBtn: string;
  downloadHtmlBtn: string;
  downloadMdBtn: string;
  downloadCsvBtn: string;
  printPdfBtn: string;
  scoreOverall: string;
  scoreRopa: string;
  scoreCrossBorder: string;
  scoreBreach: string;
  blockersLabel: string;
  warningsLabel: string;
  sealDigestLabel: string;
  issuesTitle: string;
  noIssuesMsg: string;
  toastSaved: string;
  toastSealed: string;
  toastCopied: string;
  toastProfileSaved: string;
  toastDeleted: string;
  toastDuplicated: string;
  publicNotFoundTitle: string;
  publicNotFoundHint: string;
}

const AR_COPY: PdplUiCopy = {
  brandTitle: 'PDPLCheck | رقيب خصوصية الخليج',
  brandSubtitle: 'أستوديو RoPA ونقل البيانات ومؤقت الـ 72 ساعة — الإمارات 45/2021 والسعودية SDAIA PDPL',
  disclaimerLabel: 'تنبيه النطاق القانوني الإلزامي',
  storageServer: 'SQLite WAL (:4199)',
  storageBrowser: 'متصفح محلي ($0)',
  themeLight: 'مرمر فيروزي (نهاري)',
  themeDark: 'أوبسيديان الخليج (ليلي)',
  langSwitch: 'English (LTR)',
  tabRopa: 'سجل RoPA والنقل الخارجي',
  tabBreach: 'مؤقت الـ 72 ساعة وتدقيق CSV',
  tabNotice: 'الضوابط الـ 10 وإشعار الخصوصية وA4 PDF',
  presetsHeading: 'سيناريوهات انطلاق سريعة',
  dossierSelectLabel: 'الملف النشط',
  btnNewFromPreset: 'إنشاء من السيناريو',
  btnSaveDraft: 'حفظ المسودة',
  btnSealDossier: 'اعتماد وختم SHA-256',
  btnDuplicate: 'نسخ لمسودة جديدة',
  btnDelete: 'حذف المسودة',
  btnShareReport: 'نسخ رابط المشاركة',
  btnBackToStudio: 'العودة إلى الأستوديو',
  lockedBadge: 'ملف معتمد ومختوم',
  draftBadge: 'مسودة قابلة للتعديل',
  publicViewBadge: 'عرض تقرير مشاركة',
  viewsLabel: 'المشاهدات',
  orgSectionTitle: 'هوية المتحكم وقناة حقوق أصحاب البيانات (DSAR)',
  orgNameArLabel: 'اسم الجهة (بالعربية)',
  orgNameEnLabel: 'اسم الجهة (بالإنجليزية)',
  jurisdictionLabel: 'النطاق التنظيمي المطبق',
  contactEmailLabel: 'بريد DSAR / DPO',
  noticeArUrlLabel: 'رابط إشعار الخصوصية العربي (إلزامي لسدايا)',
  noticeEnUrlLabel: 'رابط إشعار الخصوصية الإنجليزي',
  dsarSlaLabel: 'مهلة الرد على DSAR (أيام)',
  dpoAppointedLabel: 'تم تعيين مسؤول حماية البيانات (DPO)',
  saveProfileBtn: 'حفظ كملف جهة متكرر',
  loadProfileLabel: 'استيراد جهة محفوظة',
  ropaSectionTitle: 'سجل أنشطة المعالجة والنقل عبر الحدود (RoPA)',
  addActivityBtn: 'إضافة نشاط معالجة',
  activityNameArLabel: 'اسم النشاط (عربي)',
  activityNameEnLabel: 'اسم النشاط (إنجليزي)',
  purposeLabel: 'الغرض النظامي المحدد',
  lawfulBasisLabel: 'الأساس النظامي',
  hostingRegionLabel: 'موقع الاستضافة / المعالجة',
  safeguardLabel: 'ضمانة النقل عبر الحدود',
  retentionDaysLabel: 'مدة الاحتفاظ (أيام)',
  processorLabel: 'المعالج / مزود البنية',
  categoriesLabel: 'فئات البيانات (مفصولة بـ |)',
  sensitiveToggleLabel: 'بيانات شخصية حساسة',
  marketingToggleLabel: 'نشاط تسويقي / ترويجي',
  explicitOptInLabel: 'موافقة تسويق صريحة منفصلة (Opt-in)',
  breachSectionTitle: 'حاسبة ومؤقت الـ 72 ساعة للحوادث (سدايا + مكتب الإمارات للبيانات)',
  breachActiveToggle: 'إعلان حادثة تسريب نشطة للتقييم (Triage)',
  incidentTitleArLabel: 'وصف الحادثة (عربي)',
  incidentTitleEnLabel: 'وصف الحادثة (إنجليزي)',
  discoveredAtLabel: 'وقت العلم بالحادثة (ISO UTC)',
  riskSeverityLabel: 'درجة خطورة التأثير',
  affectedCountLabel: 'عدد الأفراد المتأثرين',
  reportedToRegulatorToggle: 'تم إشعار الجهة التنظيمية (سدايا / مكتب الإمارات)',
  reportedAtLabel: 'وقت تقديم البلاغ (ISO UTC)',
  subjectsNotifiedToggle: 'تم إشعار أصحاب البيانات المتضررين',
  simulate38hBtn: 'محاكاة 38 ساعة',
  simulate65hBtn: 'حرج (<12س متبقية)',
  simulate80hBtn: 'تجاوز 72 ساعة',
  simulateCleanBtn: 'وضع طبيعي (بلا حادثة)',
  elapsedLabel: 'المنقضي منذ العلم',
  remainingLabel: 'المتبقي لنافذة 72س',
  deadlineLabel: 'الموعد الحدي لسدايا',
  sdaiaNoticeLabel: 'إخطار سدايا (72س)',
  uaeNoticeLabel: 'إخطار مكتب الإمارات',
  subjectsNoticeLabel: 'إخطار أصحاب البيانات',
  requiredYes: 'مطلوب التجهيز',
  requiredNo: 'غير مطلوب حالياً',
  csvBatchTitle: 'مدقق ملفات RoPA الجماعي عبر CSV (مع حماية حقن الصيغ)',
  csvLoadSampleBtn: 'تحميل عينة CSV اختبارية',
  csvAuditBtn: 'تدقيق ملف CSV الآن',
  csvDownloadBtn: 'تنزيل CSV معقم (UTF-8 BOM)',
  controlsMatrixTitle: 'مصفوفة الـ 10 ضوابط المزدوجة (UAE PDPL & KSA SDAIA PDPL)',
  noticeHtmlTitle: 'معاينة مسودة إشعار الخصوصية ثنائي اللغة (HTML + JSON-LD)',
  previewArBtn: 'نسخة عربية (RTL)',
  previewEnBtn: 'English (LTR)',
  copyHtmlBtn: 'نسخ كود HTML',
  downloadHtmlBtn: 'تنزيل إشعار الخصوصية HTML',
  downloadMdBtn: 'تنزيل سجل Markdown',
  downloadCsvBtn: 'تنزيل سجل RoPA CSV',
  printPdfBtn: 'طباعة / تصدير A4 PDF',
  scoreOverall: 'الجاهزية الكلية',
  scoreRopa: 'درجة RoPA',
  scoreCrossBorder: 'سلامة النقل الخارجي',
  scoreBreach: 'جاهزية الـ 72 ساعة',
  blockersLabel: 'عوائق',
  warningsLabel: 'تحذيرات',
  sealDigestLabel: 'بصمة الختم الحتمية SHA-256',
  issuesTitle: 'الفجوات والملاحظات المكتشفة',
  noIssuesMsg: 'لا توجد عوائق أو تحذيرات في المدخلات الحالية.',
  toastSaved: 'تم حفظ المسودة وإعادة احتساب مؤشرات الامتثال.',
  toastSealed: 'تم اعتماد الملف وتوليد الرمز التسلسلي وختم SHA-256 بنجاح.',
  toastCopied: 'تم النسخ إلى الحافظة بنجاح.',
  toastProfileSaved: 'تم حفظ ملف الجهة للاستخدام المتكرر.',
  toastDeleted: 'تم حذف المسودة بنجاح.',
  toastDuplicated: 'تم استنساخ مسودة جديدة قابلة للتعديل.',
  publicNotFoundTitle: 'تعذر العثور على تقرير PDPL المشارك',
  publicNotFoundHint: 'قد يكون الرابط منتهياً أو غير متوفر على هذه العقدة المحلية.',
};

const EN_COPY: PdplUiCopy = {
  brandTitle: 'PDPLCheck | Gulf Privacy Studio',
  brandSubtitle: 'UAE PDPL (45/2021) & KSA SDAIA PDPL — RoPA, Transfers & 72h Breach Clock',
  disclaimerLabel: 'Mandatory Legal Disclaimer',
  storageServer: 'SQLite WAL (:4199)',
  storageBrowser: 'Browser Local ($0)',
  themeLight: 'Alabaster Teal (Light)',
  themeDark: 'Gulf Obsidian (Dark)',
  langSwitch: 'العربية (RTL)',
  tabRopa: 'RoPA & Cross-Border',
  tabBreach: '72h Breach Clock & CSV Batch',
  tabNotice: '10 Controls, Privacy Notice & A4 PDF',
  presetsHeading: 'Quick-Start Scenarios',
  dossierSelectLabel: 'Active Dossier',
  btnNewFromPreset: 'Create from Preset',
  btnSaveDraft: 'Save Draft',
  btnSealDossier: 'Seal & Lock SHA-256',
  btnDuplicate: 'Duplicate Draft',
  btnDelete: 'Delete Draft',
  btnShareReport: 'Copy Share Link',
  btnBackToStudio: 'Back to Studio',
  lockedBadge: 'Sealed & Immutable',
  draftBadge: 'Editable Draft',
  publicViewBadge: 'Shared Dossier View',
  viewsLabel: 'Views',
  orgSectionTitle: 'Controller Identity & DSAR Channel',
  orgNameArLabel: 'Organization Name (Arabic)',
  orgNameEnLabel: 'Organization Name (English)',
  jurisdictionLabel: 'Applicable Regulatory Scope',
  contactEmailLabel: 'DSAR / DPO Inbox Email',
  noticeArUrlLabel: 'Arabic Privacy Notice URL (KSA Mandatory)',
  noticeEnUrlLabel: 'English Privacy Notice URL',
  dsarSlaLabel: 'DSAR Response SLA (Days)',
  dpoAppointedLabel: 'Dedicated Data Protection Officer (DPO) Appointed',
  saveProfileBtn: 'Save Reusable Entity Profile',
  loadProfileLabel: 'Load Saved Entity',
  ropaSectionTitle: 'Record of Processing Activities (RoPA) & Cross-Border Transfers',
  addActivityBtn: 'Add RoPA Activity',
  activityNameArLabel: 'Activity Name (AR)',
  activityNameEnLabel: 'Activity Name (EN)',
  purposeLabel: 'Specific Lawful Purpose',
  lawfulBasisLabel: 'Lawful Basis',
  hostingRegionLabel: 'Hosting / Processing Region',
  safeguardLabel: 'Cross-Border Safeguard',
  retentionDaysLabel: 'Retention Period (Days)',
  processorLabel: 'Sub-Processor / Cloud Host',
  categoriesLabel: 'Data Categories (|-separated)',
  sensitiveToggleLabel: 'Sensitive Personal Data',
  marketingToggleLabel: 'Direct Marketing Activity',
  explicitOptInLabel: 'Explicit Separate Marketing Opt-In',
  breachSectionTitle: '72-Hour Breach Notification Triage Clock (SDAIA & UAE Data Office)',
  breachActiveToggle: 'Declare Active Incident for Breach Triage',
  incidentTitleArLabel: 'Incident Title (AR)',
  incidentTitleEnLabel: 'Incident Title (EN)',
  discoveredAtLabel: 'Controller Awareness Timestamp (ISO UTC)',
  riskSeverityLabel: 'Estimated Harm Severity',
  affectedCountLabel: 'Estimated Affected Data Subjects',
  reportedToRegulatorToggle: 'Regulator Notified (SDAIA / UAE Data Office)',
  reportedAtLabel: 'Filing Timestamp (ISO UTC)',
  subjectsNotifiedToggle: 'Affected Data Subjects Notified',
  simulate38hBtn: 'Simulate 38h Active',
  simulate65hBtn: 'Urgent (<12h Left)',
  simulate80hBtn: 'Overdue (>72h)',
  simulateCleanBtn: 'Clear Incident',
  elapsedLabel: 'Elapsed Since Awareness',
  remainingLabel: 'Remaining in 72h Window',
  deadlineLabel: 'SDAIA 72h Cutoff',
  sdaiaNoticeLabel: 'SDAIA 72h Filing',
  uaeNoticeLabel: 'UAE Data Office Notice',
  subjectsNoticeLabel: 'Data Subject Notice',
  requiredYes: 'Action Required',
  requiredNo: 'Not Triggered',
  csvBatchTitle: 'Bulk RoPA CSV Auditor & Formula-Safe Exporter',
  csvLoadSampleBtn: 'Load Sample Audit CSV',
  csvAuditBtn: 'Run Batch CSV Audit',
  csvDownloadBtn: 'Download Sanitized CSV (UTF-8 BOM)',
  controlsMatrixTitle: 'Dual-PDPL 10-Control Readiness Matrix',
  noticeHtmlTitle: 'Bilingual Privacy Notice Preview (XSS-Safe HTML + JSON-LD)',
  previewArBtn: 'Arabic (RTL)',
  previewEnBtn: 'English (LTR)',
  copyHtmlBtn: 'Copy HTML Snippet',
  downloadHtmlBtn: 'Download Privacy Notice HTML',
  downloadMdBtn: 'Download RoPA Markdown',
  downloadCsvBtn: 'Download RoPA CSV',
  printPdfBtn: 'Print / Export A4 PDF',
  scoreOverall: 'Overall Readiness',
  scoreRopa: 'RoPA Hygiene',
  scoreCrossBorder: 'Transfer Safeguards',
  scoreBreach: '72h Breach Readiness',
  blockersLabel: 'Blockers',
  warningsLabel: 'Warnings',
  sealDigestLabel: 'Deterministic SHA-256 Digest',
  issuesTitle: 'Audit Blockers & Remediation Warnings',
  noIssuesMsg: 'Zero compliance blockers or warnings remain on this configuration.',
  toastSaved: 'Draft saved and compliance metrics recomputed.',
  toastSealed: 'Dossier sealed with sequential PDPL code & SHA-256 digest.',
  toastCopied: 'Copied to clipboard.',
  toastProfileSaved: 'Organization privacy profile saved.',
  toastDeleted: 'Draft dossier deleted.',
  toastDuplicated: 'Editable draft copy created.',
  publicNotFoundTitle: 'Shared PDPL Dossier Not Found',
  publicNotFoundHint: 'This report slug or code is not present in the local repository.',
};

export function getUiCopy(locale: Locale): PdplUiCopy {
  return locale === 'en' ? EN_COPY : AR_COPY;
}

export function formatJurisdictionLabel(j: JurisdictionScope, locale: Locale): string {
  if (locale === 'ar') {
    if (j === 'uae_pdpl') return 'الإمارات (مرسوم بقانون 45/2021)';
    if (j === 'ksa_pdpl') return 'السعودية (نظام سدايا PDPL)';
    return 'مزدوج الخليج (الإمارات + السعودية)';
  }
  if (j === 'uae_pdpl') return 'UAE PDPL (Law No. 45/2021)';
  if (j === 'ksa_pdpl') return 'KSA PDPL (SDAIA)';
  return 'Dual GCC (UAE + KSA)';
}

export function formatReadinessTierLabel(tier: ReadinessTier, locale: Locale): string {
  if (locale === 'ar') {
    if (tier === 'ready') return 'جاهز للاعتماد (Ready)';
    if (tier === 'needs_remediation') return 'يحتاج معالجة (Remediation)';
    return 'محجوب بعوائق (Blocked)';
  }
  if (tier === 'ready') return 'Ready';
  if (tier === 'needs_remediation') return 'Needs Remediation';
  return 'Blocked';
}
