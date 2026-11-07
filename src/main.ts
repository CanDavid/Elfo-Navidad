import Phaser from 'phaser';
import { LEVEL, LEVELS, selectLevel, type EnemyData, type PlatformData } from './level';
import './style.css';

type HeldInput = { left: boolean; right: boolean; jump: boolean; magic: boolean };
type GameSnapshot = { levelId: string; sparks: number; total: number; score: number; best: number; checkpoint: boolean; switchOn: boolean; iceBroken: boolean; secretFound: boolean; giftsBroken: number; enemiesDefeated: number; bossHealth: number | null; bossProjectiles: number; bossX: number | null; bossY: number | null; bossVisible: boolean; pose: string; finished: boolean };

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string, options: Record<string, unknown>) => YouTubePlayer;
      PlayerState: { PLAYING: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
    __NICO_DEBUG__?: {
      snapshot: () => GameSnapshot;
      teleport: (x: number, y: number) => void;
      collect: (id: string) => void;
      breakIce: () => void;
      activateSwitch: () => void;
      castMagic: () => void;
      hitGift: (index: number) => void;
      defeatEnemy: (id: string) => void;
      enemyX: (id: string) => number | null;
      hitBoss: () => void;
      respawn: () => void;
      finish: () => void;
    };
  }
}

type YouTubePlayer = { playVideo: () => void; stopVideo: () => void; destroy: () => void };
type YouTubeStateEvent = { data: number };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const shell = $('game-shell');
const titleScreen = $('title-screen');
const introScreen = $('intro-screen');
const introLoading = $('intro-loading');
const pauseScreen = $('pause-screen');
const resultScreen = $('result-screen');
const storyScreen = $('story-screen');
const hud = $('hud');
const touchControls = $('touch-controls');
const rotateMessage = $('rotate-message');
const toast = $('toast');
const soundButton = $('sound-button');

const storage = {
  get(key: string, fallback: string) {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  },
  set(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* Safari private mode may reject storage. */ }
  },
};

let soundEnabled = storage.get('nico-sound', 'true') !== 'false';
let bestScore = Number(storage.get('nico-best', '0')) || 0;
let activeScene: SalonScene | undefined;
const levelMatch = location.hash.match(/^#level-(\d+)$/);
let currentLevelIndex = levelMatch ? Math.min(Number(levelMatch[1]), LEVELS.length - 1) : 0;
const autoStart = location.hash === '#replay' || !!levelMatch;
if (location.hash === '#replay') {
  try { sessionStorage.removeItem('nico-campaign'); } catch { /* Storage is optional. */ }
  history.replaceState(null, '', `${location.pathname}${location.search}`);
}
selectLevel(currentLevelIndex);
let campaign = { sparks: 0, score: 0 };
try { campaign = JSON.parse(sessionStorage.getItem('nico-campaign') || '{"sparks":0,"score":0}'); } catch { /* Use defaults. */ }
let started = autoStart;
let menuPaused = false;
let orientationPaused = false;
let introActive = false;
let toastTimer = 0;

class TinyAudio {
  private context?: AudioContext;

  unlock() {
    if (!soundEnabled) return;
    this.context ??= new AudioContext();
    void this.context.resume();
  }

  play(kind: 'jump' | 'spark' | 'magic' | 'hit' | 'star') {
    if (!soundEnabled) return;
    this.unlock();
    const ctx = this.context;
    if (!ctx) return;
    const notes = {
      jump: [420, 620, 0.12], spark: [760, 1120, 0.14], magic: [920, 480, 0.12],
      hit: [180, 90, 0.2], star: [523, 1046, 0.65],
    }[kind];
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = kind === 'hit' ? 'square' : 'triangle';
    oscillator.frequency.setValueAtTime(notes[0], ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(notes[1], ctx.currentTime + notes[2]);
    gain.gain.setValueAtTime(kind === 'star' ? 0.11 : 0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + notes[2]);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + notes[2]);
    if (kind === 'star') {
      [0.15, 0.3].forEach((delay, i) => setTimeout(() => this.chime(i ? 783 : 659), delay * 1000));
    }
  }

  private chime(frequency: number) {
    if (!soundEnabled || !this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.08, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.3);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start();
    oscillator.stop(this.context.currentTime + 0.3);
  }
}

const audio = new TinyAudio();
const held: HeldInput = { left: false, right: false, jump: false, magic: false };
const youtubeVideoId = 'q5j9RXUoDP0';
let youtubePlayer: YouTubePlayer | undefined;
let youtubePlayerPromise: Promise<YouTubePlayer | undefined> | undefined;

function showToast(message: string, duration = 2200) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.add('hidden'), duration);
}

function updateSoundLabel() {
  soundButton.textContent = `SONIDO: ${soundEnabled ? 'SÍ' : 'NO'}`;
}

function clearHeldInputs() {
  Object.keys(held).forEach((key) => { held[key as keyof HeldInput] = false; });
  document.querySelectorAll('.control-button.pressed').forEach((button) => button.classList.remove('pressed'));
  activeScene?.clearTransientInput();
}

function bindHold(id: string, name: keyof HeldInput, onPress?: () => void, onRelease?: () => void) {
  const button = $<HTMLButtonElement>(id);
  const release = (event?: PointerEvent) => {
    if (event && button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    held[name] = false;
    button.classList.remove('pressed');
    onRelease?.();
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    try { button.setPointerCapture(event.pointerId); } catch { /* Synthetic pointers used by browser tests are not capturable. */ }
    held[name] = true;
    button.classList.add('pressed');
    onPress?.();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((eventName) => button.addEventListener(eventName, (event) => release(event as PointerEvent)));
}

bindHold('left-button', 'left');
bindHold('right-button', 'right');
bindHold('jump-button', 'jump', () => activeScene?.pressJump(), () => activeScene?.releaseJump());
bindHold('magic-button', 'magic', () => activeScene?.castMagic());

function pauseGame(showMenu = true) {
  if (!started || !activeScene?.scene.isActive()) return;
  clearHeldInputs();
  activeScene.scene.pause();
  if (showMenu) {
    menuPaused = true;
    pauseScreen.classList.remove('hidden');
  }
}

function resumeGame() {
  menuPaused = false;
  pauseScreen.classList.add('hidden');
  if (!orientationPaused && started && activeScene?.scene.isPaused()) activeScene.scene.resume();
}

function checkOrientation() {
  const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 900;
  rotateMessage.classList.toggle('hidden', !portrait);
  if (portrait && started) {
    orientationPaused = true;
    pauseGame(false);
  } else if (orientationPaused) {
    orientationPaused = false;
    if (!menuPaused && activeScene?.scene.isPaused()) activeScene.scene.resume();
  }
}

function reloadRun() {
  clearHeldInputs();
  try { sessionStorage.removeItem('nico-campaign'); } catch { /* Storage is optional. */ }
  history.replaceState(null, '', `${location.pathname}${location.search}#replay`);
  location.reload();
}

function loadNextLevel() {
  currentLevelIndex = Math.min(currentLevelIndex + 1, LEVELS.length - 1);
  history.replaceState(null, '', `${location.pathname}${location.search}#level-${currentLevelIndex}`);
  location.reload();
}

function startLevel() {
  if (!introActive) return;
  introActive = false;
  youtubePlayer?.stopVideo();
  introScreen.classList.add('hidden');
  started = true;
  hud.classList.remove('hidden');
  touchControls.classList.remove('hidden');
  activeScene?.scene.resume();
  showToast(LEVEL.name, 1800);
  checkOrientation();
}

function prepareYouTubePlayer() {
  if (youtubePlayer) return Promise.resolve(youtubePlayer);
  if (youtubePlayerPromise) return youtubePlayerPromise;
  youtubePlayerPromise = new Promise((resolve) => {
    const createPlayer = () => {
      if (!window.YT?.Player) { resolve(undefined); return; }
      youtubePlayer = new window.YT.Player('youtube-player', {
        videoId: youtubeVideoId,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 0, controls: 1, playsinline: 1, rel: 0, fs: 0 },
        events: {
          onReady: () => resolve(youtubePlayer),
          onStateChange: (event: YouTubeStateEvent) => {
            if (event.data === window.YT?.PlayerState.PLAYING) introLoading.classList.add('hidden');
            if (event.data === window.YT?.PlayerState.ENDED) startLevel();
          },
          onError: () => { introLoading.textContent = 'NO SE PUDO CARGAR · PULSA SALTAR'; },
        },
      });
    };
    if (window.YT?.Player) { createPlayer(); return; }
    window.onYouTubeIframeAPIReady = createPlayer;
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => { introLoading.textContent = 'NO SE PUDO CARGAR · PULSA SALTAR'; resolve(undefined); };
    document.head.appendChild(script);
  });
  return youtubePlayerPromise;
}

function playIntro() {
  introActive = true;
  titleScreen.classList.add('hidden');
  introScreen.classList.remove('hidden');
  introLoading.classList.remove('hidden');
  void prepareYouTubePlayer().then((player) => {
    if (!introActive) return;
    if (player) player.playVideo();
  });
}

window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 150));
window.addEventListener('blur', clearHeldInputs);
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearHeldInputs(); pauseGame(true); } });
document.addEventListener('contextmenu', (event) => event.preventDefault());

class SalonScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private sparks!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private bossProjectiles!: Phaser.Physics.Arcade.Group;
  private boss?: Phaser.Physics.Arcade.Sprite;
  private bossVisual?: Phaser.GameObjects.Image;
  private bossHealthLabel?: Phaser.GameObjects.Text;
  private movingPlatform!: Phaser.GameObjects.Rectangle;
  private movingBody!: Phaser.Physics.Arcade.StaticBody;
  private iceBlocks: Phaser.GameObjects.Rectangle[] = [];
  private giftPlatforms: Phaser.GameObjects.Rectangle[] = [];
  private goal?: Phaser.Physics.Arcade.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private collected = new Set<string>();
  private checkpointReached = false;
  private switchOn = false;
  private iceBroken = false;
  private secretFound = false;
  private giftsBroken = 0;
  private enemiesDefeated = 0;
  private finished = false;
  private campaignSaved = false;
  private bossHealth = LEVEL.boss?.hits ?? 0;
  private bossNextShot = 0;
  private bossNextJump = 0;
  private bossInvulnerableUntil = 0;
  private facing = 1;
  private jumpPressedAt = -9999;
  private leftGroundAt = -9999;
  private flightRemaining = 2000;
  private flying = false;
  private usedAirJump = false;
  private lastMagicAt = -9999;
  private castingUntil = -9999;
  private currentPose = '';
  private invulnerableUntil = 0;
  private tutorialIndex = 0;
  private respawnPoint: { x: number; y: number } = { ...LEVEL.spawn };
  private zoneLabel!: Phaser.GameObjects.Text;
  private twinkles: Phaser.GameObjects.Arc[] = [];

  constructor() { super('SALON'); }

  preload() { /* All art is generated locally for instant, offline-safe loading. */ }

  create() {
    activeScene = this;
    this.makeTextures();
    this.physics.world.setBounds(0, 0, LEVEL.width, LEVEL.height + 180);
    this.cameras.main.setBounds(0, 0, LEVEL.width, LEVEL.height);
    this.drawWorld();
    this.createPlatforms();
    this.createInteractiveObjects();
    this.createPlayer();
    this.createInputs();
    this.createCollisions();
    this.zoneLabel = this.add.text(42, 115, LEVEL.name, {
      fontFamily: 'Arial Black, Arial', fontSize: '24px', color: '#fff4c7', stroke: '#4e2032', strokeThickness: 7,
    }).setScrollFactor(0).setDepth(50).setAlpha(0);
    this.updateHud();
    if (!started) this.scene.pause();
    this.installDebugApi();
  }

  private makeTextures() {
    const make = (key: string, width: number, height: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      if (this.textures.exists(key)) return;
      const g = this.add.graphics(); draw(g); g.generateTexture(key, width, height); g.destroy();
    };
    type ElfPose = 'idle' | 'run1' | 'run2' | 'jump' | 'fall' | 'fly' | 'magic' | 'celebrate';
    const drawElf = (g: Phaser.GameObjects.Graphics, pose: ElfPose) => {
      const poses = {
        idle: { la:[24,62,19,88], ra:[48,62,53,88], ll:[30,84,27,103], rl:[42,84,45,103] },
        run1: { la:[24,62,14,77], ra:[48,62,60,72], ll:[31,84,18,99], rl:[42,84,55,96] },
        run2: { la:[24,62,12,72], ra:[48,62,57,79], ll:[31,84,52,99], rl:[42,84,24,96] },
        jump: { la:[24,62,12,43], ra:[48,62,61,42], ll:[31,84,22,94], rl:[42,84,52,93] },
        fall: { la:[24,62,7,66], ra:[48,62,65,66], ll:[31,84,30,103], rl:[42,84,43,103] },
        fly: { la:[24,62,9,51], ra:[48,62,66,49], ll:[31,84,20,95], rl:[42,84,55,95] },
        magic: { la:[24,62,17,84], ra:[48,62,69,58], ll:[31,84,27,103], rl:[42,84,45,103] },
        celebrate: { la:[24,62,11,38], ra:[48,62,61,37], ll:[31,84,22,98], rl:[42,84,51,98] },
      }[pose];
      const limb = (points: number[]) => {
        g.lineStyle(7, 0xb9253c, 1).lineBetween(points[0], points[1], points[2], points[3]);
        g.fillStyle(0xffffff).fillCircle(points[2], points[3], 4);
      };
      limb(poses.la); limb(poses.ra);
      g.lineStyle(7, 0xb9253c, 1).lineBetween(poses.ll[0], poses.ll[1], poses.ll[2], poses.ll[3]).lineBetween(poses.rl[0], poses.rl[1], poses.rl[2], poses.rl[3]);
      g.fillStyle(0x2b2330).fillEllipse(poses.ll[2] - 1, Math.min(102, poses.ll[3]), 14, 6).fillEllipse(poses.rl[2] + 1, Math.min(102, poses.rl[3]), 14, 6);
      g.fillStyle(0xc72b43).fillRoundedRect(23, 55, 26, 35, 7);
      g.fillStyle(0xf9f2df).fillTriangle(20, 56, 36, 69, 52, 56).fillCircle(36, 57, 4);
      g.fillStyle(0xf1b99e).fillEllipse(36, 38, 35, 37);
      g.fillStyle(0xe7a786).fillEllipse(18, 39, 7, 11).fillEllipse(54, 39, 7, 11);
      g.fillStyle(0x7b3d2e).fillRoundedRect(21, 22, 30, 9, 4);
      g.fillStyle(0xd42e45).fillTriangle(13, 27, 52, 4, 55, 30);
      g.fillStyle(0xf3c94f).fillCircle(52, 7, 5);
      g.fillStyle(0xf8dfd0).fillEllipse(26, 43, 8, 6).fillEllipse(47, 43, 8, 6);
      g.fillStyle(0xe88d95).fillCircle(21, 47, 5).fillCircle(51, 47, 5);
      g.fillStyle(0xffffff).fillEllipse(29, 37, 8, 6).fillEllipse(43, 37, 8, 6);
      g.fillStyle(0x5b82a0).fillCircle(30, 37, 3).fillCircle(42, 37, 3);
      g.fillStyle(0x25212b).fillCircle(30, 37, 1.5).fillCircle(42, 37, 1.5);
      g.lineStyle(2, 0x8b3441, 1).beginPath().arc(36, 45, 9, 0.35, 2.8).strokePath();
      if (pose === 'magic') {
        g.fillStyle(0xb9f7ff, 0.9).fillPoints([{x:68,y:42},{x:71,y:51},{x:80,y:54},{x:71,y:57},{x:68,y:66},{x:65,y:57},{x:56,y:54},{x:65,y:51}], true);
      }
    };
    (['idle','run1','run2','jump','fall','fly','magic','celebrate'] as ElfPose[]).forEach((pose) => make(`nico-${pose}`, 80, 108, (g) => drawElf(g, pose)));
    make('spark', 34, 34, (g) => {
      g.fillStyle(0xffdf62).fillPoints([{x:17,y:0},{x:21,y:11},{x:34,y:12},{x:24,y:20},{x:28,y:33},{x:17,y:25},{x:6,y:33},{x:10,y:20},{x:0,y:12},{x:13,y:11}], true);
      g.lineStyle(2, 0xffffff, 0.8).strokeCircle(17, 16, 12);
    });
    make('magic', 28, 28, (g) => g.fillStyle(0xb5f5ff).fillPoints([{x:14,y:0},{x:18,y:10},{x:28,y:14},{x:18,y:18},{x:14,y:28},{x:10,y:18},{x:0,y:14},{x:10,y:10}], true));
    make('enemy-magic', 32, 32, (g) => {
      g.fillStyle(0xc16cff, 0.35).fillCircle(16, 16, 16);
      g.fillStyle(0x8b35c9).fillPoints([{x:16,y:0},{x:21,y:10},{x:32,y:16},{x:21,y:22},{x:16,y:32},{x:11,y:22},{x:0,y:16},{x:11,y:10}], true);
      g.fillStyle(0xffd2ff).fillCircle(16, 16, 5);
    });
    make('snowman', 60, 74, (g) => {
      g.fillStyle(0xeefcff).fillCircle(30, 48, 24).fillCircle(30, 20, 18);
      g.fillStyle(0x253844).fillCircle(24, 17, 3).fillCircle(36, 17, 3);
      g.fillStyle(0xf08a42).fillTriangle(31, 22, 31, 28, 48, 25);
      g.fillStyle(0xcf3045).fillRect(8, 29, 44, 8);
    });
    make('cookie', 58, 64, (g) => {
      g.fillStyle(0xc87945).fillCircle(29, 34, 27);
      g.fillStyle(0xfff1d0).fillCircle(21, 27, 4).fillCircle(38, 22, 4).fillCircle(35, 46, 4);
      g.fillStyle(0x42293b).fillCircle(22, 34, 2).fillCircle(36, 34, 2);
      g.lineStyle(2, 0x702d35).lineBetween(23, 42, 35, 42);
    });
    make('grouch', 104, 132, (g) => {
      g.lineStyle(12, 0x55933f).lineBetween(29, 94, 18, 122).lineBetween(72, 94, 88, 122);
      g.fillStyle(0x29302c).fillEllipse(14, 124, 30, 12).fillEllipse(91, 124, 30, 12);
      g.fillStyle(0xb92e43).fillRoundedRect(20, 63, 66, 48, 15);
      g.fillStyle(0xf4eee0).fillRect(18, 62, 70, 13);
      g.fillStyle(0x72b553).fillEllipse(52, 45, 67, 67);
      g.fillStyle(0x4e8d38).fillEllipse(19, 47, 15, 25).fillEllipse(85, 47, 15, 25);
      g.fillStyle(0xffffff).fillEllipse(38, 40, 19, 14).fillEllipse(66, 40, 19, 14);
      g.fillStyle(0xf6d34d).fillCircle(41, 42, 5).fillCircle(63, 42, 5);
      g.fillStyle(0x28242d).fillCircle(42, 42, 2.5).fillCircle(62, 42, 2.5);
      g.lineStyle(5, 0x31532d).lineBetween(27, 28, 45, 34).lineBetween(59, 34, 78, 28);
      g.lineStyle(4, 0x3d5635).beginPath().arc(52, 57, 22, 3.4, 6).strokePath();
      g.fillStyle(0xd73348).fillTriangle(15, 28, 81, 2, 91, 31);
      g.fillStyle(0xf4eee0).fillCircle(84, 7, 8).fillRect(14, 24, 76, 11);
    });
    make('goal', 100, 100, (g) => {
      g.fillStyle(0xffdf62).fillPoints([{x:50,y:0},{x:61,y:35},{x:99,y:36},{x:68,y:58},{x:80,y:96},{x:50,y:73},{x:20,y:96},{x:32,y:58},{x:1,y:36},{x:39,y:35}], true);
      g.lineStyle(5, 0xffffff, 0.8).strokeCircle(50, 48, 34);
    });
  }

  private drawWorld() {
    if (LEVEL.theme !== 'salon') { this.drawAlternateWorld(); return; }
    this.add.rectangle(LEVEL.width / 2, 360, LEVEL.width, 720, 0x4c3345).setDepth(-30);
    this.add.rectangle(LEVEL.width / 2, 670, LEVEL.width, 160, 0x754852).setDepth(-29);
    this.add.rectangle(LEVEL.width / 2, 590, LEVEL.width, 18, 0xe1b778).setDepth(-27);
    this.add.rectangle(LEVEL.width / 2, 704, LEVEL.width, 20, 0x3d2936).setDepth(-26);
    for (let x = 60; x < LEVEL.width; x += 170) {
      this.add.circle(x, 165 + (x % 340 ? 42 : 0), 5, 0xf0c98d, 0.15).setDepth(-28);
      this.add.rectangle(x, 410, 2, 320, 0xf5d59a, 0.06).setDepth(-28);
    }
    this.drawWindow(520, 155);
    this.drawSofa(1450, 580);
    this.drawFireplace(2640, 555);
    this.drawBookshelf(4720, 410);
    this.drawTree(8200, 690);
    this.add.ellipse(1700, 718, 2350, 230, 0x2c7772, 0.72).setStrokeStyle(14, 0xe3bc78, 0.65).setDepth(-14);
    this.add.ellipse(4900, 720, 2500, 210, 0x8c3e54, 0.56).setStrokeStyle(12, 0xd8a868, 0.5).setDepth(-14);
    this.drawPicture(1120, 210, 280, 190, 0x244f55);
    this.drawPicture(2050, 200, 220, 160, 0x6c2942);
    this.drawPicture(6280, 210, 250, 180, 0x275d54);
    for (let x = 90; x < LEVEL.width; x += 210) {
      const wireY = 82 + Math.sin(x / 350) * 22;
      if (x < LEVEL.width - 210) this.add.line(0, 0, x, wireY, x + 210, 82 + Math.sin((x + 210) / 350) * 22, 0x253333, 0.8).setOrigin(0).setDepth(-9);
      const glow = this.add.circle(x, wireY + 8, 7, x % 420 ? 0xffd75e : 0xff667e, 0.95).setDepth(-8);
      this.twinkles.push(glow);
      this.tweens.add({ targets: glow, alpha: 0.35, scale: 1.55, yoyo: true, repeat: -1, duration: 750 + (x % 500) });
    }
    for (let x = 380; x < 3200; x += 540) this.drawGift(x, 690, 130 + x % 90, 100 + x % 60);
    for (let x = 3500; x < 6200; x += 420) this.drawBookStack(x, 700, x % 3);
  }

  private drawAlternateWorld() {
    const palettes = {
      kitchen: { wall: 0xf0cfad, lower: 0x75a4a0, trim: 0x7e3946 },
      workshop: { wall: 0x315662, lower: 0x7b3d50, trim: 0xe0b761 },
      rooftop: { wall: 0x102d46, lower: 0x1b4055, trim: 0xe8f3ef },
    } as const;
    const palette = palettes[LEVEL.theme as keyof typeof palettes];
    this.add.rectangle(LEVEL.width / 2, 350, LEVEL.width, 700, palette.wall).setDepth(-30);
    this.add.rectangle(LEVEL.width / 2, 665, LEVEL.width, 170, palette.lower).setDepth(-28);
    this.add.rectangle(LEVEL.width / 2, 580, LEVEL.width, 20, palette.trim).setDepth(-26);
    if (LEVEL.theme === 'kitchen') {
      for (let x = 0; x < LEVEL.width; x += 160) for (let y = 80; y < 560; y += 120) this.add.rectangle(x + 78, y, 150, 110, 0xffead1, 0.48).setStrokeStyle(3, 0xb97769, 0.35).setDepth(-27);
      for (let x = 650; x < LEVEL.width; x += 1750) {
        this.add.rectangle(x, 430, 620, 330, 0x984f45).setStrokeStyle(12, 0x5e3433).setDepth(-20);
        this.add.rectangle(x, 430, 330, 230, 0x222936).setStrokeStyle(9, 0xd49e69).setDepth(-19);
        this.add.circle(x - 190, 285, 58, 0x8ec0ba).setStrokeStyle(8, 0xf2d9a5).setDepth(-18);
      }
      for (let x = 1200; x < LEVEL.width; x += 1200) {
        this.add.ellipse(x, 610, 420, 100, 0xd7e9df, 0.75).setDepth(-16);
        this.add.rectangle(x, 555, 230, 85, 0xbe724b).setStrokeStyle(6, 0xffdf93).setDepth(-15);
      }
    } else if (LEVEL.theme === 'workshop') {
      for (let x = 240; x < LEVEL.width; x += 560) {
        this.add.circle(x, 230 + (x % 3) * 60, 105, 0xd2a64f, 0.35).setStrokeStyle(18, 0x523946).setDepth(-22);
        this.add.circle(x, 230 + (x % 3) * 60, 35, 0x315662).setDepth(-21);
        for (let a = 0; a < 8; a += 1) this.add.rectangle(x + Math.cos(a * Math.PI / 4) * 120, 230 + (x % 3) * 60 + Math.sin(a * Math.PI / 4) * 120, 38, 70, 0xd2a64f, 0.45).setAngle(a * 45).setDepth(-23);
      }
      this.add.rectangle(1800, 600, 1400, 170, 0x8f5a3d).setStrokeStyle(12, 0x3f3032).setDepth(-18);
      for (let x = 3300; x < 7600; x += 900) {
        this.add.rectangle(x, 575, 620, 190, x % 1800 ? 0x3d8c83 : 0xb44855).setStrokeStyle(10, 0xf0c766).setDepth(-17);
        this.add.circle(x - 190, 680, 62, 0x292b36).setStrokeStyle(10, 0xd8b15d).setDepth(-16);
        this.add.circle(x + 190, 680, 62, 0x292b36).setStrokeStyle(10, 0xd8b15d).setDepth(-16);
      }
    } else {
      for (let x = 80; x < LEVEL.width; x += 210) this.add.circle(x, 90 + (x * 7) % 420, 3 + x % 6, 0xffffff, 0.75).setDepth(-24);
      this.add.circle(3150, 150, 110, 0xffe9ad, 0.92).setDepth(-23);
      for (let x = 0; x < LEVEL.width; x += 700) {
        this.add.rectangle(x + 350, 570, 650, 260, 0x6c4352).setStrokeStyle(9, 0xc58c77).setDepth(-20);
        this.add.triangle(x + 350, 390, 0, 210, 325, 0, 650, 210, 0x34536a).setDepth(-19);
        this.add.rectangle(x + 530, 350, 95, 250, 0x744a43).setDepth(-18);
        this.add.ellipse(x + 530, 215, 55, 110, 0xdce9e3, 0.45).setDepth(-17);
      }
      for (let x = 100; x < LEVEL.width; x += 260) this.add.circle(x, 705, 18 + x % 12, 0xffffff, 0.8).setDepth(-14);
    }
    for (let x = 100; x < LEVEL.width; x += 250) {
      const glow = this.add.circle(x, 75 + Math.sin(x / 250) * 18, 6, x % 500 ? 0xffdc65 : 0xff6b82, 0.9).setDepth(-8);
      this.twinkles.push(glow);
      this.tweens.add({ targets: glow, alpha: 0.3, yoyo: true, repeat: -1, duration: 750 + x % 450 });
    }
  }

  private drawWindow(x: number, y: number) {
    this.add.rectangle(x, y + 170, 560, 390, 0xe6c28b).setDepth(-22);
    this.add.rectangle(x, y + 170, 500, 330, 0x173f55).setDepth(-21);
    this.add.circle(x + 145, y + 75, 48, 0xf8e9bd, 0.85).setDepth(-20);
    for (let i = 0; i < 22; i += 1) this.add.circle(x - 220 + (i * 83) % 440, y + 35 + (i * 57) % 270, 3 + i % 4, 0xffffff, 0.7).setDepth(-19);
    this.add.rectangle(x, y + 170, 16, 330, 0xe6c28b).setDepth(-18);
    this.add.rectangle(x, y + 170, 500, 16, 0xe6c28b).setDepth(-18);
    this.add.triangle(x - 340, y + 185, 0, 0, 190, -25, 190, 390, 0x87364d, 0.94).setDepth(-17);
    this.add.triangle(x + 340, y + 185, 0, 0, -190, -25, -190, 390, 0x87364d, 0.94).setDepth(-17);
  }

  private drawSofa(x: number, y: number) {
    this.add.rectangle(x, y + 70, 900, 100, 0x3e2533).setDepth(-18);
    this.add.rectangle(x - 360, y + 130, 42, 120, 0x563527).setDepth(-16);
    this.add.rectangle(x + 360, y + 130, 42, 120, 0x563527).setDepth(-16);
    this.add.rectangle(x, y - 85, 820, 330, 0x2f746f).setStrokeStyle(10, 0x173f45).setDepth(-17);
    this.add.rectangle(x - 245, y - 80, 285, 270, 0x408b82).setStrokeStyle(5, 0x8ac0a8, 0.4).setDepth(-16);
    this.add.rectangle(x + 65, y - 80, 285, 270, 0x387f78).setStrokeStyle(5, 0x8ac0a8, 0.4).setDepth(-16);
    this.add.rectangle(x + 320, y - 55, 180, 230, 0x9e4057).setStrokeStyle(6, 0xf0bf78, 0.5).setAngle(-5).setDepth(-15);
  }

  private drawFireplace(x: number, y: number) {
    this.add.rectangle(x, y - 160, 720, 45, 0xd0a272).setStrokeStyle(8, 0x694233).setDepth(-18);
    this.add.rectangle(x, y, 620, 340, 0xa76850).setStrokeStyle(10, 0x684033).setDepth(-19);
    this.add.rectangle(x, y + 30, 360, 230, 0x241f26).setStrokeStyle(12, 0xe0b17a).setDepth(-17);
    this.add.ellipse(x, y + 105, 210, 115, 0xe85f3d, 0.9).setDepth(-16);
    this.add.triangle(x, y + 90, 0, 95, 55, -65, 110, 95, 0xffd35d).setDepth(-15);
    this.add.rectangle(x - 175, y - 205, 48, 110, 0xc43c52).setDepth(-16);
    this.add.rectangle(x + 175, y - 205, 48, 110, 0x2e8176).setDepth(-16);
  }

  private drawBookshelf(x: number, y: number) {
    this.add.rectangle(x, y, 2880, 650, 0x5b382e).setStrokeStyle(18, 0x2d2428).setDepth(-23);
    for (let shelf = 0; shelf < 4; shelf += 1) this.add.rectangle(x, 155 + shelf * 155, 2820, 22, 0xc18b5e).setDepth(-20);
    const colors = [0x9b3d54, 0x347e76, 0xd29a55, 0x5c4f83, 0xb85a43];
    for (let i = 0; i < 55; i += 1) {
      const bx = 3350 + (i * 53) % 2720;
      const row = i % 4;
      const h = 70 + (i * 17) % 55;
      this.add.rectangle(bx, 140 + row * 155 - h / 2, 38 + i % 3 * 7, h, colors[i % colors.length], 0.9).setStrokeStyle(2, 0xf3d69a, 0.2).setDepth(-19);
    }
    this.add.circle(5270, 235, 68, 0xf0d9a4).setStrokeStyle(10, 0x744938).setDepth(-18);
    this.add.line(0, 0, 5270, 235, 5270, 190, 0x47313a, 4).setOrigin(0).setDepth(-17);
    this.add.line(0, 0, 5270, 235, 5310, 250, 0x47313a, 4).setOrigin(0).setDepth(-17);
  }

  private drawTree(x: number, groundY: number) {
    this.add.rectangle(x, groundY - 150, 210, 360, 0x633c2a).setStrokeStyle(12, 0x3c2a27).setDepth(-22);
    this.add.triangle(x, groundY - 490, 0, 620, 650, 0, 1300, 620, 0x14533f, 0.96).setDepth(-21);
    this.add.triangle(x, groundY - 690, 70, 520, 650, 0, 1230, 520, 0x1c6a4c, 0.96).setDepth(-20);
    this.add.triangle(x, groundY - 835, 165, 390, 650, 0, 1135, 390, 0x2a7a55, 0.96).setDepth(-19);
    const ornaments = [0xd94159, 0xf2cb5e, 0x67c6cb, 0xb05a9a];
    for (let i = 0; i < 20; i += 1) {
      const ox = x - 430 + (i * 157) % 860;
      const oy = 185 + (i * 83) % 430;
      this.add.circle(ox, oy, 16 + i % 3 * 4, ornaments[i % ornaments.length], 0.95).setStrokeStyle(3, 0xffefc2, 0.65).setDepth(-15);
    }
    this.add.line(0, 0, x - 460, 360, x + 460, 480, 0xf4d56e, 0.65).setLineWidth(8).setOrigin(0).setDepth(-14);
    this.add.line(0, 0, x - 360, 250, x + 350, 340, 0xe85b73, 0.55).setLineWidth(7).setOrigin(0).setDepth(-14);
  }

  private drawPicture(x: number, y: number, width: number, height: number, color: number) {
    this.add.rectangle(x, y, width, height, 0xd5aa70).setStrokeStyle(8, 0x402d31).setDepth(-22);
    this.add.rectangle(x, y, width - 30, height - 30, color).setDepth(-21);
    this.add.circle(x, y - 15, Math.min(width, height) * 0.22, 0xf1d18c, 0.75).setDepth(-20);
  }

  private drawGift(x: number, y: number, width: number, height: number) {
    const color = x % 2 ? 0xcf4054 : 0x3b8d75;
    this.add.rectangle(x, y - height / 2, width, height, color, 0.55).setStrokeStyle(5, 0xffe7a3, 0.3).setDepth(-9);
    this.add.rectangle(x, y - height / 2, 18, height, 0xffd45c, 0.4).setDepth(-8);
  }

  private drawBookStack(x: number, y: number, offset: number) {
    [0x7e3852, 0x2b7b73, 0xca7b4c].forEach((color, i) => this.add.rectangle(x + i * 8, y - i * 31 - offset * 5, 260 - i * 20, 27, color, 0.55).setDepth(-9));
  }

  private platformColor(kind: PlatformData['kind']) {
    return { floor: 0x6a3045, gift: 0xc93d53, book: 0x4d8a82, shelf: 0xa66b4e, branch: 0x3e7650, secret: 0x735988 }[kind];
  }

  private createPlatforms() {
    this.platforms = this.physics.add.staticGroup();
    LEVEL.platforms.forEach((data, index) => {
      const platform = this.add.rectangle(data.x + data.width / 2, data.y + data.height / 2, data.width, data.height, this.platformColor(data.kind))
        .setStrokeStyle(data.kind === 'branch' ? 7 : 4, data.kind === 'branch' ? 0x9bc96f : 0xffd89a, 0.65);
      this.physics.add.existing(platform, true);
      this.platforms.add(platform);
      if (data.kind === 'gift') {
        const ribbon = this.add.rectangle(data.x + data.width / 2, data.y + data.height / 2, 16, data.height, 0xffd15d).setDepth(platform.depth + 1);
        platform.setData({ gift: true, hits: 2, giftIndex: index, ribbon });
        this.giftPlatforms.push(platform);
      }
    });
    const moving = LEVEL.movingPlatform;
    this.movingPlatform = this.add.rectangle(moving.fromX, moving.y, moving.width, 26, 0x59b9ab).setStrokeStyle(4, 0xd9fff2).setVisible(false);
    this.physics.add.existing(this.movingPlatform, true);
    this.movingBody = this.movingPlatform.body as Phaser.Physics.Arcade.StaticBody;
    this.movingBody.enable = false;
    this.platforms.add(this.movingPlatform);
  }

  private createInteractiveObjects() {
    this.sparks = this.physics.add.group({ allowGravity: false, immovable: true });
    LEVEL.sparks.forEach((data, index) => {
      const spark = this.sparks.create(data.x, data.y, 'spark') as Phaser.Physics.Arcade.Sprite;
      const giftIndex = LEVEL.platforms.findIndex((platform) => platform.kind === 'gift' && data.x > platform.x && data.x < platform.x + platform.width && data.y > platform.y && data.y < platform.y + platform.height);
      spark.setData({ id: data.id, secret: !!data.secret, giftIndex });
      if (giftIndex >= 0) {
        spark.setVisible(false);
        (spark.body as Phaser.Physics.Arcade.Body).enable = false;
      }
      spark.setDepth(5);
      this.tweens.add({ targets: spark, y: data.y - 10, angle: 12, yoyo: true, repeat: -1, duration: 700 + (index % 4) * 120 });
    });
    this.enemies = this.physics.add.group({ collideWorldBounds: true });
    LEVEL.enemies.forEach((data) => {
      const enemy = this.enemies.create(data.x, data.y, data.type) as Phaser.Physics.Arcade.Sprite;
      enemy.setData({ ...data, direction: -1, dying: false, nextJumpAt: this.time.now + 1600 });
      enemy.setBounce(0.05).setDepth(5);
      enemy.body!.setSize(data.type === 'cookie' ? 44 : 46, data.type === 'cookie' ? 55 : 68);
    });
    this.projectiles = this.physics.add.group({ allowGravity: false });
    this.bossProjectiles = this.physics.add.group({ allowGravity: false });
    this.createIce(LEVEL.ice.x, LEVEL.ice.y, LEVEL.ice.width, LEVEL.ice.height, false);
    this.createIce(5945, 205, 80, 125, true);
    const switchBase = this.add.rectangle(LEVEL.switch.x, LEVEL.switch.y, 52, 75, 0x6f3760).setStrokeStyle(4, 0xf6d465);
    this.physics.add.existing(switchBase, true);
    switchBase.setData('switch', true);
    this.physics.add.overlap(this.projectiles, switchBase, (bullet) => {
      (bullet as Phaser.Physics.Arcade.Sprite).destroy(); this.activateSwitch();
    });
    if (LEVEL.boss) {
      this.bossHealth = LEVEL.boss.hits;
      this.boss = this.physics.add.sprite(LEVEL.boss.x, LEVEL.boss.y, 'grouch').setDepth(9).setBounce(0.05).setCollideWorldBounds(true);
      this.boss.body!.setSize(70, 112).setOffset(17, 18);
      this.boss.setAlpha(0);
      this.bossVisual = this.add.image(LEVEL.boss.x, LEVEL.boss.y, 'grouch').setDepth(10);
      this.boss.setData({ dying: false, direction: -1 });
      this.bossNextShot = this.time.now + 900;
      this.bossNextJump = this.time.now + 1300;
      this.bossHealthLabel = this.add.text(640, 108, 'GRUÑÓN  ♥ ♥ ♥ ♥ ♥', { fontFamily: 'Arial Black', fontSize: '25px', color: '#c7ff8c', stroke: '#321f3d', strokeThickness: 7 })
        .setOrigin(0.5).setScrollFactor(0).setDepth(55);
      this.add.ellipse(LEVEL.boss.x, 727, 150, 24, 0x0b1820, 0.42).setDepth(2);
    } else {
      this.goal = this.physics.add.image(LEVEL.goal.x, LEVEL.goal.y, 'goal').setImmovable(true).setDepth(7);
      (this.goal.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      this.tweens.add({ targets: this.goal, angle: 8, scale: 1.08, yoyo: true, repeat: -1, duration: 900 });
      this.add.text(LEVEL.goal.x - 145, LEVEL.goal.y - 95, 'LA ESTRELLA', { fontFamily: 'Arial Black', fontSize: '28px', color: '#fff7c2', stroke: '#57203b', strokeThickness: 8 });
    }
  }

  private createIce(x: number, y: number, width: number, height: number, secret: boolean) {
    const ice = this.add.rectangle(x + width / 2, y + height / 2, width, height, 0x9ce7f0, 0.82).setStrokeStyle(4, 0xe9ffff).setDepth(4);
    this.physics.add.existing(ice, true);
    ice.setData({ ice: true, secret });
    this.platforms.add(ice);
    this.iceBlocks.push(ice);
  }

  private createPlayer() {
    this.player = this.physics.add.sprite(LEVEL.spawn.x, LEVEL.spawn.y, 'nico-idle').setDepth(10);
    this.player.setCollideWorldBounds(false).setMaxVelocity(330, 760).setDragX(1100);
    this.player.body!.setSize(34, 78).setOffset(23, 28);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08, -220, 55);
    this.cameras.main.setDeadzone(170, 180);
  }

  private createInputs() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE, magic: Phaser.Input.Keyboard.KeyCodes.X,
      pause: Phaser.Input.Keyboard.KeyCodes.ESC,
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.jump.on('down', () => this.pressJump());
    this.keys.jump.on('up', () => this.releaseJump());
    this.keys.magic.on('down', () => this.castMagic());
    this.keys.pause.on('down', () => menuPaused ? resumeGame() : pauseGame(true));
  }

  private createCollisions() {
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.overlap(this.player, this.sparks, (_player, spark) => this.collectSpark(spark as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => this.hitPlayer(enemy as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.projectiles, this.enemies, (bullet, enemy) => this.defeatEnemy(bullet as Phaser.Physics.Arcade.Sprite, enemy as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.projectiles, this.platforms, (bullet, object) => {
      const target = object as unknown as Phaser.GameObjects.Rectangle;
      if (target.getData('gift')) this.damageGift(target);
      else if (target.getData('ice')) this.breakIce(target);
      (bullet as Phaser.Physics.Arcade.Sprite).destroy();
    });
    if (this.goal) this.physics.add.overlap(this.player, this.goal, () => this.finishLevel());
    if (this.boss) {
      this.physics.add.collider(this.boss, this.platforms);
      this.physics.add.overlap(this.player, this.boss, () => this.hitPlayer(this.boss!));
      this.physics.add.overlap(this.projectiles, this.boss, (bullet) => this.hitBoss(bullet as Phaser.Physics.Arcade.Sprite));
      this.physics.add.overlap(this.player, this.bossProjectiles, (_player, bullet) => {
        (bullet as Phaser.Physics.Arcade.Sprite).destroy();
        this.hitPlayer(this.boss!);
      });
      this.physics.add.collider(this.bossProjectiles, this.platforms, (bullet) => (bullet as Phaser.Physics.Arcade.Sprite).destroy());
    }
  }

  clearTransientInput() {
    this.jumpPressedAt = -9999;
    this.flying = false;
  }

  pressJump() {
    if (this.finished || !started || this.scene.isPaused()) return;
    const now = this.time.now;
    this.jumpPressedAt = now;
    const grounded = this.player.body?.blocked.down || this.player.body?.touching.down;
    if (grounded || now - this.leftGroundAt < 130) {
      this.doJump();
    } else if (!this.usedAirJump && this.flightRemaining > 0) {
      this.usedAirJump = true;
      this.flying = true;
      this.player.setVelocityY(-145);
      audio.play('jump');
      showToast('¡VUELA, NICO!', 900);
    }
  }

  releaseJump() {
    this.flying = false;
    if (this.player?.body && this.player.body.velocity.y < -190) this.player.setVelocityY(this.player.body.velocity.y * 0.48);
  }

  private doJump() {
    this.player.setVelocityY(-470);
    this.jumpPressedAt = -9999;
    this.usedAirJump = false;
    audio.play('jump');
  }

  castMagic() {
    if (this.finished || !started || this.scene.isPaused() || this.time.now - this.lastMagicAt < 330) return;
    this.lastMagicAt = this.time.now;
    this.castingUntil = this.time.now + 480;
    this.setPlayerPose('nico-magic');
    const star = this.projectiles.create(this.player.x + this.facing * 34, this.player.y - 5, 'magic') as Phaser.Physics.Arcade.Sprite;
    star.setVelocityX(this.facing * 590).setAngularVelocity(this.facing * 420).setDepth(9).setData('born', this.time.now);
    audio.play('magic');
    this.tweens.add({ targets: this.player, angle: this.facing * -10, yoyo: true, duration: 90 });
  }

  private collectSpark(spark: Phaser.Physics.Arcade.Sprite) {
    const id = String(spark.getData('id'));
    if (this.collected.has(id)) { spark.destroy(); return; }
    this.collected.add(id);
    if (spark.getData('secret') && !this.secretFound) {
      this.secretFound = true;
      showToast('¡HAS ENCONTRADO EL CAMINO SECRETO!');
    }
    spark.destroy();
    audio.play('spark');
    this.updateHud();
  }

  private hitPlayer(enemy: Phaser.Physics.Arcade.Sprite) {
    if (this.time.now < this.invulnerableUntil || enemy.getData('dying')) return;
    this.respawn('¡CUIDADO!');
  }

  private defeatEnemy(bullet: Phaser.Physics.Arcade.Sprite | undefined, enemy: Phaser.Physics.Arcade.Sprite) {
    bullet?.destroy();
    if (!enemy.active || enemy.getData('dying')) return;
    enemy.setData('dying', true).setCollideWorldBounds(false).setTint(0xffe37a).setVelocity(enemy.x < this.player.x ? -150 : 150, -370).setAngularVelocity(enemy.x < this.player.x ? -380 : 380);
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.checkCollision.none = true;
    body.setAllowGravity(true);
    this.enemiesDefeated += 1;
    this.tweens.add({ targets: enemy, alpha: 0.2, delay: 650, duration: 700, onComplete: () => enemy.destroy() });
    audio.play('hit');
    showToast('¡ENEMIGO DERROTADO!', 800);
  }

  private hitBoss(bullet?: Phaser.Physics.Arcade.Sprite, force = false) {
    bullet?.destroy();
    if (!this.boss?.active || this.boss.getData('dying') || (!force && this.time.now < this.bossInvulnerableUntil)) return;
    this.bossInvulnerableUntil = this.time.now + 280;
    this.bossHealth -= 1;
    this.bossHealthLabel?.setText(`GRUÑÓN  ${'♥ '.repeat(this.bossHealth).trim() || 'DERROTADO'}`);
    audio.play('hit');
    this.boss.setVelocityX(this.player.x < this.boss.x ? 190 : -190).setVelocityY(-130);
    this.bossVisual?.setTint(0xffe078);
    if (this.bossVisual) this.tweens.add({ targets: this.bossVisual, scaleX: 1.18, scaleY: 0.82, yoyo: true, duration: 120, onComplete: () => this.bossVisual?.clearTint().setScale(1) });
    if (this.bossHealth > 0) {
      showToast(`¡IMPACTO! QUEDAN ${this.bossHealth} GOLPES`, 1000);
      return;
    }
    this.boss.setData('dying', true).setCollideWorldBounds(false).setVelocity(this.boss.x < this.player.x ? -170 : 170, -520).setAngularVelocity(420);
    const body = this.boss.body as Phaser.Physics.Arcade.Body;
    body.checkCollision.none = true;
    body.setAllowGravity(true);
    this.bossProjectiles.clear(true, true);
    if (this.bossVisual) this.tweens.add({ targets: this.bossVisual, y: this.bossVisual.y + 360, angle: 420, alpha: 0, duration: 850, ease: 'Back.in' });
    showToast('¡EL GRUÑÓN HA SIDO DERROTADO!', 1600);
    this.finishLevel();
  }

  private damageGift(target: Phaser.GameObjects.Rectangle) {
    if (!target.active) return;
    const hits = Number(target.getData('hits')) - 1;
    target.setData('hits', hits);
    audio.play('hit');
    this.tweens.add({ targets: target, x: target.x + 7, angle: 3, yoyo: true, repeat: 2, duration: 45 });
    if (hits > 0) {
      target.setFillStyle(0xe05965).setStrokeStyle(6, 0xffffff, 0.8);
      showToast('¡OTRO GOLPE DE MAGIA!', 700);
      return;
    }
    this.giftsBroken += 1;
    const giftIndex = Number(target.getData('giftIndex'));
    const ribbon = target.getData('ribbon') as Phaser.GameObjects.Rectangle | undefined;
    ribbon?.destroy();
    for (let i = 0; i < 8; i += 1) {
      const piece = this.add.rectangle(target.x + Phaser.Math.Between(-30, 30), target.y, 16, 12, i % 2 ? 0xffd15d : 0xc93d53).setDepth(12).setAngle(i * 37);
      this.tweens.add({ targets: piece, x: piece.x + Phaser.Math.Between(-90, 90), y: piece.y + Phaser.Math.Between(-90, 60), angle: piece.angle + 180, alpha: 0, duration: 520, onComplete: () => piece.destroy() });
    }
    this.sparks.getChildren().forEach((child) => {
      const spark = child as Phaser.Physics.Arcade.Sprite;
      if (spark.getData('giftIndex') === giftIndex) {
        spark.setVisible(true).setScale(0.2);
        (spark.body as Phaser.Physics.Arcade.Body).enable = true;
        this.tweens.add({ targets: spark, scale: 1, duration: 300, ease: 'Back.out' });
      }
    });
    target.destroy();
    showToast('¡REGALO ABIERTO! ¡RECOGE LAS CHISPAS!', 1300);
  }

  private breakIce(target?: Phaser.GameObjects.Rectangle) {
    const blocks = target ? [target] : this.iceBlocks.filter((block) => block.active);
    blocks.forEach((block) => {
      if (!block.active) return;
      const secret = block.getData('secret');
      if (!secret) this.iceBroken = true;
      this.tweens.add({ targets: block, alpha: 0, scale: 1.35, duration: 240, onComplete: () => block.destroy() });
    });
    audio.play('hit');
    showToast(target?.getData('secret') ? '¡SECRETO DESBLOQUEADO!' : '¡EL HIELO SE HA DERRETIDO!', 1200);
  }

  activateSwitch() {
    if (this.switchOn) return;
    this.switchOn = true;
    this.movingPlatform.setVisible(true);
    this.movingBody.enable = true;
    this.movingBody.updateFromGameObject();
    this.tweens.add({
      targets: this.movingPlatform, x: LEVEL.movingPlatform.toX, duration: 1400, ease: 'Sine.inOut',
      onUpdate: () => this.movingBody.updateFromGameObject(),
    });
    showToast('¡PLATAFORMA MÁGICA ACTIVADA!');
    audio.play('spark');
  }

  respawn(message = '¡INTÉNTALO OTRA VEZ!') {
    if (this.finished) return;
    audio.play('hit');
    this.cameras.main.flash(180, 255, 240, 230);
    this.player.setPosition(this.respawnPoint.x, this.respawnPoint.y).setVelocity(0, 0).setAlpha(0.45);
    this.invulnerableUntil = this.time.now + 1200;
    this.flightRemaining = 2000;
    this.flying = false;
    this.usedAirJump = false;
    this.tweens.add({ targets: this.player, alpha: 1, duration: 180, yoyo: true, repeat: 3 });
    showToast(message, 1000);
    this.updateHud();
  }

  private finishLevel() {
    if (this.finished) return;
    this.finished = true;
    this.player.setVelocity(0, 0).body!.enable = false;
    this.setPlayerPose('nico-celebrate');
    this.goal?.setTint(0xffffff);
    this.cameras.main.flash(700, 255, 226, 109);
    this.twinkles.forEach((light) => light.setFillStyle(0xffe36e, 1));
    audio.play('star');
    this.tweens.add({ targets: this.player, y: this.player.y - 55, angle: 360, scale: 1.2, duration: 900, ease: 'Back.out' });
    const score = this.collected.size * 100;
    if (!this.campaignSaved) {
      campaign = { sparks: campaign.sparks + this.collected.size, score: campaign.score + score };
      try { sessionStorage.setItem('nico-campaign', JSON.stringify(campaign)); } catch { /* Storage is optional. */ }
      this.campaignSaved = true;
    }
    bestScore = Math.max(bestScore, campaign.score);
    storage.set('nico-best', String(bestScore));
    window.setTimeout(() => {
      touchControls.classList.add('hidden');
      hud.classList.add('hidden');
      if (LEVEL.next) {
        $('story-character-name').textContent = LEVEL.next.character;
        $('story-title').textContent = LEVEL.next.title;
        $('story-message').textContent = LEVEL.next.message;
        storyScreen.classList.remove('hidden');
      } else {
        const campaignTotal = LEVELS.reduce((total, level) => total + level.sparks.length, 0);
        $('result-title').innerHTML = '¡HAS RECUPERADO<br />LA MAGIA!';
        $('result-sparks').textContent = `${campaign.sparks}/${campaignTotal}`;
        $('result-score').textContent = campaign.score.toLocaleString('es-ES');
        $('result-best').textContent = bestScore.toLocaleString('es-ES');
        resultScreen.classList.remove('hidden');
      }
    }, 900);
  }

  private updateHud() {
    $('spark-count').textContent = `${this.collected.size}/${LEVEL.sparks.length}`;
    $('score-count').textContent = String(this.collected.size * 100).padStart(6, '0');
    $('flight-fill').style.width = `${Math.max(0, this.flightRemaining / 20)}%`;
  }

  private updateEnemies(time: number) {
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (enemy.getData('dying')) return;
      const data = enemy.data.values as EnemyData & { direction: number; nextJumpAt: number; dying: boolean };
      if (data.type === 'snowman') {
        if (enemy.x <= data.minX || enemy.body?.blocked.left) data.direction = 1;
        if (enemy.x >= data.maxX || enemy.body?.blocked.right) data.direction = -1;
        enemy.setVelocityX(data.direction * 78).setFlipX(data.direction > 0);
        enemy.angle = Math.sin(time / 120) * 6;
        enemy.setScale(1, 1 - Math.abs(Math.sin(time / 120)) * 0.06);
      } else {
        if (enemy.body?.blocked.down) {
          enemy.setVelocityX(0);
          const remaining = data.nextJumpAt - time;
          enemy.setScale(1 + (remaining < 380 ? 0.08 : 0), remaining < 380 ? 0.72 : 1);
          enemy.setTint(remaining < 380 ? 0xffd58a : 0xffffff);
          if (remaining <= 0) {
            let direction = this.player.x < enemy.x ? -1 : 1;
            if (enemy.x <= data.minX) direction = 1;
            if (enemy.x >= data.maxX) direction = -1;
            enemy.clearTint().setScale(1).setVelocity(direction * 145, -330).setFlipX(direction > 0);
            data.nextJumpAt = time + 1900;
          }
        }
      }
    });
  }

  private updateBoss(time: number) {
    const boss = this.boss;
    const config = LEVEL.boss;
    if (!boss || !config || this.bossHealth <= 0 || boss.getData('dying')) return;
    if (!boss.active) boss.setActive(true);
    const body = boss.body as Phaser.Physics.Arcade.Body;
    if (!body.enable) body.enable = true;
    if (boss.y > 790 || boss.x < config.minX - 180 || boss.x > config.maxX + 180) {
      boss.setPosition(config.x, config.y).setVelocity(0, 0).setAngularVelocity(0).setAngle(0);
    }
    boss.setVisible(true).setAlpha(0);
    this.bossVisual?.setVisible(true).setAlpha(1);
    this.projectiles.getChildren().forEach((child) => {
      const bullet = child as Phaser.Physics.Arcade.Sprite;
      if (bullet.active && Phaser.Math.Distance.Between(bullet.x, bullet.y, boss.x, boss.y) < 82) this.hitBoss(bullet);
    });
    if (this.bossHealth <= 0 || boss.getData('dying')) return;
    let direction = Number(boss.getData('direction')) || -1;
    if (boss.x <= config.minX || boss.body?.blocked.left) direction = 1;
    if (boss.x >= config.maxX || boss.body?.blocked.right) direction = -1;
    boss.setData('direction', direction).setVelocityX(direction * 115).setFlipX(direction > 0);
    boss.angle = Math.sin(time / 150) * 3;
    if (time >= this.bossNextJump && boss.body?.blocked.down) {
      const towardPlayer = this.player.x < boss.x ? -1 : 1;
      boss.setVelocity(towardPlayer * 230, -490);
      this.bossNextJump = time + 1650 + Phaser.Math.Between(0, 650);
    }
    if (time >= this.bossNextShot) {
      const shot = this.bossProjectiles.create(boss.x + (this.player.x < boss.x ? -45 : 45), boss.y - 18, 'enemy-magic') as Phaser.Physics.Arcade.Sprite;
      const aim = new Phaser.Math.Vector2(this.player.x - boss.x, this.player.y - boss.y).normalize().scale(355);
      shot.setVelocity(aim.x, aim.y).setAngularVelocity(520).setDepth(10).setData('born', time);
      this.bossNextShot = time + 1050 + Phaser.Math.Between(0, 450);
    }
    this.bossProjectiles.getChildren().forEach((child) => {
      const shot = child as Phaser.Physics.Arcade.Sprite;
      if (time - Number(shot.getData('born')) > 2600) shot.destroy();
    });
    this.bossVisual?.setPosition(boss.x, boss.y).setFlipX(boss.flipX).setAngle(boss.angle);
  }

  private setPlayerPose(pose: string) {
    if (this.currentPose === pose) return;
    this.currentPose = pose;
    this.player.setTexture(pose);
  }

  private updateTutorials() {
    const tutorial = LEVEL.tutorials[this.tutorialIndex];
    if (tutorial && this.player.x >= tutorial.x) {
      showToast(tutorial.text, 2500);
      this.tutorialIndex += 1;
    }
    if (!LEVEL.boss && !this.checkpointReached && this.player.x >= LEVEL.checkpoint.x) {
      this.checkpointReached = true;
      this.respawnPoint = { ...LEVEL.checkpoint };
      showToast('PUNTO DE CONTROL', 1800);
      audio.play('spark');
    }
  }

  private updateZoneLabel() {
    const zone = LEVEL.zones.find((entry) => this.player.x >= entry.start && this.player.x < entry.end);
    if (zone && this.zoneLabel.text !== zone.name) {
      this.zoneLabel.setText(zone.name).setAlpha(1);
      this.tweens.killTweensOf(this.zoneLabel);
      this.tweens.add({ targets: this.zoneLabel, alpha: 0, delay: 1700, duration: 700 });
    }
  }

  update(time: number, delta: number) {
    if (!started || this.finished) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const groundedContact = body.blocked.down || body.touching.down || body.wasTouching.down;
    if (groundedContact) this.leftGroundAt = time;
    const grounded = groundedContact || (time - this.leftGroundAt < 90 && Math.abs(body.velocity.y) < 80);
    if (grounded) {
      this.flightRemaining = 2000;
      this.usedAirJump = false;
      this.flying = false;
      if (time - this.jumpPressedAt < 150) this.doJump();
    }
    const left = held.left || this.cursors.left.isDown || this.keys.left.isDown;
    const right = held.right || this.cursors.right.isDown || this.keys.right.isDown;
    if (left !== right) {
      this.facing = left ? -1 : 1;
      this.player.setAccelerationX(this.facing * 980).setFlipX(this.facing < 0);
    } else {
      this.player.setAccelerationX(0);
    }
    if (this.flying && (held.jump || this.cursors.space.isDown || this.keys.jump.isDown) && this.flightRemaining > 0) {
      this.flightRemaining -= delta;
      body.setAllowGravity(false);
      this.player.setVelocityY(Math.max(body.velocity.y - 12, -175));
      if (Math.random() < 0.25) {
        const trail = this.add.star(this.player.x - this.facing * 22, this.player.y + 25, 5, 2, 6, 0xffd95d).setDepth(8);
        this.tweens.add({ targets: trail, alpha: 0, scale: 0.1, y: trail.y + 26, duration: 420, onComplete: () => trail.destroy() });
      }
      if (this.flightRemaining <= 0) this.flying = false;
    } else {
      body.setAllowGravity(true);
    }
    if (time < this.castingUntil) this.setPlayerPose('nico-magic');
    else if (this.flying) this.setPlayerPose('nico-fly');
    else if (!grounded) this.setPlayerPose(body.velocity.y < 0 ? 'nico-jump' : 'nico-fall');
    else if (Math.abs(body.velocity.x) > 28) this.setPlayerPose(Math.floor(time / 120) % 2 ? 'nico-run1' : 'nico-run2');
    else this.setPlayerPose('nico-idle');
    this.player.angle = this.flying ? Math.sin(time / 100) * 8 : Phaser.Math.Linear(this.player.angle, grounded && Math.abs(body.velocity.x) > 20 ? Math.sin(time / 75) * 4 : 0, 0.18);
    this.player.setScale(grounded && Math.abs(body.velocity.x) < 15 ? 1 + Math.sin(time / 400) * 0.025 : 1);
    this.projectiles.getChildren().forEach((child) => {
      const bullet = child as Phaser.Physics.Arcade.Sprite;
      if (time - Number(bullet.getData('born')) > 1600) bullet.destroy();
    });
    if (this.player.y > LEVEL.height + 100) this.respawn();
    this.updateEnemies(time);
    this.updateBoss(time);
    this.updateTutorials();
    this.updateZoneLabel();
    this.updateHud();
  }

  resetRun() {
    this.scene.restart();
    started = true;
    this.scene.resume();
  }

  private snapshot(): GameSnapshot {
    return { levelId: LEVEL.id, sparks: this.collected.size, total: LEVEL.sparks.length, score: this.collected.size * 100, best: bestScore, checkpoint: this.checkpointReached, switchOn: this.switchOn, iceBroken: this.iceBroken, secretFound: this.secretFound, giftsBroken: this.giftsBroken, enemiesDefeated: this.enemiesDefeated, bossHealth: LEVEL.boss ? this.bossHealth : null, bossProjectiles: this.bossProjectiles.countActive(true), bossX: this.boss?.x ?? null, bossY: this.boss?.y ?? null, bossVisible: this.bossVisual?.visible ?? false, pose: this.currentPose, finished: this.finished };
  }

  private installDebugApi() {
    if (!new URLSearchParams(location.search).has('test')) return;
    window.__NICO_DEBUG__ = {
      snapshot: () => this.snapshot(),
      teleport: (x, y) => this.player.setPosition(x, y).setVelocity(0, 0),
      collect: (id) => { const spark = this.sparks.getChildren().find((child) => child.getData('id') === id) as Phaser.Physics.Arcade.Sprite | undefined; if (spark) this.collectSpark(spark); },
      breakIce: () => this.breakIce(),
      activateSwitch: () => this.activateSwitch(),
      castMagic: () => this.castMagic(),
      hitGift: (index) => { const gift = this.giftPlatforms[index]; if (gift?.active) this.damageGift(gift); },
      defeatEnemy: (id) => { const enemy = this.enemies.getChildren().find((child) => child.getData('id') === id) as Phaser.Physics.Arcade.Sprite | undefined; if (enemy) this.defeatEnemy(undefined, enemy); },
      enemyX: (id) => { const enemy = this.enemies.getChildren().find((child) => child.getData('id') === id) as Phaser.Physics.Arcade.Sprite | undefined; return enemy?.x ?? null; },
      hitBoss: () => this.hitBoss(undefined, true),
      respawn: () => this.respawn(),
      finish: () => this.finishLevel(),
    };
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#173a38',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1250 }, debug: false } },
  input: { activePointers: 5 },
  render: { antialias: true, pixelArt: false, roundPixels: true },
  scene: [SalonScene],
});

$('play-button').addEventListener('click', () => {
  audio.unlock();
  campaign = { sparks: 0, score: 0 };
  try { sessionStorage.removeItem('nico-campaign'); } catch { /* Storage is optional. */ }
  resultScreen.classList.add('hidden');
  playIntro();
});

window.addEventListener('nico-intro-ended', startLevel);
$('skip-intro-button').addEventListener('click', startLevel);

$('pause-button').addEventListener('click', () => pauseGame(true));
$('continue-button').addEventListener('click', resumeGame);
$('restart-button').addEventListener('click', () => {
  reloadRun();
});
$('sound-button').addEventListener('click', () => {
  soundEnabled = !soundEnabled; storage.set('nico-sound', String(soundEnabled)); updateSoundLabel(); if (soundEnabled) audio.unlock();
});
$('replay-button').addEventListener('click', () => {
  reloadRun();
});
$('next-level-button').addEventListener('click', () => {
  storyScreen.classList.add('hidden');
  loadNextLevel();
});

updateSoundLabel();
if (autoStart) {
  titleScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  touchControls.classList.remove('hidden');
}
checkOrientation();

void game;
