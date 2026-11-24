import { Building2, Plus, ShieldAlert, ShieldCheck, Trash2, UserCheck } from 'lucide-react';
import {
  HOSTING_REGION_META,
  LAWFUL_BASIS_META,
  SAFEGUARD_META,
} from '../core/pdplRules.ts';
import type {
  HostingRegion,
  JurisdictionScope,
  LawfulBasis,
  Locale,
  OrganizationPrivacyProfile,
  PdplIssue,
  RopaActivityItem,
  SafeguardMechanism,
} from '../core/types.ts';
import type { OrgProfileRecord } from '../lib/api.ts';
import type { PdplUiCopy } from '../lib/i18n.ts';

interface RopaAndOrgPanelProps {
  locale: Locale;
  copy: PdplUiCopy;
  locked: boolean;
  organization: OrganizationPrivacyProfile;
  activities: RopaActivityItem[];
  issues: PdplIssue[];
  profiles: OrgProfileRecord[];
  onChangeOrganization: (next: OrganizationPrivacyProfile) => void;
  onChangeActivities: (next: RopaActivityItem[]) => void;
  onSaveProfile: () => void;
  onApplyProfile: (profileId: string) => void;
}

export default function RopaAndOrgPanel({
  locale,
  copy,
  locked,
  organization,
  activities,
  issues,
  profiles,
  onChangeOrganization,
  onChangeActivities,
  onSaveProfile,
  onApplyProfile,
}: RopaAndOrgPanelProps) {
  const isAr = locale === 'ar';

  function handleOrgField<K extends keyof OrganizationPrivacyProfile>(
    key: K,
    value: OrganizationPrivacyProfile[K],
  ) {
    onChangeOrganization({ ...organization, [key]: value });
  }

  function handleActivityField<K extends keyof RopaActivityItem>(
    idx: number,
    key: K,
    value: RopaActivityItem[K],
  ) {
    const updated = activities.map((item, i) => (i === idx ? { ...item, [key]: value } : item));
    onChangeActivities(updated);
  }

  function addActivity() {
    const nextNum = activities.length + 1;
    const newItem: RopaActivityItem = {
      id: `ROPA-${String(nextNum).padStart(2, '0')}`,
      activityNameAr: `نشاط معالجة جديد #${nextNum}`,
      activityNameEn: `New Processing Activity #${nextNum}`,
      purpose: 'Deliver core platform services under contract.',
      dataCategories: ['identity', 'email'],
      containsSensitiveData: false,
      isMarketingActivity: false,
      explicitMarketingOptIn: false,
      lawfulBasis: 'contract',
      hostingRegion: organization.jurisdiction === 'ksa_pdpl' ? 'ksa_local' : 'uae_local',
      transferSafeguard: 'local_residency',
      retentionDays: 365,
      processorName: 'Regional Cloud Provider',
    };
    onChangeActivities([...activities, newItem]);
  }

  function removeActivity(idx: number) {
    if (activities.length <= 1) return;
    onChangeActivities(activities.filter((_, i) => i !== idx));
  }

  const orgLevelIssues = issues.filter((iss) => !iss.activityId);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left/Right Column: Controller Identity & DSAR Profile */}
      <section className="pdpl-card rounded-2xl p-5 lg:col-span-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[var(--accent-primary)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              {copy.orgSectionTitle}
            </h2>
          </div>
          {!locked && (
            <button
              type="button"
              onClick={onSaveProfile}
              className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary)] transition hover:opacity-90"
            >
              {copy.saveProfileBtn}
            </button>
          )}
        </div>

        {profiles.length > 0 && !locked && (
          <div className="mb-4">
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {copy.loadProfileLabel}
            </label>
            <select
              className="pdpl-input"
              value=""
              onChange={(e) => {
                if (e.target.value) onApplyProfile(e.target.value);
              }}
            >
              <option value="">
                {isAr ? '— اختر ملف جهة محفوظ —' : '— Select saved entity profile —'}
              </option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.profile.jurisdiction})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {copy.orgNameArLabel}
            </label>
            <input
              type="text"
              dir="rtl"
              data-testid="org-name-ar-input"
              disabled={locked}
              className="pdpl-input"
              value={organization.organizationNameAr}
              onChange={(e) => handleOrgField('organizationNameAr', e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {copy.orgNameEnLabel}
            </label>
            <input
              type="text"
              dir="ltr"
              data-testid="org-name-en-input"
              disabled={locked}
              className="pdpl-input"
              value={organization.organizationNameEn}
              onChange={(e) => handleOrgField('organizationNameEn', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                {copy.jurisdictionLabel}
              </label>
              <select
                disabled={locked}
                data-testid="org-jurisdiction-select"
                className="pdpl-input"
                value={organization.jurisdiction}
                onChange={(e) =>
                  handleOrgField('jurisdiction', e.target.value as JurisdictionScope)
                }
              >
                <option value="dual_gcc">
                  {isAr ? 'مزدوج الخليج (UAE + KSA)' : 'Dual GCC (UAE + KSA)'}
                </option>
                <option value="uae_pdpl">
                  {isAr ? 'الإمارات (PDPL 45/2021)' : 'UAE PDPL (Law 45/2021)'}
                </option>
                <option value="ksa_pdpl">
                  {isAr ? 'السعودية (SDAIA PDPL)' : 'KSA PDPL (SDAIA)'}
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                {copy.dsarSlaLabel}
              </label>
              <input
                type="number"
                min={1}
                max={90}
                dir="ltr"
                data-testid="org-dsar-sla-input"
                disabled={locked}
                className="pdpl-input num-tabular"
                value={organization.dsarSlaDays}
                onChange={(e) => handleOrgField('dsarSlaDays', Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {copy.contactEmailLabel}
            </label>
            <input
              type="email"
              dir="ltr"
              data-testid="org-contact-email-input"
              disabled={locked}
              className="pdpl-input pdpl-mono"
              value={organization.contactEmail}
              onChange={(e) => handleOrgField('contactEmail', e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {copy.noticeArUrlLabel}
            </label>
            <input
              type="url"
              dir="ltr"
              data-testid="org-notice-ar-url-input"
              disabled={locked}
              className="pdpl-input pdpl-mono"
              placeholder="https://example.sa/ar/privacy"
              value={organization.privacyNoticeArUrl}
              onChange={(e) => handleOrgField('privacyNoticeArUrl', e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {copy.noticeEnUrlLabel}
            </label>
            <input
              type="url"
              dir="ltr"
              data-testid="org-notice-en-url-input"
              disabled={locked}
              className="pdpl-input pdpl-mono"
              placeholder="https://example.ae/en/privacy"
              value={organization.privacyNoticeEnUrl}
              onChange={(e) => handleOrgField('privacyNoticeEnUrl', e.target.value)}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm font-medium">
            <input
              type="checkbox"
              data-testid="org-dpo-checkbox"
              disabled={locked}
              checked={organization.dpoAppointed}
              onChange={(e) => handleOrgField('dpoAppointed', e.target.checked)}
              className="h-4 w-4 accent-[var(--accent-primary)]"
            />
            <UserCheck className="h-4 w-4 text-[var(--accent-primary)]" />
            <span>{copy.dpoAppointedLabel}</span>
          </label>
        </div>

        {orgLevelIssues.length > 0 && (
          <div className="mt-4 space-y-2">
            {orgLevelIssues.map((iss) => (
              <div
                key={iss.id}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  iss.severity === 'blocker'
                    ? 'border-[var(--accent-crimson)] bg-[var(--accent-crimson-soft)] text-[var(--accent-crimson)]'
                    : 'border-[var(--accent-amber)] bg-[var(--accent-amber-soft)] text-[var(--accent-amber)]'
                }`}
              >
                <strong className="font-bold">[{iss.code}]</strong>{' '}
                {isAr ? iss.messageAr : iss.messageEn}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Main Column: RoPA Activities & Cross-Border Matrix */}
      <section className="pdpl-card rounded-2xl p-5 lg:col-span-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[var(--accent-primary)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              {copy.ropaSectionTitle} ({activities.length})
            </h2>
          </div>
          {!locked && (
            <button
              type="button"
              onClick={addActivity}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-bold text-[var(--accent-primary-fg)] transition hover:bg-[var(--accent-primary-hover)]"
            >
              <Plus className="h-4 w-4" />
              <span>{copy.addActivityBtn}</span>
            </button>
          )}
        </div>

        <div className="space-y-4">
          {activities.map((item, idx) => {
            const itemIssues = issues.filter((iss) => iss.activityId === item.id);
            const hasBlocker = itemIssues.some((iss) => iss.severity === 'blocker');
            const hasWarning = itemIssues.some((iss) => iss.severity === 'warning');

            return (
              <div
                key={item.id}
                data-testid={`ropa-card-${idx}`}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="pdpl-mono rounded-lg bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-bold text-[var(--accent-primary)]">
                      {item.id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        hasBlocker
                          ? 'bg-[var(--accent-crimson-soft)] text-[var(--accent-crimson)]'
                          : hasWarning
                            ? 'bg-[var(--accent-amber-soft)] text-[var(--accent-amber)]'
                            : 'bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]'
                      }`}
                    >
                      {hasBlocker ? (
                        <ShieldAlert className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {hasBlocker
                          ? isAr
                            ? 'عائق امتثال'
                            : 'Blocker'
                          : hasWarning
                            ? isAr
                              ? 'تحذير'
                              : 'Warning'
                            : isAr
                              ? 'مكتمل'
                              : 'Pass'}
                      </span>
                    </span>
                  </div>
                  {!locked && (
                    <button
                      type="button"
                      disabled={activities.length <= 1}
                      onClick={() => removeActivity(idx)}
                      className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--accent-crimson-soft)] hover:text-[var(--accent-crimson)] disabled:opacity-35"
                      title={isAr ? 'حذف النشاط' : 'Remove activity'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.activityNameArLabel}
                    </label>
                    <input
                      type="text"
                      dir="rtl"
                      disabled={locked}
                      className="pdpl-input"
                      value={item.activityNameAr}
                      onChange={(e) => handleActivityField(idx, 'activityNameAr', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.activityNameEnLabel}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      disabled={locked}
                      className="pdpl-input"
                      value={item.activityNameEn}
                      onChange={(e) => handleActivityField(idx, 'activityNameEn', e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    {copy.purposeLabel}
                  </label>
                  <input
                    type="text"
                    dir="auto"
                    disabled={locked}
                    className="pdpl-input"
                    value={item.purpose}
                    onChange={(e) => handleActivityField(idx, 'purpose', e.target.value)}
                  />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.lawfulBasisLabel}
                    </label>
                    <select
                      disabled={locked}
                      data-testid={`ropa-basis-select-${idx}`}
                      className="pdpl-input"
                      value={item.lawfulBasis}
                      onChange={(e) =>
                        handleActivityField(idx, 'lawfulBasis', e.target.value as LawfulBasis)
                      }
                    >
                      {Object.values(LAWFUL_BASIS_META).map((m) => (
                        <option key={m.code} value={m.code}>
                          {isAr ? m.labelAr : m.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.hostingRegionLabel}
                    </label>
                    <select
                      disabled={locked}
                      data-testid={`ropa-region-select-${idx}`}
                      className="pdpl-input"
                      value={item.hostingRegion}
                      onChange={(e) =>
                        handleActivityField(idx, 'hostingRegion', e.target.value as HostingRegion)
                      }
                    >
                      {Object.values(HOSTING_REGION_META).map((m) => (
                        <option key={m.code} value={m.code}>
                          {isAr ? m.labelAr : m.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.safeguardLabel}
                    </label>
                    <select
                      disabled={locked}
                      data-testid={`ropa-safeguard-select-${idx}`}
                      className="pdpl-input"
                      value={item.transferSafeguard}
                      onChange={(e) =>
                        handleActivityField(
                          idx,
                          'transferSafeguard',
                          e.target.value as SafeguardMechanism,
                        )
                      }
                    >
                      {Object.values(SAFEGUARD_META).map((m) => (
                        <option key={m.code} value={m.code}>
                          {isAr ? m.labelAr : m.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.retentionDaysLabel}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={36500}
                      dir="ltr"
                      data-testid={`ropa-retention-input-${idx}`}
                      disabled={locked}
                      className="pdpl-input num-tabular"
                      value={item.retentionDays}
                      onChange={(e) =>
                        handleActivityField(idx, 'retentionDays', Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.processorLabel}
                    </label>
                    <input
                      type="text"
                      dir="auto"
                      data-testid={`ropa-processor-input-${idx}`}
                      disabled={locked}
                      className="pdpl-input"
                      value={item.processorName}
                      onChange={(e) => handleActivityField(idx, 'processorName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.categoriesLabel}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      disabled={locked}
                      className="pdpl-input pdpl-mono"
                      value={item.dataCategories.join('|')}
                      onChange={(e) =>
                        handleActivityField(
                          idx,
                          'dataCategories',
                          e.target.value
                            .split('|')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        )
                      }
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 border-t border-[var(--border-subtle)] pt-3 text-xs font-medium">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={locked}
                      checked={item.containsSensitiveData}
                      onChange={(e) =>
                        handleActivityField(idx, 'containsSensitiveData', e.target.checked)
                      }
                      className="h-4 w-4 accent-[var(--accent-primary)]"
                    />
                    <span>{copy.sensitiveToggleLabel}</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={locked}
                      checked={item.isMarketingActivity}
                      onChange={(e) =>
                        handleActivityField(idx, 'isMarketingActivity', e.target.checked)
                      }
                      className="h-4 w-4 accent-[var(--accent-primary)]"
                    />
                    <span>{copy.marketingToggleLabel}</span>
                  </label>
                  {item.isMarketingActivity && (
                    <label className="flex cursor-pointer items-center gap-2 text-[var(--accent-primary)]">
                      <input
                        type="checkbox"
                        data-testid={`ropa-explicit-optin-checkbox-${idx}`}
                        disabled={locked}
                        checked={item.explicitMarketingOptIn}
                        onChange={(e) =>
                          handleActivityField(idx, 'explicitMarketingOptIn', e.target.checked)
                        }
                        className="h-4 w-4 accent-[var(--accent-primary)]"
                      />
                      <span>{copy.explicitOptInLabel}</span>
                    </label>
                  )}
                </div>

                {itemIssues.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {itemIssues.map((iss) => (
                      <div
                        key={iss.id}
                        className={`rounded-lg px-2.5 py-1.5 text-xs ${
                          iss.severity === 'blocker'
                            ? 'bg-[var(--accent-crimson-soft)] text-[var(--accent-crimson)]'
                            : 'bg-[var(--accent-amber-soft)] text-[var(--accent-amber)]'
                        }`}
                      >
                        <strong>[{iss.code}]</strong> {isAr ? iss.messageAr : iss.messageEn}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
