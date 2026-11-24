import { useState } from 'react';
import { AlarmClock, Download, FileSpreadsheet, Play, ShieldAlert } from 'lucide-react';
import type {
  BreachRiskSeverity,
  BreachTriageInput,
  BreachWindowAssessment,
  Locale,
  OrganizationPrivacyProfile,
  RopaCsvAuditReport,
} from '../core/types.ts';
import { auditRopaCsvApi, triggerTextDownload } from '../lib/api.ts';
import type { PdplUiCopy } from '../lib/i18n.ts';

interface BreachAndCsvPanelProps {
  locale: Locale;
  copy: PdplUiCopy;
  locked: boolean;
  organization: OrganizationPrivacyProfile;
  breachTriage: BreachTriageInput;
  breachAssessment: BreachWindowAssessment;
  onChangeBreachTriage: (next: BreachTriageInput) => void;
}

const SAMPLE_ROPA_CSV = [
  'activity_id,activity_name_ar,activity_name_en,purpose,data_categories,contains_sensitive_data,is_marketing_activity,explicit_marketing_opt_in,lawful_basis,hosting_region,transfer_safeguard,retention_days,processor_name',
  'CSV-01,الفوترة السحابية,Subscription Billing,"Issue tax invoices, manage accounts",identity|tax_id,false,false,false,contract,uae_local,local_residency,1825,UAE Financial Cloud',
  'CSV-02,الحملات التسويقية,Marketing Campaigns,Newsletter and seasonal offers,email|name,false,true,true,explicit_consent,ksa_local,local_residency,365,KSA Mail Relay',
  'CSV-03,التتبع الإعلاني,Ad Retargeting,Behavioral ad targeting across networks,device_id|ip_address,false,true,false,legitimate_interest,us_cloud,none,365,=HYPERLINK("http://test")',
].join('\n');

