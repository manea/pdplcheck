import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  FileText,
  Printer,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  buildBilingualPrivacyNoticeHtml,
  buildPdplRopaDossierMarkdown,
} from '../core/breachAndNotice.ts';
import {
  HOSTING_REGION_META,
  LAWFUL_BASIS_META,
  PDPLCHECK_LEGAL_DISCLAIMER_AR,
  PDPLCHECK_LEGAL_DISCLAIMER_EN,
  SAFEGUARD_META,
} from '../core/pdplRules.ts';
import { exportRopaCsv } from '../core/ropaAuditor.ts';
import type { ControlStatus, Locale } from '../core/types.ts';
import { triggerTextDownload, type UiPdplDossier } from '../lib/api.ts';
import { formatReadinessTierLabel, type PdplUiCopy } from '../lib/i18n.ts';

interface DossierPreviewAndPrintProps {
  locale: Locale;
  copy: PdplUiCopy;
  locked: boolean;
  readOnlyPublic?: boolean;
  dossier: UiPdplDossier;
  onChangeControlStatus: (controlId: string, status: ControlStatus) => void;
  onCopySuccess: () => void;
}

export default function DossierPreviewAndPrint({
  locale,
  copy,
  locked,
  readOnlyPublic = false,
  dossier,
  onChangeControlStatus,
  onCopySuccess,
}: DossierPreviewAndPrintProps) {
  const isAr = locale === 'ar';
  const [noticeLocale, setNoticeLocale] = useState<Locale>(locale);
  const [showRawHtml, setShowRawHtml] = useState(false);

  const previewHtml = useMemo(
    () => buildBilingualPrivacyNoticeHtml(dossier, noticeLocale),
    [dossier, noticeLocale],
  );
  const previewIsAr = noticeLocale === 'ar';
  const previewOrgName = previewIsAr
    ? dossier.organization.organizationNameAr
    : dossier.organization.organizationNameEn;
  const markdownDoc = useMemo(
    () => buildPdplRopaDossierMarkdown(dossier, locale),
    [dossier, locale],
  );
  const csvDoc = useMemo(() => exportRopaCsv(dossier, locale), [dossier, locale]);

  const tierColor =
    dossier.summary.readinessTier === 'ready'
      ? 'bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)] border-[var(--accent-emerald)]'
      : dossier.summary.readinessTier === 'needs_remediation'
        ? 'bg-[var(--accent-amber-soft)] text-[var(--accent-amber)] border-[var(--accent-amber)]'
        : 'bg-[var(--accent-crimson-soft)] text-[var(--accent-crimson)] border-[var(--accent-crimson)]';

  async function handleCopyHtml() {
    try {
      await navigator.clipboard.writeText(previewHtml);
      onCopySuccess();
    } catch {
      // ignore clipboard denial in headless contexts
    }
  }

  const filePrefix = (dossier.dossierCode || dossier.slug || dossier.id || 'pdpl')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');

  return (
    <div className="space-y-6">
      {/* Summary KPI Cards */}
      <section className="pdpl-card print-avoid-break rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
              {isAr
                ? dossier.organization.organizationNameAr
                : dossier.organization.organizationNameEn}
            </h2>
            <p
              data-testid="report-dossier-code"
              className="pdpl-mono mt-0.5 text-xs text-[var(--text-secondary)]"
            >
              {dossier.dossierCode || (isAr ? 'مسودة — لم تُختم بعد' : 'DRAFT — NOT SEALED')} ·{' '}
              {dossier.organization.contactEmail}
            </p>
          </div>
          <span
            data-testid="live-readiness-tier"
            className={`rounded-full border px-3.5 py-1 text-xs font-extrabold ${tierColor}`}
          >
            {formatReadinessTierLabel(dossier.summary.readinessTier, locale)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3">
            <div className="text-xs text-[var(--text-secondary)]">{copy.scoreOverall}</div>
            <div
              data-testid="live-overall-score"
              className="pdpl-mono num-tabular mt-1 text-2xl font-extrabold text-[var(--accent-primary)]"
            >
              {dossier.summary.overallScore}/100
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3">
            <div className="text-xs text-[var(--text-secondary)]">{copy.scoreRopa}</div>
            <div className="pdpl-mono num-tabular mt-1 text-2xl font-extrabold">
              {dossier.summary.ropaScore}/100
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3">
            <div className="text-xs text-[var(--text-secondary)]">{copy.scoreCrossBorder}</div>
            <div className="pdpl-mono num-tabular mt-1 text-2xl font-extrabold">
              {dossier.summary.crossBorderScore}/100
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3">
            <div className="text-xs text-[var(--text-secondary)]">{copy.scoreBreach}</div>
            <div className="pdpl-mono num-tabular mt-1 text-2xl font-extrabold">
              {dossier.summary.breachReadinessScore}/100
            </div>
          </div>
          <div className="col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 md:col-span-1">
            <div className="text-xs text-[var(--text-secondary)]">
              {copy.blockersLabel} / {copy.warningsLabel}
            </div>
            <div className="pdpl-mono num-tabular mt-1 text-2xl font-extrabold">
              {dossier.summary.blockersCount} / {dossier.summary.warningsCount}
            </div>
          </div>
        </div>
      </section>

      {/* 10-Control Matrix & Audit Issues */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="pdpl-card print-avoid-break rounded-2xl p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[var(--accent-primary)]" />
              <h3 className="text-base font-bold">{copy.controlsMatrixTitle}</h3>
            </div>
            <span className="pdpl-mono num-tabular text-xs font-bold text-[var(--accent-primary)]">
              {dossier.summary.controlsPassed}/{dossier.summary.controlsTotal}
            </span>
          </div>

          <div className="space-y-2.5">
            {dossier.controls.map((ctrl) => {
              const badgeCls =
                ctrl.status === 'pass'
                  ? 'bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]'
                  : ctrl.status === 'partial'
                    ? 'bg-[var(--accent-amber-soft)] text-[var(--accent-amber)]'
                    : 'bg-[var(--accent-crimson-soft)] text-[var(--accent-crimson)]';
              return (
                <div
                  key={ctrl.id}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="pdpl-mono rounded bg-[var(--bg-elevated)] px-2 py-0.5 text-xs font-bold text-[var(--accent-primary)]">
                        {ctrl.id}
                      </span>
                      <span className="text-sm font-bold">
                        {isAr ? ctrl.titleAr : ctrl.titleEn}
                      </span>
                    </div>
                    {!locked && !readOnlyPublic ? (
                      <select
                        className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 py-1 text-xs font-bold"
                        value={ctrl.status}
                        onChange={(e) =>
                          onChangeControlStatus(ctrl.id, e.target.value as ControlStatus)
                        }
                      >
                        <option value="pass">{isAr ? 'مستوفٍ (Pass)' : 'Pass'}</option>
                        <option value="partial">{isAr ? 'جزئي (Partial)' : 'Partial'}</option>
                        <option value="fail">{isAr ? 'غير مستوفٍ (Fail)' : 'Fail'}</option>
                      </select>
                    ) : (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badgeCls}`}>
                        {ctrl.status.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                    {isAr ? ctrl.noteAr : ctrl.noteEn}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="pdpl-card print-avoid-break rounded-2xl p-5 lg:col-span-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[var(--accent-gold)]" />
            <h3 className="text-base font-bold">{copy.issuesTitle}</h3>
          </div>

          {dossier.audit.issues.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--accent-emerald)] bg-[var(--accent-emerald-soft)] p-4 text-xs font-semibold text-[var(--accent-emerald)]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{copy.noIssuesMsg}</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {dossier.audit.issues.map((iss) => (
                <div
                  key={iss.id}
                  className={`rounded-xl border p-3 text-xs ${
                    iss.severity === 'blocker'
                      ? 'border-[var(--accent-crimson)] bg-[var(--accent-crimson-soft)] text-[var(--accent-crimson)]'
                      : 'border-[var(--accent-amber)] bg-[var(--accent-amber-soft)] text-[var(--accent-amber)]'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 font-bold">
                    <span className="pdpl-mono">{iss.code}</span>
                    <span>{iss.framework}</span>
                  </div>
                  <p className="leading-relaxed">{isAr ? iss.messageAr : iss.messageEn}</p>
                </div>
              ))}
            </div>
          )}

          {dossier.digestHex && (
            <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
              <div className="text-xs font-bold text-[var(--accent-primary)]">
                {copy.sealDigestLabel} ({dossier.dossierCode})
              </div>
              <div
                dir="ltr"
                data-testid="report-digest-hex"
                className="pdpl-mono mt-1 break-all text-xs"
              >
                {dossier.digestHex}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Export Bar & Live Bilingual Privacy Notice Preview */}
      <section className="pdpl-card no-print rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-[var(--accent-primary)]" />
            <h3 className="text-base font-bold">{copy.noticeHtmlTitle}</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setNoticeLocale('ar')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                noticeLocale === 'ar'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)]'
                  : 'border border-[var(--border-strong)] bg-[var(--bg-canvas)]'
              }`}
            >
              {copy.previewArBtn}
            </button>
            <button
              type="button"
              onClick={() => setNoticeLocale('en')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                noticeLocale === 'en'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)]'
                  : 'border border-[var(--border-strong)] bg-[var(--bg-canvas)]'
              }`}
            >
              {copy.previewEnBtn}
            </button>
            <button
              type="button"
              data-testid="toggle-raw-html-btn"
              onClick={() => setShowRawHtml((prev) => !prev)}
              className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary)]"
            >
              {showRawHtml ? (isAr ? 'معاينة مرئية' : 'Rendered Preview') : 'HTML Source'}
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyHtml}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3 py-2 text-xs font-bold transition hover:bg-[var(--bg-elevated)]"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>{copy.copyHtmlBtn}</span>
          </button>
          <button
            type="button"
            onClick={() =>
              triggerTextDownload(
                `${filePrefix}-privacy-notice-${noticeLocale}.html`,
                previewHtml,
                'text/html;charset=utf-8',
              )
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-bold text-[var(--accent-primary-fg)] transition hover:bg-[var(--accent-primary-hover)]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{copy.downloadHtmlBtn}</span>
          </button>
          <button
            type="button"
            onClick={() =>
              triggerTextDownload(
                `${filePrefix}-ropa-${locale}.md`,
                markdownDoc,
                'text/markdown;charset=utf-8',
              )
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3 py-2 text-xs font-bold transition hover:bg-[var(--bg-elevated)]"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>{copy.downloadMdBtn}</span>
          </button>
          <button
            type="button"
            onClick={() =>
              triggerTextDownload(
                `${filePrefix}-ropa-${locale}.csv`,
                csvDoc,
                'text/csv;charset=utf-8',
              )
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3 py-2 text-xs font-bold transition hover:bg-[var(--bg-elevated)]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{copy.downloadCsvBtn}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent-gold)] bg-[var(--accent-gold-soft)] px-3.5 py-2 text-xs font-bold text-[var(--accent-gold)]"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>{copy.printPdfBtn}</span>
          </button>
        </div>

        {showRawHtml ? (
          <pre
            dir="ltr"
            data-testid="notice-source-pre"
            className="pdpl-mono max-h-96 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4 text-xs"
          >
            {previewHtml}
          </pre>
        ) : (
          <div
            dir={previewIsAr ? 'rtl' : 'ltr'}
            lang={noticeLocale}
            data-testid="notice-visual-preview"
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-5 text-sm leading-relaxed"
          >
            <div className="border-b-2 border-[var(--accent-primary)] pb-3">
              <h4 className="text-base font-extrabold text-[var(--accent-primary)]">
                {previewIsAr
                  ? `إشعار الخصوصية — ${previewOrgName}`
                  : `Privacy Notice — ${previewOrgName}`}
              </h4>
              <p className="pdpl-mono mt-1 text-xs text-[var(--text-secondary)]">
                {previewIsAr
                  ? `مرجع الملف: ${dossier.dossierCode || 'PREVIEW'} | قناة DSAR: ${dossier.organization.contactEmail}`
                  : `Dossier: ${dossier.dossierCode || 'PREVIEW'} | DSAR Inbox: ${dossier.organization.contactEmail}`}
              </p>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-3 py-2 text-start">{previewIsAr ? 'النشاط' : 'Activity'}</th>
                    <th className="px-3 py-2 text-start">{previewIsAr ? 'الغرض' : 'Purpose'}</th>
                    <th className="px-3 py-2 text-start">{previewIsAr ? 'الأساس' : 'Basis'}</th>
                    <th className="px-3 py-2 text-start">{previewIsAr ? 'الاستضافة' : 'Hosting'}</th>
                    <th className="px-3 py-2 text-start">{previewIsAr ? 'الضمانة' : 'Safeguard'}</th>
                    <th className="px-3 py-2 text-start">{previewIsAr ? 'الاحتفاظ' : 'Retention'}</th>
                  </tr>
                </thead>
                <tbody>
                  {dossier.activities.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                      <td className="px-3 py-2 font-bold">
                        {previewIsAr ? item.activityNameAr : item.activityNameEn}
                      </td>
                      <td dir="auto" className="px-3 py-2">{item.purpose}</td>
                      <td className="px-3 py-2">
                        {previewIsAr
                          ? LAWFUL_BASIS_META[item.lawfulBasis].labelAr
                          : LAWFUL_BASIS_META[item.lawfulBasis].labelEn}
                      </td>
                      <td className="px-3 py-2">
                        {previewIsAr
                          ? HOSTING_REGION_META[item.hostingRegion].labelAr
                          : HOSTING_REGION_META[item.hostingRegion].labelEn}
                      </td>
                      <td className="px-3 py-2">
                        {previewIsAr
                          ? SAFEGUARD_META[item.transferSafeguard].labelAr
                          : SAFEGUARD_META[item.transferSafeguard].labelEn}
                      </td>
                      <td className="pdpl-mono num-tabular px-3 py-2">
                        {item.retentionDays} {previewIsAr ? 'يوماً' : 'days'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-[var(--text-secondary)]">
              {previewIsAr
                ? `يحق لك طلب الوصول إلى بياناتك أو تصحيحها أو محوها عبر ${dossier.organization.contactEmail}، ونستهدف الرد خلال ${dossier.organization.dsarSlaDays} يوماً.`
                : `Request access, correction, or erasure anytime via ${dossier.organization.contactEmail} (target SLA: ${dossier.organization.dsarSlaDays} days).`}
            </p>
          </div>
        )}
      </section>

      {/* Print-safe Footer Disclaimer */}
      <footer className="print-avoid-break rounded-2xl border border-[var(--accent-gold)] bg-[var(--accent-gold-soft)] p-4 text-xs leading-relaxed text-[var(--text-primary)]">
        <strong>{copy.disclaimerLabel}:</strong>{' '}
        {(isAr ? PDPLCHECK_LEGAL_DISCLAIMER_AR : PDPLCHECK_LEGAL_DISCLAIMER_EN).replace(
          /^[^:]+:\s*/,
          '',
        )}
      </footer>
    </div>
  );
}
