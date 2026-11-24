import {
  HOSTING_REGION_META,
  LAWFUL_BASIS_META,
  PDPLCHECK_LEGAL_DISCLAIMER_AR,
  PDPLCHECK_LEGAL_DISCLAIMER_EN,
  SAFEGUARD_META,
  isValidContactEmail,
} from './pdplRules.ts';
import type {
  BreachWindowAssessment,
  ControlStatus,
  Locale,
  OrganizationPrivacyProfile,
  PdplCheckItem,
  PdplDossier,
  PdplSummary,
  ReadinessTier,
  RopaActivityItem,
  RopaAuditReport,
} from './types.ts';

function hasCode(audit: RopaAuditReport, code: string): boolean {
  return audit.issues.some((iss) => iss.code === code);
}

export function buildDefaultPdplControls(
  org: OrganizationPrivacyProfile,
  activities: RopaActivityItem[],
  audit: RopaAuditReport,
  breach: BreachWindowAssessment,
): PdplCheckItem[] {
  const missingPurpose = hasCode(audit, 'MISSING_PURPOSE');
  const missingArNotice = hasCode(audit, 'MISSING_ARABIC_NOTICE');
  const missingAnyNotice = hasCode(audit, 'MISSING_PRIVACY_NOTICE');
  const missingEnNotice = hasCode(audit, 'MISSING_ENGLISH_NOTICE');
  const marketingGap = hasCode(audit, 'UNCONSENTED_MARKETING');
  const crossBorderGap = audit.unprotectedTransfers > 0;
  const crossBorderReview = hasCode(audit, 'SENSITIVE_CROSS_BORDER_REVIEW');
  const retentionGap = hasCode(audit, 'MISSING_RETENTION_PERIOD');
  const dsrEmailGap = !isValidContactEmail(org.contactEmail);
  const dsrSlaGap = hasCode(audit, 'DSAR_SLA_EXCEEDS_30_DAYS');
  const sensitiveGap = hasCode(audit, 'SENSITIVE_DATA_BASIS_GAP');
  const missingProcessor = hasCode(audit, 'MISSING_PROCESSOR_NAME');

  const noticeStatus: ControlStatus =
    missingArNotice || missingAnyNotice ? 'fail' : missingEnNotice ? 'partial' : 'pass';
  const crossBorderStatus: ControlStatus = crossBorderGap
    ? 'fail'
    : crossBorderReview
      ? 'partial'
      : 'pass';
  const dsrStatus: ControlStatus = dsrEmailGap ? 'fail' : dsrSlaGap ? 'partial' : 'pass';
  const breachStatus: ControlStatus =
    breach.state === 'overdue'
      ? 'fail'
      : breach.state === 'urgent_under_12h' || breach.state === 'within_72h'
        ? 'partial'
        : 'pass';
  const processorStatus: ControlStatus = missingProcessor ? 'partial' : 'pass';
  const dpoStatus: ControlStatus = org.dpoAppointed
    ? 'pass'
    : hasCode(audit, 'DPO_RECOMMENDED')
      ? 'partial'
      : 'pass';

  const sensitiveCount = activities.filter((a) => a.containsSensitiveData).length;

  return [
    {
      id: 'C01_LEGAL_BASIS',
      titleAr: 'الأساس النظامي والغرض المحدد (RoPA)',
      titleEn: 'Lawful Basis & Purpose Limitation (RoPA)',
      frameworkRef: 'UAE 45/2021 & KSA SDAIA PDPL',
      status: missingPurpose ? 'fail' : 'pass',
      weight: 10,
      noteAr: missingPurpose
        ? 'توجد أنشطة معالجة بدون غرض نظامي موثق.'
        : 'تم تحديد الأساس النظامي والغرض لكل نشاط معالجة.',
      noteEn: missingPurpose
        ? 'One or more processing activities are missing a purpose.'
        : 'Every activity documents its lawful basis and purpose.',
    },
    {
      id: 'C02_ARABIC_NOTICE',
      titleAr: 'إشعار الخصوصية العربي (وثنائي اللغة)',
      titleEn: 'Arabic & Bilingual Privacy Notice Prior to Collection',
      frameworkRef: 'KSA SDAIA PDPL / UAE PDPL',
      status: noticeStatus,
      weight: 12,
      noteAr:
        noticeStatus === 'fail'
          ? 'رابط إشعار الخصوصية المطلوب غير مكتمل.'
          : noticeStatus === 'partial'
            ? 'الإشعار العربي متوفر؛ يُنصح بإرفاق النسخة الإنجليزية أيضاً.'
            : 'روابط إشعار الخصوصية الثنائية موثقة ومتاحة قبل الجمع.',
      noteEn:
        noticeStatus === 'fail'
          ? 'Required privacy notice link is missing.'
          : noticeStatus === 'partial'
            ? 'Arabic notice present; English URL is recommended for UAE scope.'
            : 'Bilingual privacy notice links are documented prior to collection.',
    },
    {
      id: 'C03_MARKETING_OPTIN',
      titleAr: 'فصل وموافقة التسويق الصريحة (Opt-in)',
      titleEn: 'Explicit Separate Marketing Opt-In Consent',
      frameworkRef: 'KSA PDPL Marketing & UAE Consent Rules',
      status: marketingGap ? 'fail' : 'pass',
      weight: 10,
      noteAr: marketingGap
        ? 'يوجد نشاط تسويقي يفتقر لموافقة صريحة منفصلة.'
        : 'الأنشطة التسويقية مضبوطة بموافقة صريحة منفصلة.',
      noteEn: marketingGap
        ? 'A marketing processing activity lacks explicit opt-in consent.'
        : 'All marketing activities enforce explicit separate opt-in.',
    },
    {
      id: 'C04_CROSS_BORDER',
      titleAr: 'ضوابط نقل البيانات عبر الحدود (SCCs / التوطين)',
      titleEn: 'Cross-Border Transfer Safeguards (Residency / SCCs)',
      frameworkRef: 'KSA Transfer Reg & UAE PDPL',
      status: crossBorderStatus,
      weight: 14,
      noteAr:
        crossBorderStatus === 'fail'
          ? `رُصدت ${audit.unprotectedTransfers} عمليات نقل خارجي دون ضمانة نظامية.`
          : crossBorderStatus === 'partial'
            ? 'نقل خارجي يستلزم مراجعة تقييم الأثر وتفضيل SCCs.'
            : 'نطاقات الاستضافة والنقل عبر الحدود مدعومة بضمانات موثقة.',
      noteEn:
        crossBorderStatus === 'fail'
          ? `${audit.unprotectedTransfers} cross-border transfers lack documented safeguards.`
          : crossBorderStatus === 'partial'
            ? 'Sensitive cross-border transfer should reinforce SCC documentation.'
            : 'All cross-border hosting flows hold residency or SCC safeguards.',
    },
    {
      id: 'C05_RETENTION_SCHEDULE',
      titleAr: 'تحديد مدد الاحتفاظ والحذف الدوري',
      titleEn: 'Defined Retention Days & Minimization',
      frameworkRef: 'UAE 45/2021 & KSA PDPL',
      status: retentionGap ? 'fail' : 'pass',
      weight: 10,
      noteAr: retentionGap
        ? 'توجد أنشطة تفتقر لمدة احتفاظ محددة بالأيام.'
        : 'جميع الأنشطة مقيدة بمدة احتفاظ محددة.',
      noteEn: retentionGap
        ? 'At least one activity omits positive retention days.'
        : 'Every activity enforces explicit numeric retention days.',
    },
    {
      id: 'C06_DSR_CHANNEL',
      titleAr: 'قناة حقوق أصحاب البيانات ومؤشر الاستجابة (DSAR)',
      titleEn: 'Data Subject Rights (DSAR) Channel & SLA',
      frameworkRef: 'UAE & KSA DSR Rights',
      status: dsrStatus,
      weight: 10,
      noteAr:
        dsrStatus === 'fail'
          ? 'بريد التواصل لطلبات الخصوصية غير مضبوط.'
          : dsrStatus === 'partial'
            ? 'البريد مضبوط لكن مهلة DSAR تتجاوز 30 يوماً.'
            : `قناة DSAR (${org.contactEmail}) مفعلة بمهلة ${org.dsarSlaDays} يوماً.`,
      noteEn:
        dsrStatus === 'fail'
          ? 'Privacy / DSAR contact email is missing or invalid.'
          : dsrStatus === 'partial'
            ? 'DSAR contact exists, but SLA target exceeds 30 days.'
            : `DSAR inbox (${org.contactEmail}) active with ${org.dsarSlaDays}-day SLA.`,
    },
    {
      id: 'C07_SENSITIVE_DATA',
      titleAr: 'ضوابط البيانات الحساسة والاستثنائية',
      titleEn: 'Sensitive Personal Data Lawful Guardrails',
      frameworkRef: 'UAE PDPL & KSA PDPL Sensitive Data',
      status: sensitiveGap ? 'fail' : 'pass',
      weight: 10,
      noteAr: sensitiveGap
        ? 'تم ربط بيانات حساسة بأساس نظامي غير مجاز (مصلحة مشروعة/عقد).'
        : sensitiveCount > 0
          ? `جميع الأنشطة الحساسة (${sensitiveCount}) محمية بأساس نظامي ملائم.`
          : 'لا توجد فجوات في مسار البيانات الحساسة.',
      noteEn: sensitiveGap
        ? 'Sensitive data relies on an unsupported lawful basis.'
        : sensitiveCount > 0
          ? `All ${sensitiveCount} sensitive activities use valid strict lawful bases.`
          : 'No sensitive personal data lawful-basis violations detected.',
    },
    {
      id: 'C08_BREACH_72H_CLOCK',
      titleAr: 'مؤقت الـ 72 ساعة لإبلاغ سدايا ومكتب الإمارات للبيانات',
      titleEn: '72-Hour SDAIA & UAE Data Office Breach Clock',
      frameworkRef: 'KSA SDAIA 72h Rule & UAE PDPL',
      status: breachStatus,
      weight: 12,
      noteAr: breach.guidanceAr,
      noteEn: breach.guidanceEn,
    },
    {
      id: 'C09_PROCESSOR_REGISTRY',
      titleAr: 'حصر المعالجين الخارجيين ومزودي البنية',
      titleEn: 'Sub-Processor & Hosting Vendor Inventory',
      frameworkRef: 'Controller-Processor Governance',
      status: processorStatus,
      weight: 6,
      noteAr: missingProcessor
        ? 'يوجد نشاط بدون اسم المعالج أو مزود الاستضافة.'
        : 'تم توثيق أسماء المعالجين في سجل المعالجة.',
      noteEn: missingProcessor
        ? 'One or more activities omit the sub-processor vendor name.'
        : 'All sub-processors / hosting vendors are documented.',
    },
    {
      id: 'C10_DPO_GOVERNANCE',
      titleAr: 'مسؤول حماية البيانات والحوكمة المؤسسية (DPO)',
      titleEn: 'Data Protection Officer (DPO) Governance',
      frameworkRef: 'UAE Art. 10 & KSA DPO Guidance',
      status: dpoStatus,
      weight: 6,
      noteAr: org.dpoAppointed
        ? 'تم تعيين مسؤول حماية البيانات وتوثيقه.'
        : 'لم يُعيّن DPO رسمي بعد — يُنصح بتعيينه عند التوسع أو البيانات الحساسة.',
      noteEn: org.dpoAppointed
        ? 'Dedicated DPO governance owner is appointed.'
        : 'No formal DPO appointed yet — recommended for high-volume or sensitive processing.',
    },
  ];
}

