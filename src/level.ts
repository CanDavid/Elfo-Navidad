export type PlatformKind = 'floor' | 'gift' | 'book' | 'shelf' | 'branch' | 'secret';
export type LevelTheme = 'salon' | 'kitchen' | 'workshop' | 'rooftop';

export interface PlatformData { x: number; y: number; width: number; height: number; kind: PlatformKind }
export interface SparkData { id: string; x: number; y: number; secret?: boolean }
export interface EnemyData { id: string; type: 'snowman' | 'cookie'; x: number; y: number; minX: number; maxX: number }
export interface LevelData {
  id: string; name: string; theme: LevelTheme; width: number; height: number;
  spawn: { x: number; y: number }; checkpoint: { x: number; y: number }; goal: { x: number; y: number };
  switch: { x: number; y: number }; ice: { x: number; y: number; width: number; height: number };
  movingPlatform: { fromX: number; toX: number; y: number; width: number };
  zones: { name: string; start: number; end: number; color: number }[];
  platforms: PlatformData[]; sparks: SparkData[]; enemies: EnemyData[];
  tutorials: { x: number; text: string }[];
  next?: { character: string; title: string; message: string };
  boss?: { x: number; y: number; minX: number; maxX: number; hits: number };
}

const salon: LevelData = {
  id: 'salon-navidad', name: 'EL SALÓN DE NAVIDAD', theme: 'salon', width: 9600, height: 900,
  spawn: { x: 180, y: 680 }, checkpoint: { x: 6490, y: 570 }, goal: { x: 9290, y: 120 },
  switch: { x: 4800, y: 490 }, ice: { x: 3900, y: 585, width: 84, height: 150 },
  movingPlatform: { fromX: 4960, toX: 5350, y: 505, width: 150 },
  zones: [
    { name: 'ZONA DE REGALOS', start: 0, end: 3300, color: 0x5b1f32 },
    { name: 'ESTANTERÍA', start: 3300, end: 6400, color: 0x402a46 },
    { name: 'ÁRBOL', start: 6400, end: 9600, color: 0x173a38 },
  ],
  platforms: [
    { x: 0, y: 750, width: 1100, height: 150, kind: 'floor' }, { x: 1180, y: 750, width: 1220, height: 150, kind: 'floor' },
    { x: 2490, y: 750, width: 1030, height: 150, kind: 'floor' }, { x: 3610, y: 750, width: 900, height: 150, kind: 'floor' },
    { x: 4560, y: 750, width: 1320, height: 150, kind: 'floor' }, { x: 5960, y: 750, width: 970, height: 150, kind: 'floor' },
    { x: 1000, y: 650, width: 190, height: 100, kind: 'gift' }, { x: 1400, y: 630, width: 220, height: 120, kind: 'gift' },
    { x: 1780, y: 540, width: 260, height: 210, kind: 'gift' }, { x: 2180, y: 650, width: 210, height: 100, kind: 'gift' },
    { x: 2670, y: 600, width: 220, height: 150, kind: 'gift' }, { x: 3030, y: 480, width: 240, height: 270, kind: 'gift' },
    { x: 3480, y: 655, width: 170, height: 32, kind: 'book' }, { x: 3730, y: 575, width: 200, height: 32, kind: 'book' },
    { x: 4090, y: 500, width: 230, height: 34, kind: 'book' }, { x: 4440, y: 610, width: 190, height: 32, kind: 'book' },
    { x: 4720, y: 535, width: 220, height: 32, kind: 'shelf' }, { x: 5400, y: 510, width: 250, height: 32, kind: 'shelf' },
    { x: 5750, y: 420, width: 220, height: 32, kind: 'book' }, { x: 6060, y: 330, width: 260, height: 32, kind: 'secret' },
    { x: 6540, y: 650, width: 390, height: 32, kind: 'branch' }, { x: 7030, y: 600, width: 430, height: 36, kind: 'branch' },
    { x: 7540, y: 520, width: 400, height: 36, kind: 'branch' }, { x: 8030, y: 430, width: 390, height: 36, kind: 'branch' },
    { x: 8490, y: 340, width: 390, height: 36, kind: 'branch' }, { x: 8920, y: 245, width: 410, height: 36, kind: 'branch' },
  ],
  sparks: [
    ...[420,600,790,1050,1270,1500,1810,2010,2250,2700,3100].map((x,i)=>({id:`g${i}`,x,y:i>6&&i<9?470:680})),
    ...[3500,3770,4140,4500,4800,5140,5480,5800].map((x,i)=>({id:`s${i}`,x,y:430-(i%3)*40})),
    ...[6000,6100,6200,6300].map((x,i)=>({id:`secret${i}`,x,y:265,secret:true})),
    ...[6610,6760,7110,7310,7620,7810,8110,8300,8560,8730,9000,9170].map((x,i)=>({id:`t${i}`,x,y:560-i*36})),
  ],
  enemies: [
    { id:'snow-1',type:'snowman',x:1270,y:680,minX:1200,maxX:1370 }, { id:'cookie-1',type:'cookie',x:4350,y:690,minX:4200,maxX:4560 },
    { id:'snow-2',type:'snowman',x:7180,y:530,minX:7040,maxX:7420 },
  ],
  tutorials: [
    {x:500,text:'USA ◀ ▶ PARA CORRER'}, {x:900,text:'ROMPE LOS REGALOS ROJOS CON DOS GOLPES DE MAGIA'},
    {x:1080,text:'MANTÉN PARA SALTAR MÁS ALTO'}, {x:1740,text:'PULSA OTRA VEZ EN EL AIRE PARA VOLAR'},
    {x:3620,text:'LA MAGIA ROMPE EL HIELO'}, {x:4620,text:'ACTIVA EL INTERRUPTOR CON MAGIA'},
    {x:6500,text:'PUNTO DE CONTROL · SUBE HASTA LA ESTRELLA'},
  ],
  next: { character:'LUMI, EL HADA DE LA ESTRELLA', title:'LAS CHISPAS SIGUEN SU CAMINO', message:'EL VIENTO LAS HA LLEVADO HASTA LA COCINA. ALLÍ, LOS DULCES HAN COBRADO VIDA. ¡SIGUE SU RASTRO!' },
};

