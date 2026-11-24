import { describe, expect, it } from 'vitest';

import {
  buildBilingualPrivacyNoticeHtml,
  buildPdplRopaDossierMarkdown,
} from '../../src/core/breachAndNotice.ts';
import {
  buildExecutiveSummaryText,
  verifyDossierIntegrity,
} from '../../src/core/dossierDigest.ts';
import {
  KSA_BREACH_WINDOW_HOURS,
  KSA_PDPL_CODE,
  PDPLCHECK_LEGAL_DISCLAIMER_AR,
  PDPLCHECK_LEGAL_DISCLAIMER_EN,
  UAE_PDPL_CODE,
  evaluateBreach72hClock,
} from '../../src/core/pdplRules.ts';
import { createDossierFromPreset, PDPLCHECK_PRESETS } from '../../src/core/presets.ts';
import {
  PdplCoreError,
  auditPdplRopaAndTransfers,
  auditRopaCsv,
  exportRopaCsv,
  sanitizeCsvCell,
} from '../../src/core/ropaAuditor.ts';

describe('PDPLCheck zero-dependency core engine', () => {
  it('exposes UAE & KSA framework constants and evaluates the 72h SDAIA breach clock', () => {
    expect(UAE_PDPL_CODE).toBe('UAE-PDPL-45-2021');
    expect(KSA_PDPL_CODE).toBe('KSA-SDAIA-PDPL');
    expect(KSA_BREACH_WINDOW_HOURS).toBe(72);
    expect(PDPLCHECK_LEGAL_DISCLAIMER_AR).toContain('سدايا');
    expect(PDPLCHECK_LEGAL_DISCLAIMER_EN).toContain('NOT legal counsel');

    const refIso = '2026-11-24T10:00:00.000Z';

    const withinWindow = evaluateBreach72hClock(
      {
        activeIncident: true,
        incidentTitleAr: 'اختبار نافذة 38 ساعة',
        incidentTitleEn: '38h active breach triage',
        discoveredAtIso: '2026-11-22T20:00:00.000Z',
        reportedToRegulator: false,
        reportedAtIso: '',
        riskSeverity: 'high_harm',
        affectedSubjectsCount: 300,
        likelyDataSubjectsNotified: false,
      },
      refIso,
    );
    expect(withinWindow.state).toBe('within_72h');
    expect(withinWindow.elapsedHours).toBe(38);
    expect(withinWindow.remainingHours).toBe(34);
    expect(withinWindow.overdue).toBe(false);
    expect(withinWindow.requiresSdaiaNotification).toBe(true);
    expect(withinWindow.requiresUaeDataOfficeNotification).toBe(true);
    expect(withinWindow.requiresDataSubjectNotification).toBe(true);

    const urgentWindow = evaluateBreach72hClock(
      {
        activeIncident: true,
        incidentTitleAr: 'نافذة حرجة',
        incidentTitleEn: 'Urgent 65h incident',
        discoveredAtIso: '2026-11-21T17:00:00.000Z',
        reportedToRegulator: false,
        reportedAtIso: '',
        riskSeverity: 'moderate',
        affectedSubjectsCount: 90,
        likelyDataSubjectsNotified: false,
      },
      refIso,
    );
    expect(urgentWindow.state).toBe('urgent_under_12h');
    expect(urgentWindow.remainingHours).toBe(7);
    expect(urgentWindow.slaRiskTier).toBe('critical');

    const overdueWindow = evaluateBreach72hClock(
      {
        activeIncident: true,
        incidentTitleAr: 'حادثة متجاوزة',
        incidentTitleEn: 'Overdue incident',
        discoveredAtIso: '2026-11-21T02:00:00.000Z',
        reportedToRegulator: false,
        reportedAtIso: '',
        riskSeverity: 'moderate',
        affectedSubjectsCount: 50,
        likelyDataSubjectsNotified: false,
      },
      refIso,
    );
    expect(overdueWindow.state).toBe('overdue');
    expect(overdueWindow.overdue).toBe(true);
    expect(overdueWindow.remainingHours).toBe(0);

    const notifiedWindow = evaluateBreach72hClock(
      {
        activeIncident: true,
        incidentTitleAr: 'تم الإبلاغ بالوقت',
        incidentTitleEn: 'Reported within 18h',
        discoveredAtIso: '2026-11-23T12:00:00.000Z',
        reportedToRegulator: true,
        reportedAtIso: '2026-11-24T06:00:00.000Z',
        riskSeverity: 'moderate',
        affectedSubjectsCount: 25,
        likelyDataSubjectsNotified: false,
      },
      refIso,
    );
    expect(notifiedWindow.state).toBe('notified_on_time');
    expect(notifiedWindow.elapsedHours).toBe(18);
    expect(notifiedWindow.overdue).toBe(false);
  });

  it('scores gcc-saas-compliant preset at 100/100 ready with all 10 controls passing', async () => {
    const dossier = await createDossierFromPreset('gcc-saas-compliant', {
      sequenceNumber: 1,
      referenceIso: '2026-11-24T10:00:00.000Z',
    });
    expect(PDPLCHECK_PRESETS).toHaveLength(3);
    expect(dossier.controls).toHaveLength(10);
    expect(dossier.summary.overallScore).toBe(100);
    expect(dossier.summary.ropaScore).toBe(100);
    expect(dossier.summary.crossBorderScore).toBe(100);
    expect(dossier.summary.breachReadinessScore).toBe(100);
    expect(dossier.summary.controlsPassed).toBe(10);
    expect(dossier.summary.blockersCount).toBe(0);
    expect(dossier.summary.readinessTier).toBe('ready');
  });

  it('flags missing Arabic notice, unconsented marketing, and unprotected transfers as blocked', async () => {
    const dossier = await createDossierFromPreset('ksa-ecommerce-transfer-gaps', {
      sequenceNumber: 2,
      referenceIso: '2026-11-24T10:00:00.000Z',
    });
    const codes = new Set(dossier.audit.issues.map((i) => i.code));
    expect(dossier.summary.readinessTier).toBe('blocked');
    expect(dossier.audit.unprotectedTransfers).toBe(2);
    expect(codes.has('MISSING_ARABIC_NOTICE')).toBe(true);
    expect(codes.has('UNCONSENTED_MARKETING')).toBe(true);
    expect(codes.has('CROSS_BORDER_NO_SAFEGUARD')).toBe(true);
    expect(codes.has('SENSITIVE_DATA_BASIS_GAP')).toBe(true);
    expect(codes.has('MISSING_RETENTION_PERIOD')).toBe(true);
    expect(codes.has('INVALID_DSR_EMAIL')).toBe(true);
  });

  it('evaluates breach-72h-triage-drill with active SLA countdown and remediation tier', async () => {
    const dossier = await createDossierFromPreset('breach-72h-triage-drill', {
      sequenceNumber: 3,
      referenceIso: '2026-11-24T10:00:00.000Z',
    });
    expect(dossier.breachAssessment.state).toBe('within_72h');
    expect(dossier.breachAssessment.remainingHours).toBe(34);
    expect(dossier.breachAssessment.requiresSdaiaNotification).toBe(true);
    expect(dossier.breachAssessment.requiresDataSubjectNotification).toBe(true);
    expect(dossier.summary.blockersCount).toBe(0);
    expect(dossier.summary.readinessTier).toBe('needs_remediation');
  });

  it('rejects empty RoPA lists with typed PdplCoreError', () => {
    expect(() =>
      auditPdplRopaAndTransfers(PDPLCHECK_PRESETS[0].organization, []),
    ).toThrowError(PdplCoreError);

    try {
      auditPdplRopaAndTransfers(PDPLCHECK_PRESETS[0].organization, []);
    } catch (err) {
      expect(err).toBeInstanceOf(PdplCoreError);
      expect((err as PdplCoreError).code).toBe('INVALID_ROPA');
    }
  });

  it('audits bulk RoPA CSV inputs and throws structured EMPTY_CSV / INVALID_CSV_HEADER errors', () => {
    try {
      auditRopaCsv('   \n ');
      throw new Error('Expected EMPTY_CSV');
    } catch (err) {
      expect(err).toBeInstanceOf(PdplCoreError);
      expect((err as PdplCoreError).code).toBe('EMPTY_CSV');
    }

    try {
      auditRopaCsv('activity_id,purpose\nA1,Billing');
      throw new Error('Expected INVALID_CSV_HEADER');
    } catch (err) {
      expect(err).toBeInstanceOf(PdplCoreError);
      expect((err as PdplCoreError).code).toBe('INVALID_CSV_HEADER');
    }

    const csvInput = [
      'activity_id,activity_name_ar,activity_name_en,purpose,data_categories,contains_sensitive_data,is_marketing_activity,explicit_marketing_opt_in,lawful_basis,hosting_region,transfer_safeguard,retention_days,processor_name',
      'CSV-01,الفوترة,Billing,"Invoicing, ledger",identity|tax_id,false,false,false,contract,uae_local,local_residency,1825,UAE Billing Cloud',
      'CSV-02,تتبع,Ad Tracking,Retargeting ads,device_id,false,true,false,legitimate_interest,us_cloud,none,365,US Ad Network',
    ].join('\n');

    const csvAudit = auditRopaCsv(csvInput, { jurisdiction: 'uae_pdpl' });
    expect(csvAudit.totalRows).toBe(2);
    expect(csvAudit.passedRows).toBe(1);
    expect(csvAudit.blockedRows).toBe(1);
    expect(csvAudit.rows[1].issues.some((i) => i.code === 'UNCONSENTED_MARKETING')).toBe(true);
    expect(csvAudit.rows[1].issues.some((i) => i.code === 'CROSS_BORDER_NO_SAFEGUARD')).toBe(true);
  });

  it('exports UTF-8 BOM CRLF CSV while neutralizing formula injection cells', () => {
    expect(sanitizeCsvCell('=CMD("calc")')).toBe('"\'=CMD(""calc"")"');
    expect(sanitizeCsvCell('+1+1')).toBe("'+1+1");
    expect(sanitizeCsvCell('-SUM(A1:A2)')).toBe("'-SUM(A1:A2)");
    expect(sanitizeCsvCell('@IMPORTXML')).toBe("'@IMPORTXML");

    const maliciousCsv = [
      'activity_id,activity_name_ar,activity_name_en,purpose,data_categories,contains_sensitive_data,is_marketing_activity,explicit_marketing_opt_in,lawful_basis,hosting_region,transfer_safeguard,retention_days,processor_name',
      'R-01,=2+3,+FormulaTest,"=HYPERLINK(""http://bad"")",email,false,false,false,contract,ksa_local,scc_contract,365,@MaliciousVendor',
    ].join('\n');

    const report = auditRopaCsv(maliciousCsv);
    const exportedEn = exportRopaCsv(report, 'en');
    const exportedAr = exportRopaCsv(report, 'ar');
    expect(exportedEn.startsWith('\uFEFF')).toBe(true);
    expect(exportedEn).toContain('\r\n');
    expect(exportedAr).toContain("'=2+3");
    expect(exportedEn).toContain("'+FormulaTest");
    expect(exportedEn).toContain("'=HYPERLINK");
    expect(exportedEn).toContain("'@MaliciousVendor");
  });

  it('builds XSS-safe bilingual privacy notice HTML + JSON-LD and Markdown register', async () => {
    const base = await createDossierFromPreset('gcc-saas-compliant', {
      sequenceNumber: 7,
      referenceIso: '2026-11-24T10:00:00.000Z',
    });

    const injected = {
      ...base,
      organization: {
        ...base.organization,
        organizationNameAr: 'شركة <script>alert(1)</script> الخليج',
        organizationNameEn: 'Gulf </script><img onerror=alert(2)> Co',
      },
    };

    const htmlAr = buildBilingualPrivacyNoticeHtml(injected, 'ar');
    expect(htmlAr).toContain('lang="ar" dir="rtl"');
    expect(htmlAr).not.toContain('<script>alert(1)</script>');
    expect(htmlAr).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(htmlAr).toContain('application/ld+json');
    expect(htmlAr).toContain(PDPLCHECK_LEGAL_DISCLAIMER_AR);

    const htmlEn = buildBilingualPrivacyNoticeHtml(injected, 'en');
    expect(htmlEn).toContain('lang="en" dir="ltr"');
    expect(htmlEn).toContain('\\u003c/script\\u003e');
    expect(htmlEn).not.toContain('</script><img onerror=alert(2)>');

    const mdAr = buildPdplRopaDossierMarkdown(base, 'ar');
    expect(mdAr).toContain('PDPL-2026-0007');
    expect(mdAr).toContain(PDPLCHECK_LEGAL_DISCLAIMER_AR);
    expect(mdAr).toContain('C08_BREACH_72H_CLOCK');
  });

  it('seals deterministic PDPL-YYYY-0001 SHA-256 digests and detects tampering', async () => {
    const dossier = await createDossierFromPreset('gcc-saas-compliant', {
      sequenceNumber: 1,
      referenceIso: '2026-11-24T10:00:00.000Z',
    });

    expect(dossier.dossierCode).toBe('PDPL-2026-0001');
    expect(dossier.digestHex).toMatch(/^[a-f0-9]{64}$/);

    const validCheck = await verifyDossierIntegrity(dossier);
    expect(validCheck.valid).toBe(true);

    const tampered = {
      ...dossier,
      organization: {
        ...dossier.organization,
        organizationNameEn: 'Tampered Entity LLC',
      },
    };
    const tamperedCheck = await verifyDossierIntegrity(tampered);
    expect(tamperedCheck.valid).toBe(false);
    expect(tamperedCheck.actualHex).not.toBe(tamperedCheck.expectedHex);

    const summaryAr = buildExecutiveSummaryText(dossier, 'ar');
    const summaryEn = buildExecutiveSummaryText(dossier, 'en');
    expect(summaryAr).toContain('PDPL-2026-0001');
    expect(summaryEn).toContain('Overall 100/100');
  });
});
