const ASSET_BASE = "/games/penguin-shooter";

export type StageId =
  | "town"
  | "country"
  | "frost"
  | "desert"
  | "cloud"
  | "moon"
  | "mars"
  | "machine"
  | "blackhole"
  | "dimension";
export type BossCheckpoint = "mid" | "stage";

export type SubStageConfig = {
  number: number;
  globalNumber: number;
  label: string;
  spawnInterval: number;
  enemySpeedBonus: number;
  rewardCoins: number;
  bossCheckpoint?: BossCheckpoint;
};

export type BossAttackPattern =
  | "aimed-1"
  | "aimed-2"
  | "aimed-3"
  | "spread-2"
  | "ring-4"
  | "aimed-ring-6"
  | "cannon-burst-5"
  | "aimed-laser"
  | "laser-sweep"
  | "homing-missile";

export type BossAttack = {
  pattern: BossAttackPattern;
  fireInterval: number;
  bulletSpeed: number;
  burstSize?: number;
  burstInterval?: number;
};

export type BossVisual =
  | "scrap"
  | "fortress"
  | "crater"
  | "core"
  | "storm"
  | "olympus"
  | "mirror"
  | "citadel"
  | "kraken"
  | "sphinx"
  | "airship"
  | "lunar"
  | "volcano"
  | "clockwork"
  | "gravity"
  | "worldRift";

export type BossDefinition = {
  checkpoint: BossCheckpoint;
  name: string;
  hp: number;
  score: number;
  rewardCoins: number;
  attackLabel: string;
  weaponLabel: string;
  visual: BossVisual;
  assetPath?: string;
  speedBonus: number;
  driftScale: number;
  attack: BossAttack;
};

export type StageDefinition = {
  number: number;
  id: StageId;
  label: string;
  storyLabel: string;
  background: string;
  accent: string;
  musicBase: number;
  bosses: Record<BossCheckpoint, BossDefinition>;
  smallStages: SubStageConfig[];
};

export type WeaponId =
  | "standard"
  | "spread-3"
  | "rainbow-laser"
  | "snack-missile"
  | "fridge-beam"
  | "coin-cannon";

export type WeaponDefinition = {
  id: WeaponId;
  label: string;
  shortLabel: string;
  unlockStage: number;
  description: string;
  damage: number;
  cooldown: number;
  cost: number;
  projectile: "bullet" | "laser" | "missile" | "beam" | "cannon";
};

export const WEAPON_ORDER: WeaponId[] = [
  "standard",
  "spread-3",
  "rainbow-laser",
  "snack-missile",
  "fridge-beam",
  "coin-cannon",
];

export const WEAPON_DEFINITIONS: Record<WeaponId, WeaponDefinition> = {
  standard: {
    id: "standard",
    label: "Standard Shooter",
    shortLabel: "Standard",
    unlockStage: 1,
    description: "高速の直線弾",
    damage: 1,
    cooldown: 10,
    cost: 0,
    projectile: "bullet",
  },
  "spread-3": {
    id: "spread-3",
    label: "3-Way Spread",
    shortLabel: "3-Way",
    unlockStage: 2,
    description: "左右へ広がる3発",
    damage: 1,
    cooldown: 11,
    cost: 0,
    projectile: "bullet",
  },
  "rainbow-laser": {
    id: "rainbow-laser",
    label: "Rainbow Laser",
    shortLabel: "Laser",
    unlockStage: 4,
    description: "高威力の光線",
    damage: 2,
    cooldown: 18,
    cost: 0,
    projectile: "laser",
  },
  "snack-missile": {
    id: "snack-missile",
    label: "Snack Missile",
    shortLabel: "Missile",
    unlockStage: 6,
    description: "ゆっくり追尾する2発",
    damage: 2,
    cooldown: 22,
    cost: 0,
    projectile: "missile",
  },
  "fridge-beam": {
    id: "fridge-beam",
    label: "Fridge Beam",
    shortLabel: "Beam",
    unlockStage: 7,
    description: "敵を冷やす低速ビーム",
    damage: 1,
    cooldown: 14,
    cost: 0,
    projectile: "beam",
  },
  "coin-cannon": {
    id: "coin-cannon",
    label: "Lucky Coin Cannon",
    shortLabel: "Cannon",
    unlockStage: 8,
    description: "コイン1枚で高威力",
    damage: 4,
    cooldown: 24,
    cost: 1,
    projectile: "cannon",
  },
};

const createSmallStages = (
  stageNumber: number,
  themeLabel: string,
  spawnBase: number,
): SubStageConfig[] =>
  Array.from({ length: 10 }, (_, index) => {
    const number = index + 1;
    return {
      number,
      globalNumber: (stageNumber - 1) * 10 + number,
      label: `${themeLabel}-${String(number).padStart(2, "0")}`,
      spawnInterval: Math.max(24, spawnBase - Math.floor(index / 3)),
      enemySpeedBonus: (stageNumber - 1) * 0.16 + index * 0.022,
      rewardCoins: number % 5 === 0 ? 2 : 1,
      bossCheckpoint: number === 5 ? "mid" : number === 10 ? "stage" : undefined,
    };
  });

