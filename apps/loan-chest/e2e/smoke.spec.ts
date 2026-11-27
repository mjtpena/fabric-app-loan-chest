import { expect, test } from '@playwright/test';
import { openApp } from '@x10/shared/e2e';

const CURATOR = 'Alex Rivera';
const BORROWER = 'Sam Taylor';

test.describe('Loan Chest — smoke & acceptance criteria', () => {
  test('loads wooden loan chest, switches lens, focuses Today item, and toggles list view without console errors', async ({ page }, info) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await openApp(page, '/', CURATOR);
    await expect(page.getByTestId('loan-chest-svg')).toBeVisible();

    // Switch to Wear lens
    await page.getByRole('radiogroup', { name: 'Lens' }).getByRole('radio', { name: /Wear/ }).click();

    // Click Today item for near-retirement LC-03
    if (info.project.name === 'phone') {
      await page.getByRole('button', { name: /^Today/ }).click();
    }
    await page.getByRole('button', { name: /LC-03 near retirement/ }).click();

    // Toggle to List view
    await page.getByRole('radio', { name: 'List' }).click();
    await expect(page.getByRole('table').first()).toContainText('LC-01');

    expect(errors).toEqual([]);
  });

  test('?nowebgl renders the complete SVG loan chest', async ({ page }) => {
    await openApp(page, '/?nowebgl', CURATOR);
    await expect(page.getByTestId('loan-chest-svg')).toBeVisible();
  });

  test('AC2: Drawer pull refuses a loan longer than 4 days with the maximum shown', async ({ page }) => {
    await openApp(page, '/drawer-pull', BORROWER);
    await page.getByLabel('Start date').fill('2026-12-10');
    await page.getByLabel('Return date').fill('2026-12-16');
    await expect(page.getByText(/exceeds the maximum of 4 days/)).toBeVisible();
  });

  test('AC3: Waiting list ranks never-borrowed Jordan Lee first ahead of recent borrowers', async ({ page }) => {
    await openApp(page, '/waiting-list', CURATOR);
    const firstRow = page.getByRole('table').locator('tbody tr').first();
    await expect(firstRow).toContainText('Jordan Lee');
    await expect(firstRow).toContainText('Never borrowed');
    await expect(firstRow).toContainText('Allocated');
  });

  test('AC4 & AC5: Return slip shows $2.00 donation for 3d overdue loan and retires LC-03 on 12th return', async ({ page }) => {
    await openApp(page, '/return-slip', CURATOR);
    // LC-01 is 3 days overdue -> $2.00 donation
    await expect(page.getByText('$2.00').first()).toBeVisible();

    // Check in LC-03 (11/12 wears) -> retires automatically
    const lc03Row = page.getByRole('row', { name: /LC-03/ });
    await lc03Row.getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByText(/LC-03 reached 12 wears and has been retired/)).toBeVisible();
  });
});
