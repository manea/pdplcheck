import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createPdplCheckServer } from '../../server/app.mjs';
import { verifyDossierIntegrity } from '../../src/core/dossierDigest.ts';
import type { PdplDossier } from '../../src/core/types.ts';

interface RunningTestServer {
  baseUrl: string;
  dataDir: string;
  distDir: string;
  stop: () => Promise<void>;
}

const activeServers: RunningTestServer[] = [];

async function startTestServer(
  options: { basePath?: string; withFakeDist?: boolean; maxMutationsPerMinute?: number } = {},
): Promise<RunningTestServer> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pdplcheck-test-'));
  const dataDir = path.join(tempRoot, 'data');
  const distDir = options.withFakeDist ? path.join(tempRoot, 'dist') : '';
  if (options.withFakeDist) {
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<!doctype html><html><head><title>PDPLCheck</title><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>',
      'utf8',
    );
  }

  const { handler, close } = createPdplCheckServer({
    dataDir,
    distDir,
    basePath: options.basePath ?? '',
    maxMutationsPerMinute: options.maxMutationsPerMinute ?? 120,
  });
  const server = http.createServer(handler);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  const handle: RunningTestServer = {
    baseUrl,
    dataDir,
    distDir,
    stop: async () => {
      close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(tempRoot, { recursive: true, force: true });
    },
  };
  activeServers.push(handle);
  return handle;
}

afterEach(async () => {
  while (activeServers.length > 0) {
    const srv = activeServers.pop();
    if (srv) {
      await srv.stop();
    }
  }
});

async function apiJson<T>(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; headers: Headers; data: T }> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T;
  return { status: res.status, headers: res.headers, data };
}

