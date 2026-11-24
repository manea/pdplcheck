export type Locale = 'ar' | 'en';

export type JurisdictionScope = 'uae_pdpl' | 'ksa_pdpl' | 'dual_gcc';

export type LawfulBasis =
  | 'explicit_consent'
  | 'contract'
  | 'legal_obligation'
  | 'vital_interest'
  | 'legitimate_interest';

export type HostingRegion =
  | 'uae_local'
  | 'ksa_local'
  | 'eu_adequate'
  | 'us_cloud'
  | 'other_non_adequate';

export type SafeguardMechanism =
  | 'local_residency'
  | 'scc_contract'
  | 'explicit_consent_transfer'
  | 'none';

export type ControlStatus = 'pass' | 'partial' | 'fail';

export type IssueSeverity = 'blocker' | 'warning';

export type BreachRiskSeverity = 'none' | 'moderate' | 'high_harm';

export type ReadinessTier = 'ready' | 'needs_remediation' | 'blocked';

export type BreachClockState =
  | 'no_incident'
  | 'within_72h'
  | 'urgent_under_12h'
  | 'overdue'
  | 'notified_on_time';

export interface OrganizationPrivacyProfile {
  organizationNameAr: string;
  organizationNameEn: string;
  jurisdiction: JurisdictionScope;
  contactEmail: string;
  privacyNoticeArUrl: string;
  privacyNoticeEnUrl: string;
  dpoAppointed: boolean;
  dsarSlaDays: number;
}

export interface RopaActivityItem {
  id: string;
  activityNameAr: string;
  activityNameEn: string;
  purpose: string;
  dataCategories: string[];
  containsSensitiveData: boolean;
  isMarketingActivity: boolean;
  explicitMarketingOptIn: boolean;
  lawfulBasis: LawfulBasis;
  hostingRegion: HostingRegion;
  transferSafeguard: SafeguardMechanism;
  retentionDays: number;
  processorName: string;
}

export interface BreachTriageInput {
  activeIncident: boolean;
  incidentTitleAr: string;
  incidentTitleEn: string;
  discoveredAtIso: string;
  reportedToRegulator: boolean;
  reportedAtIso: string;
  riskSeverity: BreachRiskSeverity;
  affectedSubjectsCount: number;
  likelyDataSubjectsNotified: boolean;
}

export interface BreachWindowAssessment {
  state: BreachClockState;
  elapsedHours: number;
  remainingHours: number;
  windowHours: number;
  overdue: boolean;
  sdaiaDeadlineIso: string | null;
  requiresSdaiaNotification: boolean;
  requiresUaeDataOfficeNotification: boolean;
  requiresDataSubjectNotification: boolean;
  slaRiskTier: 'low' | 'elevated' | 'critical';
  guidanceAr: string;
  guidanceEn: string;
}

export interface PdplCheckItem {
  id: string;
  titleAr: string;
  titleEn: string;
  frameworkRef: string;
  status: ControlStatus;
  weight: number;
  noteAr: string;
  noteEn: string;
}

export interface PdplIssue {
  id: string;
  activityId?: string;
  severity: IssueSeverity;
  framework: 'UAE_PDPL' | 'KSA_PDPL' | 'DUAL_GCC';
  code: string;
  messageAr: string;
  messageEn: string;
}

export interface RopaAuditReport {
  totalActivities: number;
  compliantActivities: number;
  crossBorderActivities: number;
  unprotectedTransfers: number;
  blockersCount: number;
  warningsCount: number;
  ropaScore: number;
  crossBorderScore: number;
  issues: PdplIssue[];
  auditedAtIso: string;
}

export interface RopaCsvRowResult {
  rowNumber: number;
  activityId: string;
  activityName: string;
  status: 'pass' | 'warning' | 'blocker';
  issues: PdplIssue[];
  item: RopaActivityItem;
}

export interface RopaCsvAuditReport {
  totalRows: number;
  passedRows: number;
  warningRows: number;
  blockedRows: number;
  rows: RopaCsvRowResult[];
  ropaAudit: RopaAuditReport;
}

export interface PdplSummary {
  overallScore: number;
  ropaScore: number;
  crossBorderScore: number;
  breachReadinessScore: number;
  controlsPassed: number;
  controlsTotal: number;
  blockersCount: number;
  warningsCount: number;
  readinessTier: ReadinessTier;
}

export interface PdplDossier {
  id: string;
  dossierCode: string;
  presetId: string;
  organization: OrganizationPrivacyProfile;
  activities: RopaActivityItem[];
  breachTriage: BreachTriageInput;
  controls: PdplCheckItem[];
  audit: RopaAuditReport;
  breachAssessment: BreachWindowAssessment;
  summary: PdplSummary;
  digestHex: string;
  sealedAtIso: string;
  updatedAtIso: string;
}