const kitchen: LevelData = {
  id:'cocina-dulces',name:'LA COCINA DE LOS DULCES',theme:'kitchen',width:8200,height:900,
  spawn:{x:180,y:680},checkpoint:{x:5000,y:610},goal:{x:7900,y:175},switch:{x:3860,y:500},ice:{x:3000,y:600,width:90,height:150},
  movingPlatform:{fromX:4050,toX:4470,y:510,width:165},
  zones:[{name:'LA ENCIMERA',start:0,end:2800,color:0x7b3e45},{name:'HORNO DE CANELA',start:2800,end:5400,color:0x5c3b32},{name:'TORRE DE TAZAS',start:5400,end:8200,color:0x325a63}],
  platforms:[
    {x:0,y:750,width:1500,height:150,kind:'floor'},{x:1590,y:750,width:1250,height:150,kind:'floor'},{x:2940,y:750,width:1450,height:150,kind:'floor'},
    {x:4490,y:750,width:1350,height:150,kind:'floor'},{x:5940,y:750,width:2260,height:150,kind:'floor'},
    {x:900,y:635,width:240,height:36,kind:'book'},{x:1260,y:540,width:260,height:40,kind:'shelf'},{x:1810,y:630,width:230,height:38,kind:'book'},
    {x:2220,y:535,width:250,height:38,kind:'shelf'},{x:2650,y:440,width:220,height:38,kind:'book'},{x:3300,y:610,width:240,height:38,kind:'shelf'},
    {x:3700,y:525,width:230,height:38,kind:'book'},{x:4580,y:610,width:260,height:38,kind:'shelf'},{x:5050,y:535,width:280,height:38,kind:'book'},
    {x:5520,y:635,width:230,height:38,kind:'shelf'},{x:6100,y:590,width:300,height:40,kind:'book'},{x:6550,y:500,width:300,height:40,kind:'shelf'},
    {x:7000,y:405,width:300,height:40,kind:'book'},{x:7440,y:310,width:300,height:40,kind:'shelf'},{x:7750,y:245,width:360,height:40,kind:'secret'},
  ],
  sparks:[...[420,680,980,1330,1730,1900,2280,2700,3200,3500,3820,4200,4660,5100,5560,6150,6660,7100,7520,7840].map((x,i)=>({id:`k${i}`,x,y:680-(i%4)*55})),
    ...[7200,7310,7420].map((x,i)=>({id:`ksecret${i}`,x,y:335,secret:true}))],
  enemies:[{id:'cookie-k1',type:'cookie',x:2050,y:690,minX:1700,maxX:2400},{id:'cookie-k2',type:'cookie',x:4800,y:690,minX:4550,maxX:5300},{id:'snow-k',type:'snowman',x:6250,y:520,minX:6110,maxX:6380}],
  tutorials:[{x:650,text:'LOS DULCES TAMBIÉN ESCONDEN CHISPAS'},{x:2920,text:'DERRITE EL AZÚCAR HELADO CON MAGIA'},{x:4950,text:'PUNTO DE CONTROL'}],
  next:{character:'CANELA, LA GALLETA COCINERA',title:'SE OYEN MARTILLOS EN LA NOCHE',message:'LAS ÚLTIMAS CHISPAS HAN DESPERTADO EL TALLER DE JUGUETES. LOS TRENES Y LOS BLOQUES NO DEJAN DE MOVERSE.'},
};

