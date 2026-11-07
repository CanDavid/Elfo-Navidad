import { expect, test } from '@playwright/test';

test('la portada y el nivel encajan en iPad horizontal', async ({ page }) => {
  await page.goto('?test=1');
  await expect(page.getByRole('heading', { name: /NICO Y LA/ })).toBeVisible();
  await page.screenshot({ path: '/tmp/nico-title.png' });
  await page.getByRole('button', { name: 'JUGAR' }).click();
  await page.getByRole('button', { name: /SALTAR/ }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/nico-game.png' });
});
