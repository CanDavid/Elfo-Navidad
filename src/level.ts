export type PlatformKind = 'floor' | 'gift' | 'book' | 'shelf' | 'branch' | 'secret';

export interface PlatformData {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: PlatformKind;
}

export interface SparkData { id: string; x: number; y: number; secret?: boolean }
export interface EnemyData { id: string; type: 'snowman' | 'cookie'; x: number; y: number; minX: number; maxX: number }

export const LEVEL = {
  id: 'salon-navidad',
  name: 'EL SALÓN DE NAVIDAD',
  width: 9600,
  height: 900,
  spawn: { x: 180, y: 680 },
  checkpoint: { x: 6490, y: 570 },
  goal: { x: 9290, y: 120 },
  switch: { x: 4800, y: 490 },
  ice: { x: 3900, y: 585, width: 84, height: 150 },
  movingPlatform: { fromX: 4960, toX: 5350, y: 505, width: 150 },
  zones: [
    { name: 'ZONA DE REGALOS', start: 0, end: 3300, color: 0x5b1f32 },
    { name: 'ESTANTERÍA', start: 3300, end: 6400, color: 0x402a46 },
    { name: 'ÁRBOL', start: 6400, end: 9600, color: 0x173a38 },
  ],
  platforms: [
    { x: 0, y: 750, width: 1100, height: 150, kind: 'floor' },
    { x: 1180, y: 750, width: 1220, height: 150, kind: 'floor' },
    { x: 2490, y: 750, width: 1030, height: 150, kind: 'floor' },
    { x: 3610, y: 750, width: 900, height: 150, kind: 'floor' },
    { x: 4560, y: 750, width: 1320, height: 150, kind: 'floor' },
    { x: 5960, y: 750, width: 970, height: 150, kind: 'floor' },
    { x: 1000, y: 650, width: 190, height: 100, kind: 'gift' },
    { x: 1400, y: 630, width: 220, height: 120, kind: 'gift' },
    { x: 1780, y: 540, width: 260, height: 210, kind: 'gift' },
    { x: 2180, y: 650, width: 210, height: 100, kind: 'gift' },
    { x: 2670, y: 600, width: 220, height: 150, kind: 'gift' },
    { x: 3030, y: 480, width: 240, height: 270, kind: 'gift' },
    { x: 3480, y: 655, width: 170, height: 32, kind: 'book' },
    { x: 3730, y: 575, width: 200, height: 32, kind: 'book' },
    { x: 4090, y: 500, width: 230, height: 34, kind: 'book' },
    { x: 4440, y: 610, width: 190, height: 32, kind: 'book' },
    { x: 4720, y: 535, width: 220, height: 32, kind: 'shelf' },
    { x: 5400, y: 510, width: 250, height: 32, kind: 'shelf' },
    { x: 5750, y: 420, width: 220, height: 32, kind: 'book' },
    { x: 6060, y: 330, width: 260, height: 32, kind: 'secret' },
    { x: 6540, y: 650, width: 390, height: 32, kind: 'branch' },
    { x: 7030, y: 600, width: 430, height: 36, kind: 'branch' },
    { x: 7540, y: 520, width: 400, height: 36, kind: 'branch' },
    { x: 8030, y: 430, width: 390, height: 36, kind: 'branch' },
    { x: 8490, y: 340, width: 390, height: 36, kind: 'branch' },
    { x: 8920, y: 245, width: 410, height: 36, kind: 'branch' },
  ] as PlatformData[],
  sparks: [
    ...[420, 600, 790, 1050, 1270, 1500, 1810, 2010, 2250, 2700, 3100].map((x, i) => ({ id: `g${i}`, x, y: i > 6 && i < 9 ? 470 : 680 })),
    ...[3500, 3770, 4140, 4500, 4800, 5140, 5480, 5800].map((x, i) => ({ id: `s${i}`, x, y: 430 - (i % 3) * 40 })),
    ...[6000, 6100, 6200, 6300].map((x, i) => ({ id: `secret${i}`, x, y: 265, secret: true })),
    ...[6610, 6760, 7110, 7310, 7620, 7810, 8110, 8300, 8560, 8730, 9000, 9170].map((x, i) => ({ id: `t${i}`, x, y: 560 - i * 36 })),
  ] as SparkData[],
  enemies: [
    { id: 'snow-1', type: 'snowman', x: 2380, y: 680, minX: 2140, maxX: 2480 },
    { id: 'cookie-1', type: 'cookie', x: 4350, y: 690, minX: 4200, maxX: 4560 },
    { id: 'snow-2', type: 'snowman', x: 7180, y: 530, minX: 7040, maxX: 7420 },
  ] as EnemyData[],
  tutorials: [
    { x: 500, text: 'USA ◀ ▶ PARA CORRER' },
    { x: 1080, text: 'MANTÉN PARA SALTAR MÁS ALTO' },
    { x: 1740, text: 'PULSA OTRA VEZ EN EL AIRE PARA VOLAR' },
    { x: 3620, text: 'LA MAGIA ROMPE EL HIELO' },
    { x: 4620, text: 'ACTIVA EL INTERRUPTOR CON MAGIA' },
    { x: 6500, text: 'PUNTO DE CONTROL · SUBE HASTA LA ESTRELLA' },
  ],
} as const;
