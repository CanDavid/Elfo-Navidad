import { expect, test } from '@playwright/test';

type Snapshot = { sparks: number; total: number; score: number; best: number; checkpoint: boolean; switchOn: boolean; iceBroken: boolean; secretFound: boolean; giftsBroken: number; enemiesDefeated: number; pose: string; finished: boolean };

const snapshot = (page: import('@playwright/test').Page) => page.evaluate(() => window.__NICO_DEBUG__!.snapshot()) as Promise<Snapshot>;

test.beforeEach(async ({ page }) => {
  await page.goto('?test=1');
  await expect(page.getByRole('heading', { name: /NICO Y LA/ })).toBeVisible();
  await page.getByRole('button', { name: 'JUGAR' }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.waitForFunction(() => !!window.__NICO_DEBUG__);
});

test('carga desde el subdirectorio y admite teclado y dos controles táctiles', async ({ page }) => {
  const failures: string[] = [];
  page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');

  const right = page.locator('#right-button');
  const jump = page.locator('#jump-button');
  await right.dispatchEvent('pointerdown', { pointerId: 11, pointerType: 'touch', isPrimary: true });
  await jump.dispatchEvent('pointerdown', { pointerId: 12, pointerType: 'touch', isPrimary: false });
  await expect(right).toHaveClass(/pressed/);
  await expect(jump).toHaveClass(/pressed/);
  await jump.dispatchEvent('pointerup', { pointerId: 12, pointerType: 'touch' });
  await right.dispatchEvent('pointerup', { pointerId: 11, pointerType: 'touch' });
  await expect(right).not.toHaveClass(/pressed/);
  expect(failures).toEqual([]);
});

test('conserva chispas al reaparecer, no las duplica y activa la ruta completa', async ({ page }) => {
  await page.evaluate(() => window.__NICO_DEBUG__!.collect('g0'));
  expect((await snapshot(page)).sparks).toBe(1);
  await page.evaluate(() => window.__NICO_DEBUG__!.collect('g0'));
  expect((await snapshot(page)).sparks).toBe(1);

  await page.evaluate(() => window.__NICO_DEBUG__!.teleport(6600, 580));
  await page.waitForTimeout(300);
  const atCheckpoint = await snapshot(page);
  expect(atCheckpoint.checkpoint).toBe(true);
  await page.evaluate(() => window.__NICO_DEBUG__!.respawn());
  expect((await snapshot(page)).sparks).toBe(atCheckpoint.sparks);

  await page.evaluate(() => {
    window.__NICO_DEBUG__!.breakIce();
    window.__NICO_DEBUG__!.activateSwitch();
    window.__NICO_DEBUG__!.collect('secret0');
  });
  const route = await snapshot(page);
  expect(route.iceBroken).toBe(true);
  expect(route.switchOn).toBe(true);
  expect(route.secretFound).toBe(true);
});

test('los regalos requieren dos impactos, liberan chispas y los enemigos caen derrotados', async ({ page }) => {
  await page.evaluate(() => window.__NICO_DEBUG__!.teleport(4160, 690));
  await page.locator('#magic-button').click();
  await page.waitForTimeout(650);
  expect((await snapshot(page)).enemiesDefeated).toBe(1);

  await page.evaluate(() => window.__NICO_DEBUG__!.teleport(900, 690));
  await page.locator('#magic-button').click();
  await page.waitForTimeout(430);
  expect((await snapshot(page)).giftsBroken).toBe(0);
  await page.locator('#magic-button').click();
  await page.waitForTimeout(430);
  expect((await snapshot(page)).giftsBroken).toBe(1);
  await page.evaluate(() => window.__NICO_DEBUG__!.collect('g3'));
  expect((await snapshot(page)).sparks).toBe(1);
});

test('Nico cambia de pose al correr, saltar, volar y lanzar magia', async ({ page }) => {
  await page.waitForFunction(() => window.__NICO_DEBUG__?.snapshot().pose === 'nico-idle');
  expect((await snapshot(page)).pose).toBe('nico-idle');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(180);
  expect((await snapshot(page)).pose).toMatch(/nico-run[12]/);
  await page.keyboard.press('Space');
  await page.waitForTimeout(80);
  expect((await snapshot(page)).pose).toBe('nico-jump');
  await page.keyboard.up('ArrowRight');

  await page.keyboard.down('Space');
  await page.waitForTimeout(100);
  expect((await snapshot(page)).pose).toBe('nico-fly');
  await page.keyboard.up('Space');
  await page.locator('#magic-button').dispatchEvent('pointerdown', { pointerId: 14, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(60);
  expect((await snapshot(page)).pose).toBe('nico-magic');
  await page.locator('#magic-button').dispatchEvent('pointerup', { pointerId: 14, pointerType: 'touch' });
});

test('termina la partida, reinicia elementos y conserva el récord', async ({ page }) => {
  await page.evaluate(() => {
    window.__NICO_DEBUG__!.collect('g0');
    window.__NICO_DEBUG__!.collect('secret0');
    window.__NICO_DEBUG__!.finish();
  });
  await expect(page.getByRole('heading', { name: /HAS ENCENDIDO/ })).toBeVisible();
  expect((await snapshot(page)).finished).toBe(true);
  await page.getByRole('button', { name: 'VOLVER A JUGAR' }).click();
  await page.waitForFunction(() => window.__NICO_DEBUG__?.snapshot().finished === false);
  const fresh = await snapshot(page);
  expect(fresh.sparks).toBe(0);
  expect(fresh.best).toBe(200);

  await page.reload();
  await page.getByRole('button', { name: 'JUGAR' }).click();
  await page.waitForFunction(() => !!window.__NICO_DEBUG__);
  expect((await snapshot(page)).best).toBe(200);
});

test('pausa en vertical y conserva el estado al volver a horizontal', async ({ page }) => {
  await page.evaluate(() => window.__NICO_DEBUG__!.collect('g1'));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#rotate-message')).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#rotate-message')).toBeHidden();
  expect((await snapshot(page)).sparks).toBe(1);
});
