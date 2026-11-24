import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBilingualPrivacyNoticeHtml,
  buildDefaultPdplControls,
  buildPdplRopaDossierMarkdown,
  computePdplSummary,
} from '../src/core/breachAndNotice.ts';
import {
  buildDossierCanonicalText,
  buildExecutiveSummaryText,
} from '../src/core/dossierDigest.ts';
import {
  evaluateBreach72hClock,
  isValidJurisdiction,
} from '../src/core/pdplRules.ts';
import { PDPLCHECK_PRESETS, createDossierFromPreset } from '../src/core/presets.ts';
import {
  PdplCoreError,
  auditPdplRopaAndTransfers,
  auditRopaCsv,
  exportRopaCsv,
} from '../src/core/ropaAuditor.ts';
import { openPdplDatabase, slugify } from './db.mjs';

const __serverDir = path.dirname(fileURLToPath(import.meta.url));
let APP_VERSION = '0.2.0';
try {
  const pkgJson = JSON.parse(
    fs.readFileSync(path.resolve(__serverDir, '../package.json'), 'utf8'),
  );
  if (typeof pkgJson.version === 'string' && pkgJson.version.trim()) {
    APP_VERSION = pkgJson.version.trim();
  }
} catch {
  // fallback version
}

const MAX_JSON_BODY = 5 * 1024 * 1024; // 5 MB limit
const VALID_CONTROL_STATUSES = new Set(['pass', 'partial', 'fail']);
const VALID_RISK_SEVERITIES = new Set(['none', 'moderate', 'high_harm']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_JSON_BODY) {
      const err = new Error('JSON payload exceeds 5 MB limit');
      err.statusCode = 413;
      err.code = 'PAYLOAD_TOO_LARGE';
      throw err;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error('Invalid JSON payload');
    err.statusCode = 400;
    err.code = 'INVALID_JSON';
    throw err;
  }
}

function normalizeBasePath(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let trimmed = raw.trim();
  if (!trimmed || trimmed === '/') return '';
  if (!trimmed.startsWith('/')) trimmed = `/${trimmed}`;
  return trimmed.replace(/\/+$/, '');
}

function resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath = '') {
  if (normalizedAppOrigin) return normalizedAppOrigin;
  const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const proto = protoHeader || (req.socket?.encrypted ? 'https' : 'http');
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1:4199')
    .split(',')[0]
    .trim();
  return `${proto}://${hostHeader}${normalizedBasePath}`;
}

function mergeOrganizationProfile(patch, fallback) {
  const fb = fallback || {
    organizationNameAr: 'شركة خليجية لتقنية المعلومات',
    organizationNameEn: 'Gulf Cloud Entity LLC',
    jurisdiction: 'dual_gcc',
    contactEmail: 'privacy@example.ae',
    privacyNoticeArUrl: 'https://example.ae/ar/privacy',
    privacyNoticeEnUrl: 'https://example.ae/en/privacy',
    dpoAppointed: false,
    dsarSlaDays: 30,
  };
  const src = patch && typeof patch === 'object' ? patch : {};
  const rawJur =
    src.jurisdiction !== undefined
      ? String(src.jurisdiction).trim().toLowerCase()
      : fb.jurisdiction;
  const rawSla = Number(src.dsarSlaDays ?? fb.dsarSlaDays ?? 30);

  return {
    organizationNameAr: String(src.organizationNameAr ?? fb.organizationNameAr).trim(),
    organizationNameEn: String(src.organizationNameEn ?? fb.organizationNameEn).trim(),
    jurisdiction: isValidJurisdiction(rawJur) ? rawJur : String(src.jurisdiction ?? fb.jurisdiction),
    contactEmail: String(src.contactEmail ?? fb.contactEmail).trim(),
    privacyNoticeArUrl: String(src.privacyNoticeArUrl ?? fb.privacyNoticeArUrl).trim(),
    privacyNoticeEnUrl: String(src.privacyNoticeEnUrl ?? fb.privacyNoticeEnUrl).trim(),
    dpoAppointed:
      src.dpoAppointed !== undefined ? Boolean(src.dpoAppointed) : Boolean(fb.dpoAppointed),
    dsarSlaDays: Number.isFinite(rawSla) ? Math.floor(rawSla) : 0,
  };
}