describe('PDPLCheck Node 22 + SQLite WAL HTTP API integration', () => {
  it('serves /api/health and /api/presets with security headers', async () => {
    const srv = await startTestServer();

    const health = await apiJson<{
      ok: boolean;
      service: string;
      version: string;
      basePath: string;
      totalDossiers: number;
    }>(`${srv.baseUrl}/api/health`);

    expect(health.status).toBe(200);
    expect(health.headers.get('x-content-type-options')).toBe('nosniff');
    expect(health.headers.get('referrer-policy')).toBe('same-origin');
    expect(health.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    const pkg = JSON.parse(
      fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    expect(health.data.ok).toBe(true);
    expect(health.data.service).toBe('pdplcheck');
    expect(health.data.version).toBe(pkg.version);
    expect(health.data.basePath).toBe('/');
    expect(health.data.totalDossiers).toBe(0);

    const presets = await apiJson<{ presets: Array<{ id: string }> }>(`${srv.baseUrl}/api/presets`);
    expect(presets.status).toBe(200);
    expect(presets.data.presets).toHaveLength(3);
  });

  it('audits RoPA CSVs & stateless dual PDPL + 72h clock and maps PdplCoreError to 400', async () => {
    const srv = await startTestServer();

    const csvPayload = [
      'activity_id,activity_name_ar,activity_name_en,purpose,data_categories,contains_sensitive_data,is_marketing_activity,explicit_marketing_opt_in,lawful_basis,hosting_region,transfer_safeguard,retention_days,processor_name',
      'ROPA-01,الفوترة,Billing,"Issue invoices, manage subscriptions",identity|tax_id,false,false,false,contract,ksa_local,local_residency,1825,Riyadh Cloud',
      'ROPA-02,تتبع,Ad Profiling,Behavioral ad retargeting,device_id,false,true,false,legitimate_interest,us_cloud,none,365,=SUM(A1:A2)',
    ].join('\n');

    const csvAudit = await apiJson<{
      report: { totalRows: number; passedRows: number; blockedRows: number };
      csvExport: string;
    }>(`${srv.baseUrl}/api/audit/ropa-csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvText: csvPayload,
        locale: 'ar',
        organization: { jurisdiction: 'ksa_pdpl' },
      }),
    });
    expect(csvAudit.status).toBe(200);
    expect(csvAudit.data.report.totalRows).toBe(2);
    expect(csvAudit.data.report.passedRows).toBe(1);
    expect(csvAudit.data.report.blockedRows).toBe(1);
    expect(csvAudit.data.csvExport.startsWith('\uFEFF')).toBe(true);
    expect(csvAudit.data.csvExport).toContain("'=SUM(A1:A2)");

    const emptyErr = await apiJson<{ code: string }>(`${srv.baseUrl}/api/audit/ropa-csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText: '   ' }),
    });
    expect(emptyErr.status).toBe(400);
    expect(emptyErr.data.code).toBe('EMPTY_CSV');

    const badHeaderErr = await apiJson<{ code: string }>(`${srv.baseUrl}/api/audit/ropa-csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText: 'wrong_col\nvalue' }),
    });
    expect(badHeaderErr.status).toBe(400);
    expect(badHeaderErr.data.code).toBe('INVALID_CSV_HEADER');

    const statelessAudit = await apiJson<{
      summary: { overallScore: number; readinessTier: string };
      breachAssessment: { state: string; remainingHours: number; requiresSdaiaNotification: boolean };
      controls: Array<{ id: string }>;
      privacyNoticeHtml: string;
      ropaMarkdown: string;
    }>(`${srv.baseUrl}/api/audit-pdpl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale: 'ar',
        referenceIso: '2026-11-24T10:00:00.000Z',
        organization: {
          organizationNameAr: 'شركة النخيل للحلول السحابية',
          organizationNameEn: 'Palm Cloud Solutions LLC',
          jurisdiction: 'dual_gcc',
          contactEmail: 'privacy@palmcloud.ae',
          privacyNoticeArUrl: 'https://palmcloud.ae/ar/privacy',
          privacyNoticeEnUrl: 'https://palmcloud.ae/en/privacy',
          dpoAppointed: true,
          dsarSlaDays: 20,
        },
        activities: [
          {
            id: 'ROPA-99',
            activityNameAr: 'معالجة الطلبات',
            activityNameEn: 'Order Fulfillment',
            purpose: 'Process customer orders and delivery notifications.',
            dataCategories: ['identity', 'phone'],
            containsSensitiveData: false,
            isMarketingActivity: false,
            explicitMarketingOptIn: false,
            lawfulBasis: 'contract',
            hostingRegion: 'uae_local',
            transferSafeguard: 'scc_contract',
            retentionDays: 1095,
            processorName: 'UAE Tier-1 Cloud',
          },
        ],
        breachTriage: {
          activeIncident: true,
          incidentTitleAr: 'محاولة تسريب تجريبية',
          incidentTitleEn: 'Simulated ticket bucket read exposure',
          discoveredAtIso: '2026-11-22T20:00:00.000Z',
          reportedToRegulator: false,
          reportedAtIso: '',
          riskSeverity: 'high_harm',
          affectedSubjectsCount: 450,
          likelyDataSubjectsNotified: false,
        },
      }),
    });
    expect(statelessAudit.status).toBe(200);
    expect(statelessAudit.data.controls).toHaveLength(10);
    expect(statelessAudit.data.breachAssessment.state).toBe('within_72h');
    expect(statelessAudit.data.breachAssessment.remainingHours).toBe(34);
    expect(statelessAudit.data.breachAssessment.requiresSdaiaNotification).toBe(true);
    expect(statelessAudit.data.summary.readinessTier).toBe('needs_remediation');
    expect(statelessAudit.data.privacyNoticeHtml).toContain('application/ld+json');
    expect(statelessAudit.data.ropaMarkdown).toContain('شركة النخيل للحلول السحابية');
  });

  it('supports CRUD for reusable GCC organization privacy profiles', async () => {
    const srv = await startTestServer();

    const created = await apiJson<{
      profile: {
        id: string;
        name: string;
        profile: { organizationNameEn: string; jurisdiction: string; dpoAppointed: boolean };
      };
    }>(`${srv.baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationNameAr: 'شركة الدانة للبيانات',
        organizationNameEn: 'Dana Data Systems LLC',
        jurisdiction: 'uae_pdpl',
        contactEmail: 'dpo@danadata.ae',
        privacyNoticeArUrl: 'https://danadata.ae/ar/privacy',
        privacyNoticeEnUrl: 'https://danadata.ae/en/privacy',
        dpoAppointed: false,
        dsarSlaDays: 25,
      }),
    });
    expect(created.status).toBe(201);
    const id = created.data.profile.id;
    expect(created.data.profile.profile.organizationNameEn).toBe('Dana Data Systems LLC');

    const listed = await apiJson<{ profiles: Array<{ id: string }> }>(`${srv.baseUrl}/api/profiles`);
    expect(listed.status).toBe(200);
    expect(listed.data.profiles).toHaveLength(1);

    const patched = await apiJson<{
      profile: { profile: { jurisdiction: string; dpoAppointed: boolean } };
    }>(`${srv.baseUrl}/api/profiles/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jurisdiction: 'dual_gcc', dpoAppointed: true }),
    });
    expect(patched.status).toBe(200);
    expect(patched.data.profile.profile.jurisdiction).toBe('dual_gcc');
    expect(patched.data.profile.profile.dpoAppointed).toBe(true);

    const deleted = await apiJson<{ deleted: boolean }>(
      `${srv.baseUrl}/api/profiles/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    expect(deleted.status).toBe(200);
    expect(deleted.data.deleted).toBe(true);

    const missing = await apiJson<{ error: string }>(
      `${srv.baseUrl}/api/profiles/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    expect(missing.status).toBe(404);
  });

  it('creates preset & custom dossiers, validates inputs, updates draft, and deletes draft', async () => {
    const srv = await startTestServer();

    const missingErr = await apiJson<{ code: string }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(missingErr.status).toBe(400);
    expect(missingErr.data.code).toBe('MISSING_DOSSIER_INPUT');

    const badPreset = await apiJson<{ code: string }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: 'does-not-exist' }),
    });
    expect(badPreset.status).toBe(400);
    expect(badPreset.data.code).toBe('UNKNOWN_PRESET');

    const blockedRes = await apiJson<{
      dossier: PdplDossier;
      publicReportUrl: string;
    }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presetId: 'ksa-ecommerce-transfer-gaps',
        referenceIso: '2026-11-24T10:00:00.000Z',
        actor: 'dpo-reviewer',
      }),
    });
    expect(blockedRes.status).toBe(201);
    const id = blockedRes.data.dossier.id;
    expect(blockedRes.data.dossier.summary.readinessTier).toBe('blocked');
    const beforeScore = blockedRes.data.dossier.summary.overallScore;

    const patched = await apiJson<{ dossier: PdplDossier }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization: {
            contactEmail: 'privacy@najdstore.sa',
            privacyNoticeArUrl: 'https://najdstore.sa/ar/privacy',
            privacyNoticeEnUrl: 'https://najdstore.sa/en/privacy',
            dpoAppointed: true,
            dsarSlaDays: 15,
          },
          activities: blockedRes.data.dossier.activities.map((item) => ({
            ...item,
            explicitMarketingOptIn: true,
            lawfulBasis: item.containsSensitiveData ? 'explicit_consent' : item.lawfulBasis,
            hostingRegion: 'ksa_local',
            transferSafeguard: 'local_residency',
            retentionDays: 730,
            processorName: 'KSA Tier-1 Sovereign Cloud',
          })),
        }),
      },
    );
    expect(patched.status).toBe(200);
    expect(patched.data.dossier.summary.overallScore).toBeGreaterThan(beforeScore);
    expect(patched.data.dossier.summary.overallScore).toBe(100);
    expect(patched.data.dossier.summary.readinessTier).toBe('ready');

    const custom = await apiJson<{ dossier: PdplDossier }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'custom-uae-draft',
        organization: {
          organizationNameAr: 'مسودة هيئة أبوظبي التجريبية',
          organizationNameEn: 'Custom UAE Draft LLC',
          jurisdiction: 'uae_pdpl',
          contactEmail: 'privacy@customuae.ae',
          privacyNoticeArUrl: 'https://customuae.ae/ar/privacy',
          privacyNoticeEnUrl: 'https://customuae.ae/en/privacy',
          dpoAppointed: true,
          dsarSlaDays: 20,
        },
        activities: [
          {
            id: 'ROPA-C1',
            activityNameAr: 'إدارة الموارد',
            activityNameEn: 'Resource Scheduling',
            purpose: 'Schedule facility access passes.',
            dataCategories: ['identity'],
            containsSensitiveData: false,
            isMarketingActivity: false,
            explicitMarketingOptIn: false,
            lawfulBasis: 'contract',
            hostingRegion: 'uae_local',
            transferSafeguard: 'local_residency',
            retentionDays: 365,
            processorName: 'UAE Region Cloud',
          },
        ],
      }),
    });
    expect(custom.status).toBe(201);

    const listed = await apiJson<{
      dossiers: Array<{ id: string }>;
      stats: { totalDossiers: number; draftDossiers: number };
    }>(`${srv.baseUrl}/api/dossiers`);
    expect(listed.data.stats.totalDossiers).toBe(2);
    expect(listed.data.stats.draftDossiers).toBe(2);

    const delCustom = await apiJson<{ deleted: boolean }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(custom.data.dossier.id)}`,
      { method: 'DELETE' },
    );
    expect(delCustom.status).toBe(200);
    expect(delCustom.data.deleted).toBe(true);
  });

  it('assigns atomic PDPL-YYYY-NNNN codes, verifies SHA-256 digest, enforces 409 lock, and duplicates cleanly', async () => {
    const srv = await startTestServer();
    const year = new Date().getUTCFullYear();

    const p1 = await apiJson<{ dossier: PdplDossier }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: 'gcc-saas-compliant' }),
    });
    const p2 = await apiJson<{ dossier: PdplDossier }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: 'breach-72h-triage-drill' }),
    });

    const fin1 = await apiJson<{ dossier: PdplDossier & { status: string } }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(p1.data.dossier.id)}/finalize`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'ciso' }),
      },
    );
    expect(fin1.status).toBe(200);
    expect(fin1.data.dossier.dossierCode).toBe(`PDPL-${year}-0001`);
    expect(fin1.data.dossier.status).toBe('locked');
    expect(fin1.data.dossier.digestHex).toMatch(/^[a-f0-9]{64}$/);
    expect((await verifyDossierIntegrity(fin1.data.dossier)).valid).toBe(true);

    const fin2 = await apiJson<{ dossier: PdplDossier }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(p2.data.dossier.id)}/lock`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'dpo' }),
      },
    );
    expect(fin2.status).toBe(200);
    expect(fin2.data.dossier.dossierCode).toBe(`PDPL-${year}-0002`);
    expect((await verifyDossierIntegrity(fin2.data.dossier)).valid).toBe(true);

    const mutateLocked = await apiJson<{ code: string }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(p1.data.dossier.id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization: { organizationNameEn: 'Tampered Entity' } }),
      },
    );
    expect(mutateLocked.status).toBe(409);
    expect(mutateLocked.data.code).toBe('DOSSIER_LOCKED');

    const deleteLocked = await apiJson<{ code: string }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(p1.data.dossier.id)}`,
      { method: 'DELETE' },
    );
    expect(deleteLocked.status).toBe(409);
    expect(deleteLocked.data.code).toBe('DOSSIER_LOCKED');

    const refinalize = await apiJson<{ code: string }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(p1.data.dossier.id)}/finalize`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
    );
    expect(refinalize.status).toBe(409);
    expect(refinalize.data.code).toBe('ALREADY_LOCKED');

    const cloned = await apiJson<{ dossier: PdplDossier & { status: string } }>(
      `${srv.baseUrl}/api/dossiers/${encodeURIComponent(p1.data.dossier.id)}/duplicate`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
    );
    expect(cloned.status).toBe(201);
    expect(cloned.data.dossier.status).toBe('draft');
    expect(cloned.data.dossier.dossierCode).toBe('');
    expect(cloned.data.dossier.organization.organizationNameEn).toContain('(Copy)');
  });

  it('exports Privacy Notice HTML, RoPA Markdown, UTF-8 BOM CSV, executive summary, public report views & BASE_PATH assets', async () => {
    const srv = await startTestServer({ basePath: '/pdplcheck', withFakeDist: true });

    const created = await apiJson<{ dossier: PdplDossier & { slug: string } }>(
      `${srv.baseUrl}/pdplcheck/api/dossiers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId: 'gcc-saas-compliant' }),
      },
    );
    const id = created.data.dossier.id;
    const slug = created.data.dossier.slug;
    expect(slug).toBe('gcc-saas-compliant');

    const noticeRes = await fetch(
      `${srv.baseUrl}/pdplcheck/api/dossiers/${encodeURIComponent(id)}/privacy-notice.html?locale=ar`,
    );
    expect(noticeRes.status).toBe(200);
    const noticeHtml = await noticeRes.text();
    expect(noticeHtml).toContain('lang="ar" dir="rtl"');
    expect(noticeHtml).toContain('application/ld+json');

    const mdRes = await fetch(
      `${srv.baseUrl}/pdplcheck/api/dossiers/${encodeURIComponent(id)}/ropa.md?locale=en`,
    );
    expect(mdRes.status).toBe(200);
    const mdText = await mdRes.text();
    expect(mdText).toContain('NOT legal counsel');
    expect(mdText).toContain('10-Control Dual-PDPL Matrix');

    const csvRes = await fetch(
      `${srv.baseUrl}/pdplcheck/api/dossiers/${encodeURIComponent(id)}/export.csv?locale=ar`,
    );
    expect(csvRes.status).toBe(200);
    const csvBuf = Buffer.from(await csvRes.arrayBuffer());
    expect(Array.from(csvBuf.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const csvText = csvBuf.toString('utf8');
    expect(csvText.startsWith('\uFEFF')).toBe(true);
    expect(csvText).toContain('ROPA-01');

    const sumRes = await apiJson<{ locale: string; summary: string }>(
      `${srv.baseUrl}/pdplcheck/api/dossiers/${encodeURIComponent(id)}/summary?locale=ar`,
    );
    expect(sumRes.status).toBe(200);
    expect(sumRes.data.locale).toBe('ar');
    expect(sumRes.data.summary).toContain('أفق السحابية');

    const pub1 = await apiJson<{
      viewCount: number;
      privacyNoticeHtmlEn: string;
      privacyNoticeHtmlAr: string;
      ropaMarkdownEn: string;
      ropaMarkdownAr: string;
      summaryEn: string;
      summaryAr: string;
    }>(`${srv.baseUrl}/pdplcheck/api/public/reports/${encodeURIComponent(slug)}`);
    expect(pub1.status).toBe(200);
    expect(pub1.data.viewCount).toBe(1);
    expect(pub1.data.privacyNoticeHtmlEn).toContain('application/ld+json');
    expect(pub1.data.ropaMarkdownAr).toContain('مصفوفة الضوابط الـ 10');

    const pub2 = await apiJson<{ viewCount: number }>(
      `${srv.baseUrl}/pdplcheck/api/public/reports/${encodeURIComponent(slug)}`,
    );
    expect(pub2.data.viewCount).toBe(2);

    const healthBase = await apiJson<{ basePath: string }>(`${srv.baseUrl}/pdplcheck/api/health`);
    expect(healthBase.status).toBe(200);
    expect(healthBase.data.basePath).toBe('/pdplcheck');

    const htmlRes = await fetch(`${srv.baseUrl}/pdplcheck/`);
    expect(htmlRes.status).toBe(200);
    const html = await htmlRes.text();
    expect(html).toContain('window.__PDPLCHECK_BASE__="/pdplcheck"');
    expect(html).toContain('href="/pdplcheck/assets/app.css"');
    expect(html).toContain('src="/pdplcheck/assets/app.js"');
  });

  it('enforces per-IP write rate limiting cleanly', async () => {
    const srv = await startTestServer({ maxMutationsPerMinute: 2 });

    const r1 = await apiJson<{ profile: { id: string } }>(`${srv.baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationNameEn: 'Entity 1' }),
    });
    expect(r1.status).toBe(201);

    const r2 = await apiJson<{ profile: { id: string } }>(`${srv.baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationNameEn: 'Entity 2' }),
    });
    expect(r2.status).toBe(201);

    const r3 = await apiJson<{ code: string }>(`${srv.baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationNameEn: 'Entity 3' }),
    });
    expect(r3.status).toBe(429);
    expect(r3.data.code).toBe('RATE_LIMITED');
  });
});
