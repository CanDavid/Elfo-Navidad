import { expect, test } from '@playwright/test';

test('recorre los tres niveles, presenta a cada guía y abre el duelo final', async ({ page }) => {
  await page.goto('?test=1#level-0');
  await page.waitForFunction(() => window.__NICO_DEBUG__?.snapshot().levelId === 'salon-navidad');

  const stages = [
    { level: 'salon-navidad', guide: 'LUMI', next: 'cocina-dulces' },
    { level: 'cocina-dulces', guide: 'CANELA', next: 'taller-juguetes' },
    { level: 'taller-juguetes', guide: 'BRUNO', next: 'azotea-final' },
  ];

  for (const stage of stages) {
    expect(await page.evaluate(() => window.__NICO_DEBUG__!.snapshot().levelId)).toBe(stage.level);
    await page.evaluate(() => window.__NICO_DEBUG__!.finish());
    await expect(page.locator('#story-character-name')).toContainText(stage.guide);
    await page.getByRole('button', { name: 'SIGUIENTE NIVEL' }).click();
    await page.waitForFunction((id) => window.__NICO_DEBUG__?.snapshot().levelId === id, stage.next);
  }

  const bossStart = await page.evaluate(() => window.__NICO_DEBUG__!.snapshot());
  expect(bossStart.bossHealth).toBe(5);
  expect(bossStart.bossVisible).toBe(true);
  expect(bossStart.bossX).toBeGreaterThan(700);
  expect(bossStart.bossX).toBeLessThan(1350);
  await page.waitForTimeout(1700);
  expect((await page.evaluate(() => window.__NICO_DEBUG__!.snapshot().bossProjectiles)).valueOf()).toBeGreaterThan(0);
});

test('el jefe recibe cinco disparos reales y completa la aventura sin desaparecer', async ({ page }) => {
  await page.goto('?test=1#level-3');
  await page.waitForFunction(() => window.__NICO_DEBUG__?.snapshot().levelId === 'azotea-final');

  for (let health = 4; health >= 0; health -= 1) {
    await page.evaluate(() => {
      const state = window.__NICO_DEBUG__!.snapshot();
      window.__NICO_DEBUG__!.teleport((state.bossX ?? 1030) - 100, state.bossY ?? 650);
      window.__NICO_DEBUG__!.castMagic();
    });
    await page.waitForFunction((expected) => window.__NICO_DEBUG__?.snapshot().bossHealth === expected, health);
    if (health > 0) {
      const state = await page.evaluate(() => window.__NICO_DEBUG__!.snapshot());
      expect(state.bossVisible).toBe(true);
      expect(state.bossX).toBeGreaterThan(500);
      await page.waitForTimeout(320);
    }
  }

  await expect(page.getByRole('heading', { name: /HAS RECUPERADO/ })).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: 'VOLVER A JUGAR' })).toBeVisible();
});
