import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function assertNoHorizontalOverflow(page: Page) {
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dims.scrollWidth).toBeLessThanOrEqual(dims.innerWidth);
}

test.describe('PDPLCheck — UAE & KSA PDPL Studio E2E', () => {
  test('defaults to Arabic RTL / Alabaster Teal, toggles English LTR / Gulf Obsidian, and persists across reload', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.getByTestId('storage-mode-badge')).toContainText('SQLite WAL (:4199)');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'alabaster-teal');
    await expect(page.getByTestId('mandatory-legal-disclaimer')).toContainText('سدايا');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/01-workspace-ar-alabaster.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByTestId('toggle-locale-btn').click();
    await page.getByTestId('toggle-theme-btn').click();

    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'gulf-obsidian');
    await expect(page.getByTestId('mandatory-legal-disclaimer')).toContainText('NOT legal counsel');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/02-workspace-en-obsidian.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.reload();
    await expect(page.getByTestId('storage-mode-badge')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'gulf-obsidian');

    // Restore defaults cleanly
    await page.getByTestId('toggle-locale-btn').click();
    await page.getByTestId('toggle-theme-btn').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'alabaster-teal');

    expect(errors).toEqual([]);
  });

  test('remediates KSA e-commerce transfer gaps, tests 72h breach triage & BOM CSV audit, seals PDPL-YYYY-0001 with SHA-256, and verifies public route', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const year = new Date().getUTCFullYear();
    const expectedCode = `PDPL-${year}-0001`;

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.getByTestId('org-name-en-input')).toBeVisible();

    // 1. Launch KSA E-Commerce Transfer & Arabic Notice Gaps preset
    await page.getByTestId('preset-btn-ksa-ecommerce-transfer-gaps').click();
    await expect(page.getByTestId('org-name-en-input')).toHaveValue('Najd Digital Commerce Co.');

    // 2. Remediate entity profile & both RoPA activities to 100/100 compliance
    await page.getByTestId('org-contact-email-input').fill('privacy@najdstore.sa');
    await page.getByTestId('org-notice-ar-url-input').fill('https://najdstore.sa/ar/privacy');
    await page.getByTestId('org-dsar-sla-input').fill('15');
    await page.getByTestId('org-dpo-checkbox').check();

    await page.getByTestId('ropa-safeguard-select-0').selectOption('scc_contract');
    await page.getByTestId('ropa-explicit-optin-checkbox-0').check();

    await page.getByTestId('ropa-basis-select-1').selectOption('explicit_consent');
    await page.getByTestId('ropa-safeguard-select-1').selectOption('scc_contract');
    await page.getByTestId('ropa-retention-input-1').fill('730');
    await page.getByTestId('ropa-processor-input-1').fill('KSA Regulated HSM Vault');

    await page.screenshot({
      path: 'test-results/qa-screenshots/03-remediated-ropa-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // 3. Switch to Tab 2 (72h Breach Clock & Bulk RoPA CSV)
    await page.getByTestId('tab-breach').click();
    await page.getByTestId('simulate-38h-btn').click();
    await expect(page.getByTestId('breach-state-badge')).toHaveText('within_72h');
    await page.getByTestId('simulate-clean-btn').click();
    await expect(page.getByTestId('breach-state-badge')).toHaveText('no_incident');

    await page.getByTestId('run-csv-audit-btn').click();
    await expect(page.getByTestId('csv-results-table')).toContainText('CSV-01');
    await expect(page.getByTestId('csv-results-table')).toContainText('CSV-02');
    await expect(page.getByTestId('csv-results-table')).toContainText('CSV-03');

    const dlPromise = page.waitForEvent('download');
    await page.getByTestId('download-csv-audit-btn').click();
    const csvDownload = await dlPromise;
    expect(csvDownload.suggestedFilename()).toContain('.csv');
    const dlPath = await csvDownload.path();
    expect(dlPath).toBeTruthy();
    if (dlPath) {
      const bytes = fs.readFileSync(dlPath);
      expect(bytes[0]).toBe(0xef);
      expect(bytes[1]).toBe(0xbb);
      expect(bytes[2]).toBe(0xbf);
      const csvStr = bytes.toString('utf8');
      expect(csvStr).toContain("'=HYPERLINK");
    }

    // 4. Switch to Tab 3 (10 Controls, Bilingual Privacy Notice HTML + JSON-LD & SHA-256 Sealing)
    await page.getByTestId('tab-notice').click();
    await expect(page.getByTestId('live-overall-score')).toHaveText('100/100');

    await page.getByTestId('toggle-raw-html-btn').click();
    await expect(page.getByTestId('notice-source-pre')).toContainText('application/ld+json');
    await page.getByTestId('toggle-raw-html-btn').click();

    await page.getByTestId('finalize-dossier-btn').click();
    await expect(page.getByTestId('report-dossier-code')).toContainText(expectedCode);
    await expect(page.getByTestId('report-digest-hex')).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.getByTestId('finalize-dossier-btn')).toHaveCount(0);

    await page.screenshot({
      path: 'test-results/qa-screenshots/04-sealed-dossier-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // 5. Verify Public Share Route persistence across reload
    await page.getByTestId('open-public-brief-btn').click();
    await expect(page).toHaveURL(new RegExp(`/r/${expectedCode}$`));
    await expect(page.getByTestId('report-digest-hex')).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.getByTestId('public-view-count')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('report-digest-hex')).toHaveText(/^[0-9a-f]{64}$/);

    await page.getByTestId('back-to-studio-btn').click();
    await expect(page).toHaveURL(/\/$/);

    expect(errors).toEqual([]);
  });

  test('verifies mobile 390x844 responsiveness across all tabs in Arabic RTL and dark English LTR with zero horizontal overflow', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByTestId('ropa-card-0')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/05-mobile-ar-alabaster.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByTestId('tab-breach').click();
    await page.getByTestId('run-csv-audit-btn').click();
    await expect(page.getByTestId('csv-results-table')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByTestId('tab-notice').click();
    await expect(page.getByTestId('live-overall-score')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByTestId('tab-ropa').click();
    await page.getByTestId('toggle-locale-btn').click();
    await page.getByTestId('toggle-theme-btn').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'gulf-obsidian');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/06-mobile-en-obsidian.png',
      fullPage: true,
      animations: 'disabled',
    });

    expect(errors).toEqual([]);
  });
});