export default function BreachAndCsvPanel({
  locale,
  copy,
  locked,
  organization,
  breachTriage,
  breachAssessment,
  onChangeBreachTriage,
}: BreachAndCsvPanelProps) {
  const isAr = locale === 'ar';
  const [csvText, setCsvText] = useState(SAMPLE_ROPA_CSV);
  const [csvResult, setCsvResult] = useState<{
    report: RopaCsvAuditReport;
    csvExport: string;
  } | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [runningCsv, setRunningCsv] = useState(false);

  function setBreachField<K extends keyof BreachTriageInput>(
    key: K,
    value: BreachTriageInput[K],
  ) {
    onChangeBreachTriage({ ...breachTriage, [key]: value });
  }

  function simulateHoursAgo(hoursAgo: number | null) {
    if (hoursAgo === null) {
      onChangeBreachTriage({
        activeIncident: false,
        incidentTitleAr: '',
        incidentTitleEn: '',
        discoveredAtIso: '',
        reportedToRegulator: false,
        reportedAtIso: '',
        riskSeverity: 'none',
        affectedSubjectsCount: 0,
        likelyDataSubjectsNotified: false,
      });
      return;
    }

    const discoveredIso = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
    onChangeBreachTriage({
      activeIncident: true,
      incidentTitleAr: `حادثة محاكاة (${hoursAgo} ساعة منذ العلم)`,
      incidentTitleEn: `Simulated breach triage (${hoursAgo}h since awareness)`,
      discoveredAtIso: discoveredIso,
      reportedToRegulator: false,
      reportedAtIso: '',
      riskSeverity: hoursAgo >= 65 ? 'high_harm' : 'moderate',
      affectedSubjectsCount: hoursAgo >= 65 ? 1420 : 250,
      likelyDataSubjectsNotified: false,
    });
  }

  async function handleRunCsvAudit() {
    setRunningCsv(true);
    setCsvError(null);
    try {
      const res = await auditRopaCsvApi(csvText, locale, organization);
      setCsvResult(res);
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Failed to audit CSV');
      setCsvResult(null);
    } finally {
      setRunningCsv(false);
    }
  }

  const clockBadgeColor =
    breachAssessment.state === 'no_incident' || breachAssessment.state === 'notified_on_time'
      ? 'bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)] border-[var(--accent-emerald)]'
      : breachAssessment.state === 'within_72h'
        ? 'bg-[var(--accent-amber-soft)] text-[var(--accent-amber)] border-[var(--accent-amber)]'
        : 'bg-[var(--accent-crimson-soft)] text-[var(--accent-crimson)] border-[var(--accent-crimson)]';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* 72-Hour SDAIA + UAE Data Office Breach Triage */}
      <section className="pdpl-card rounded-2xl p-5 lg:col-span-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlarmClock className="h-5 w-5 text-[var(--accent-gold)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              {copy.breachSectionTitle}
            </h2>
          </div>
          <span
            data-testid="breach-state-badge"
            className={`pdpl-mono rounded-full border px-3 py-1 text-xs font-bold ${clockBadgeColor}`}
          >
            {breachAssessment.state}
          </span>
        </div>

        {!locked && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="simulate-38h-btn"
              onClick={() => simulateHoursAgo(38)}
              className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-primary)] transition hover:opacity-90"
            >
              {copy.simulate38hBtn}
            </button>
            <button
              type="button"
              data-testid="simulate-65h-btn"
              onClick={() => simulateHoursAgo(65)}
              className="rounded-lg border border-[var(--accent-amber)] bg-[var(--accent-amber-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-amber)] transition hover:opacity-90"
            >
              {copy.simulate65hBtn}
            </button>
            <button
              type="button"
              data-testid="simulate-80h-btn"
              onClick={() => simulateHoursAgo(80)}
              className="rounded-lg border border-[var(--accent-crimson)] bg-[var(--accent-crimson-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-crimson)] transition hover:opacity-90"
            >
              {copy.simulate80hBtn}
            </button>
            <button
              type="button"
              data-testid="simulate-clean-btn"
              onClick={() => simulateHoursAgo(null)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]"
            >
              {copy.simulateCleanBtn}
            </button>
          </div>
        )}

        <label className="mb-4 flex cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm font-semibold">
          <input
            type="checkbox"
            disabled={locked}
            checked={breachTriage.activeIncident}
            onChange={(e) => setBreachField('activeIncident', e.target.checked)}
            className="h-4 w-4 accent-[var(--accent-gold)]"
          />
          <ShieldAlert className="h-4 w-4 text-[var(--accent-gold)]" />
          <span>{copy.breachActiveToggle}</span>
        </label>

        {/* Live 72h Readout Grid */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3">
            <div className="text-xs text-[var(--text-secondary)]">{copy.elapsedLabel}</div>
            <div className="pdpl-mono num-tabular mt-1 text-xl font-extrabold text-[var(--text-primary)]">
              {breachAssessment.elapsedHours}h
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3">
            <div className="text-xs text-[var(--text-secondary)]">{copy.remainingLabel}</div>
            <div className="pdpl-mono num-tabular mt-1 text-xl font-extrabold text-[var(--accent-primary)]">
              {breachAssessment.remainingHours}h
            </div>
          </div>
          <div className="col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 sm:col-span-1">
            <div className="text-xs text-[var(--text-secondary)]">{copy.deadlineLabel}</div>
            <div dir="ltr" className="pdpl-mono num-tabular mt-1 truncate text-xs font-semibold">
              {breachAssessment.sdaiaDeadlineIso || '—'}
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2 text-xs">
            <span className="block text-[var(--text-secondary)]">{copy.sdaiaNoticeLabel}</span>
            <strong className="mt-0.5 block font-bold">
              {breachAssessment.requiresSdaiaNotification ? copy.requiredYes : copy.requiredNo}
            </strong>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2 text-xs">
            <span className="block text-[var(--text-secondary)]">{copy.uaeNoticeLabel}</span>
            <strong className="mt-0.5 block font-bold">
              {breachAssessment.requiresUaeDataOfficeNotification
                ? copy.requiredYes
                : copy.requiredNo}
            </strong>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2 text-xs">
            <span className="block text-[var(--text-secondary)]">{copy.subjectsNoticeLabel}</span>
            <strong className="mt-0.5 block font-bold">
              {breachAssessment.requiresDataSubjectNotification
                ? copy.requiredYes
                : copy.requiredNo}
            </strong>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3 text-xs leading-relaxed">
          {isAr ? breachAssessment.guidanceAr : breachAssessment.guidanceEn}
        </div>

        {breachTriage.activeIncident && (
          <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  {copy.incidentTitleArLabel}
                </label>
                <input
                  type="text"
                  dir="rtl"
                  disabled={locked}
                  className="pdpl-input"
                  value={breachTriage.incidentTitleAr}
                  onChange={(e) => setBreachField('incidentTitleAr', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  {copy.incidentTitleEnLabel}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  disabled={locked}
                  className="pdpl-input"
                  value={breachTriage.incidentTitleEn}
                  onChange={(e) => setBreachField('incidentTitleEn', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  {copy.discoveredAtLabel}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  disabled={locked}
                  className="pdpl-input pdpl-mono"
                  value={breachTriage.discoveredAtIso}
                  onChange={(e) => setBreachField('discoveredAtIso', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  {copy.riskSeverityLabel}
                </label>
                <select
                  disabled={locked}
                  className="pdpl-input"
                  value={breachTriage.riskSeverity}
                  onChange={(e) =>
                    setBreachField('riskSeverity', e.target.value as BreachRiskSeverity)
                  }
                >
                  <option value="none">{isAr ? 'محتوى / لا خطر' : 'None'}</option>
                  <option value="moderate">{isAr ? 'تأثير متوسط' : 'Moderate'}</option>
                  <option value="high_harm">{isAr ? 'ضرر جسيم' : 'High Harm'}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  {copy.affectedCountLabel}
                </label>
                <input
                  type="number"
                  min={0}
                  dir="ltr"
                  disabled={locked}
                  className="pdpl-input num-tabular"
                  value={breachTriage.affectedSubjectsCount}
                  onChange={(e) =>
                    setBreachField('affectedSubjectsCount', Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-1 text-xs font-medium">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={breachTriage.reportedToRegulator}
                  onChange={(e) => setBreachField('reportedToRegulator', e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent-primary)]"
                />
                <span>{copy.reportedToRegulatorToggle}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={breachTriage.likelyDataSubjectsNotified}
                  onChange={(e) => setBreachField('likelyDataSubjectsNotified', e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent-primary)]"
                />
                <span>{copy.subjectsNotifiedToggle}</span>
              </label>
            </div>

            {breachTriage.reportedToRegulator && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  {copy.reportedAtLabel}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  disabled={locked}
                  placeholder="2026-11-24T10:00:00.000Z"
                  className="pdpl-input pdpl-mono"
                  value={breachTriage.reportedAtIso}
                  onChange={(e) => setBreachField('reportedAtIso', e.target.value)}
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Bulk RoPA CSV Batch Auditor */}
      <section className="pdpl-card rounded-2xl p-5 lg:col-span-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[var(--accent-primary)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">{copy.csvBatchTitle}</h2>
          </div>
          <button
            type="button"
            onClick={() => setCsvText(SAMPLE_ROPA_CSV)}
            className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-primary)]"
          >
            {copy.csvLoadSampleBtn}
          </button>
        </div>

        <textarea
          rows={7}
          dir="ltr"
          className="pdpl-input pdpl-mono text-xs leading-relaxed"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="run-csv-audit-btn"
            disabled={runningCsv}
            onClick={handleRunCsvAudit}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-[var(--accent-primary-fg)] transition hover:bg-[var(--accent-primary-hover)]"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{copy.csvAuditBtn}</span>
          </button>

          {csvResult && (
            <button
              type="button"
              data-testid="download-csv-audit-btn"
              onClick={() =>
                triggerTextDownload(
                  `pdplcheck-ropa-batch-${locale}.csv`,
                  csvResult.csvExport,
                  'text/csv;charset=utf-8',
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-bold text-[var(--accent-primary)]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{copy.csvDownloadBtn}</span>
            </button>
          )}
        </div>

        {csvError && (
          <div className="mt-3 rounded-xl border border-[var(--accent-crimson)] bg-[var(--accent-crimson-soft)] p-3 text-xs font-semibold text-[var(--accent-crimson)]">
            {csvError}
          </div>
        )}

        {csvResult && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
              <div className="rounded-lg bg-[var(--accent-emerald-soft)] p-2 text-[var(--accent-emerald)]">
                {isAr ? 'سليم' : 'Passed'}: {csvResult.report.passedRows}
              </div>
              <div className="rounded-lg bg-[var(--accent-amber-soft)] p-2 text-[var(--accent-amber)]">
                {isAr ? 'تحذير' : 'Warning'}: {csvResult.report.warningRows}
              </div>
              <div className="rounded-lg bg-[var(--accent-crimson-soft)] p-2 text-[var(--accent-crimson)]">
                {isAr ? 'عائق' : 'Blocked'}: {csvResult.report.blockedRows}
              </div>
            </div>

            <div className="max-h-64 overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table data-testid="csv-results-table" className="w-full border-collapse text-xs">
                <thead className="bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-2.5 py-2 text-start">ID</th>
                    <th className="px-2.5 py-2 text-start">{isAr ? 'النشاط' : 'Activity'}</th>
                    <th className="px-2.5 py-2 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="px-2.5 py-2 text-start">{isAr ? 'الملاحظات' : 'Notes'}</th>
                  </tr>
                </thead>
                <tbody>
                  {csvResult.report.rows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className="border-t border-[var(--border-subtle)] bg-[var(--bg-canvas)]"
                    >
                      <td className="pdpl-mono px-2.5 py-2 font-semibold">{row.activityId}</td>
                      <td className="px-2.5 py-2">
                        {isAr ? row.item.activityNameAr : row.item.activityNameEn}
                      </td>
                      <td className="px-2.5 py-2 font-bold">{row.status}</td>
                      <td className="px-2.5 py-2">
                        {row.issues.length > 0
                          ? row.issues
                              .map((iss) => (isAr ? iss.messageAr : iss.messageEn))
                              .join(' | ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
