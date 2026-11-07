import { expect, test } from '@playwright/test';

test('el vídeo aparece tras JUGAR y al terminar inicia el nivel', async ({ page }) => {
  await page.goto('?test=1');
  await page.getByRole('button', { name: 'JUGAR' }).click();
  await expect(page.locator('#intro-screen')).toBeVisible();
  await expect(page.getByRole('button', { name: /SALTAR/ })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('nico-intro-ended')));
  await expect(page.locator('#intro-screen')).toBeHidden();
  await expect(page.locator('#hud')).toBeVisible();
});