function mergeActivities(input, fallback) {
  const fb = Array.isArray(fallback) ? fallback : [];
  if (!Array.isArray(input)) return fb;

  return input
    .filter((item) => item && typeof item === 'object')
    .map((item, idx) => {
      const cats = Array.isArray(item.dataCategories)
        ? item.dataCategories.map((c) => String(c).trim()).filter(Boolean)
        : typeof item.dataCategories === 'string'
          ? item.dataCategories
              .split(/[|,]/)
              .map((c) => c.trim())
              .filter(Boolean)
          : ['identity'];
      const rawRetention = Number(item.retentionDays ?? 365);

      return {
        id: String(item.id || `ROPA-${String(idx + 1).padStart(2, '0')}`).trim(),
        activityNameAr: String(item.activityNameAr || item.activityNameEn || 'نشاط معالجة').trim(),
        activityNameEn: String(item.activityNameEn || item.activityNameAr || 'Processing Activity').trim(),
        purpose: String(item.purpose ?? '').trim(),
        dataCategories: cats,
        containsSensitiveData: Boolean(item.containsSensitiveData),
        isMarketingActivity: Boolean(item.isMarketingActivity),
        explicitMarketingOptIn: Boolean(item.explicitMarketingOptIn),
        lawfulBasis: String(item.lawfulBasis ?? 'contract').trim(),
        hostingRegion: String(item.hostingRegion ?? 'uae_local').trim(),
        transferSafeguard: String(item.transferSafeguard ?? 'local_residency').trim(),
        retentionDays: Number.isFinite(rawRetention) ? rawRetention : 0,
        processorName: String(item.processorName ?? '').trim(),
      };
    });
}

function mergeBreachTriage(patch, fallback) {
  const fb = fallback || {
    activeIncident: false,
    incidentTitleAr: '',
    incidentTitleEn: '',
    discoveredAtIso: '',
    reportedToRegulator: false,
    reportedAtIso: '',
    riskSeverity: 'none',
    affectedSubjectsCount: 0,
    likelyDataSubjectsNotified: false,
  };
  const src = patch && typeof patch === 'object' ? patch : {};
  const rawRisk = String(src.riskSeverity ?? fb.riskSeverity ?? 'none').trim().toLowerCase();
  const rawAffected = Number(src.affectedSubjectsCount ?? fb.affectedSubjectsCount ?? 0);

  return {
    activeIncident:
      src.activeIncident !== undefined ? Boolean(src.activeIncident) : Boolean(fb.activeIncident),
    incidentTitleAr: String(src.incidentTitleAr ?? fb.incidentTitleAr).trim(),
    incidentTitleEn: String(src.incidentTitleEn ?? fb.incidentTitleEn).trim(),
    discoveredAtIso: String(src.discoveredAtIso ?? fb.discoveredAtIso).trim(),
    reportedToRegulator:
      src.reportedToRegulator !== undefined
        ? Boolean(src.reportedToRegulator)
        : Boolean(fb.reportedToRegulator),
    reportedAtIso: String(src.reportedAtIso ?? fb.reportedAtIso).trim(),
    riskSeverity: VALID_RISK_SEVERITIES.has(rawRisk) ? rawRisk : fb.riskSeverity,
    affectedSubjectsCount:
      Number.isFinite(rawAffected) && rawAffected >= 0 ? Math.floor(rawAffected) : 0,
    likelyDataSubjectsNotified:
      src.likelyDataSubjectsNotified !== undefined
        ? Boolean(src.likelyDataSubjectsNotified)
        : Boolean(fb.likelyDataSubjectsNotified),
  };
}