const workshop: LevelData = {
  id:'taller-juguetes',name:'EL TALLER DE JUGUETES',theme:'workshop',width:8600,height:900,
  spawn:{x:180,y:680},checkpoint:{x:5150,y:590},goal:{x:8320,y:170},switch:{x:4100,y:485},ice:{x:3420,y:600,width:90,height:150},
  movingPlatform:{fromX:4300,toX:4740,y:500,width:175},
  zones:[{name:'MESA DE INVENTOS',start:0,end:3000,color:0x345b64},{name:'VÍA DEL TREN',start:3000,end:5700,color:0x654052},{name:'TORRE DE JUGUETES',start:5700,end:8600,color:0x294c43}],
  platforms:[
    {x:0,y:750,width:1250,height:150,kind:'floor'},{x:1340,y:750,width:1440,height:150,kind:'floor'},{x:2870,y:750,width:1500,height:150,kind:'floor'},
    {x:4470,y:750,width:1370,height:150,kind:'floor'},{x:5930,y:750,width:2670,height:150,kind:'floor'},
    {x:850,y:630,width:230,height:85,kind:'gift'},{x:1240,y:545,width:220,height:40,kind:'book'},{x:1660,y:620,width:260,height:40,kind:'shelf'},
    {x:2100,y:520,width:260,height:40,kind:'book'},{x:2520,y:430,width:240,height:40,kind:'secret'},{x:3100,y:620,width:260,height:40,kind:'shelf'},
    {x:3600,y:525,width:250,height:40,kind:'book'},{x:3970,y:440,width:220,height:40,kind:'shelf'},{x:4820,y:620,width:270,height:40,kind:'book'},
    {x:5300,y:535,width:270,height:40,kind:'shelf'},{x:5750,y:450,width:260,height:40,kind:'book'},{x:6200,y:620,width:280,height:40,kind:'shelf'},
    {x:6650,y:530,width:290,height:40,kind:'book'},{x:7100,y:435,width:300,height:40,kind:'shelf'},{x:7550,y:340,width:300,height:40,kind:'book'},
    {x:7970,y:250,width:430,height:40,kind:'secret'},
  ],
  sparks:[...[400,650,900,1290,1700,2150,2580,3050,3500,3970,4350,4820,5300,5780,6230,6700,7150,7600,8050,8300].map((x,i)=>({id:`w${i}`,x,y:675-(i%4)*55})),
    ...[2460,2560,2660].map((x,i)=>({id:`wsecret${i}`,x,y:365,secret:true}))],
  enemies:[{id:'snow-w1',type:'snowman',x:1500,y:680,minX:1370,maxX:2050},{id:'cookie-w1',type:'cookie',x:3250,y:690,minX:2950,maxX:3850},{id:'snow-w2',type:'snowman',x:6320,y:550,minX:6210,maxX:6450}],
  tutorials:[{x:700,text:'LOS BLOQUES ROJOS SE ROMPEN CON DOS DISPAROS'},{x:3400,text:'ACTIVA LA GRÚA MÁGICA'},{x:5100,text:'PUNTO DE CONTROL'}],
  next:{character:'BRUNO, EL RENO MECÁNICO',title:'ALGUIEN ROBA LA MAGIA',message:'UN GRUÑÓN VERDE ESPERA EN LA AZOTEA. PUEDE SALTAR Y LANZAR MAGIA. ESQUIVA SUS ATAQUES Y GOLPÉALO CINCO VECES.'},
};

const rooftop: LevelData = {
  id:'azotea-final',name:'LA AZOTEA DEL GRUÑÓN',theme:'rooftop',width:1550,height:900,
  spawn:{x:220,y:680},checkpoint:{x:220,y:680},goal:{x:-1000,y:-1000},switch:{x:-1000,y:-1000},ice:{x:-1200,y:-1000,width:1,height:1},
  movingPlatform:{fromX:-1000,toX:-1000,y:-1000,width:1},
  zones:[{name:'DUELO FINAL',start:0,end:1550,color:0x173a38}],
  platforms:[{x:0,y:750,width:1550,height:150,kind:'floor'},{x:470,y:570,width:260,height:38,kind:'branch'},{x:930,y:510,width:280,height:38,kind:'branch'}],
  sparks:[...[350,570,790,1010,1230,1430].map((x,i)=>({id:`b${i}`,x,y:675-(i%3)*65}))],
  enemies:[], tutorials:[{x:500,text:'ESQUIVA SU MAGIA Y GOLPÉALO CINCO VECES'}],
  boss:{x:1030,y:650,minX:720,maxX:1340,hits:5},
};

export const LEVELS: LevelData[] = [salon,kitchen,workshop,rooftop];
export let LEVEL: LevelData = LEVELS[0];
export function selectLevel(index: number) { LEVEL = LEVELS[Math.max(0,Math.min(index,LEVELS.length-1))]; }