function computeBreachReadinessScore(breach: BreachWindowAssessment): number {
  if (breach.state === 'no_incident' || breach.state === 'notified_on_time') {
    return breach.slaRiskTier === 'elevated' ? 88 : 100;
  }
  if (breach.state === 'within_72h') {
    return 65;
  }
  if (breach.state === 'urgent_under_12h') {
    return 35;
  }
  return 10;
}

export function computePdplSummary(
  audit: RopaAuditReport,
  controls: PdplCheckItem[],
  breachAssessment: BreachWindowAssessment,
): PdplSummary {
  const breachReadinessScore = computeBreachReadinessScore(breachAssessment);
  const overallScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        audit.ropaScore * 0.4 +
          audit.crossBorderScore * 0.3 +
          breachReadinessScore * 0.3,
      ),
    ),
  );

  const controlsPassed = controls.filter((c) => c.status === 'pass').length;
  const controlsTotal = controls.length;

  let readinessTier: ReadinessTier = 'ready';
  if (audit.blockersCount > 0 || breachAssessment.overdue || overallScore < 60) {
    readinessTier = 'blocked';
  } else if (
    audit.warningsCount > 0 ||
    breachAssessment.state === 'within_72h' ||
    breachAssessment.state === 'urgent_under_12h' ||
    overallScore < 90
  ) {
    readinessTier = 'needs_remediation';
  }

  return {
    overallScore,
    ropaScore: audit.ropaScore,
    crossBorderScore: audit.crossBorderScore,
    breachReadinessScore,
    controlsPassed,
    controlsTotal,
    blockersCount: audit.blockersCount,
    warningsCount: audit.warningsCount,
    readinessTier,
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeJsonLd(jsonText: string): string {
  return jsonText.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function buildBilingualPrivacyNoticeHtml(
  dossier: PdplDossier,
  locale: Locale = 'ar',
): string {
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const orgName = isAr
    ? dossier.organization.organizationNameAr
    : dossier.organization.organizationNameEn;
  const disclaimer = isAr ? PDPLCHECK_LEGAL_DISCLAIMER_AR : PDPLCHECK_LEGAL_DISCLAIMER_EN;

  const jsonLdPayload = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: isAr ? `إشعار الخصوصية — ${orgName}` : `Privacy Notice — ${orgName}`,
    inLanguage: isAr ? 'ar' : 'en',
    identifier: dossier.dossierCode,
    publisher: {
      '@type': 'Organization',
      name: orgName,
      email: dossier.organization.contactEmail,
    },
    about: 'UAE PDPL Federal Decree-Law No. 45/2021 & KSA SDAIA PDPL',
  };

  const activityRows = dossier.activities
    .map((item) => {
      const name = isAr ? item.activityNameAr : item.activityNameEn;
      const basis = isAr
        ? LAWFUL_BASIS_META[item.lawfulBasis].labelAr
        : LAWFUL_BASIS_META[item.lawfulBasis].labelEn;
      const region = isAr
        ? HOSTING_REGION_META[item.hostingRegion].labelAr
        : HOSTING_REGION_META[item.hostingRegion].labelEn;
      const safeguard = isAr
        ? SAFEGUARD_META[item.transferSafeguard].labelAr
        : SAFEGUARD_META[item.transferSafeguard].labelEn;
      return `      <tr>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(item.purpose)}</td>
        <td>${escapeHtml(basis)}</td>
        <td>${escapeHtml(region)}</td>
        <td>${escapeHtml(safeguard)}</td>
        <td>${escapeHtml(String(item.retentionDays))} ${isAr ? 'يوماً' : 'days'}</td>
      </tr>`;
    })
    .join('\n');

  const safeJsonLd = escapeJsonLd(JSON.stringify(jsonLdPayload, null, 2));

  return `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(isAr ? `إشعار الخصوصية — ${orgName}` : `Privacy Notice — ${orgName}`)}</title>
  <script type="application/ld+json">${safeJsonLd}</script>
</head>
<body style="font-family: system-ui, sans-serif; background:#FAF9F6; color:#0F172A; line-height:1.7; padding:2rem; max-width:920px; margin:auto;">
  <header style="border-bottom:2px solid #0F766E; padding-bottom:1rem; margin-bottom:1.5rem;">
    <h1 style="margin:0; color:#0F766E;">${escapeHtml(isAr ? `إشعار الخصوصية — ${orgName}` : `Privacy Notice — ${orgName}`)}</h1>
    <p style="margin:0.4rem 0 0; color:#475569;">${escapeHtml(isAr ? `مرجع الملف: ${dossier.dossierCode} | قناة الحقوق (DSAR): ${dossier.organization.contactEmail}` : `Dossier: ${dossier.dossierCode} | Privacy / DSAR Contact: ${dossier.organization.contactEmail}`)}</p>
  </header>

  <aside style="background:#FFFBEB; border:1px solid #B45309; padding:1rem; border-radius:8px; margin-bottom:1.5rem;">
    <strong>${escapeHtml(isAr ? 'إخلاء مسؤولية النطاق' : 'Scope Notice')}:</strong>
    <p style="margin:0.4rem 0 0;">${escapeHtml(disclaimer)}</p>
  </aside>

  <section>
    <h2>${escapeHtml(isAr ? '1. سجل أنشطة المعالجة والنقل عبر الحدود (RoPA)' : '1. Processing Activities & Cross-Border Transfers (RoPA)')}</h2>
    <table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; background:#FFFFFF;">
      <thead style="background:#ECFDF5;">
        <tr>
          <th>${escapeHtml(isAr ? 'النشاط' : 'Activity')}</th>
          <th>${escapeHtml(isAr ? 'الغرض' : 'Purpose')}</th>
          <th>${escapeHtml(isAr ? 'الأساس النظامي' : 'Lawful Basis')}</th>
          <th>${escapeHtml(isAr ? 'منطقة الاستضافة' : 'Hosting Region')}</th>
          <th>${escapeHtml(isAr ? 'ضمانة النقل' : 'Transfer Safeguard')}</th>
          <th>${escapeHtml(isAr ? 'الاحتفاظ' : 'Retention')}</th>
        </tr>
      </thead>
      <tbody>
${activityRows}
      </tbody>
    </table>
  </section>

  <section style="margin-top:1.5rem;">
    <h2>${escapeHtml(isAr ? '2. حقوق أصحاب البيانات وآلية التواصل' : '2. Data Subject Rights & Contact')}</h2>
    <p>${escapeHtml(
      isAr
        ? `يحق لك طلب الوصول إلى بياناتك أو تصحيحها أو إتلافها/محوها أو سحب موافقتك التسويقية في أي وقت عبر مراسلة ${dossier.organization.contactEmail}، ونستهدف الرد خلال ${dossier.organization.dsarSlaDays} يوماً.`
        : `You may request access, rectification, erasure, restriction, or withdraw marketing consent at any time via ${dossier.organization.contactEmail} (target turnaround: ${dossier.organization.dsarSlaDays} days).`,
    )}</p>
  </section>

  <footer style="margin-top:2rem; border-top:1px solid #CBD5E1; padding-top:0.8rem; font-size:0.85rem; color:#475569;">
    SHA-256 Digest: <code>${escapeHtml(dossier.digestHex)}</code>
  </footer>
</body>
</html>
`;
}

export function buildPdplRopaDossierMarkdown(
  dossier: PdplDossier,
  locale: Locale = 'ar',
): string {
  const isAr = locale === 'ar';
  const orgName = isAr
    ? dossier.organization.organizationNameAr
    : dossier.organization.organizationNameEn;
  const disclaimer = isAr ? PDPLCHECK_LEGAL_DISCLAIMER_AR : PDPLCHECK_LEGAL_DISCLAIMER_EN;

  const lines: string[] = [
    isAr
      ? `# سجل الجاهزية والخصوصية — ${orgName} (${dossier.dossierCode})`
      : `# Gulf PDPL RoPA & Readiness Dossier — ${orgName} (${dossier.dossierCode})`,
    '',
    `> ${disclaimer}`,
    '',
    isAr ? '## 1. ملخص النتيجة والمؤشرات' : '## 1. Readiness Summary',
    `- **${isAr ? 'النتيجة الكلية' : 'Overall Score'}**: \`${dossier.summary.overallScore}/100\` (\`${dossier.summary.readinessTier}\`)`,
    `- **${isAr ? 'درجة RoPA' : 'RoPA Score'}**: \`${dossier.summary.ropaScore}/100\` | **${isAr ? 'درجة النقل الخارجي' : 'Cross-Border Score'}**: \`${dossier.summary.crossBorderScore}/100\` | **${isAr ? 'جاهزية الـ 72 ساعة' : '72h Breach Score'}**: \`${dossier.summary.breachReadinessScore}/100\``,
    `- **${isAr ? 'العوائق / التحذيرات' : 'Blockers / Warnings'}**: \`${dossier.summary.blockersCount}\` / \`${dossier.summary.warningsCount}\``,
    `- **${isAr ? 'حالة نافذة الـ 72 ساعة' : '72h Breach Clock State'}**: \`${dossier.breachAssessment.state}\` (${isAr ? 'المتبقي' : 'remaining'}: \`${dossier.breachAssessment.remainingHours}h\`)`,
    '',
    isAr ? '## 2. مصفوفة الضوابط الـ 10' : '## 2. 10-Control Dual-PDPL Matrix',
  ];

  for (const ctrl of dossier.controls) {
    const title = isAr ? ctrl.titleAr : ctrl.titleEn;
    const note = isAr ? ctrl.noteAr : ctrl.noteEn;
    lines.push(`- [${ctrl.status.toUpperCase()}] **${ctrl.id}** — ${title}: ${note}`);
  }

  lines.push('');
  lines.push(isAr ? '## 3. سجل أنشطة المعالجة (RoPA)' : '## 3. RoPA Processing Register');
  for (const item of dossier.activities) {
    const name = isAr ? item.activityNameAr : item.activityNameEn;
    lines.push(
      `- **${item.id}** (${name}): ${item.purpose} | \`${item.lawfulBasis}\` | \`${item.hostingRegion}\` | \`${item.transferSafeguard}\` | \`${item.retentionDays}d\``,
    );
  }

  lines.push('');
  lines.push(`---`);
  lines.push(
    `${isAr ? 'ختم النزاهة الحتمي' : 'Deterministic SHA-256 Seal'}: \`${dossier.dossierCode}\` — \`${dossier.digestHex}\``,
  );

  return lines.join('\n');
}