function applyControlOverrides(baseControls, overridesInput) {
  if (!overridesInput) return baseControls;
  const map = new Map();
  if (Array.isArray(overridesInput)) {
    for (const item of overridesInput) {
      if (item && typeof item.id === 'string') {
        map.set(item.id, item);
      }
    }
  } else if (typeof overridesInput === 'object') {
    for (const [id, val] of Object.entries(overridesInput)) {
      map.set(id, val);
    }
  }

  return baseControls.map((ctrl) => {
    const ov = map.get(ctrl.id);
    if (!ov) return ctrl;
    if (typeof ov === 'string' && VALID_CONTROL_STATUSES.has(ov)) {
      return { ...ctrl, status: ov };
    }
    if (ov && typeof ov === 'object') {
      const status = VALID_CONTROL_STATUSES.has(ov.status) ? ov.status : ctrl.status;
      return {
        ...ctrl,
        status,
        noteAr: ov.noteAr !== undefined ? String(ov.noteAr) : ctrl.noteAr,
        noteEn: ov.noteEn !== undefined ? String(ov.noteEn) : ctrl.noteEn,
      };
    }
    return ctrl;
  });
}

function evaluatePdplCompliance(dossier, referenceIso, controlOverrides) {
  const refIso = referenceIso || dossier.updatedAtIso || new Date().toISOString();
  const audit = auditPdplRopaAndTransfers(dossier.organization, dossier.activities, refIso);
  const breachAssessment = evaluateBreach72hClock(dossier.breachTriage, refIso);
  const defaultControls = buildDefaultPdplControls(
    dossier.organization,
    dossier.activities,
    audit,
    breachAssessment,
  );
  const controls = applyControlOverrides(defaultControls, controlOverrides);
  const summary = computePdplSummary(audit, controls, breachAssessment);
  return { audit, breachAssessment, controls, summary };
}

function serveStaticAsset(res, pathname, resolvedDist, method = 'GET', normalizedBasePath = '') {
  if (!resolvedDist || !fs.existsSync(resolvedDist)) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  let decodedPath = '/';
  try {
    decodedPath = decodeURIComponent(pathname || '/');
  } catch {
    sendJson(res, 400, { error: 'Malformed path' });
    return;
  }

  const cleanRel = decodedPath.replace(/^\/+/, '');
  const candidate = path.resolve(resolvedDist, cleanRel || 'index.html');
  if (candidate !== resolvedDist && !candidate.startsWith(resolvedDist + path.sep)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  let fileToServe = null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    fileToServe = candidate;
  } else {
    const indexFallback = path.join(resolvedDist, 'index.html');
    if (fs.existsSync(indexFallback) && fs.statSync(indexFallback).isFile()) {
      fileToServe = indexFallback;
    }
  }

  if (!fileToServe) {
    sendJson(res, 404, { error: 'Static asset not found' });
    return;
  }

  const ext = path.extname(fileToServe).toLowerCase();
  const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';

  if (ext === '.html' && normalizedBasePath) {
    let html = fs.readFileSync(fileToServe, 'utf8');
    html = html
      .replaceAll('href="/', `href="${normalizedBasePath}/`)
      .replaceAll('src="/', `src="${normalizedBasePath}/`);
    const baseScript = `<script>window.__PDPLCHECK_BASE__=${JSON.stringify(normalizedBasePath)};</script>`;
    html = html.includes('</head>') ? html.replace('</head>', `${baseScript}</head>`) : `${baseScript}${html}`;
    const bodyBuf = Buffer.from(html, 'utf8');
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': bodyBuf.byteLength,
      'Cache-Control': 'no-cache',
      ...SECURITY_HEADERS,
    });
    if (method === 'HEAD') {
      res.end();
      return;
    }
    res.end(bodyBuf);
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    ...SECURITY_HEADERS,
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(fileToServe).pipe(res);
}

function sendAttachment(res, contentType, filename, content) {
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
  });
  res.end(content);
}

function mapCoreErrorStatus(err) {
  if (err?.statusCode) return err.statusCode;
  if (err instanceof PdplCoreError) return 400;
  return 500;
}