const bossAsset = (fileName: string) => `${ASSET_BASE}/bosses/${fileName}`;

export const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    number: 1,
    id: "town",
    label: "町",
    storyLabel: "はじまりの町",
    background: `${ASSET_BASE}/backgrounds/town.svg`,
    accent: "#38bdf8",
    musicBase: 196,
    bosses: {
      mid: {
        checkpoint: "mid",
        name: "スクラップUFO",
        hp: 8,
        score: 600,
        rewardCoins: 3,
        attackLabel: "ジグザグ突進",
        weaponLabel: "スクラップクロー",
        visual: "scrap",
        speedBonus: 0,
        driftScale: 1.1,
        attack: { pattern: "aimed-1", fireInterval: 130, bulletSpeed: 4.4 },
      },
      stage: {
        checkpoint: "stage",
        name: "スクラップ要塞",
        hp: 14,
        score: 900,
        rewardCoins: 5,
        attackLabel: "クレーンゲート砲",
        weaponLabel: "ツインゲート砲",
        visual: "fortress",
        assetPath: bossAsset("stage-01-scrap-fortress.svg"),
        speedBonus: 0.1,
        driftScale: 1.25,
        attack: { pattern: "aimed-2", fireInterval: 110, bulletSpeed: 5 },
      },
    },
    smallStages: createSmallStages(1, "Town", 42),
  },
  {
    number: 2,
    id: "country",
    label: "王国",
    storyLabel: "みどりの王国",
    background: `${ASSET_BASE}/backgrounds/country.svg`,
    accent: "#22c55e",
    musicBase: 220,
    bosses: {
      mid: {
        checkpoint: "mid",
        name: "キャラバンUFO",
        hp: 12,
        score: 760,
        rewardCoins: 4,
        attackLabel: "横流れ隊列",
        weaponLabel: "キャラバンランス",
        visual: "scrap",
        speedBonus: 0.12,
        driftScale: 1.35,
        attack: { pattern: "spread-2", fireInterval: 105, bulletSpeed: 5 },
      },
      stage: {
        checkpoint: "stage",
        name: "緑の王国城塞",
        hp: 18,
        score: 1100,
        rewardCoins: 6,
        attackLabel: "城壁バリア",
        weaponLabel: "バリア城壁砲",
        visual: "citadel",
        assetPath: bossAsset("stage-02-verdant-citadel.svg"),
        speedBonus: 0.18,
        driftScale: 1.15,
        attack: { pattern: "aimed-3", fireInterval: 95, bulletSpeed: 5.4 },
      },
    },
    smallStages: createSmallStages(2, "Kingdom", 39),
  },
  {
    number: 3,
    id: "frost",
    label: "氷海",
    storyLabel: "凍てつく海域",
    background: `${ASSET_BASE}/backgrounds/frost.svg`,
    accent: "#67e8f9",
    musicBase: 247,
    bosses: {
      mid: {
        checkpoint: "mid",
        name: "フロストドローン",
        hp: 15,
        score: 920,
        rewardCoins: 5,
        attackLabel: "氷柱リング",
        weaponLabel: "フロストスパイク",
        visual: "crater",
        speedBonus: 0.1,
        driftScale: 1.45,
        attack: { pattern: "ring-4", fireInterval: 120, bulletSpeed: 4.6 },
      },
      stage: {
        checkpoint: "stage",
        name: "氷海クラーケン",
        hp: 22,
        score: 1320,
        rewardCoins: 7,
        attackLabel: "低温触手波",
        weaponLabel: "クラーケンコア",
        visual: "kraken",
        assetPath: bossAsset("stage-03-frost-kraken.svg"),
        speedBonus: 0.22,
        driftScale: 1.4,
        attack: { pattern: "aimed-ring-6", fireInterval: 88, bulletSpeed: 5.5 },
      },
    },
    smallStages: createSmallStages(3, "Frost", 36),
  },
  {
    number: 4,
    id: "desert",
    label: "砂漠",
    storyLabel: "砂漠遺跡の謎",
    background: `${ASSET_BASE}/backgrounds/desert.svg`,
    accent: "#fbbf24",
    musicBase: 208,
    bosses: {
      mid: {
        checkpoint: "mid",
        name: "ダストスフィンクス",
        hp: 18,
        score: 1100,
        rewardCoins: 6,
        attackLabel: "砂嵐レーザー",
        weaponLabel: "砂塵ランチャー",
        visual: "storm",
        speedBonus: 0.2,
        driftScale: 1.55,
        attack: { pattern: "aimed-laser", fireInterval: 150, bulletSpeed: 0 },
      },
      stage: {
        checkpoint: "stage",
        name: "砂漠スフィンクス",
        hp: 25,
        score: 1540,
        rewardCoins: 8,
        attackLabel: "黄金翼の審判",
        weaponLabel: "サンドオーブ砲",
        visual: "sphinx",
        assetPath: bossAsset("stage-04-sand-sphinx.svg"),
        speedBonus: 0.3,
        driftScale: 1.45,
        attack: { pattern: "cannon-burst-5", fireInterval: 86, bulletSpeed: 6 },
      },
    },
    smallStages: createSmallStages(4, "Desert", 34),
  },
  {
    number: 5,
    id: "cloud",
    label: "雲上都市",
    storyLabel: "雷雲の空中回廊",
    background: `${ASSET_BASE}/backgrounds/cloud.svg`,
    accent: "#c084fc",
    musicBase: 233,
    bosses: {
      mid: {
        checkpoint: "mid",
        name: "サンダーバルーン",
        hp: 20,
        score: 1260,
        rewardCoins: 7,
        attackLabel: "落雷ステップ",
        weaponLabel: "テンペスト針",
        visual: "storm",
        speedBonus: 0.24,
        driftScale: 1.65,
        attack: { pattern: "spread-2", fireInterval: 92, bulletSpeed: 5.8 },
      },
      stage: {
        checkpoint: "stage",
        name: "雲上都市戦艦",
        hp: 30,
        score: 1760,
        rewardCoins: 9,
        attackLabel: "テンペスト放電",
        weaponLabel: "クラウドライト砲",
        visual: "airship",
        assetPath: bossAsset("stage-05-tempest-airship.svg"),
        speedBonus: 0.34,
        driftScale: 1.5,
        attack: { pattern: "aimed-ring-6", fireInterval: 84, bulletSpeed: 6 },
      },
    },
    smallStages: createSmallStages(5, "Cloud", 32),
  },
  {
    number: 6,
    id: "moon",
    label: "月",
    storyLabel: "月面クレーター",
    background: `${ASSET_BASE}/backgrounds/moon.svg`,
    accent: "#cbd5e1",
    musicBase: 262,
    bosses: {
      mid: {
        checkpoint: "mid",
        name: "クレーターUFO",
        hp: 22,
        score: 1420,
        rewardCoins: 7,
        attackLabel: "低重力ホバー",
        weaponLabel: "クレーターリング",
        visual: "crater",
        speedBonus: 0.27,
        driftScale: 1.7,
        attack: { pattern: "ring-4", fireInterval: 112, bulletSpeed: 4.9 },
      },
      stage: {
        checkpoint: "stage",
        name: "月面コアゴーレム",
        hp: 34,
        score: 1980,
        rewardCoins: 10,
        attackLabel: "衛星破砕リング",
        weaponLabel: "ルナコア砲",
        visual: "lunar",
        assetPath: bossAsset("stage-06-lunar-golem.svg"),
        speedBonus: 0.38,
        driftScale: 1.45,
        attack: { pattern: "aimed-ring-6", fireInterval: 80, bulletSpeed: 6.1 },
      },
    },
    smallStages: createSmallStages(6, "Moon", 30),
  },
  {
    number: 7,
    id: "mars",
    label: "火星",
    storyLabel: "赤い砂の前線",
    background: `${ASSET_BASE}/backgrounds/mars.svg`,
    accent: "#fb923c",
    musicBase: 165,
    bosses: {
      mid: {
        checkpoint: "mid",
        name: "ダストUFO",
        hp: 24,
        score: 1560,
        rewardCoins: 8,
        attackLabel: "ツインレーザー",
        weaponLabel: "ダストレーザー",
        visual: "storm",
        speedBonus: 0.32,
        driftScale: 1.75,
        attack: { pattern: "aimed-laser", fireInterval: 136, bulletSpeed: 0 },
      },
      stage: {
        checkpoint: "stage",
        name: "火星火山要塞",
        hp: 38,
        score: 2240,
        rewardCoins: 11,
        attackLabel: "火星噴流",
        weaponLabel: "オリンポス火山砲",
        visual: "volcano",
        assetPath: bossAsset("stage-07-volcano-fortress.svg"),
        speedBonus: 0.44,
        driftScale: 1.55,
        attack: {
          pattern: "cannon-burst-5",
          fireInterval: 78,
          bulletSpeed: 6.4,
          burstSize: 5,
          burstInterval: 10,
        },
      },
    },
    smallStages: createSmallStages(7, "Mars", 29),
  },
  {
    number: 8,
    id: "machine",
    label: "機械惑星",
    storyLabel: "歯車の惑星都市",
    background: `${ASSET_BASE}/backgrounds/machine.svg`,
    accent: "#2dd4bf",
    musicBase: 185,
    bosses: {
      mid: {
        checkpoint: "mid",
        name: "ギアハンター",
        hp: 28,
        score: 1740,
        rewardCoins: 9,
        attackLabel: "交互砲撃",
        weaponLabel: "ギアランサー",
        visual: "clockwork",
        speedBonus: 0.38,
        driftScale: 1.8,
        attack: { pattern: "aimed-3", fireInterval: 88, bulletSpeed: 6.2 },
      },
      stage: {
        checkpoint: "stage",
        name: "クロックワーク皇帝",
        hp: 44,
        score: 2520,
        rewardCoins: 12,
        attackLabel: "時間差バースト",
        weaponLabel: "クロノギア砲",
        visual: "clockwork",
        assetPath: bossAsset("stage-08-clockwork-emperor.svg"),
        speedBonus: 0.5,
        driftScale: 1.6,
        attack: { pattern: "cannon-burst-5", fireInterval: 74, bulletSpeed: 6.6, burstSize: 5, burstInterval: 8 },
      },
    },
    smallStages: createSmallStages(8, "Machine", 28),
  },
  {
    number: 9,
    id: "blackhole",
    label: "ブラックホール",
    storyLabel: "重力の向こう側",
    background: `${ASSET_BASE}/backgrounds/blackhole.svg`,
    accent: "#a78bfa",
    musicBase: 147,
    bosses: {
      mid: {
        checkpoint: "mid",
        name: "グラビティドローン",
        hp: 32,
        score: 1960,
        rewardCoins: 10,
        attackLabel: "重力リング",
        weaponLabel: "ブラックオーブ",
        visual: "gravity",
        speedBonus: 0.42,
        driftScale: 1.9,
        attack: { pattern: "ring-4", fireInterval: 102, bulletSpeed: 5.4 },
      },
      stage: {
        checkpoint: "stage",
        name: "ブラックホール・イーター",
        hp: 52,
        score: 2860,
        rewardCoins: 13,
        attackLabel: "重力崩壊スイープ",
        weaponLabel: "ボイドリング砲",
        visual: "gravity",
        assetPath: bossAsset("stage-09-gravity-eater.svg"),
        speedBonus: 0.56,
        driftScale: 1.7,
        attack: { pattern: "laser-sweep", fireInterval: 150, bulletSpeed: 0 },
      },
    },
    smallStages: createSmallStages(9, "Blackhole", 27),
  },
  {
    number: 10,
    id: "dimension",
    label: "異次元",
    storyLabel: "異次元ゲート・最終決戦",
    background: `${ASSET_BASE}/backgrounds/dimension.svg`,
    accent: "#d946ef",
    musicBase: 277,
    bosses: {
      mid: {
        checkpoint: "mid",
        name: "ミラーUFO",
        hp: 38,
        score: 2240,
        rewardCoins: 12,
        attackLabel: "反転誘導弾",
        weaponLabel: "ミラーミサイル",
        visual: "mirror",
        speedBonus: 0.48,
        driftScale: 2,
        attack: { pattern: "homing-missile", fireInterval: 96, bulletSpeed: 3.7 },
      },
      stage: {
        checkpoint: "stage",
        name: "ワールドリフト",
        hp: 70,
        score: 4200,
        rewardCoins: 16,
        attackLabel: "次元裂け目の脈動",
        weaponLabel: "ワールドリフト",
        visual: "worldRift",
        assetPath: bossAsset("stage-10-world-rift.svg"),
        speedBonus: 0.62,
        driftScale: 1.85,
        attack: { pattern: "laser-sweep", fireInterval: 132, bulletSpeed: 0 },
      },
    },
    smallStages: createSmallStages(10, "Dimension", 26),
  },
];

export const FINAL_STAGE = STAGE_DEFINITIONS.length;
export const CLEAR_TARGET = STAGE_DEFINITIONS.reduce(
  (sum, stage) => sum + stage.smallStages.length,
  0,
);
export const MAX_LIVES = 10;
export const TWO_PLAYER_UNLOCK_STAGE = 10;

export const getStageDefinition = (stageNumber: number) =>
  STAGE_DEFINITIONS[stageNumber - 1] ?? STAGE_DEFINITIONS[0];

export const getStageGoal = (stageNumber: number) =>
  getStageDefinition(stageNumber).smallStages.length;

export const getSubStage = (stageNumber: number, completedCount: number) => {
  const stage = getStageDefinition(stageNumber);
  const index = Math.min(completedCount, stage.smallStages.length - 1);
  return stage.smallStages[index] ?? stage.smallStages[0];
};

export const getBossDefinition = (
  stageNumber: number,
  checkpoint: BossCheckpoint,
) => getStageDefinition(stageNumber).bosses[checkpoint];
