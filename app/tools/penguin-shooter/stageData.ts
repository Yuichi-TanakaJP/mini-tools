const ASSET_BASE = "/games/penguin-shooter";

export type StageId = "town" | "country" | "moon" | "mars" | "dimension";
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

export type BossDefinition = {
  checkpoint: BossCheckpoint;
  name: string;
  hp: number;
  score: number;
  rewardCoins: number;
  attackLabel: string;
  speedBonus: number;
  driftScale: number;
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

const createSmallStages = (
  stageNumber: number,
  themeLabel: string,
  spawnBase: number,
): SubStageConfig[] =>
  Array.from({ length: 20 }, (_, index) => {
    const number = index + 1;
    return {
      number,
      globalNumber: (stageNumber - 1) * 20 + number,
      label: `${themeLabel}-${String(number).padStart(2, "0")}`,
      spawnInterval: Math.max(26, spawnBase - Math.floor(index / 4)),
      enemySpeedBonus: (stageNumber - 1) * 0.18 + index * 0.015,
      rewardCoins: number % 5 === 0 ? 2 : 1,
      bossCheckpoint:
        number === 10 ? "mid" : number === 20 ? "stage" : undefined,
    };
  });

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
        hp: 5,
        score: 600,
        rewardCoins: 3,
        attackLabel: "ジグザグ突進",
        speedBonus: 0,
        driftScale: 1.1,
      },
      stage: {
        checkpoint: "stage",
        name: "タワーゲートUFO",
        hp: 8,
        score: 900,
        rewardCoins: 5,
        attackLabel: "ゲートビーム",
        speedBonus: 0.1,
        driftScale: 1.25,
      },
    },
    smallStages: createSmallStages(1, "Town", 42),
  },
  {
    number: 2,
    id: "country",
    label: "国",
    storyLabel: "みどりの国境",
    background: `${ASSET_BASE}/backgrounds/country.svg`,
    accent: "#22c55e",
    musicBase: 220,
    bosses: {
      mid: {
        checkpoint: "mid",
        name: "キャラバンUFO",
        hp: 7,
        score: 760,
        rewardCoins: 4,
        attackLabel: "横流れ隊列",
        speedBonus: 0.12,
        driftScale: 1.35,
      },
      stage: {
        checkpoint: "stage",
        name: "キャッスルUFO",
        hp: 10,
        score: 1100,
        rewardCoins: 6,
        attackLabel: "城壁バリア",
        speedBonus: 0.18,
        driftScale: 1.15,
      },
    },
    smallStages: createSmallStages(2, "Country", 39),
  },
  {
    number: 3,
    id: "moon",
    label: "月",
    storyLabel: "月面クレーター",
    background: `${ASSET_BASE}/backgrounds/moon.svg`,
    accent: "#cbd5e1",
    musicBase: 247,
    bosses: {
      mid: {
        checkpoint: "mid",
        name: "クレーターUFO",
        hp: 9,
        score: 920,
        rewardCoins: 5,
        attackLabel: "低重力ホバー",
        speedBonus: 0.1,
        driftScale: 1.55,
      },
      stage: {
        checkpoint: "stage",
        name: "ムーンコアUFO",
        hp: 12,
        score: 1320,
        rewardCoins: 7,
        attackLabel: "月光リング",
        speedBonus: 0.22,
        driftScale: 1.4,
      },
    },
    smallStages: createSmallStages(3, "Moon", 36),
  },
  {
    number: 4,
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
        hp: 11,
        score: 1100,
        rewardCoins: 6,
        attackLabel: "砂嵐加速",
        speedBonus: 0.24,
        driftScale: 1.65,
      },
      stage: {
        checkpoint: "stage",
        name: "オリンポスUFO",
        hp: 15,
        score: 1600,
        rewardCoins: 8,
        attackLabel: "火星噴流",
        speedBonus: 0.34,
        driftScale: 1.5,
      },
    },
    smallStages: createSmallStages(4, "Mars", 33),
  },
  {
    number: 5,
    id: "dimension",
    label: "異次元",
    storyLabel: "異次元ゲート",
    background: `${ASSET_BASE}/backgrounds/dimension.svg`,
    accent: "#d946ef",
    musicBase: 277,
    bosses: {
      mid: {
        checkpoint: "mid",
        name: "ミラーUFO",
        hp: 13,
        score: 1400,
        rewardCoins: 8,
        attackLabel: "反転ワープ",
        speedBonus: 0.3,
        driftScale: 1.9,
      },
      stage: {
        checkpoint: "stage",
        name: "ワールドロックUFO",
        hp: 18,
        score: 2200,
        rewardCoins: 10,
        attackLabel: "次元封印",
        speedBonus: 0.42,
        driftScale: 1.7,
      },
    },
    smallStages: createSmallStages(5, "Dimension", 30),
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