export function createPdplCheckServer({
  dataDir,
  distDir = '',
  appOrigin = '',
  basePath = '',
  maxMutationsPerMinute = 120,
}) {
  const db = openPdplDatabase(dataDir);
  const resolvedDist = distDir ? path.resolve(distDir) : null;
  const normalizedAppOrigin = String(appOrigin || '').replace(/\/+$/, '');
  const normalizedBasePath = normalizeBasePath(basePath);
  const rateBuckets = new Map();

  function checkRateLimit(req, method) {
    if (method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') {
      return true;
    }
    const now = Date.now();
    const ip =
      String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1')
        .split(',')[0]
        .trim() || '127.0.0.1';
    const windowMs = 60_000;
    const prev = rateBuckets.get(ip) || [];
    const recent = prev.filter((ts) => now - ts < windowMs);
    if (recent.length >= maxMutationsPerMinute) {
      rateBuckets.set(ip, recent);
      return false;
    }
    recent.push(now);
    rateBuckets.set(ip, recent);
    return true;
  }

  function buildPublicReportUrl(req, slugOrCode) {
    return `${resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath)}/r/${encodeURIComponent(slugOrCode)}`;
  }

  function findStoredDossier(id) {
    return db.getDossierById(id) || db.getDossierBySlugOrCode(id);
  }

  async function handleApiRequest(req, res, method, pathname, searchParams) {
    if (!checkRateLimit(req, method)) {
      return sendJson(res, 429, {
        error: 'Too many write requests; please slow down and try again shortly.',
        code: 'RATE_LIMITED',
      });
    }

    // 1. Health & Presets
    if (method === 'GET' && pathname === '/api/health') {
      const stats = db.getStats();
      return sendJson(res, 200, {
        ok: true,
        service: 'pdplcheck',
        version: APP_VERSION,
        basePath: normalizedBasePath || '/',
        ...stats,
        timestamp: new Date().toISOString(),
      });
    }

    if (method === 'GET' && pathname === '/api/presets') {
      return sendJson(res, 200, { presets: PDPLCHECK_PRESETS });
    }

    // 2. Stateless Dual-PDPL RoPA + 72h Breach Auditor + CSV Batch Auditor
    if (method === 'POST' && pathname === '/api/audit-pdpl') {
      const body = await readJsonBody(req);
      const locale = body?.locale === 'en' ? 'en' : 'ar';
      const refIso =
        typeof body?.referenceIso === 'string' && body.referenceIso.trim()
          ? body.referenceIso.trim()
          : new Date().toISOString();

      const organization = mergeOrganizationProfile(body?.organization, null);
      const activities = mergeActivities(body?.activities, []);
      const breachTriage = mergeBreachTriage(body?.breachTriage, null);

      const { audit, breachAssessment, controls, summary } = evaluatePdplCompliance(
        { organization, activities, breachTriage, updatedAtIso: refIso },
        refIso,
        body?.controls ?? body?.controlOverrides,
      );

      const previewDossier = {
        id: 'stateless-preview',
        dossierCode: 'PREVIEW',
        presetId: 'custom',
        organization,
        activities,
        breachTriage,
        controls,
        audit,
        breachAssessment,
        summary,
        digestHex: '',
        sealedAtIso: '',
        updatedAtIso: refIso,
      };

      return sendJson(res, 200, {
        organization,
        activities,
        breachTriage,
        controls,
        audit,
        breachAssessment,
        summary,
        privacyNoticeHtml: buildBilingualPrivacyNoticeHtml(previewDossier, locale),
        ropaMarkdown: buildPdplRopaDossierMarkdown(previewDossier, locale),
      });
    }

    if (method === 'POST' && pathname === '/api/audit/ropa-csv') {
      const body = await readJsonBody(req);
      const locale = body?.locale === 'en' ? 'en' : 'ar';
      const csvText = String(body?.csvText ?? body?.csv ?? '');
      const orgOverride =
        body?.organization && typeof body.organization === 'object'
          ? mergeOrganizationProfile(body.organization, null)
          : undefined;
      const report = auditRopaCsv(csvText, orgOverride);
      const csvExport = exportRopaCsv(report, locale);
      return sendJson(res, 200, {
        report,
        csvExport,
      });
    }

    // 3. Organization Profiles CRUD
    if (method === 'GET' && pathname === '/api/profiles') {
      return sendJson(res, 200, { profiles: db.listProfiles() });
    }

    if (method === 'POST' && pathname === '/api/profiles') {
      const body = await readJsonBody(req);
      const created = db.createProfile(body || {});
      return sendJson(res, 201, { profile: created });
    }

    const profileMatch = pathname.match(/^\/api\/profiles\/([^/]+)$/);
    if (profileMatch) {
      const profileId = decodeURIComponent(profileMatch[1] || '');
      if (method === 'PATCH') {
        const body = await readJsonBody(req);
        const updated = db.updateProfile(profileId, body || {});
        if (!updated) return sendJson(res, 404, { error: 'Profile not found' });
        return sendJson(res, 200, { profile: updated });
      }
      if (method === 'DELETE') {
        const del = db.deleteProfile(profileId);
        if (!del.deleted) return sendJson(res, 404, { error: 'Profile not found' });
        return sendJson(res, 200, { deleted: true, id: profileId });
      }
    }

    // 4. Dossiers List & Creation
    if (method === 'GET' && pathname === '/api/dossiers') {
      return sendJson(res, 200, {
        dossiers: db.listDossiers(),
        stats: db.getStats(),
      });
    }

    if (method === 'POST' && pathname === '/api/dossiers') {
      const body = await readJsonBody(req);
      const actor = String(body?.actor || 'governance').trim() || 'governance';
      const refIso =
        typeof body?.referenceIso === 'string' && body.referenceIso.trim()
          ? body.referenceIso.trim()
          : new Date().toISOString();

      if (body?.presetId) {
        const presetMeta = PDPLCHECK_PRESETS.find((p) => p.id === body.presetId);
        if (!presetMeta) {
          return sendJson(res, 400, { error: 'Unknown presetId', code: 'UNKNOWN_PRESET' });
        }
        const seed = await createDossierFromPreset(presetMeta.id, { referenceIso: refIso });
        const evaluated = evaluatePdplCompliance(
          seed,
          refIso,
          body?.controls ?? body?.controlOverrides,
        );
        const bundle = db.createDossier(
          {
            ...seed,
            id: undefined,
            slug: body?.slug ? slugify(body.slug, presetMeta.id) : presetMeta.id,
            defaultLocale: body?.defaultLocale === 'en' ? 'en' : 'ar',
            ...evaluated,
          },
          actor,
        );
        return sendJson(res, 201, {
          ...bundle,
          publicReportUrl: buildPublicReportUrl(req, bundle.dossier.slug),
        });
      }

      if (!body?.organization || !Array.isArray(body?.activities) || body.activities.length === 0) {
        return sendJson(res, 400, {
          error: 'Provide presetId or organization + non-empty activities array.',
          code: 'MISSING_DOSSIER_INPUT',
        });
      }

      const defaultLocale = body?.defaultLocale === 'en' ? 'en' : 'ar';
      const organization = mergeOrganizationProfile(body.organization, null);
      const activities = mergeActivities(body.activities, []);
      const breachTriage = mergeBreachTriage(body?.breachTriage, null);

      const candidate = {
        slug: slugify(body?.slug || organization.organizationNameEn, 'dossier'),
        presetId: 'custom',
        defaultLocale,
        organization,
        activities,
        breachTriage,
        updatedAtIso: refIso,
      };
      const evaluated = evaluatePdplCompliance(
        candidate,
        refIso,
        body?.controls ?? body?.controlOverrides,
      );

      const bundle = db.createDossier(
        {
          ...candidate,
          ...evaluated,
        },
        actor,
      );

      return sendJson(res, 201, {
        ...bundle,
        publicReportUrl: buildPublicReportUrl(req, bundle.dossier.slug),
      });
    }

    // 5. Dossier Actions: Duplicate & Finalize / Lock
    const dupMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/duplicate$/);
    if (method === 'POST' && dupMatch) {
      const id = decodeURIComponent(dupMatch[1] || '');
      const body = await readJsonBody(req);
      const cloned = db.duplicateDossier(id, String(body?.actor || 'governance').trim() || 'governance');
      if (!cloned) return sendJson(res, 404, { error: 'Dossier not found' });
      return sendJson(res, 201, {
        ...cloned,
        publicReportUrl: buildPublicReportUrl(req, cloned.dossier.slug),
      });
    }

    const finalizeMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/(finalize|lock)$/);
    if (method === 'POST' && finalizeMatch) {
      const id = decodeURIComponent(finalizeMatch[1] || '');
      const body = await readJsonBody(req);
      const actor = String(body?.actor || 'governance').trim() || 'governance';
      const lockedBundle = db.finalizeDossier(id, buildDossierCanonicalText, actor);
      if (!lockedBundle) return sendJson(res, 404, { error: 'Dossier not found' });
      return sendJson(res, 200, {
        ...lockedBundle,
        publicReportUrl: buildPublicReportUrl(
          req,
          lockedBundle.dossier.dossierCode || lockedBundle.dossier.slug,
        ),
      });
    }

    // 6. Exports & Summary (Privacy Notice HTML + JSON-LD, RoPA Markdown Register, BOM CSV, Executive Summary)
    const htmlNoticeMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/privacy-notice\.html$/);
    if (method === 'GET' && htmlNoticeMatch) {
      const bundle = findStoredDossier(decodeURIComponent(htmlNoticeMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'en' ? 'en' : 'ar';
      const d = bundle.dossier;
      const fname = slugify(d.dossierCode || d.slug || d.id, 'dossier');
      return sendAttachment(
        res,
        'text/html; charset=utf-8',
        `pdplcheck-${fname}-privacy-notice-${locale}.html`,
        buildBilingualPrivacyNoticeHtml(d, locale),
      );
    }

    const ropaMdMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/ropa\.md$/);
    if (method === 'GET' && ropaMdMatch) {
      const bundle = findStoredDossier(decodeURIComponent(ropaMdMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'en' ? 'en' : 'ar';
      const d = bundle.dossier;
      const fname = slugify(d.dossierCode || d.slug || d.id, 'dossier');
      return sendAttachment(
        res,
        'text/markdown; charset=utf-8',
        `pdplcheck-${fname}-ropa-${locale}.md`,
        buildPdplRopaDossierMarkdown(d, locale),
      );
    }

    const csvMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/export\.csv$/);
    if (method === 'GET' && csvMatch) {
      const bundle = findStoredDossier(decodeURIComponent(csvMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'en' ? 'en' : 'ar';
      const d = bundle.dossier;
      const fname = slugify(d.dossierCode || d.slug || d.id, 'dossier');
      return sendAttachment(
        res,
        'text/csv; charset=utf-8',
        `pdplcheck-${fname}-ropa-${locale}.csv`,
        exportRopaCsv(d, locale),
      );
    }

    const summaryMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/summary$/);
    if (method === 'GET' && summaryMatch) {
      const bundle = findStoredDossier(decodeURIComponent(summaryMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'en' ? 'en' : 'ar';
      return sendJson(res, 200, {
        locale,
        summary: buildExecutiveSummaryText(bundle.dossier, locale),
      });
    }

    // 7. Single Dossier Read, Update & Delete
    const dossierMatch = pathname.match(/^\/api\/dossiers\/([^/]+)$/);
    if (dossierMatch) {
      const id = decodeURIComponent(dossierMatch[1] || '');
      if (method === 'GET') {
        const bundle = findStoredDossier(id);
        if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, {
          ...bundle,
          publicReportUrl: buildPublicReportUrl(
            req,
            bundle.dossier.dossierCode || bundle.dossier.slug,
          ),
        });
      }
      if (method === 'PATCH') {
        const patch = await readJsonBody(req);
        const refIso =
          typeof patch?.referenceIso === 'string' && patch.referenceIso.trim()
            ? patch.referenceIso.trim()
            : new Date().toISOString();

        const updated = db.updateDossier(
          id,
          (current) => {
            const nextOrganization = patch?.organization
              ? mergeOrganizationProfile(patch.organization, current.organization)
              : current.organization;
            const nextActivities =
              patch?.activities !== undefined
                ? mergeActivities(patch.activities, current.activities)
                : current.activities;
            const nextBreachTriage = patch?.breachTriage
              ? mergeBreachTriage(patch.breachTriage, current.breachTriage)
              : current.breachTriage;

            const nextDraft = {
              ...current,
              ...(typeof patch?.slug === 'string' && patch.slug.trim() ? { slug: patch.slug.trim() } : {}),
              ...(patch?.defaultLocale === 'ar' || patch?.defaultLocale === 'en'
                ? { defaultLocale: patch.defaultLocale }
                : {}),
              organization: nextOrganization,
              activities: nextActivities,
              breachTriage: nextBreachTriage,
              updatedAtIso: refIso,
            };

            const evaluated = evaluatePdplCompliance(
              nextDraft,
              refIso,
              patch?.controls ?? patch?.controlOverrides,
            );
            return {
              ...nextDraft,
              ...evaluated,
            };
          },
          String(patch?.actor || 'governance').trim() || 'governance',
        );
        if (!updated) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, {
          ...updated,
          publicReportUrl: buildPublicReportUrl(req, updated.dossier.slug),
        });
      }
      if (method === 'DELETE') {
        const del = db.deleteDossier(id);
        if (!del.deleted) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, { deleted: true, id: del.id });
      }
    }

    // 8. Public Shareable PDPL Dossier (/api/public/reports/:slugOrCode)
    const pubMatch = pathname.match(/^\/api\/public\/reports\/([^/]+)$/);
    if (method === 'GET' && pubMatch) {
      const slugOrCode = decodeURIComponent(pubMatch[1] || '');
      const bundle = db.getDossierBySlugOrCode(slugOrCode, { incrementView: true });
      if (!bundle) return sendJson(res, 404, { error: 'PDPL dossier not found' });
      const d = bundle.dossier;
      return sendJson(res, 200, {
        ...bundle,
        summaryAr: buildExecutiveSummaryText(d, 'ar'),
        summaryEn: buildExecutiveSummaryText(d, 'en'),
        privacyNoticeHtmlAr: buildBilingualPrivacyNoticeHtml(d, 'ar'),
        privacyNoticeHtmlEn: buildBilingualPrivacyNoticeHtml(d, 'en'),
        ropaMarkdownAr: buildPdplRopaDossierMarkdown(d, 'ar'),
        ropaMarkdownEn: buildPdplRopaDossierMarkdown(d, 'en'),
        publicReportUrl: buildPublicReportUrl(req, d.dossierCode || d.slug),
      });
    }

    return sendJson(res, 404, { error: 'API endpoint not found' });
  }

  async function handler(req, res) {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      let pathname = parsedUrl.pathname;
      if (
        normalizedBasePath &&
        (pathname === normalizedBasePath || pathname.startsWith(`${normalizedBasePath}/`))
      ) {
        pathname = pathname.slice(normalizedBasePath.length) || '/';
      }
      const method = String(req.method || 'GET').toUpperCase();

      if (pathname.startsWith('/api/')) {
        await handleApiRequest(req, res, method, pathname, parsedUrl.searchParams);
        return;
      }

      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      serveStaticAsset(res, pathname, resolvedDist, method, normalizedBasePath);
    } catch (err) {
      const statusCode = mapCoreErrorStatus(err);
      const payload = {
        error: err?.message || 'Internal server error',
        ...(err?.code ? { code: err.code } : {}),
      };
      if (!res.headersSent) {
        sendJson(res, statusCode, payload);
      } else {
        res.end();
      }
    }
  }

  return {
    handler,
    close: () => db.close(),
  };
}
