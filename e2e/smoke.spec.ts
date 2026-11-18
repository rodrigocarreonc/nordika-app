import { test, expect } from '@playwright/test';

test('loads the app and checks login page', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  console.log('Final URL:', page.url());
  const bodyText = await page.innerText('body');
  console.log('Body text:\n', bodyText);
  await expect(page.getByText('NORDIKA').first()).toBeVisible({ timeout: 10000 });
});
