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

export type StageDefinition = {
  number: number;
  id: StageId;
  label: string;
  storyLabel: string;
  background: string;
  accent: string;
  musicBase: number;
  midBoss: string;
  stageBoss: string;
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
    midBoss: "スクラップUFO",
    stageBoss: "タワーゲートUFO",
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
    midBoss: "キャラバンUFO",
    stageBoss: "キャッスルUFO",
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
    midBoss: "クレーターUFO",
    stageBoss: "ムーンコアUFO",
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
    midBoss: "ダストUFO",
    stageBoss: "オリンポスUFO",
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
    midBoss: "ミラーUFO",
    stageBoss: "ワールドロックUFO",
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
