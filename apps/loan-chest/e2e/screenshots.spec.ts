/**
 * High-signal screenshots (6 PNGs). Run: SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts
 */
import { test } from '@playwright/test';
import { openApp } from '@x10/shared/e2e';

const CURATOR = 'Alex Rivera';

async function dismissBanner(page: import('@playwright/test').Page) {
  await page.getByTestId('demo-banner').getByRole('button').first().click().catch(() => undefined);
}

test.describe('light', () => {
  test.use({ colorScheme: 'light' });

  test('stage light', async ({ page }, info) => {
    test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1');
    const phone = info.project.name === 'phone';
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page, '/', CURATOR);
    await dismissBanner(page);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: phone ? 'docs/redesign/phone-light-stage.png' : 'docs/redesign/desktop-light-stage.png',
    });
  });

  test('lens + Today focus', async ({ page }, info) => {
    test.skip(!process.env.SCREENSHOTS || info.project.name === 'phone', 'desktop only');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page, '/', CURATOR);
    await dismissBanner(page);
    await page.getByRole('radiogroup', { name: 'Lens' }).getByRole('radio', { name: /Wear/ }).click();
    await page.getByRole('button', { name: /LC-03 near retirement/ }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/redesign/desktop-lens.png' });
  });

  test('primary tool (Return slip)', async ({ page }, info) => {
    test.skip(!process.env.SCREENSHOTS || info.project.name === 'phone', 'desktop only');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page, '/return-slip', CURATOR);
    await dismissBanner(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/redesign/desktop-tool.png', fullPage: true });
  });
});

test.describe('dark', () => {
  test.use({ colorScheme: 'dark' });

  test('stage dark', async ({ page }, info) => {
    test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1');
    const phone = info.project.name === 'phone';
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page, '/', CURATOR);
    await dismissBanner(page);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: phone ? 'docs/redesign/phone-dark-stage.png' : 'docs/redesign/desktop-dark-stage.png',
    });
  });
});
