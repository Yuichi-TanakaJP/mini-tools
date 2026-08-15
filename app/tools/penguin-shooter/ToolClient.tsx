"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  CLEAR_TARGET,
  FINAL_STAGE,
  GAME_MODE_DEFINITIONS,
  MAX_LIVES,
  STAGE_DEFINITIONS,
  TWO_PLAYER_UNLOCK_STAGE,
  WEAPON_DEFINITIONS,
  WEAPON_ORDER,
  getBossDefinition,
  getGameModeDefinition,
  getStageDefinition,
  getStageGoal,
  getSubStage,
} from "./stageData";
import type {
  BossCheckpoint,
  BossDefinition,
  GameMode,
  StageDefinition,
  StageId,
  WeaponId,
} from "./stageData";

const WIDTH = 720;
const HEIGHT = 820;
const PLAYER_SIZE = 66;
const ENEMY_SIZE = 46;
const BULLET_WIDTH = 8;
const BULLET_HEIGHT = 18;
const COIN_SIZE = 24;
const OBSTACLE_SIZE = 52;
const OPENING_MS = 10_000;
const STAR_COUNT = 56;
const MUTE_STORAGE_KEY = "penguin-shooter-muted";
const BOSS_RESERVED_Y = 188;
const MOBILE_PAGE_BOTTOM_PADDING = 128;
const DESKTOP_BOARD_MAX_SCALE = 1.12;

type GameState = "idle" | "opening" | "playing" | "cleared" | "gameover";

type Player = {
  x: number;
  y: number;
  speed: number;
};

type Bullet = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  weapon: WeaponId;
};

type EnemyBullet = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: "warm" | "cool" | "white";
};

type EnemyLaser = {
  id: number;
  x: number;
  y: number;
  angle: number;
  angleStart: number;
  angleEnd: number;
  warningRemaining: number;
  activeRemaining: number;
  totalActiveDuration: number;
  width: number;
  hue: "warm" | "cool" | "white";
  hasHitPlayer: boolean;
};

type EnemyMissile = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  turnRate: number;
  hue: "warm" | "cool";
  lifetime: number;
};

const ENEMY_BULLET_SIZE = 12;
const MISSILE_SIZE = 18;
const LASER_BEAM_LENGTH = 1100;

type Enemy = {
  id: number;
  x: number;
  y: number;
  anchorX?: number;
  phase?: number;
  speed: number;
  drift: number;
  hp: number;
  maxHp: number;
  kind: "scout" | "boss";
  checkpoint?: "mid" | "stage";
  boss?: BossDefinition;
  fireCooldown?: number;
  burstRemaining?: number;
  freezeRemaining?: number;
};

type Coin = {
  id: number;
  x: number;
  y: number;
  speed: number;
};

type Obstacle = {
  id: number;
  x: number;
  y: number;
  speed: number;
  hp: number;
  destructible: boolean;
  stageId: StageId;
  kind: "normal" | "ruins";
};

type BarrierItem = {
  id: number;
  x: number;
  y: number;
  speed: number;
};

const BARRIER_ITEM_SIZE = 30;
const BARRIER_ACTIVE_FRAMES = 180;
const BARRIER_COOLDOWN_FRAMES = 300;

type Burst = {
  id: number;
  x: number;
  y: number;
  label: string;
};

type Star = {
  id: number;
  x: number;
  y: number;
  r: number;
  speed: number;
};

type ControlKey =
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowDown"
  | "Space"
  | "Bomb";

type SoundEffect = "shoot" | "hit" | "coin" | "bomb" | "clear" | "stage";
type BossMarkers = Record<number, Record<BossCheckpoint, boolean>>;

type StageVisualTheme = {
  atmosphere: string;
  distant: string;
  midground: string;
  foreground: string;
};

const STAGE_VISUALS: Record<StageId, StageVisualTheme> = {
  town: {
    atmosphere:
      "linear-gradient(180deg, rgba(14, 165, 233, 0.18), rgba(15, 23, 42, 0)), radial-gradient(circle at 18% 18%, rgba(250, 204, 21, 0.3), transparent 18%)",
    distant:
      "linear-gradient(180deg, rgba(59, 130, 246, 0), rgba(30, 41, 59, 0.46)), repeating-linear-gradient(90deg, transparent 0 48px, rgba(226, 232, 240, 0.22) 49px 52px)",
    midground:
      "linear-gradient(90deg, rgba(15, 23, 42, 0.78) 0 9%, transparent 9% 15%, rgba(30, 41, 59, 0.82) 15% 29%, transparent 29% 38%, rgba(51, 65, 85, 0.82) 38% 52%, transparent 52% 62%, rgba(15, 23, 42, 0.82) 62% 78%, transparent 78% 100%)",
    foreground:
      "linear-gradient(105deg, transparent 0 42%, rgba(248, 250, 252, 0.62) 43% 44%, transparent 45% 100%), linear-gradient(180deg, rgba(15, 23, 42, 0), rgba(15, 23, 42, 0.74))",
  },
  country: {
    atmosphere:
      "linear-gradient(180deg, rgba(34, 197, 94, 0.18), rgba(15, 23, 42, 0)), radial-gradient(circle at 72% 16%, rgba(187, 247, 208, 0.28), transparent 20%)",
    distant:
      "radial-gradient(ellipse at 16% 100%, rgba(22, 101, 52, 0.76) 0 18%, transparent 19%), radial-gradient(ellipse at 48% 100%, rgba(21, 128, 61, 0.72) 0 24%, transparent 25%), radial-gradient(ellipse at 82% 100%, rgba(20, 83, 45, 0.78) 0 21%, transparent 22%)",
    midground:
      "linear-gradient(90deg, rgba(22, 101, 52, 0.76) 0 22%, transparent 22% 30%, rgba(132, 204, 22, 0.48) 30% 46%, transparent 46% 58%, rgba(21, 128, 61, 0.7) 58% 88%, transparent 88% 100%)",
    foreground:
      "repeating-linear-gradient(95deg, rgba(187, 247, 208, 0.34) 0 2px, transparent 3px 34px), linear-gradient(180deg, rgba(15, 23, 42, 0), rgba(20, 83, 45, 0.72))",
  },
  frost: {
    atmosphere:
      "linear-gradient(180deg, rgba(103, 232, 249, 0.22), rgba(15, 23, 42, 0)), radial-gradient(circle at 72% 18%, rgba(224, 242, 254, 0.28), transparent 20%)",
    distant:
      "linear-gradient(165deg, transparent 0 42%, rgba(186, 230, 253, 0.56) 43% 58%, transparent 59%), linear-gradient(195deg, transparent 0 46%, rgba(125, 211, 252, 0.48) 47% 62%, transparent 63%)",
    midground:
      "repeating-linear-gradient(160deg, rgba(224, 242, 254, 0.26) 0 3px, transparent 4px 32px), linear-gradient(180deg, rgba(8, 47, 73, 0), rgba(8, 47, 73, 0.76))",
    foreground:
      "linear-gradient(180deg, rgba(15, 23, 42, 0), rgba(8, 47, 73, 0.82)), repeating-linear-gradient(90deg, rgba(224, 242, 254, 0.2) 0 2px, transparent 3px 42px)",
  },
  desert: {
    atmosphere:
      "linear-gradient(180deg, rgba(251, 191, 36, 0.2), rgba(15, 23, 42, 0)), radial-gradient(circle at 76% 17%, rgba(254, 240, 138, 0.28), transparent 20%)",
    distant:
      "radial-gradient(ellipse at 18% 100%, rgba(146, 64, 14, 0.76) 0 20%, transparent 21%), radial-gradient(ellipse at 66% 100%, rgba(180, 83, 9, 0.72) 0 28%, transparent 29%)",
    midground:
      "linear-gradient(90deg, rgba(120, 53, 15, 0.72) 0 18%, transparent 18% 30%, rgba(180, 83, 9, 0.7) 30% 54%, transparent 54% 67%, rgba(120, 53, 15, 0.72) 67% 100%)",
    foreground:
      "repeating-linear-gradient(100deg, rgba(254, 240, 138, 0.24) 0 2px, transparent 3px 28px), linear-gradient(180deg, rgba(15, 23, 42, 0), rgba(69, 26, 3, 0.82))",
  },
  cloud: {
    atmosphere:
      "linear-gradient(180deg, rgba(192, 132, 252, 0.22), rgba(15, 23, 42, 0)), radial-gradient(circle at 22% 20%, rgba(245, 243, 255, 0.26), transparent 18%)",
    distant:
      "radial-gradient(ellipse at 14% 100%, rgba(196, 181, 253, 0.62) 0 18%, transparent 19%), radial-gradient(ellipse at 58% 100%, rgba(139, 92, 246, 0.64) 0 25%, transparent 26%), radial-gradient(ellipse at 92% 100%, rgba(221, 214, 254, 0.55) 0 18%, transparent 19%)",
    midground:
      "linear-gradient(90deg, rgba(49, 46, 129, 0.74) 0 22%, transparent 22% 34%, rgba(109, 40, 217, 0.64) 34% 55%, transparent 55% 69%, rgba(49, 46, 129, 0.74) 69% 100%)",
    foreground:
      "repeating-linear-gradient(95deg, rgba(245, 243, 255, 0.3) 0 2px, transparent 3px 36px), linear-gradient(180deg, rgba(15, 23, 42, 0), rgba(49, 46, 129, 0.8))",
  },
  moon: {
    atmosphere:
      "linear-gradient(180deg, rgba(203, 213, 225, 0.14), rgba(15, 23, 42, 0)), radial-gradient(circle at 26% 20%, rgba(226, 232, 240, 0.28), transparent 16%)",
    distant:
      "radial-gradient(ellipse at 18% 100%, rgba(100, 116, 139, 0.7) 0 18%, transparent 19%), radial-gradient(ellipse at 62% 100%, rgba(71, 85, 105, 0.78) 0 26%, transparent 27%), radial-gradient(ellipse at 92% 100%, rgba(148, 163, 184, 0.56) 0 18%, transparent 19%)",
    midground:
      "radial-gradient(circle at 18% 64%, rgba(226, 232, 240, 0.16) 0 5%, transparent 6%), radial-gradient(circle at 70% 70%, rgba(226, 232, 240, 0.14) 0 7%, transparent 8%)",
    foreground:
      "repeating-linear-gradient(100deg, rgba(226, 232, 240, 0.18) 0 1px, transparent 2px 42px), linear-gradient(180deg, rgba(15, 23, 42, 0), rgba(30, 41, 59, 0.8))",
  },
  mars: {
    atmosphere:
      "linear-gradient(180deg, rgba(249, 115, 22, 0.2), rgba(15, 23, 42, 0)), radial-gradient(circle at 72% 18%, rgba(253, 186, 116, 0.26), transparent 19%)",
    distant:
      "radial-gradient(ellipse at 24% 100%, rgba(124, 45, 18, 0.78) 0 18%, transparent 19%), radial-gradient(ellipse at 58% 100%, rgba(154, 52, 18, 0.72) 0 26%, transparent 27%), radial-gradient(ellipse at 88% 100%, rgba(67, 20, 7, 0.72) 0 20%, transparent 21%)",
    midground:
      "repeating-linear-gradient(8deg, rgba(251, 146, 60, 0.18) 0 3px, transparent 4px 34px), linear-gradient(90deg, rgba(154, 52, 18, 0.7) 0 28%, transparent 28% 44%, rgba(124, 45, 18, 0.72) 44% 75%, transparent 75% 100%)",
    foreground:
      "repeating-linear-gradient(100deg, rgba(253, 186, 116, 0.24) 0 2px, transparent 3px 26px), linear-gradient(180deg, rgba(15, 23, 42, 0), rgba(67, 20, 7, 0.76))",
  },
  machine: {
    atmosphere:
      "linear-gradient(180deg, rgba(45, 212, 191, 0.18), rgba(15, 23, 42, 0)), radial-gradient(circle at 68% 14%, rgba(204, 251, 241, 0.2), transparent 18%)",
    distant:
      "repeating-radial-gradient(circle at 18% 90%, transparent 0 18px, rgba(45, 212, 191, 0.26) 19px 24px, transparent 25px 48px), linear-gradient(180deg, rgba(15, 23, 42, 0), rgba(6, 78, 59, 0.6))",
    midground:
      "linear-gradient(90deg, rgba(15, 118, 110, 0.72) 0 16%, transparent 16% 28%, rgba(19, 78, 74, 0.78) 28% 48%, transparent 48% 60%, rgba(15, 118, 110, 0.72) 60% 100%)",
    foreground:
      "repeating-linear-gradient(90deg, rgba(45, 212, 191, 0.24) 0 2px, transparent 3px 34px), linear-gradient(180deg, rgba(15, 23, 42, 0), rgba(4, 47, 46, 0.86))",
  },
  blackhole: {
    atmosphere:
      "linear-gradient(180deg, rgba(167, 139, 250, 0.2), rgba(2, 6, 23, 0)), radial-gradient(circle at 52% 24%, rgba(124, 58, 237, 0.28), transparent 24%)",
    distant:
      "conic-gradient(from 40deg at 50% 100%, rgba(124, 58, 237, 0.36), transparent 16%, rgba(167, 139, 250, 0.22) 32%, transparent 54%, rgba(49, 46, 129, 0.34) 72%, transparent)",
    midground:
      "repeating-radial-gradient(ellipse at 50% 84%, transparent 0 22px, rgba(167, 139, 250, 0.18) 23px 27px, transparent 28px 52px)",
    foreground:
      "radial-gradient(ellipse at 50% 100%, rgba(124, 58, 237, 0.36), transparent 58%), linear-gradient(180deg, rgba(2, 6, 23, 0), rgba(17, 24, 39, 0.9))",
  },
  dimension: {
    atmosphere:
      "linear-gradient(180deg, rgba(217, 70, 239, 0.22), rgba(15, 23, 42, 0)), radial-gradient(circle at 24% 22%, rgba(34, 211, 238, 0.26), transparent 18%), radial-gradient(circle at 82% 28%, rgba(250, 204, 21, 0.2), transparent 16%)",
    distant:
      "conic-gradient(from 30deg at 50% 100%, rgba(34, 211, 238, 0.22), transparent 16%, rgba(217, 70, 239, 0.22) 28%, transparent 44%, rgba(250, 204, 21, 0.16) 58%, transparent 74%, rgba(34, 211, 238, 0.22))",
    midground:
      "repeating-linear-gradient(120deg, rgba(216, 180, 254, 0.22) 0 3px, transparent 4px 28px), repeating-linear-gradient(54deg, rgba(34, 211, 238, 0.16) 0 2px, transparent 3px 36px)",
    foreground:
      "radial-gradient(ellipse at 50% 100%, rgba(217, 70, 239, 0.44), transparent 56%), linear-gradient(180deg, rgba(15, 23, 42, 0), rgba(49, 46, 129, 0.8))",
  },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getBossSize = (checkpoint?: BossCheckpoint) =>
  checkpoint === "stage"
    ? { width: 176, height: 132 }
    : { width: 84, height: 96 };

const getEnemySize = (enemy: Pick<Enemy, "kind" | "checkpoint">) =>
  enemy.kind === "boss" ? getBossSize(enemy.checkpoint) : {
    width: ENEMY_SIZE,
    height: ENEMY_SIZE,
  };

const getBossHpKey = (stageNumber: number, checkpoint: BossCheckpoint) =>
  `${stageNumber}:${checkpoint}`;

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function createStars(): Star[] {
  return Array.from({ length: STAR_COUNT }, (_, index) => ({
    id: index,
    x: Math.round(pseudoRandom(index + 10) * WIDTH),
    y: Math.round(pseudoRandom(index + 110) * HEIGHT),
    r: Math.round(pseudoRandom(index + 210) * 2 + 1),
    speed: pseudoRandom(index + 310) * 1.2 + 0.5,
  }));
}

function createRandom(seedRef: { current: number }) {
  seedRef.current = (seedRef.current * 1664525 + 1013904223) % 4294967296;
  return seedRef.current / 4294967296;
}

function getObstacleLabel(stageId: StageId, destructible: boolean) {
  const labels: Record<StageId, { destructible: string; solid: string }> = {
    town: { destructible: "🚧", solid: "🏢" },
    country: { destructible: "🪵", solid: "🪨" },
    frost: { destructible: "🧊", solid: "❄️" },
    desert: { destructible: "🏺", solid: "🪨" },
    cloud: { destructible: "☁️", solid: "⚡" },
    moon: { destructible: "🪐", solid: "🌑" },
    mars: { destructible: "🌋", solid: "🪨" },
    machine: { destructible: "⚙️", solid: "🔩" },
    blackhole: { destructible: "🌀", solid: "🌑" },
    dimension: { destructible: "🔮", solid: "⬛" },
  };
  return destructible ? labels[stageId].destructible : labels[stageId].solid;
}

type BossMuzzle = {
  x: number;
  y: number;
  hue: EnemyBullet["hue"];
};

function getBossMuzzles(
  enemy: Pick<Enemy, "x" | "y">,
  enemyWidth: number,
  isStageBoss: boolean,
): { left: BossMuzzle; right: BossMuzzle; center: BossMuzzle } {
  if (isStageBoss) {
    return {
      left: { x: enemy.x + 29, y: enemy.y + 74, hue: "warm" },
      right: { x: enemy.x + enemyWidth - 29, y: enemy.y + 74, hue: "cool" },
      center: { x: enemy.x + 88, y: enemy.y + 112, hue: "white" },
    };
  }
  return {
    left: { x: enemy.x + 20, y: enemy.y + 54, hue: "warm" },
    right: { x: enemy.x + enemyWidth - 20, y: enemy.y + 54, hue: "cool" },
    center: { x: enemy.x + enemyWidth / 2, y: enemy.y + 60, hue: "white" },
  };
}

type Shot = { from: BossMuzzle; vx: number; vy: number };

function aimedShot(from: BossMuzzle, targetX: number, targetY: number, speed: number): Shot {
  const dx = targetX - from.x;
  const dy = Math.max(40, targetY - from.y);
  const length = Math.hypot(dx, dy) || 1;
  return { from, vx: (dx / length) * speed, vy: (dy / length) * speed };
}

function angledShot(from: BossMuzzle, angleFromDown: number, speed: number): Shot {
  return {
    from,
    vx: Math.sin(angleFromDown) * speed,
    vy: Math.cos(angleFromDown) * speed,
  };
}

function rectsHit(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function OpeningScene({
  progress,
  onSkip,
}: {
  progress: number;
  onSkip: () => void;
}) {
  const step = Math.min(4, Math.floor(progress * 5));
  const scenes = [
    {
      label: "Shuty 登場",
      text: "丸い救助宇宙船が星の海へ。",
      icon: "🛸",
    },
    {
      label: "Pen 搭乗",
      text: "小さな勇者がコックピットへ飛び乗る。",
      icon: "🐧",
    },
    {
      label: "Shoot が捕まった",
      text: "救出ミッションが始まる。",
      icon: "🛸😾",
    },
    {
      label: "コインで強化",
      text: "集めたコインがShutyの武器を光らせる。",
      icon: "🪙✨",
    },
    {
      label: "GAME START",
      text: "Pen、出撃。",
      icon: "🚀",
    },
  ];
  const scene = scenes[step];
  const sceneProgress = progress * 5 - step;

  return (
    <div style={styles.openingOverlay}>
      <div style={styles.openingPanel}>
        <div style={styles.openingKicker}>10秒オープニング</div>
        <div style={styles.openingViewport}>
          <div style={styles.openingStarField} />
          <div
            style={{
              ...styles.openingTrail,
              transform: `translateX(${Math.round(sceneProgress * 120 - 70)}px)`,
              opacity: step === 4 ? 1 : 0.55,
            }}
          />
          <div
            style={{
              ...styles.openingIcon,
              transform: `translateY(${Math.round(Math.sin(sceneProgress * Math.PI) * -10)}px) scale(${
                step === 4 ? 1.16 : 1
              })`,
            }}
          >
            {scene.icon}
          </div>
          <div style={styles.openingCutBadge}>{step + 1}/5</div>
        </div>
        <h2 style={styles.openingTitle}>{scene.label}</h2>
        <p style={styles.openingText}>{scene.text}</p>
        <div style={styles.openingCuts}>
          {scenes.map((cut, index) => (
            <span
              key={cut.label}
              style={{
                ...styles.openingCut,
                ...(index <= step ? styles.openingCutActive : {}),
              }}
            />
          ))}
        </div>
        <div style={styles.openingMeter}>
          <div
            style={{
              ...styles.openingMeterFill,
              width: `${Math.round(progress * 100)}%`,
            }}
          />
        </div>
        <button type="button" onClick={onSkip} style={styles.skipButton}>
          スキップ
        </button>
      </div>
    </div>
  );
}

function Shuty({ player, powered }: { player: Player; powered: boolean }) {
  return (
    <div
      aria-label="宇宙船Shutyに乗ったPen"
      style={{
        ...styles.shuty,
        left: player.x,
        top: player.y,
        filter: powered
          ? "drop-shadow(0 0 18px rgba(250, 204, 21, 0.8)) drop-shadow(0 10px 14px rgba(15, 23, 42, 0.45))"
          : styles.shuty.filter,
      }}
    >
      <div style={styles.shutyGlass} />
      <span style={styles.penFace}>🐧</span>
      <div style={styles.shutyBody} />
      <div style={styles.shutyWingLeft} />
      <div style={styles.shutyWingRight} />
      <div style={styles.shutyFlame} />
    </div>
  );
}

function EnemyView({ enemy }: { enemy: Enemy }) {
  if (enemy.kind === "boss") {
    const bossName = enemy.boss?.name ?? "捕獲UFO";
    const attackLabel = enemy.boss?.attackLabel ?? "特殊攻撃";
    const weaponLabel = enemy.boss?.weaponLabel ?? "特殊兵装";
    const isStageBoss = enemy.checkpoint === "stage";
    const hpPercent = Math.max(
      0,
      Math.round((enemy.hp / Math.max(1, enemy.maxHp)) * 100),
    );
    const bossSize = getBossSize(enemy.checkpoint);
    return (
      <div
        aria-label={bossName}
        style={{
          ...styles.enemy,
          ...styles.bossEnemy,
          ...(isStageBoss ? styles.stageBossEnemy : styles.midBossEnemy),
          width: bossSize.width,
          height: bossSize.height,
          left: enemy.x,
          top: enemy.y,
        }}
      >
        <span
          style={{
            ...styles.bossAura,
            ...(isStageBoss ? styles.stageBossAura : {}),
          }}
        />
        <span
          style={{
            ...styles.bossRing,
            ...(isStageBoss ? styles.stageBossRing : {}),
          }}
        />
        {isStageBoss && enemy.boss?.assetPath ? (
          <span
            aria-hidden
            style={{
              ...styles.stageBossSvg,
              backgroundImage: `url("${enemy.boss.assetPath}")`,
            }}
          />
        ) : isStageBoss ? (
          <>
            <span style={styles.stageBossWeaponLeft} />
            <span style={styles.stageBossWeaponRight} />
            <span style={styles.stageBossCannon} />
            <span style={styles.stageBossCore} />
            <span style={styles.stageBossDeck} />
          </>
        ) : (
          <>
            <span style={styles.midBossWingLeft} />
            <span style={styles.midBossWingRight} />
            <span style={styles.midBossCore} />
          </>
        )}
        {!isStageBoss || !enemy.boss?.assetPath ? (
          <>
            <span style={isStageBoss ? styles.stageBossBeam : styles.bossBeam} />
            <span
              style={{
                ...styles.bossName,
                ...(isStageBoss ? styles.stageBossName : {}),
              }}
            >
              {bossName}
            </span>
            <span
              style={{
                ...styles.bossAttack,
                ...(isStageBoss ? styles.stageBossAttack : {}),
              }}
            >
              {attackLabel} / {weaponLabel}
            </span>
            <span
              style={{
                ...styles.bossHp,
                ...(isStageBoss ? styles.stageBossHp : {}),
              }}
            >
              <span style={{ ...styles.bossHpFill, width: `${hpPercent}%` }} />
            </span>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div
      aria-label="敵"
      style={{
        ...styles.enemy,
        left: enemy.x,
        top: enemy.y,
        width: ENEMY_SIZE,
        height: ENEMY_SIZE,
        fontSize: 32,
      }}
    >
      👾
    </div>
  );
}

function ObstacleView({ obstacle }: { obstacle: Obstacle }) {
  const isRuins = obstacle.kind === "ruins";
  const hpMax = isRuins ? 3 : 2;
  return (
    <div
      aria-label={
        isRuins
          ? "古代遺跡"
          : obstacle.destructible
            ? "破壊可能な障害物"
            : "破壊不可能な障害物"
      }
      style={{
        ...styles.obstacle,
        ...(isRuins
          ? styles.obstacleRuins
          : obstacle.destructible
            ? styles.obstacleBreakable
            : styles.obstacleSolid),
        left: obstacle.x,
        top: obstacle.y,
      }}
    >
      <span style={styles.obstacleIcon}>
        {isRuins ? "🏛️" : getObstacleLabel(obstacle.stageId, obstacle.destructible)}
      </span>
      {obstacle.destructible ? (
        <span style={styles.obstacleHp}>
          <span
            style={{
              ...styles.obstacleHpFill,
              ...(isRuins ? styles.obstacleHpFillRuins : {}),
              width: `${Math.max(0, obstacle.hp / hpMax) * 100}%`,
            }}
          />
        </span>
      ) : null}
    </div>
  );
}

function TouchButton({
  label,
  onPressChange,
  accent = false,
}: {
  label: string;
  onPressChange: (pressed: boolean) => void;
  accent?: boolean;
}) {
  const [pressed, setPressed] = useState(false);

  const update = (next: boolean) => {
    setPressed(next);
    onPressChange(next);
  };

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={() => update(true)}
      onPointerUp={() => update(false)}
      onPointerCancel={() => update(false)}
      onPointerLeave={() => update(false)}
      style={{
        ...styles.touchButton,
        ...(accent ? styles.touchButtonAccent : {}),
        ...(pressed ? styles.touchButtonPressed : {}),
      }}
    >
      {label}
    </button>
  );
}

function Joystick({
  compact,
  onDirectionChange,
}: {
  compact: boolean;
  onDirectionChange: (directions: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  }) => void;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const threshold = compact ? 14 : 18;
  const knobRange = compact ? 30 : 42;

  const release = () => {
    originRef.current = null;
    setKnob({ x: 0, y: 0 });
    onDirectionChange({ up: false, down: false, left: false, right: false });
  };

  return (
    <div
      ref={padRef}
      role="application"
      aria-label="移動スティック"
      style={{
        ...styles.joystick,
        ...(compact ? styles.joystickCompact : {}),
      }}
      onPointerDown={(event) => {
        padRef.current?.setPointerCapture(event.pointerId);
        originRef.current = { x: event.clientX, y: event.clientY };
        setKnob({ x: 0, y: 0 });
      }}
      onPointerMove={(event) => {
        if (!originRef.current) return;
        const dx = event.clientX - originRef.current.x;
        const dy = event.clientY - originRef.current.y;
        const distance = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const radius = Math.min(distance, knobRange);
        setKnob({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
        onDirectionChange({
          up: dy < -threshold,
          down: dy > threshold,
          left: dx < -threshold,
          right: dx > threshold,
        });
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <span style={styles.joystickHint}>DRAG</span>
      <span
        aria-hidden
        style={{
          ...styles.joystickKnob,
          ...(compact ? styles.joystickKnobCompact : {}),
          transform: `translate(${knob.x}px, ${knob.y}px)`,
        }}
      />
    </div>
  );
}

function ProgressGraph({
  stage,
  stageProgressPercent,
  completedStages,
  rescued,
}: {
  stage: number;
  stageProgressPercent: number;
  completedStages: number;
  rescued: number;
}) {
  const chartWidth = 360;
  const chartHeight = 126;
  const padding = { top: 14, right: 14, bottom: 26, left: 18 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const values = STAGE_DEFINITIONS.map((definition) => {
    if (definition.number <= completedStages) return 1;
    if (definition.number === stage) return clamp(stageProgressPercent / 100, 0, 1);
    return 0;
  });
  const points = values.map((value, index) => ({
    x: padding.left + (index / (values.length - 1)) * plotWidth,
    y: padding.top + (1 - value) * plotHeight,
    value,
    stage: index + 1,
  }));
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const lastPoint = points[points.length - 1];
  const areaPath = `${linePath} L ${lastPoint?.x ?? chartWidth - padding.right} ${padding.top + plotHeight} L ${points[0]?.x ?? padding.left} ${padding.top + plotHeight} Z`;

  return (
    <section style={styles.graphCard} aria-label="10ステージ進捗グラフ">
      <div style={styles.graphHeader}>
        <div>
          <span style={styles.graphEyebrow}>MISSION PROGRESS</span>
          <strong style={styles.graphTitle}>救出ルート</strong>
        </div>
        <span style={styles.graphSummary}>{rescued}/{CLEAR_TARGET} rescued</span>
      </div>
      <svg
        role="img"
        aria-label={`Stage ${stage}、救出進捗 ${rescued}/${CLEAR_TARGET}`}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        style={styles.progressGraph}
      >
        {[0, 0.5, 1].map((value) => {
          const y = padding.top + (1 - value) * plotHeight;
          return (
            <line
              key={value}
              x1={padding.left}
              x2={chartWidth - padding.right}
              y1={y}
              y2={y}
              stroke="rgba(148, 163, 184, 0.24)"
              strokeDasharray="3 4"
            />
          );
        })}
        <path d={areaPath} fill="url(#penguin-progress-fill)" opacity="0.28" />
        <path d={linePath} fill="none" stroke="#0e7490" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => {
          const completed = point.value >= 1;
          const current = point.stage === stage;
          return (
            <g key={point.stage}>
              <circle
                cx={point.x}
                cy={point.y}
                r={current ? 6 : 4}
                fill={completed ? "#22c55e" : current ? "#facc15" : "#cbd5e1"}
                stroke="#f8fafc"
                strokeWidth="2"
              />
              <text x={point.x} y={chartHeight - 8} textAnchor="middle" style={styles.graphLabel}>
                {point.stage}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="penguin-progress-fill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
      <div style={styles.graphLegend}>
        <span><i style={{ ...styles.graphLegendDot, background: "#22c55e" }} />完了</span>
        <span><i style={{ ...styles.graphLegendDot, background: "#facc15" }} />現在</span>
        <span><i style={{ ...styles.graphLegendDot, background: "#cbd5e1" }} />未到達</span>
      </div>
    </section>
  );
}

export default function ToolClient() {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [openingProgress, setOpeningProgress] = useState(0);
  const [player, setPlayer] = useState<Player>({
    x: WIDTH / 2 - PLAYER_SIZE / 2,
    y: HEIGHT - 100,
    speed: 6,
  });
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [enemyBullets, setEnemyBullets] = useState<EnemyBullet[]>([]);
  const [enemyLasers, setEnemyLasers] = useState<EnemyLaser[]>([]);
  const [enemyMissiles, setEnemyMissiles] = useState<EnemyMissile[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [coinsOnBoard, setCoinsOnBoard] = useState<Coin[]>([]);
  const [barrierItems, setBarrierItems] = useState<BarrierItem[]>([]);
  const [barrierActiveFrames, setBarrierActiveFrames] = useState(0);
  const [barrierCooldownFrames, setBarrierCooldownFrames] = useState(0);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [stars, setStars] = useState<Star[]>(createStars);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [coins, setCoins] = useState(0);
  const [rescued, setRescued] = useState(0);
  const [stage, setStage] = useState(1);
  const [stageProgress, setStageProgress] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>(3);
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponId>("standard");
  const [bombs, setBombs] = useState(1);
  const [message, setMessage] = useState("Shuty、発進準備OK");
  const [boardScale, setBoardScale] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [subStageFlash, setSubStageFlash] = useState<{
    key: number;
    label: string;
    number: number;
  } | null>(null);
  const [stageTransition, setStageTransition] = useState<{
    key: number;
    stage: number;
    label: string;
    storyLabel: string;
  } | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const frameRef = useRef(0);
  const spawnTickRef = useRef(0);
  const obstacleTickRef = useRef(0);
  const fireTickRef = useRef(0);
  const enemyIdRef = useRef(1);
  const obstacleIdRef = useRef(1);
  const bulletIdRef = useRef(1);
  const enemyBulletIdRef = useRef(1);
  const enemyLaserIdRef = useRef(1);
  const enemyMissileIdRef = useRef(1);
  const coinIdRef = useRef(1);
  const barrierItemIdRef = useRef(1);
  const burstIdRef = useRef(1);
  const seedRef = useRef(20260507);
  const openingStartedAtRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const bgmRef = useRef<{ oscillators: OscillatorNode[]; gain: GainNode } | null>(
    null,
  );
  const mutedRef = useRef(false);
  const bossMarkersRef = useRef<BossMarkers>({});
  const previousSubStageRef = useRef<number | null>(null);
  const previousStageRef = useRef<number | null>(null);

  const playerRef = useRef(player);
  const bulletsRef = useRef<Bullet[]>([]);
  const enemyBulletsRef = useRef<EnemyBullet[]>([]);
  const enemyLasersRef = useRef<EnemyLaser[]>([]);
  const enemyMissilesRef = useRef<EnemyMissile[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const coinsOnBoardRef = useRef<Coin[]>([]);
  const barrierItemsRef = useRef<BarrierItem[]>([]);
  const barrierActiveRef = useRef(0);
  const barrierCooldownRef = useRef(0);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const livesRef = useRef(MAX_LIVES);
  const scoreRef = useRef(0);
  const coinsRef = useRef(0);
  const rescuedRef = useRef(0);
  const stageRef = useRef(1);
  const stageProgressRef = useRef(0);
  const gameModeRef = useRef<GameMode>(3);
  const bossHpRef = useRef<Record<string, number>>({});
  const selectedWeaponRef = useRef<WeaponId>("standard");
  const bombsRef = useRef(1);

  const isPlaying = gameState === "playing";
  const powered = selectedWeapon !== "standard";
  const isMobileLayout = viewportWidth > 0 && viewportWidth < 768;
  const isGameActive = gameState === "playing" || gameState === "opening";
  const isResultState = gameState === "cleared" || gameState === "gameover";
  const rescueProgress = Math.min(100, Math.round((rescued / CLEAR_TARGET) * 100));
  const currentStage = getStageDefinition(stage);
  const currentSubStage = getSubStage(stage, stageProgress);
  const currentGameMode = GAME_MODE_DEFINITIONS[gameMode];
  const currentStageGoal = currentStage.smallStages.length;
  const completedGraphStages = gameState === "cleared" ? FINAL_STAGE : Math.max(0, stage - 1);
  const twoPlayerUnlocked = rescued >= TWO_PLAYER_UNLOCK_STAGE;
  const availableWeapons = WEAPON_ORDER.filter(
    (weaponId) => currentStage.number >= WEAPON_DEFINITIONS[weaponId].unlockStage,
  );
  const stageTheme = currentStage;
  const visualTheme = STAGE_VISUALS[stageTheme.id];
  const boardBackground = `linear-gradient(180deg, rgba(15, 23, 42, 0.22), rgba(15, 23, 42, 0.1)), url("${stageTheme.background}")`;
  const stageProgressPercent = Math.min(
    100,
    Math.round((stageProgress / currentStageGoal) * 100),
  );
  const visibleBoss = enemies.find(
    (enemy) => enemy.kind === "boss" && enemy.boss,
  );

  const syncPlayer = useCallback((next: Player) => {
    playerRef.current = next;
    setPlayer(next);
  }, []);

  const syncBullets = useCallback((next: Bullet[]) => {
    bulletsRef.current = next;
    setBullets(next);
  }, []);

  const syncEnemyBullets = useCallback((next: EnemyBullet[]) => {
    enemyBulletsRef.current = next;
    setEnemyBullets(next);
  }, []);

  const syncEnemyLasers = useCallback((next: EnemyLaser[]) => {
    enemyLasersRef.current = next;
    setEnemyLasers(next);
  }, []);

  const syncEnemyMissiles = useCallback((next: EnemyMissile[]) => {
    enemyMissilesRef.current = next;
    setEnemyMissiles(next);
  }, []);

  const syncEnemies = useCallback((next: Enemy[]) => {
    enemiesRef.current = next;
    setEnemies(next);
  }, []);

  const syncCoinsOnBoard = useCallback((next: Coin[]) => {
    coinsOnBoardRef.current = next;
    setCoinsOnBoard(next);
  }, []);

  const syncBarrierItems = useCallback((next: BarrierItem[]) => {
    barrierItemsRef.current = next;
    setBarrierItems(next);
  }, []);

  const resetBarrierState = useCallback(() => {
    barrierItemsRef.current = [];
    barrierActiveRef.current = 0;
    barrierCooldownRef.current = 0;
    setBarrierItems([]);
    setBarrierActiveFrames(0);
    setBarrierCooldownFrames(0);
  }, []);

  const syncObstacles = useCallback((next: Obstacle[]) => {
    obstaclesRef.current = next;
    setObstacles(next);
  }, []);

  const addBurst = useCallback((x: number, y: number, label: string) => {
    const burst = { id: burstIdRef.current++, x, y, label };
    setBursts((current) => [...current, burst]);
    window.setTimeout(() => {
      setBursts((current) => current.filter((item) => item.id !== burst.id));
    }, 520);
  }, []);

  const resetControls = useCallback(() => {
    keysRef.current = {};
  }, []);

  const setControlPressed = useCallback((key: ControlKey, pressed: boolean) => {
    keysRef.current[key] = pressed;
    if (key === "Space") {
      keysRef.current[" "] = pressed;
      keysRef.current.Spacebar = pressed;
    }
  }, []);

  const getBossMarkers = useCallback((stageNumber: number) => {
    return bossMarkersRef.current[stageNumber] ?? { mid: false, stage: false };
  }, []);

  const getPendingCheckpoint = useCallback(
    (stageNumber: number, progress: number) => {
      const markers = getBossMarkers(stageNumber);
      const checkpoint = getSubStage(stageNumber, progress).bossCheckpoint;
      return checkpoint && !markers[checkpoint] ? checkpoint : undefined;
    },
    [getBossMarkers],
  );

  const markBossCleared = useCallback((enemy: Enemy) => {
    if (enemy.kind !== "boss" || !enemy.checkpoint) return;
    delete bossHpRef.current[getBossHpKey(stageRef.current, enemy.checkpoint)];
    const current = bossMarkersRef.current[stageRef.current] ?? {
      mid: false,
      stage: false,
    };
    bossMarkersRef.current[stageRef.current] = {
      ...current,
      [enemy.checkpoint]: true,
    };
  }, []);

  const getRescueGain = useCallback(
    (enemy: Enemy, progress: number) => {
      const stageGoal = getStageGoal(stageRef.current);
      if (progress >= stageGoal) return 0;
      if (enemy.kind === "boss") return 1;
      return getPendingCheckpoint(stageRef.current, progress) ? 0 : 1;
    },
    [getPendingCheckpoint],
  );

  const ensureAudio = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioContextRef.current) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextCtor) return null;
      const context = new AudioContextCtor();
      const masterGain = context.createGain();
      masterGain.gain.value = mutedRef.current ? 0 : 0.78;
      masterGain.connect(context.destination);
      audioContextRef.current = context;
      masterGainRef.current = masterGain;
      setAudioReady(true);
    }
    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const stopBgm = useCallback(() => {
    const current = bgmRef.current;
    if (!current) return;
    const context = audioContextRef.current;
    if (context) {
      current.gain.gain.cancelScheduledValues(context.currentTime);
      current.gain.gain.setTargetAtTime(0.0001, context.currentTime, 0.08);
      current.oscillators.forEach((oscillator) => {
        oscillator.stop(context.currentTime + 0.16);
      });
    } else {
      current.oscillators.forEach((oscillator) => oscillator.stop());
    }
    bgmRef.current = null;
  }, []);

  const startBgm = useCallback(
    (theme: StageDefinition) => {
      if (mutedRef.current) return;
      const context = ensureAudio();
      const masterGain = masterGainRef.current;
      if (!context || !masterGain) return;
      stopBgm();

      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.7);
      gain.connect(masterGain);

      const low = context.createOscillator();
      low.type = "sine";
      low.frequency.value = theme.musicBase;
      const high = context.createOscillator();
      high.type = "triangle";
      high.frequency.value = theme.musicBase * 1.5;

      low.connect(gain);
      high.connect(gain);
      low.start();
      high.start();
      bgmRef.current = { oscillators: [low, high], gain };
    },
    [ensureAudio, stopBgm],
  );

  const playTone = useCallback(
    (
      frequency: number,
      duration: number,
      type: OscillatorType = "sine",
      volume = 0.075,
    ) => {
      if (mutedRef.current) return;
      const context = ensureAudio();
      const masterGain = masterGainRef.current;
      if (!context || !masterGain) return;

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    },
    [ensureAudio],
  );

  const playSfx = useCallback(
    (effect: SoundEffect) => {
      if (effect === "shoot") playTone(740, 0.06, "square", 0.035);
      if (effect === "hit") playTone(130, 0.16, "sawtooth", 0.08);
      if (effect === "coin") playTone(1046, 0.1, "triangle", 0.065);
      if (effect === "bomb") playTone(82, 0.38, "sawtooth", 0.12);
      if (effect === "clear") {
        playTone(523, 0.18, "triangle", 0.08);
        window.setTimeout(() => playTone(784, 0.2, "triangle", 0.08), 110);
      }
      if (effect === "stage") {
        playTone(392, 0.12, "sine", 0.07);
        window.setTimeout(() => playTone(587, 0.14, "sine", 0.07), 90);
      }
    },
    [playTone],
  );

  const setMutedPreference = useCallback(
    (nextMuted: boolean) => {
      mutedRef.current = nextMuted;
      setIsMuted(nextMuted);
      window.localStorage.setItem(MUTE_STORAGE_KEY, nextMuted ? "1" : "0");
      if (masterGainRef.current) {
        masterGainRef.current.gain.value = nextMuted ? 0 : 0.78;
      }
      if (nextMuted) {
        stopBgm();
        return;
      }
      if (gameState === "opening" || gameState === "playing") {
        startBgm(getStageDefinition(stageRef.current));
      }
    },
    [gameState, startBgm, stopBgm],
  );

  const selectWeapon = useCallback((weaponId: WeaponId) => {
    const definition = WEAPON_DEFINITIONS[weaponId];
    if (stageRef.current < definition.unlockStage) {
      setMessage(`Stage ${definition.unlockStage} で${definition.label}解放`);
      return;
    }
    selectedWeaponRef.current = weaponId;
    setSelectedWeapon(weaponId);
    setMessage(`${definition.label} を装備`);
  }, []);

  const selectGameMode = useCallback(
    (mode: GameMode) => {
      if (gameState === "playing" || gameState === "opening") {
        setMessage("ゲームモードはプレイ開始前に選択してください");
        return;
      }
      gameModeRef.current = mode;
      setGameMode(mode);
      setMessage(`Mode ${mode} ${GAME_MODE_DEFINITIONS[mode].label} を選択`);
    },
    [gameState],
  );

  const fire = useCallback(() => {
    const current = playerRef.current;
    const weaponId = selectedWeaponRef.current;
    const definition = WEAPON_DEFINITIONS[weaponId];
    if (definition.cost > 0) {
      if (coinsRef.current < definition.cost) {
        setMessage(`コインが足りません（${definition.cost}枚必要）`);
        return;
      }
      coinsRef.current -= definition.cost;
      setCoins(coinsRef.current);
    }
    const base = {
      x: current.x + PLAYER_SIZE / 2 - BULLET_WIDTH / 2,
      y: current.y + 14,
      damage: definition.damage,
      weapon: weaponId,
    };
    const createBullet = (vx: number, vy: number) => ({
      id: bulletIdRef.current++,
      ...base,
      vx,
      vy,
    });
    const nextBullets =
      weaponId === "spread-3"
        ? [createBullet(0, -11), createBullet(-3, -10), createBullet(3, -10)]
        : weaponId === "snack-missile"
          ? [createBullet(-2.2, -7.2), createBullet(2.2, -7.2)]
          : weaponId === "fridge-beam"
            ? [createBullet(0, -9)]
            : weaponId === "rainbow-laser"
              ? [createBullet(0, -13)]
              : weaponId === "coin-cannon"
                ? [createBullet(0, -14)]
                : [createBullet(0, -11)];
    syncBullets([...bulletsRef.current, ...nextBullets]);
    playSfx("shoot");
  }, [playSfx, syncBullets]);

  const triggerSubStageFlash = useCallback(
    (label: string, number: number) => {
      const key = Date.now();
      setSubStageFlash({ key, label, number });
      window.setTimeout(() => {
        setSubStageFlash((current) =>
          current && current.key === key ? null : current,
        );
      }, 900);
    },
    [],
  );

  const triggerStageTransition = useCallback(
    (stageNumber: number, label: string, storyLabel: string) => {
      const key = Date.now();
      setStageTransition({ key, stage: stageNumber, label, storyLabel });
      window.setTimeout(() => {
        setStageTransition((current) =>
          current && current.key === key ? null : current,
        );
      }, 1900);
    },
    [],
  );

  const triggerBomb = useCallback(() => {
    const breakableObstacles = obstaclesRef.current.filter(
      (obstacle) => obstacle.destructible,
    );
    if (
      bombsRef.current <= 0 ||
      (enemiesRef.current.length === 0 && breakableObstacles.length === 0)
    ) {
      return;
    }
    playSfx("bomb");
    bombsRef.current -= 1;
    setBombs(bombsRef.current);
    const destroyedEnemies = enemiesRef.current;
    const destroyed = destroyedEnemies.length;
    const progressGain = enemiesRef.current.reduce(
      (sum, enemy) =>
        sum + getRescueGain(enemy, stageProgressRef.current + sum),
      0,
    );
    const nextScore =
      scoreRef.current +
      destroyedEnemies.reduce(
        (sum, enemy) => sum + (enemy.boss?.score ?? 140),
        0,
      );
    const nextRescued = Math.min(CLEAR_TARGET, rescuedRef.current + progressGain);
    const nextStageProgress = Math.min(
      getStageGoal(stageRef.current),
      stageProgressRef.current + progressGain,
    );
    scoreRef.current = nextScore;
    rescuedRef.current = nextRescued;
    stageProgressRef.current = nextStageProgress;
    setScore(nextScore);
    setRescued(nextRescued);
    setStageProgress(nextStageProgress);
    setMessage("もう、どうにでもなれボム！");
    destroyedEnemies.forEach((enemy) => {
      markBossCleared(enemy);
      addBurst(enemy.x, enemy.y, "BOOM");
    });
    breakableObstacles.forEach((obstacle) => {
      addBurst(obstacle.x, obstacle.y, "BREAK");
    });
    syncObstacles(
      obstaclesRef.current.filter((obstacle) => !obstacle.destructible),
    );
    syncEnemies([]);
    syncEnemyBullets([]);
    syncEnemyLasers([]);
    syncEnemyMissiles([]);
    resetBarrierState();
    if (stageRef.current === FINAL_STAGE && nextStageProgress >= getStageGoal(FINAL_STAGE)) {
      playSfx("clear");
      stopBgm();
      syncObstacles([]);
      setGameState("cleared");
      resetControls();
    } else if (nextStageProgress >= getStageGoal(stageRef.current)) {
      stageRef.current += 1;
      stageProgressRef.current = 0;
      obstacleTickRef.current = 0;
      setStage(stageRef.current);
      setStageProgress(0);
      playSfx("stage");
      startBgm(getStageDefinition(stageRef.current));
      syncObstacles([]);
      const advancedStageDef = getStageDefinition(stageRef.current);
      previousStageRef.current = stageRef.current;
      triggerStageTransition(
        stageRef.current,
        advancedStageDef.label,
        advancedStageDef.storyLabel,
      );
      const advancedSubStage = getSubStage(stageRef.current, 0);
      previousSubStageRef.current = advancedSubStage.globalNumber;
      setMessage(`Stage ${stageRef.current} へワープ！`);
    }
  }, [
    addBurst,
    getRescueGain,
    markBossCleared,
    playSfx,
    resetControls,
    resetBarrierState,
    startBgm,
    stopBgm,
    syncEnemies,
    syncEnemyBullets,
    syncEnemyLasers,
    syncEnemyMissiles,
    syncObstacles,
    triggerStageTransition,
  ]);

  const resetRun = useCallback(() => {
    frameRef.current = 0;
    spawnTickRef.current = 0;
    obstacleTickRef.current = 0;
    fireTickRef.current = 0;
    enemyIdRef.current = 1;
    obstacleIdRef.current = 1;
    bulletIdRef.current = 1;
    enemyBulletIdRef.current = 1;
    enemyLaserIdRef.current = 1;
    enemyMissileIdRef.current = 1;
    coinIdRef.current = 1;
    barrierItemIdRef.current = 1;
    burstIdRef.current = 1;
    seedRef.current = 20260507;
    bossMarkersRef.current = {};
    bossHpRef.current = {};
    previousSubStageRef.current = getSubStage(1, 0).globalNumber;
    previousStageRef.current = 1;
    setSubStageFlash(null);
    setStageTransition(null);
    resetControls();

    const initialPlayer = {
      x: WIDTH / 2 - PLAYER_SIZE / 2,
      y: HEIGHT - 100,
      speed: 6,
    };

    playerRef.current = initialPlayer;
    bulletsRef.current = [];
    enemyBulletsRef.current = [];
    enemyLasersRef.current = [];
    enemyMissilesRef.current = [];
    enemiesRef.current = [];
    coinsOnBoardRef.current = [];
    barrierItemsRef.current = [];
    barrierActiveRef.current = 0;
    barrierCooldownRef.current = 0;
    obstaclesRef.current = [];
    livesRef.current = MAX_LIVES;
    scoreRef.current = 0;
    coinsRef.current = 0;
    rescuedRef.current = 0;
    stageRef.current = 1;
    stageProgressRef.current = 0;
    selectedWeaponRef.current = "standard";
    bombsRef.current = 1;

    setPlayer(initialPlayer);
    setBullets([]);
    setEnemyBullets([]);
    setEnemyLasers([]);
    setEnemyMissiles([]);
    setEnemies([]);
    setCoinsOnBoard([]);
    setBarrierItems([]);
    setBarrierActiveFrames(0);
    setBarrierCooldownFrames(0);
    setObstacles([]);
    setBursts([]);
    setStars(createStars());
    setScore(0);
    setLives(MAX_LIVES);
    setCoins(0);
    setRescued(0);
    setStage(1);
    setStageProgress(0);
    setSelectedWeapon("standard");
    setBombs(1);
    setMessage("Shoot救出ミッション、開始！");
  }, [resetControls]);

  const startPlaying = useCallback(() => {
    resetRun();
    startBgm(STAGE_DEFINITIONS[0]);
    setGameState("playing");
  }, [resetRun, startBgm]);

  const startOpening = useCallback(() => {
    resetRun();
    ensureAudio();
    startBgm(STAGE_DEFINITIONS[0]);
    playSfx("stage");
    openingStartedAtRef.current = performance.now();
    setOpeningProgress(0);
    setGameState("opening");
  }, [ensureAudio, playSfx, resetRun, startBgm]);

  useEffect(() => {
    if (gameState !== "opening") return;

    let rafId = 0;
    const tick = (now: number) => {
      const nextProgress = clamp(
        (now - openingStartedAtRef.current) / OPENING_MS,
        0,
        1,
      );
      setOpeningProgress(nextProgress);
      if (nextProgress >= 1) {
        startPlaying();
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [gameState, startPlaying]);

  useEffect(() => {
    let rafId = 0;
    const resize = () => {
      window.cancelAnimationFrame(rafId);
      const nextViewportWidth = window.innerWidth;
      setViewportWidth(nextViewportWidth);
      rafId = window.requestAnimationFrame(() => {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (!rect) return;
        const heightLimit =
          nextViewportWidth < 768
            ? Math.max(340, Math.min(500, window.innerHeight * 0.54))
            : Math.max(560, Math.min(760, window.innerHeight * (isGameActive ? 0.82 : 0.88)));
        setBoardScale(
          Math.min(
            nextViewportWidth < 768 ? 1 : DESKTOP_BOARD_MAX_SCALE,
            rect.width / WIDTH,
            heightLimit / HEIGHT,
          ),
        );
      });
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(resize);

    resize();
    if (viewportRef.current) observer?.observe(viewportRef.current);
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [isGameActive]);

  useEffect(() => {
    const storedMuted = window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
    mutedRef.current = storedMuted;
    const timeoutId = window.setTimeout(() => setIsMuted(storedMuted), 0);
    return () => {
      window.clearTimeout(timeoutId);
      stopBgm();
    };
  }, [stopBgm]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSpace =
        event.key === " " || event.key === "Spacebar" || event.code === "Space";
      const isBomb = event.key.toLowerCase() === "b";
      const weaponIndex = /^[1-6]$/.test(event.key)
        ? Number(event.key) - 1
        : -1;
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
          event.key,
        ) ||
        isSpace ||
        isBomb ||
        weaponIndex >= 0
      ) {
        event.preventDefault();
      }
      keysRef.current[event.key] = true;
      if (isSpace) setControlPressed("Space", true);
      if (isBomb) setControlPressed("Bomb", true);

      if (isSpace && gameState === "idle") startOpening();
      if (isSpace && (gameState === "cleared" || gameState === "gameover")) {
        startOpening();
      }
      if (isBomb && gameState === "playing") triggerBomb();
      if (weaponIndex >= 0 && gameState === "playing") {
        selectWeapon(WEAPON_ORDER[weaponIndex]);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const isSpace =
        event.key === " " || event.key === "Spacebar" || event.code === "Space";
      keysRef.current[event.key] = false;
      if (isSpace) setControlPressed("Space", false);
      if (event.key.toLowerCase() === "b") setControlPressed("Bomb", false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", resetControls);
    document.addEventListener("visibilitychange", resetControls);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", resetControls);
      document.removeEventListener("visibilitychange", resetControls);
    };
  }, [
    gameState,
    resetControls,
    selectWeapon,
    setControlPressed,
    startOpening,
    triggerBomb,
  ]);

  useEffect(() => {
    if (!isPlaying) return;

    let rafId = 0;
    const loop = () => {
      frameRef.current += 1;
      spawnTickRef.current += 1;
      fireTickRef.current += 1;

      const keys = keysRef.current;
      const currentPlayer = playerRef.current;
      const nextPlayer = {
        ...currentPlayer,
        x: clamp(
          currentPlayer.x +
            (keys.ArrowLeft ? -currentPlayer.speed : 0) +
            (keys.ArrowRight ? currentPlayer.speed : 0),
          10,
          WIDTH - PLAYER_SIZE - 10,
        ),
        y: clamp(
          currentPlayer.y +
            (keys.ArrowUp ? -currentPlayer.speed : 0) +
            (keys.ArrowDown ? currentPlayer.speed : 0),
          12,
          HEIGHT - PLAYER_SIZE - 12,
        ),
      };
      syncPlayer(nextPlayer);

      const fireCooldown = WEAPON_DEFINITIONS[selectedWeaponRef.current].cooldown;
      if (
        (keys[" "] || keys.Space || keys.Spacebar) &&
        fireTickRef.current >= fireCooldown
      ) {
        fireTickRef.current = 0;
        fire();
      }

      if (keys.Bomb) {
        keys.Bomb = false;
        triggerBomb();
      }

      const activeSubStage = getSubStage(
        stageRef.current,
        stageProgressRef.current,
      );
      const modeDefinition = getGameModeDefinition(gameModeRef.current);
      const spawnInterval = Math.max(
        18,
        Math.round(activeSubStage.spawnInterval * modeDefinition.spawnIntervalMultiplier),
      );
      obstacleTickRef.current += 1;
      if (spawnTickRef.current >= spawnInterval) {
        const bossAlreadyVisible = enemiesRef.current.some(
          (enemy) => enemy.kind === "boss",
        );
        const checkpoint = getPendingCheckpoint(
          stageRef.current,
          stageProgressRef.current,
        );
        const boss = checkpoint
          ? getBossDefinition(stageRef.current, checkpoint)
          : undefined;
        const kind = checkpoint && !bossAlreadyVisible ? "boss" : "scout";
        const scoutCount = enemiesRef.current.filter(
          (enemy) => enemy.kind === "scout",
        ).length;
        const atEnemyLimit =
          modeDefinition.maxEnemies > 0 &&
          scoutCount >= modeDefinition.maxEnemies;
        const canSpawn = kind === "boss" || !atEnemyLimit;
        if (!canSpawn) {
          spawnTickRef.current = spawnInterval;
        } else {
          spawnTickRef.current = 0;
        const isStageBoss = kind === "boss" && checkpoint === "stage";
        const enemySize =
          kind === "boss" ? getBossSize(checkpoint) : {
            width: ENEMY_SIZE,
            height: ENEMY_SIZE,
          };
        const startX = isStageBoss
          ? Math.round((WIDTH - enemySize.width) / 2)
          : Math.round(
              createRandom(seedRef) * (WIDTH - enemySize.width - 36) + 18,
            );
        if (kind === "boss" && boss) {
          setMessage(`${boss.name} 出現！ ${boss.attackLabel} / ${boss.weaponLabel}`);
          playSfx("stage");
        }
        const bossMaxHp =
          kind === "boss" && boss
            ? Math.max(1, Math.round(boss.hp * modeDefinition.bossHpMultiplier))
            : modeDefinition.enemyHp;
        const bossKey =
          kind === "boss" && checkpoint
            ? getBossHpKey(stageRef.current, checkpoint)
            : undefined;
        const storedBossHp = bossKey ? bossHpRef.current[bossKey] : undefined;
        const initialHp =
          kind === "boss" && boss
            ? Math.min(bossMaxHp, Math.max(1, storedBossHp ?? bossMaxHp))
            : modeDefinition.enemyHp;
        if (bossKey && storedBossHp === undefined) {
          bossHpRef.current[bossKey] = initialHp;
        }
        syncEnemies([
          ...enemiesRef.current,
          {
            id: enemyIdRef.current++,
            x: startX,
            y: kind === "boss" ? (isStageBoss ? BOSS_RESERVED_Y : 142) : -76,
            anchorX: isStageBoss ? startX : undefined,
            phase: isStageBoss ? createRandom(seedRef) * Math.PI * 2 : undefined,
            speed:
              kind === "boss" && boss
                ? isStageBoss
                  ? 0
                  : 2.1 +
                    stageRef.current * 0.08 +
                    activeSubStage.enemySpeedBonus +
                    boss.speedBonus
                : 2.5 +
                  activeSubStage.enemySpeedBonus +
                  createRandom(seedRef) * 1.5,
            drift:
              isStageBoss
                ? 18 + stageRef.current * 2
                : (createRandom(seedRef) - 0.5) *
                  (kind === "boss" && boss ? boss.driftScale : 1.5),
            hp: initialHp,
            maxHp: bossMaxHp,
            kind,
            checkpoint: kind === "boss" ? checkpoint : undefined,
            boss: kind === "boss" ? boss : undefined,
            fireCooldown:
              kind === "boss" && boss
                ? Math.round(boss.attack.fireInterval * 0.6)
                : undefined,
            burstRemaining: 0,
          },
        ]);
        }
      }
      if (
        obstacleTickRef.current >= Math.max(52, spawnInterval + 18) &&
        obstaclesRef.current.length < 4
      ) {
        obstacleTickRef.current = 0;
        const obstacleId = obstacleIdRef.current++;
        const roll = createRandom(seedRef);
        const hasRuinsOnBoard = obstaclesRef.current.some(
          (obstacle) => obstacle.kind === "ruins",
        );
        const isRuins = !hasRuinsOnBoard && roll < 0.07;
        const destructible =
          isRuins || obstacleId % 4 !== 0 ? true : roll > 0.38;
        const laneWidth = WIDTH - OBSTACLE_SIZE - 48;
        const x = Math.round(createRandom(seedRef) * laneWidth + 24);
        syncObstacles([
          ...obstaclesRef.current,
          {
            id: obstacleId,
            x,
            y: -OBSTACLE_SIZE,
            speed: isRuins
              ? 1.4 + stageRef.current * 0.08
              : 1.8 + stageRef.current * 0.12 + createRandom(seedRef) * 0.8,
            hp: isRuins ? 3 : destructible ? 2 : 999,
            destructible,
            stageId: getStageDefinition(stageRef.current).id,
            kind: isRuins ? "ruins" : "normal",
          },
        ]);
      }

      setStars((current) =>
        current.map((star) => ({
          ...star,
          y: star.y + star.speed > HEIGHT ? -4 : star.y + star.speed,
        })),
      );

      const movedBullets = bulletsRef.current
        .map((bullet) => {
          if (bullet.weapon !== "snack-missile") {
            return {
              ...bullet,
              x: bullet.x + bullet.vx,
              y: bullet.y + bullet.vy,
            };
          }
          const target = enemiesRef.current
            .filter((enemy) => enemy.y > -100)
            .sort(
              (left, right) =>
                Math.abs(left.x - bullet.x) + Math.abs(left.y - bullet.y) -
                (Math.abs(right.x - bullet.x) + Math.abs(right.y - bullet.y)),
            )[0];
          if (!target) {
            return {
              ...bullet,
              x: bullet.x + bullet.vx,
              y: bullet.y + bullet.vy,
            };
          }
          const targetSize = getEnemySize(target);
          const dx = target.x + targetSize.width / 2 - bullet.x;
          const dy = target.y + targetSize.height / 2 - bullet.y;
          const length = Math.hypot(dx, dy) || 1;
          const speed = Math.max(5, Math.hypot(bullet.vx, bullet.vy));
          return {
            ...bullet,
            vx: (dx / length) * speed,
            vy: (dy / length) * speed,
            x: bullet.x + (dx / length) * speed,
            y: bullet.y + (dy / length) * speed,
          };
        })
        .filter((bullet) => bullet.y > -30 && bullet.x > -30 && bullet.x < WIDTH + 30);
      const usedBullets = new Set<number>();
      const spawnedEnemyBullets: EnemyBullet[] = [];
      const spawnedEnemyLasers: EnemyLaser[] = [];
      const spawnedEnemyMissiles: EnemyMissile[] = [];
      const nextEnemies: Enemy[] = [];
      const nextObstacles: Obstacle[] = [];
      const droppedCoins: Coin[] = [];
      const droppedBarrierItems: BarrierItem[] = [];
      let scoreGain = 0;
      let rescuedGain = 0;
      let playerHit = false;

      for (const enemy of enemiesRef.current) {
        const size = getEnemySize(enemy);
        const isStageBoss = enemy.kind === "boss" && enemy.checkpoint === "stage";
        const isFrozen = (enemy.freezeRemaining ?? 0) > 0;
        const remainingFreeze = Math.max(0, (enemy.freezeRemaining ?? 0) - 1);
        const stageBossX =
          (enemy.anchorX ?? enemy.x) +
          Math.sin(performance.now() / 720 + (enemy.phase ?? 0)) * enemy.drift;
        let updatedEnemy = {
          ...enemy,
          x: isFrozen
            ? enemy.x
            : isStageBoss
              ? clamp(stageBossX, 16, WIDTH - size.width - 16)
              : clamp(enemy.x + enemy.drift, 6, WIDTH - size.width - 6),
          y: isFrozen
            ? enemy.y
            : isStageBoss
              ? enemy.y
              : enemy.y + enemy.speed,
          freezeRemaining: remainingFreeze,
        };
        const enemyWidth = size.width;
        const enemyHeight = size.height;
        let destroyed = false;

        if (
          enemy.kind === "boss" &&
          enemy.boss &&
          updatedEnemy.y + enemyHeight > 0 &&
          updatedEnemy.y < HEIGHT - 80
        ) {
          const attack = enemy.boss.attack;
          const cooldown = (updatedEnemy.fireCooldown ?? 0) - 1;
          if (cooldown > 0) {
            updatedEnemy = { ...updatedEnemy, fireCooldown: cooldown };
          } else {
            const targetX = nextPlayer.x + PLAYER_SIZE / 2;
            const targetY = nextPlayer.y + PLAYER_SIZE / 2;
            const muzzles = getBossMuzzles(updatedEnemy, enemyWidth, isStageBoss);
            const burstRemaining = updatedEnemy.burstRemaining ?? 0;
            const baseSpeed = attack.bulletSpeed;

            const shots: Shot[] = [];
            let nextBurstRemaining = 0;
            let nextCooldown = attack.fireInterval;
            let nextFreezeRemaining = remainingFreeze;

            switch (attack.pattern) {
              case "aimed-1": {
                shots.push(aimedShot(muzzles.center, targetX, targetY, baseSpeed));
                break;
              }
              case "aimed-2": {
                shots.push(
                  aimedShot(muzzles.left, targetX, targetY, baseSpeed),
                  aimedShot(muzzles.right, targetX, targetY, baseSpeed),
                );
                break;
              }
              case "aimed-3": {
                shots.push(
                  aimedShot(muzzles.left, targetX, targetY, baseSpeed),
                  aimedShot(muzzles.center, targetX, targetY, baseSpeed),
                  aimedShot(muzzles.right, targetX, targetY, baseSpeed),
                );
                break;
              }
              case "spread-2": {
                shots.push(
                  angledShot(muzzles.left, -Math.PI / 6, baseSpeed),
                  angledShot(muzzles.right, Math.PI / 6, baseSpeed),
                );
                break;
              }
              case "ring-4": {
                const angles = [-Math.PI / 3, -Math.PI / 9, Math.PI / 9, Math.PI / 3];
                for (const angle of angles) {
                  shots.push(angledShot(muzzles.center, angle, baseSpeed));
                }
                break;
              }
              case "aimed-ring-6": {
                shots.push(aimedShot(muzzles.center, targetX, targetY, baseSpeed));
                const angles = [
                  -Math.PI / 2.4,
                  -Math.PI / 5,
                  -Math.PI / 12,
                  Math.PI / 12,
                  Math.PI / 5,
                ];
                for (const angle of angles) {
                  shots.push(angledShot(muzzles.center, angle, baseSpeed));
                }
                break;
              }
              case "cannon-burst-5": {
                shots.push(aimedShot(muzzles.center, targetX, targetY, baseSpeed));
                if (burstRemaining > 0) {
                  nextBurstRemaining = burstRemaining - 1;
                  nextCooldown = attack.burstInterval ?? 10;
                } else {
                  shots.push(
                    aimedShot(muzzles.left, targetX, targetY, baseSpeed),
                    aimedShot(muzzles.right, targetX, targetY, baseSpeed),
                  );
                  nextBurstRemaining = (attack.burstSize ?? 5) - 1;
                  nextCooldown = attack.burstInterval ?? 10;
                }
                if (nextBurstRemaining <= 0) {
                  nextCooldown = attack.fireInterval;
                }
                break;
              }
              case "aimed-laser": {
                const warning = 28;
                const active = 60;
                for (const muzzle of [muzzles.left, muzzles.right]) {
                  const dx = targetX - muzzle.x;
                  const dy = Math.max(40, targetY - muzzle.y);
                  const angle = Math.atan2(dx, dy);
                  spawnedEnemyLasers.push({
                    id: enemyLaserIdRef.current++,
                    x: muzzle.x,
                    y: muzzle.y,
                    angle,
                    angleStart: angle,
                    angleEnd: angle,
                    warningRemaining: warning,
                    activeRemaining: active,
                    totalActiveDuration: active,
                    width: 14,
                    hue: muzzle.hue,
                    hasHitPlayer: false,
                  });
                }
                nextFreezeRemaining = warning + active;
                break;
              }
              case "laser-sweep": {
                const warning = 32;
                const active = 96;
                const muzzle = muzzles.center;
                const dx = targetX - muzzle.x;
                const dy = Math.max(40, targetY - muzzle.y);
                const aimAngle = Math.atan2(dx, dy);
                const sweepHalf = Math.PI / 4;
                const start = aimAngle - sweepHalf;
                const end = aimAngle + sweepHalf;
                spawnedEnemyLasers.push({
                  id: enemyLaserIdRef.current++,
                  x: muzzle.x,
                  y: muzzle.y,
                  angle: start,
                  angleStart: start,
                  angleEnd: end,
                  warningRemaining: warning,
                  activeRemaining: active,
                  totalActiveDuration: active,
                  width: 18,
                  hue: muzzle.hue,
                  hasHitPlayer: false,
                });
                nextFreezeRemaining = warning + active;
                break;
              }
              case "homing-missile": {
                const sources = [muzzles.left, muzzles.right];
                for (const muzzle of sources) {
                  const dx = targetX - muzzle.x;
                  const dy = Math.max(40, targetY - muzzle.y);
                  const length = Math.hypot(dx, dy) || 1;
                  const speed = 3.2 + attack.bulletSpeed * 0.05;
                  spawnedEnemyMissiles.push({
                    id: enemyMissileIdRef.current++,
                    x: muzzle.x - MISSILE_SIZE / 2,
                    y: muzzle.y,
                    vx: (dx / length) * speed,
                    vy: (dy / length) * speed,
                    speed,
                    turnRate: 0.045,
                    hue: muzzle.hue === "warm" ? "warm" : "cool",
                    lifetime: 240,
                  });
                }
                break;
              }
            }

            for (const shot of shots) {
              spawnedEnemyBullets.push({
                id: enemyBulletIdRef.current++,
                x: shot.from.x - ENEMY_BULLET_SIZE / 2,
                y: shot.from.y,
                vx: shot.vx,
                vy: shot.vy,
                hue: shot.from.hue,
              });
            }

            updatedEnemy = {
              ...updatedEnemy,
              fireCooldown: nextCooldown,
              burstRemaining: nextBurstRemaining,
              freezeRemaining: nextFreezeRemaining,
            };
          }
        }

        for (const bullet of movedBullets) {
          if (usedBullets.has(bullet.id)) continue;
          const hit = rectsHit(
            { x: bullet.x, y: bullet.y, width: BULLET_WIDTH, height: BULLET_HEIGHT },
            { x: updatedEnemy.x, y: updatedEnemy.y, width: enemyWidth, height: enemyHeight },
          );
          if (!hit) continue;
          usedBullets.add(bullet.id);
          updatedEnemy = {
            ...updatedEnemy,
            hp: updatedEnemy.hp - Math.max(1, bullet.damage),
            freezeRemaining:
              bullet.weapon === "fridge-beam"
                ? Math.max(updatedEnemy.freezeRemaining ?? 0, 75)
                : updatedEnemy.freezeRemaining,
          };
          if (updatedEnemy.hp <= 0) {
            destroyed = true;
            scoreGain += updatedEnemy.boss?.score ?? 120;
            rescuedGain += getRescueGain(
              updatedEnemy,
              stageProgressRef.current + rescuedGain,
            );
            markBossCleared(updatedEnemy);
            addBurst(
              updatedEnemy.x,
              updatedEnemy.y,
              updatedEnemy.kind === "boss"
                ? updatedEnemy.checkpoint === "stage"
                  ? "CLEAR"
                  : "BOSS"
                : "+120",
            );
            if (createRandom(seedRef) > 0.42) {
              const rewardCoins =
                updatedEnemy.boss?.rewardCoins ??
                getSubStage(
                  stageRef.current,
                  stageProgressRef.current + rescuedGain,
                ).rewardCoins;
              for (let index = 0; index < rewardCoins; index += 1) {
                droppedCoins.push({
                  id: coinIdRef.current++,
                  x:
                    updatedEnemy.x +
                    enemyWidth / 2 -
                    COIN_SIZE / 2 +
                    (index - (rewardCoins - 1) / 2) * 18,
                  y: updatedEnemy.y + 12,
                  speed: 3.2,
                });
              }
            }
          }
          break;
        }

        if (destroyed) continue;

        if (updatedEnemy.kind === "boss" && updatedEnemy.checkpoint) {
          bossHpRef.current[getBossHpKey(stageRef.current, updatedEnemy.checkpoint)] =
            clamp(updatedEnemy.hp, 1, updatedEnemy.maxHp);
        }

        const hitsPlayer = rectsHit(
          { x: nextPlayer.x + 8, y: nextPlayer.y + 8, width: PLAYER_SIZE - 16, height: PLAYER_SIZE - 16 },
          { x: updatedEnemy.x, y: updatedEnemy.y, width: enemyWidth, height: enemyHeight },
        );

        if (hitsPlayer) {
          playerHit = true;
          addBurst(nextPlayer.x + 10, nextPlayer.y, "HIT");
          continue;
        }

        if (updatedEnemy.y < HEIGHT + 70) {
          nextEnemies.push(updatedEnemy);
        }
      }

      for (const obstacle of obstaclesRef.current) {
        let updatedObstacle = {
          ...obstacle,
          y: obstacle.y + obstacle.speed,
        };
        let destroyed = false;

        for (const bullet of movedBullets) {
          if (usedBullets.has(bullet.id)) continue;
          const hit = rectsHit(
            {
              x: bullet.x,
              y: bullet.y,
              width: BULLET_WIDTH,
              height: BULLET_HEIGHT,
            },
            {
              x: updatedObstacle.x,
              y: updatedObstacle.y,
              width: OBSTACLE_SIZE,
              height: OBSTACLE_SIZE,
            },
          );
          if (!hit) continue;
          usedBullets.add(bullet.id);
          if (updatedObstacle.destructible) {
            updatedObstacle = {
              ...updatedObstacle,
              hp: updatedObstacle.hp - Math.max(1, bullet.damage),
            };
            if (updatedObstacle.hp <= 0) {
              destroyed = true;
              scoreGain += updatedObstacle.kind === "ruins" ? 220 : 80;
              addBurst(
                updatedObstacle.x,
                updatedObstacle.y,
                updatedObstacle.kind === "ruins" ? "RELIC" : "BREAK",
              );
              if (updatedObstacle.kind === "ruins") {
                droppedBarrierItems.push({
                  id: barrierItemIdRef.current++,
                  x:
                    updatedObstacle.x +
                    OBSTACLE_SIZE / 2 -
                    BARRIER_ITEM_SIZE / 2,
                  y: updatedObstacle.y + 6,
                  speed: 2.6,
                });
              }
            }
          } else {
            addBurst(updatedObstacle.x, updatedObstacle.y, "BLOCK");
          }
          break;
        }

        if (destroyed) continue;

        const hitsPlayer = rectsHit(
          {
            x: nextPlayer.x + 10,
            y: nextPlayer.y + 10,
            width: PLAYER_SIZE - 20,
            height: PLAYER_SIZE - 20,
          },
          {
            x: updatedObstacle.x + 4,
            y: updatedObstacle.y + 4,
            width: OBSTACLE_SIZE - 8,
            height: OBSTACLE_SIZE - 8,
          },
        );

        if (hitsPlayer) {
          playerHit = true;
          addBurst(nextPlayer.x + 10, nextPlayer.y, "CRASH");
          continue;
        }

        if (updatedObstacle.y < HEIGHT + OBSTACLE_SIZE) {
          nextObstacles.push(updatedObstacle);
        }
      }

      const movedEnemyBullets = [
        ...enemyBulletsRef.current,
        ...spawnedEnemyBullets,
      ]
        .map((bullet) => ({
          ...bullet,
          x: bullet.x + bullet.vx,
          y: bullet.y + bullet.vy,
        }))
        .filter(
          (bullet) =>
            bullet.y < HEIGHT + 30 &&
            bullet.y > -30 &&
            bullet.x > -30 &&
            bullet.x < WIDTH + 30,
        );
      const nextEnemyBullets: EnemyBullet[] = [];
      for (const bullet of movedEnemyBullets) {
        const hitsPlayer = rectsHit(
          {
            x: nextPlayer.x + 8,
            y: nextPlayer.y + 8,
            width: PLAYER_SIZE - 16,
            height: PLAYER_SIZE - 16,
          },
          {
            x: bullet.x,
            y: bullet.y,
            width: ENEMY_BULLET_SIZE,
            height: ENEMY_BULLET_SIZE,
          },
        );
        if (hitsPlayer) {
          playerHit = true;
          addBurst(nextPlayer.x + 10, nextPlayer.y, "HIT");
          continue;
        }
        nextEnemyBullets.push(bullet);
      }

      if (spawnedEnemyBullets.length > 0) {
        playSfx("shoot");
      }

      const playerHitCircle = {
        x: nextPlayer.x + PLAYER_SIZE / 2,
        y: nextPlayer.y + PLAYER_SIZE / 2,
        r: PLAYER_SIZE / 2 - 10,
      };

      const nextEnemyLasers: EnemyLaser[] = [];
      for (const laser of [...enemyLasersRef.current, ...spawnedEnemyLasers]) {
        let warningRemaining = laser.warningRemaining;
        let activeRemaining = laser.activeRemaining;
        let angle = laser.angle;
        if (warningRemaining > 0) {
          warningRemaining -= 1;
        } else if (activeRemaining > 0) {
          if (laser.angleStart !== laser.angleEnd) {
            const progress =
              1 - activeRemaining / Math.max(1, laser.totalActiveDuration);
            angle =
              laser.angleStart +
              (laser.angleEnd - laser.angleStart) * progress;
          }
          activeRemaining -= 1;
        }

        const isActive = warningRemaining <= 0 && activeRemaining > 0;
        let hasHitPlayer = laser.hasHitPlayer;
        if (isActive && !hasHitPlayer) {
          const dirX = Math.sin(angle);
          const dirY = Math.cos(angle);
          const tx = playerHitCircle.x - laser.x;
          const ty = playerHitCircle.y - laser.y;
          const projection = tx * dirX + ty * dirY;
          if (projection >= 0 && projection <= LASER_BEAM_LENGTH) {
            const perpX = tx - projection * dirX;
            const perpY = ty - projection * dirY;
            const distSq = perpX * perpX + perpY * perpY;
            const limit = laser.width + playerHitCircle.r;
            if (distSq < limit * limit) {
              playerHit = true;
              hasHitPlayer = true;
              addBurst(nextPlayer.x + 10, nextPlayer.y, "BEAM");
            }
          }
        }

        if (warningRemaining > 0 || activeRemaining > 0) {
          nextEnemyLasers.push({
            ...laser,
            angle,
            warningRemaining,
            activeRemaining,
            hasHitPlayer,
          });
        }
      }

      const nextEnemyMissiles: EnemyMissile[] = [];
      for (const missile of [
        ...enemyMissilesRef.current,
        ...spawnedEnemyMissiles,
      ]) {
        const targetDx = playerHitCircle.x - (missile.x + MISSILE_SIZE / 2);
        const targetDy = playerHitCircle.y - (missile.y + MISSILE_SIZE / 2);
        const targetAngle = Math.atan2(targetDy, targetDx);
        const currentAngle = Math.atan2(missile.vy, missile.vx);
        let delta = targetAngle - currentAngle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        const turn =
          Math.max(-missile.turnRate, Math.min(missile.turnRate, delta));
        const newAngle = currentAngle + turn;
        const vx = Math.cos(newAngle) * missile.speed;
        const vy = Math.sin(newAngle) * missile.speed;
        const x = missile.x + vx;
        const y = missile.y + vy;
        const lifetime = missile.lifetime - 1;

        if (
          lifetime <= 0 ||
          x < -40 ||
          x > WIDTH + 40 ||
          y < -40 ||
          y > HEIGHT + 40
        ) {
          continue;
        }

        const hits = rectsHit(
          {
            x: nextPlayer.x + 8,
            y: nextPlayer.y + 8,
            width: PLAYER_SIZE - 16,
            height: PLAYER_SIZE - 16,
          },
          { x, y, width: MISSILE_SIZE, height: MISSILE_SIZE },
        );
        if (hits) {
          playerHit = true;
          addBurst(nextPlayer.x + 10, nextPlayer.y, "MISSILE");
          continue;
        }

        nextEnemyMissiles.push({
          ...missile,
          x,
          y,
          vx,
          vy,
          lifetime,
        });
      }

      if (spawnedEnemyLasers.length > 0 || spawnedEnemyMissiles.length > 0) {
        playSfx("stage");
      }

      const movedCoins = [...coinsOnBoardRef.current, ...droppedCoins]
        .map((coin) => ({ ...coin, y: coin.y + coin.speed }))
        .filter((coin) => coin.y < HEIGHT + 30);
      const nextCoinsOnBoard: Coin[] = [];
      let coinGain = 0;
      for (const coin of movedCoins) {
        const collected = rectsHit(
          { x: nextPlayer.x + 8, y: nextPlayer.y + 8, width: PLAYER_SIZE - 16, height: PLAYER_SIZE - 16 },
          { x: coin.x, y: coin.y, width: COIN_SIZE, height: COIN_SIZE },
        );
        if (collected) {
          coinGain += 1;
          addBurst(coin.x, coin.y, "COIN");
        } else {
          nextCoinsOnBoard.push(coin);
        }
      }

      const movedBarrierItems = [
        ...barrierItemsRef.current,
        ...droppedBarrierItems,
      ]
        .map((item) => ({ ...item, y: item.y + item.speed }))
        .filter((item) => item.y < HEIGHT + 30);
      const nextBarrierItems: BarrierItem[] = [];
      let activatedBarrierThisFrame = false;
      for (const item of movedBarrierItems) {
        const collected = rectsHit(
          {
            x: nextPlayer.x + 8,
            y: nextPlayer.y + 8,
            width: PLAYER_SIZE - 16,
            height: PLAYER_SIZE - 16,
          },
          {
            x: item.x,
            y: item.y,
            width: BARRIER_ITEM_SIZE,
            height: BARRIER_ITEM_SIZE,
          },
        );
        if (collected) {
          if (
            barrierActiveRef.current <= 0 &&
            barrierCooldownRef.current <= 0
          ) {
            activatedBarrierThisFrame = true;
            addBurst(item.x, item.y, "SHIELD");
          } else {
            addBurst(item.x, item.y, "—");
          }
        } else {
          nextBarrierItems.push(item);
        }
      }

      if (activatedBarrierThisFrame) {
        barrierActiveRef.current = BARRIER_ACTIVE_FRAMES;
        setMessage("バリア発動！3秒間ダメージ無効");
        playSfx("bomb");
      }

      if (barrierActiveRef.current > 0) {
        barrierActiveRef.current -= 1;
        if (barrierActiveRef.current === 0) {
          barrierCooldownRef.current = BARRIER_COOLDOWN_FRAMES;
          setMessage("バリア終了。クールタイム5秒");
        }
      } else if (barrierCooldownRef.current > 0) {
        barrierCooldownRef.current -= 1;
      }
      setBarrierActiveFrames(barrierActiveRef.current);
      setBarrierCooldownFrames(barrierCooldownRef.current);

      syncBullets(movedBullets.filter((bullet) => !usedBullets.has(bullet.id)));
      syncEnemyBullets(nextEnemyBullets);
      syncEnemyLasers(nextEnemyLasers);
      syncEnemyMissiles(nextEnemyMissiles);
      syncEnemies(nextEnemies);
      syncObstacles(nextObstacles);
      syncCoinsOnBoard(nextCoinsOnBoard);
      syncBarrierItems(nextBarrierItems);

      if (scoreGain > 0) {
        playSfx("hit");
        scoreRef.current += scoreGain;
        rescuedRef.current = Math.min(CLEAR_TARGET, rescuedRef.current + rescuedGain);
        const currentGoal = getStageGoal(stageRef.current);
        stageProgressRef.current = Math.min(
          currentGoal,
          stageProgressRef.current + rescuedGain,
        );
        setScore(scoreRef.current);
        setRescued(rescuedRef.current);
        setStageProgress(stageProgressRef.current);

        const newSubStage = getSubStage(
          stageRef.current,
          stageProgressRef.current,
        );
        if (newSubStage.globalNumber !== previousSubStageRef.current) {
          previousSubStageRef.current = newSubStage.globalNumber;
          triggerSubStageFlash(newSubStage.label, newSubStage.globalNumber);
        }
      }

      if (coinGain > 0) {
        playSfx("coin");
        coinsRef.current += coinGain;
        setCoins(coinsRef.current);
      }

      if (playerHit) {
        if (barrierActiveRef.current > 0) {
          addBurst(nextPlayer.x + 10, nextPlayer.y, "GUARD");
        } else {
          playSfx("hit");
          livesRef.current -= 1;
          setLives(livesRef.current);
          setMessage(livesRef.current > 0 ? "Shutyにダメージ！" : "Shoot救出ならず...");
          if (livesRef.current <= 0) {
            stopBgm();
            setGameState("gameover");
            resetControls();
            return;
          }
        }
      }

      if (stageProgressRef.current >= getStageGoal(stageRef.current)) {
        if (stageRef.current >= FINAL_STAGE) {
          setMessage("Shoot救出成功！");
          playSfx("clear");
          stopBgm();
          setGameState("cleared");
          resetControls();
          return;
        }

        stageRef.current += 1;
        stageProgressRef.current = 0;
        obstacleTickRef.current = 0;
        setStage(stageRef.current);
        setStageProgress(0);
        playSfx("stage");
        startBgm(getStageDefinition(stageRef.current));
        const advancedStageDef = getStageDefinition(stageRef.current);
        previousStageRef.current = stageRef.current;
        triggerStageTransition(
          stageRef.current,
          advancedStageDef.label,
          advancedStageDef.storyLabel,
        );
        const advancedSubStage = getSubStage(stageRef.current, 0);
        previousSubStageRef.current = advancedSubStage.globalNumber;
        setMessage(
          stageRef.current === FINAL_STAGE
            ? "最終ステージ！ワールドリフトを追い詰めよう"
            : `Stage ${stageRef.current} 到達。Maro-kunが補給中！`,
        );
        const unlockedWeapon = WEAPON_ORDER.find(
          (weaponId) =>
            WEAPON_DEFINITIONS[weaponId].unlockStage === stageRef.current,
        );
        if (unlockedWeapon) {
          const unlockedDefinition = WEAPON_DEFINITIONS[unlockedWeapon];
          setMessage(`${unlockedDefinition.label} 解放！`);
          if (stageRef.current === 2 && selectedWeaponRef.current === "standard") {
            selectedWeaponRef.current = unlockedWeapon;
            setSelectedWeapon(unlockedWeapon);
          }
        }
        if (stageRef.current === 3 && bombsRef.current === 0) {
          bombsRef.current = 1;
          setBombs(1);
        }
        syncEnemies([]);
        syncObstacles([]);
        syncBullets([]);
        syncEnemyBullets([]);
        syncEnemyLasers([]);
        syncEnemyMissiles([]);
        resetBarrierState();
      }

      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    addBurst,
    fire,
    getPendingCheckpoint,
    getRescueGain,
    isPlaying,
    markBossCleared,
    playSfx,
    resetBarrierState,
    resetControls,
    startBgm,
    stopBgm,
    syncBullets,
    syncCoinsOnBoard,
    syncEnemies,
    syncEnemyBullets,
    syncEnemyLasers,
    syncEnemyMissiles,
    syncBarrierItems,
    syncObstacles,
    syncPlayer,
    triggerBomb,
    triggerStageTransition,
    triggerSubStageFlash,
  ]);

  const overlay = useMemo(() => {
    if (gameState === "playing" || gameState === "opening") return null;

    const title =
      gameState === "cleared"
        ? "Shoot救出成功！"
        : gameState === "gameover"
          ? "もう一回、救出へ"
          : "ペンギンシューター";
    const text =
      gameState === "cleared"
            ? "PenとShutyが10ステージを突破。Shootを無事に救出しました。"
        : gameState === "gameover"
          ? "ステージごとに解放される武器を切り替えて、救出ルートを切り開こう。"
          : "10秒オープニングから始まる、Shoot救出ミッション。";

    return (
      <div style={styles.overlay}>
        <div style={styles.overlayPanel}>
          <div style={styles.overlayIcon}>
            {gameState === "cleared" ? "🐧🤝😾" : "🐧🚀"}
          </div>
          <h2 style={styles.overlayTitle}>{title}</h2>
          <p style={styles.overlayText}>{text}</p>
          <button type="button" onClick={startOpening} style={styles.primaryButton}>
            {gameState === "idle" ? "ミッション開始" : "リトライ"}
          </button>
        </div>
      </div>
    );
  }, [gameState, startOpening]);

  return (
    <main
      style={{
        ...styles.page,
        ...(isMobileLayout ? styles.pageMobile : {}),
        ...(isGameActive ? styles.pageActive : {}),
      }}
    >
      <div style={styles.shell}>
        <section style={{ ...styles.header, ...(isGameActive ? styles.headerActive : {}) }}>
          <span style={styles.eyebrow}>New bonus game</span>
          <h1 style={styles.title}>ペンギンシューター</h1>
          <p style={{ ...styles.lead, ...(isGameActive ? styles.leadActive : {}) }}>
            宇宙船Shutyに乗ったPenを操作して、捕まったShootを助けよう。
            10ステージを進み、解放された武器を切り替えて戦います。
          </p>
        </section>

        <div
          style={{
            ...styles.layout,
            ...(isMobileLayout ? styles.layoutMobile : {}),
            ...(!isGameActive ? styles.layoutState : styles.layoutActive),
          }}
        >
          <aside
            style={{
              ...styles.side,
              ...(isMobileLayout ? styles.sideMobile : {}),
              ...(!isGameActive ? styles.sideState : styles.sideHidden),
            }}
          >
            {isResultState ? (
              <>
                <section style={styles.resultCard} aria-label="ミッション結果">
                  <span style={styles.resultEyebrow}>
                    {gameState === "cleared" ? "MISSION COMPLETE" : "MISSION REPORT"}
                  </span>
                  <div style={styles.resultIcon}>{gameState === "cleared" ? "🐧🤝😾" : "🐧🚀"}</div>
                  <h2 style={styles.resultTitle}>
                    {gameState === "cleared" ? "Shoot救出成功！" : "救出ルートを再構築"}
                  </h2>
                  <p style={styles.resultText}>
                    {gameState === "cleared"
                      ? "10ステージを突破しました。今回の救出結果を確認できます。"
                      : "到達ステージとスコアを確認して、もう一度挑戦できます。"}
                  </p>
                  <div style={styles.resultStats}>
                    <div style={styles.resultStatsItem}><span>Score</span><strong>{score}</strong></div>
                    <div style={styles.resultStatsItem}><span>Stage</span><strong>{stage}/{FINAL_STAGE}</strong></div>
                    <div style={styles.resultStatsItem}><span>Rescue</span><strong>{rescued}/{CLEAR_TARGET}</strong></div>
                    <div style={styles.resultStatsItem}><span>Life</span><strong>{lives}/{MAX_LIVES}</strong></div>
                  </div>
                  <button type="button" onClick={startOpening} style={styles.primaryButton}>
                    リトライ
                  </button>
                </section>
                <ProgressGraph
                  stage={stage}
                  stageProgressPercent={stageProgressPercent}
                  completedStages={completedGraphStages}
                  rescued={rescued}
                />
              </>
            ) : null}
            <section
              style={{
                ...styles.card,
                ...(isResultState ? styles.hiddenPanel : {}),
              }}
            >
              <div style={styles.cardTitle}>Mission</div>
              <p style={styles.cardText}>
                10の大ステージ、全100小ステージを進み、最後のワールドリフトを倒すとShoot救出。
                Bキーまたはボムボタンで全画面ボムを使えます。
              </p>
              <div style={styles.statusList}>
                <div style={styles.statusRow}>
                  <span>Stage</span>
                  <strong>
                    {stage}/{FINAL_STAGE} {currentStage.label}
                  </strong>
                </div>
                <div style={styles.statusRow}>
                  <span>Small</span>
                  <strong>
                    {currentSubStage.globalNumber}/{CLEAR_TARGET}
                  </strong>
                </div>
                <div style={styles.statusRow}>
                  <span>Score</span>
                  <strong>{score}</strong>
                </div>
                <div style={styles.statusRow}>
                  <span>Life</span>
                  <strong>{lives}</strong>
                </div>
                <div style={styles.statusRow}>
                  <span>Coin</span>
                  <strong>{coins}</strong>
                </div>
                <div style={styles.statusRow}>
                  <span>Weapon</span>
                  <strong>{WEAPON_DEFINITIONS[selectedWeapon].shortLabel}</strong>
                </div>
                <div style={styles.statusRow}>
                  <span>Bomb</span>
                  <strong>{bombs}</strong>
                </div>
                <div style={styles.statusRow}>
                  <span>Audio</span>
                  <strong>{isMuted ? "Muted" : audioReady ? "On" : "Ready"}</strong>
                </div>
                <div style={styles.statusRow}>
                  <span>Mode</span>
                  <strong>{gameMode} · {currentGameMode.label}</strong>
                </div>
                <div style={styles.statusRow}>
                  <span>2P</span>
                  <strong>{twoPlayerUnlocked ? "Unlocked" : `${rescued}/${TWO_PLAYER_UNLOCK_STAGE}`}</strong>
                </div>
              </div>
              <section style={styles.weaponCard} aria-label="武器選択">
                <div style={styles.weaponCardTitle}>Weapon Loadout</div>
                <div style={styles.weaponGrid}>
                  {WEAPON_ORDER.map((weaponId, index) => {
                    const definition = WEAPON_DEFINITIONS[weaponId];
                    const unlocked = availableWeapons.includes(weaponId);
                    const selected = selectedWeapon === weaponId;
                    return (
                      <button
                        key={weaponId}
                        type="button"
                        aria-label={`${index + 1}: ${definition.label}`}
                        aria-pressed={selected}
                        disabled={!unlocked}
                        onClick={() => selectWeapon(weaponId)}
                        style={{
                          ...styles.weaponButton,
                          ...(selected ? styles.weaponButtonSelected : {}),
                          ...(!unlocked ? styles.weaponButtonLocked : {}),
                        }}
                      >
                        <span>{index + 1}. {definition.shortLabel}</span>
                        <small style={styles.weaponButtonSmall}>
                          {unlocked ? definition.description : `Stage ${definition.unlockStage}`}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </section>
              <section style={styles.modeCard} aria-label="ゲームモード選択">
                <div style={styles.modeCardHeader}>
                  <span>Game Mode</span>
                  <strong>{gameMode} · {currentGameMode.label}</strong>
                </div>
                <div style={styles.modeGrid}>
                  {Object.values(GAME_MODE_DEFINITIONS).map((mode) => (
                    <button
                      key={mode.mode}
                      type="button"
                      aria-label={`Mode ${mode.mode}: ${mode.description}`}
                      aria-pressed={gameMode === mode.mode}
                      disabled={gameState === "playing" || gameState === "opening"}
                      onClick={() => selectGameMode(mode.mode)}
                      style={{
                        ...styles.modeButton,
                        ...(gameMode === mode.mode ? styles.modeButtonSelected : {}),
                      }}
                    >
                      <span>{mode.mode}</span>
                      <small>{mode.label}</small>
                    </button>
                  ))}
                </div>
                <p style={styles.modeDescription}>{currentGameMode.description}</p>
              </section>
              <button
                type="button"
                onClick={gameState === "playing" ? triggerBomb : startOpening}
                style={{
                  ...styles.primaryButton,
                  ...(gameState === "playing" && bombs <= 0 ? styles.disabledButton : {}),
                }}
                disabled={gameState === "playing" && bombs <= 0}
              >
                {gameState === "playing" ? "ボム" : "開始"}
              </button>
              <button
                type="button"
                onClick={() => setMutedPreference(!isMuted)}
                style={styles.secondaryButton}
              >
                {isMuted ? "音を出す" : "ミュート"}
              </button>
            </section>

            <section
              style={{
                ...styles.progressCard,
                ...(isResultState ? styles.hiddenPanel : {}),
              }}
            >
              <div style={styles.bossPanel}>
                <span>Mid Boss: {currentStage.bosses.mid.name}</span>
                <strong>{currentStage.bosses.mid.attackLabel}</strong>
                <span>Stage Boss: {currentStage.bosses.stage.name}</span>
                <strong>{currentStage.bosses.stage.attackLabel}</strong>
              </div>
              <div style={styles.progressHeader}>
                <span>
                  {currentStage.storyLabel} / {currentSubStage.label}
                </span>
                <strong>
                  {stageProgress}/{currentStageGoal}
                </strong>
              </div>
              <div style={styles.rescueMeter}>
                <div style={{ ...styles.rescueFill, width: `${stageProgressPercent}%` }} />
              </div>
              <div style={{ ...styles.progressHeader, marginTop: 14 }}>
                <span>Total rescue</span>
                <strong>{rescueProgress}%</strong>
              </div>
              <div style={styles.rescueMeter}>
                <div style={{ ...styles.totalRescueFill, width: `${rescueProgress}%` }} />
              </div>
              <div style={styles.message}>{message}</div>
              {twoPlayerUnlocked ? (
                <div style={styles.unlockNotice}>2人プレイ解放済み</div>
              ) : null}
              <div style={styles.maroLine}>
                <span style={styles.maroIcon}>🧋</span>
                <span>
                  Maro-kun:{" "}
                  {stage >= 3
                    ? "補給OK。状況に合わせて武器を切り替えてね。"
                    : "Stage 2で3-Wayショットが解放されるよ。"}
                </span>
              </div>
            </section>
            {!isResultState ? (
              <ProgressGraph
                stage={stage}
                stageProgressPercent={stageProgressPercent}
                completedStages={completedGraphStages}
                rescued={rescued}
              />
            ) : null}
          </aside>

          <section
            style={{
              ...styles.gameCard,
              ...(isMobileLayout ? styles.gameCardMobile : {}),
              ...(isGameActive ? styles.gameCardActive : styles.gameCardHidden),
            }}
          >
            {isMobileLayout ? (
              <div style={styles.mobileStatusBar} aria-label="モバイルゲーム状況">
                <div style={styles.mobileStatusLine}>
                  <strong>STAGE {stage}/{FINAL_STAGE} {currentStage.label}</strong>
                  <strong>MODE {gameMode}</strong>
                  <span>SMALL {currentSubStage.globalNumber}/{CLEAR_TARGET}</span>
                  <span>SCORE {score}</span>
                  <span>🪙 {coins}</span>
                </div>
                <div
                  style={{
                    ...styles.mobileStatusLife,
                    ...(lives <= 3 ? styles.mobileStatusLifeDanger : {}),
                  }}
                  aria-live="polite"
                >
                  <strong>❤️ LIFE {lives}/{MAX_LIVES}</strong>
                  <span style={styles.lifePips} aria-hidden>
                    {Array.from({ length: MAX_LIVES }, (_, index) => (
                      <span
                        key={index}
                        style={{
                          ...styles.lifePip,
                          ...(index < lives ? styles.lifePipAlive : styles.lifePipLost),
                        }}
                      />
                    ))}
                  </span>
                  <span>Weapon: {WEAPON_DEFINITIONS[selectedWeapon].shortLabel}</span>
                  <span style={styles.mobileStatusBarrier}>
                    {barrierActiveFrames > 0
                      ? `🛡️ ${Math.ceil(barrierActiveFrames / 60)}s`
                      : barrierCooldownFrames > 0
                        ? `🛡️ CD ${Math.ceil(barrierCooldownFrames / 60)}s`
                        : "🛡️ Ready"}
                  </span>
                </div>
                {visibleBoss?.boss ? (
                  <div style={styles.mobileBossBand} aria-live="polite">
                    <div style={styles.mobileBossBandTitle}>
                      <span>
                        {visibleBoss.checkpoint === "stage" && stage === FINAL_STAGE
                          ? "FINAL BOSS"
                          : visibleBoss.checkpoint === "stage"
                            ? "STAGE BOSS"
                            : "MID BOSS"}
                      </span>
                      <strong>{visibleBoss.boss.name}</strong>
                    </div>
                    <div style={styles.mobileBossBandMeta}>
                      <span>
                        {visibleBoss.boss.attackLabel} / {visibleBoss.boss.weaponLabel}
                      </span>
                      <strong>
                        HP {Math.max(0, Math.round((visibleBoss.hp / Math.max(1, visibleBoss.maxHp)) * 100))}%
                      </strong>
                    </div>
                    <div style={styles.bossBannerMeter}>
                      <span
                        style={{
                          ...styles.bossBannerMeterFill,
                          width: `${Math.max(0, (visibleBoss.hp / Math.max(1, visibleBoss.maxHp)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div ref={viewportRef} style={styles.viewport}>
              <div
                style={{
                  ...styles.scaler,
                  width: WIDTH * boardScale,
                  height: HEIGHT * boardScale,
                }}
              >
                <div
                  style={{
                    ...styles.board,
                    background: boardBackground,
                    transform: `scale(${boardScale})`,
                  }}
                >
                  <div style={styles.skyGlow} />
                  <div
                    style={{
                      ...styles.stageAtmosphere,
                      background: visualTheme.atmosphere,
                    }}
                  />
                  <div
                    style={{
                      ...styles.stageDistantLayer,
                      background: visualTheme.distant,
                    }}
                  />
                  <div
                    style={{
                      ...styles.stageMidgroundLayer,
                      background: visualTheme.midground,
                    }}
                  />
                  <div
                    style={{
                      ...styles.stageForegroundLayer,
                      background: visualTheme.foreground,
                    }}
                  />
                  <div style={styles.stagePlanet}>
                    <span style={styles.stagePlanetLabel}>{stageTheme.label}</span>
                  </div>
                  {stars.map((star) => (
                    <div
                      key={star.id}
                      style={{
                        ...styles.star,
                        left: star.x,
                        top: star.y,
                        width: star.r,
                        height: star.r,
                      }}
                    />
                  ))}

                  <div
                    style={{
                      ...styles.hud,
                      ...(isMobileLayout ? styles.boardHudHiddenMobile : {}),
                    }}
                    aria-label="ゲーム進行状況"
                  >
                    <div style={styles.hudLine}>
                      <span>Stage {stage}/{FINAL_STAGE} {currentStage.label}</span>
                      <span>Mode {gameMode}</span>
                      <span>Small {currentSubStage.globalNumber}/{CLEAR_TARGET}</span>
                    </div>
                    <div style={styles.hudLine}>
                      <span>Score {score}</span>
                      <span>Coin {coins}</span>
                      <span>Weapon {WEAPON_DEFINITIONS[selectedWeapon].shortLabel}</span>
                    </div>
                  </div>
                  <div
                    style={{
                      ...styles.lifeHud,
                      ...(isMobileLayout ? styles.boardHudHiddenMobile : {}),
                      ...(lives <= 3 ? styles.lifeHudDanger : {}),
                    }}
                    aria-live="polite"
                    aria-label={`ライフ ${lives}/${MAX_LIVES}`}
                  >
                    <div style={styles.lifeHudHeader}>
                      <span>LIFE</span>
                      <strong>{lives}/{MAX_LIVES}</strong>
                    </div>
                    <div style={styles.lifePips} aria-hidden>
                      {Array.from({ length: MAX_LIVES }, (_, index) => (
                        <span
                          key={index}
                          style={{
                            ...styles.lifePip,
                            ...(index < lives ? styles.lifePipAlive : styles.lifePipLost),
                          }}
                        />
                      ))}
                    </div>
                    <span style={styles.lifeHudBarrier}>
                      {barrierActiveFrames > 0
                        ? `🛡️ ${Math.ceil(barrierActiveFrames / 60)}s`
                        : barrierCooldownFrames > 0
                          ? `🛡️ CD ${Math.ceil(barrierCooldownFrames / 60)}s`
                          : "🛡️ Ready"}
                    </span>
                  </div>
                  <div
                    style={{
                      ...styles.stageBanner,
                      ...(isMobileLayout ? styles.boardHudHiddenMobile : {}),
                      boxShadow: `0 0 22px ${stageTheme.accent}66`,
                    }}
                  >
                    <span>STAGE {stage}</span>
                    <strong>
                      {stage === FINAL_STAGE
                        ? `${stageTheme.label} / FINAL BOSS`
                        : `${currentSubStage.label} ${stageProgress}/${currentStageGoal}`}
                    </strong>
                  </div>
                  {visibleBoss?.boss ? (
                    <div
                      style={{
                        ...styles.bossBanner,
                        ...(isMobileLayout ? styles.boardHudHiddenMobile : {}),
                      }}
                      aria-live="polite"
                    >
                      <div style={styles.bossBannerTitle}>
                        {visibleBoss.checkpoint === "stage" && stage === FINAL_STAGE
                          ? "FINAL BOSS"
                          : visibleBoss.checkpoint === "stage"
                            ? "STAGE BOSS"
                            : "MID BOSS"}
                        <strong>{visibleBoss.boss.name}</strong>
                      </div>
                      <div style={styles.bossBannerMeta}>
                        <span>
                          {visibleBoss.boss.attackLabel} / {visibleBoss.boss.weaponLabel}
                        </span>
                        <strong>
                          HP {Math.max(0, Math.round((visibleBoss.hp / Math.max(1, visibleBoss.maxHp)) * 100))}%
                        </strong>
                      </div>
                      <div style={styles.bossBannerMeter}>
                        <span
                          style={{
                            ...styles.bossBannerMeterFill,
                            width: `${Math.max(0, (visibleBoss.hp / Math.max(1, visibleBoss.maxHp)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {subStageFlash ? (
                    <div
                      key={subStageFlash.key}
                      style={{
                        ...styles.subStageFlash,
                        borderColor: stageTheme.accent,
                        color: stageTheme.accent,
                      }}
                    >
                      <span>SMALL {subStageFlash.number}/{CLEAR_TARGET}</span>
                      <strong>{subStageFlash.label}</strong>
                    </div>
                  ) : null}

                  {stageTransition ? (
                    <div key={stageTransition.key} style={styles.stageWarpOverlay}>
                      <div
                        style={{
                          ...styles.stageWarpWipe,
                          background: `linear-gradient(90deg, transparent, ${stageTheme.accent}, transparent)`,
                        }}
                      />
                      <div
                        style={{
                          ...styles.stageWarpPanel,
                          borderColor: stageTheme.accent,
                          boxShadow: `0 0 36px ${stageTheme.accent}88`,
                        }}
                      >
                        <span style={styles.stageWarpEyebrow}>WARP IN</span>
                        <strong style={{ ...styles.stageWarpStage, color: stageTheme.accent }}>
                          STAGE {stageTransition.stage}
                        </strong>
                        <span style={styles.stageWarpLabel}>{stageTransition.label}</span>
                        <span style={styles.stageWarpStory}>{stageTransition.storyLabel}</span>
                      </div>
                    </div>
                  ) : null}

                  {bullets.map((bullet) => (
                    <div
                      key={bullet.id}
                      aria-label={`${WEAPON_DEFINITIONS[bullet.weapon].label}の弾`}
                      style={{
                        ...styles.bullet,
                        ...(bullet.weapon === "rainbow-laser"
                          ? styles.bulletLaser
                          : bullet.weapon === "snack-missile"
                            ? styles.bulletMissile
                            : bullet.weapon === "fridge-beam"
                              ? styles.bulletBeam
                              : bullet.weapon === "coin-cannon"
                                ? styles.bulletCannon
                                : {}),
                        left: bullet.x,
                        top: bullet.y,
                      }}
                    />
                  ))}

                  {enemyBullets.map((bullet) => (
                    <div
                      key={bullet.id}
                      style={{
                        ...styles.enemyBullet,
                        ...(bullet.hue === "warm"
                          ? styles.enemyBulletWarm
                          : bullet.hue === "cool"
                            ? styles.enemyBulletCool
                            : styles.enemyBulletWhite),
                        left: bullet.x,
                        top: bullet.y,
                      }}
                    />
                  ))}

                  {enemyLasers.map((laser) => {
                    const isActive =
                      laser.warningRemaining <= 0 && laser.activeRemaining > 0;
                    const angleDeg = (laser.angle * 180) / Math.PI;
                    return (
                      <div
                        key={laser.id}
                        style={{
                          ...styles.enemyLaser,
                          ...(isActive
                            ? laser.hue === "warm"
                              ? styles.enemyLaserWarm
                              : laser.hue === "cool"
                                ? styles.enemyLaserCool
                                : styles.enemyLaserWhite
                            : styles.enemyLaserWarning),
                          left: laser.x,
                          top: laser.y,
                          width: isActive ? laser.width * 2 : 4,
                          height: LASER_BEAM_LENGTH,
                          marginLeft: isActive ? -laser.width : -2,
                          transform: `rotate(${-angleDeg}deg)`,
                        }}
                      />
                    );
                  })}

                  {enemyMissiles.map((missile) => {
                    const angleDeg =
                      (Math.atan2(missile.vy, missile.vx) * 180) / Math.PI;
                    return (
                      <div
                        key={missile.id}
                        style={{
                          ...styles.enemyMissile,
                          ...(missile.hue === "warm"
                            ? styles.enemyMissileWarm
                            : styles.enemyMissileCool),
                          left: missile.x,
                          top: missile.y,
                          transform: `rotate(${angleDeg + 90}deg)`,
                        }}
                      />
                    );
                  })}

                  {enemies.map((enemy) => (
                    <EnemyView key={enemy.id} enemy={enemy} />
                  ))}

                  {obstacles.map((obstacle) => (
                    <ObstacleView key={obstacle.id} obstacle={obstacle} />
                  ))}

                  {coinsOnBoard.map((coin) => (
                    <div
                      key={coin.id}
                      aria-label="コイン"
                      style={{ ...styles.coin, left: coin.x, top: coin.y }}
                    >
                      🪙
                    </div>
                  ))}

                  {barrierItems.map((item) => (
                    <div
                      key={item.id}
                      aria-label="バリアアイテム"
                      style={{ ...styles.barrierItem, left: item.x, top: item.y }}
                    >
                      🛡️
                    </div>
                  ))}

                  {bursts.map((burst) => (
                    <div
                      key={burst.id}
                      style={{ ...styles.burst, left: burst.x, top: burst.y }}
                    >
                      {burst.label}
                    </div>
                  ))}

                  <div
                    style={{
                      ...styles.shootCage,
                      ...(stage === FINAL_STAGE ? styles.shootCageFinal : {}),
                    }}
                  >
                    <span style={styles.cageBeam} />
                    <span style={styles.cageFace}>😾</span>
                  </div>
                  <div style={styles.maroBeacon}>
                    <span style={styles.maroBeaconIcon}>🧋</span>
                    <span style={styles.maroBeaconText}>SUPPORT</span>
                  </div>
                  <Shuty player={player} powered={powered} />
                  {barrierActiveFrames > 0 ? (
                    <div
                      aria-hidden
                      style={{
                        ...styles.playerBarrier,
                        left: player.x - 10,
                        top: player.y - 10,
                      }}
                    />
                  ) : null}
                  {overlay}
                  {gameState === "opening" ? (
                    <OpeningScene
                      progress={openingProgress}
                      onSkip={startPlaying}
                    />
                  ) : null}
                </div>
              </div>
            </div>

            <div
              style={{
                ...styles.touchPanel,
                ...(isMobileLayout ? styles.touchPanelMobile : {}),
                ...(isGameActive ? styles.touchPanelActive : {}),
              }}
            >
              <div style={styles.touchTitle}>スマホ操作</div>
              <div style={styles.touchWeaponHeader}>
                <span>Weapon: {WEAPON_DEFINITIONS[selectedWeapon].shortLabel}</span>
                <span>数字キー 1〜6 / タップで切替</span>
              </div>
              <div
                style={{
                  ...styles.touchWeaponRow,
                  ...(viewportWidth >= 430 ? styles.touchWeaponWrap : {}),
                }}
              >
                {WEAPON_ORDER.map((weaponId, index) => {
                  const definition = WEAPON_DEFINITIONS[weaponId];
                  const unlocked = availableWeapons.includes(weaponId);
                  return (
                    <button
                      key={weaponId}
                      type="button"
                      aria-label={`${index + 1}: ${definition.label}`}
                      aria-pressed={selectedWeapon === weaponId}
                      disabled={!unlocked}
                      onClick={() => selectWeapon(weaponId)}
                      style={{
                        ...styles.touchWeaponButton,
                        ...(selectedWeapon === weaponId
                          ? styles.touchWeaponSelected
                          : {}),
                        ...(!unlocked ? styles.touchWeaponLocked : {}),
                      }}
                    >
                      {index + 1} {definition.shortLabel}
                    </button>
                  );
                })}
              </div>
              <div style={styles.touchGrid}>
                <Joystick
                  compact={isMobileLayout}
                  onDirectionChange={(directions) => {
                    setControlPressed("ArrowUp", directions.up);
                    setControlPressed("ArrowDown", directions.down);
                    setControlPressed("ArrowLeft", directions.left);
                    setControlPressed("ArrowRight", directions.right);
                  }}
                />
                <div style={styles.actionGrid}>
                  <TouchButton
                    label="発射"
                    accent
                    onPressChange={(pressed) => {
                      if (pressed && gameState === "idle") startOpening();
                      setControlPressed("Space", pressed);
                    }}
                  />
                  <TouchButton
                    label="ボム"
                    onPressChange={(pressed) => {
                      if (pressed) triggerBomb();
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        @keyframes penguinShooterFloat {
          from { opacity: 1; transform: translateY(0) scale(0.94); }
          to { opacity: 0; transform: translateY(-32px) scale(1.12); }
        }

        @keyframes penguinShooterPulse {
          0%, 100% { opacity: 0.45; transform: scaleY(0.92); }
          50% { opacity: 0.9; transform: scaleY(1.08); }
        }

        @keyframes penguinShooterBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        @keyframes penguinShooterStageBossHover {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.015); }
        }

        @keyframes penguinShooterLaserBlink {
          0%, 49% { opacity: 0.55; }
          50%, 100% { opacity: 1; }
        }

        @keyframes penguinShooterSubStageFlash {
          0% { opacity: 0; transform: translate(-50%, -8px); }
          25% { opacity: 1; transform: translate(-50%, 0); }
          75% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -4px); }
        }

        @keyframes penguinShooterStageWarp {
          0% { opacity: 0; transform: scale(0.6); }
          15% { opacity: 1; transform: scale(1); }
          70% { opacity: 1; transform: scale(1.04); }
          100% { opacity: 0; transform: scale(1.18); }
        }

        @keyframes penguinShooterStageWipe {
          0% { transform: translateX(-110%); }
          50% { transform: translateX(0); }
          100% { transform: translateX(110%); }
        }
      `}</style>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "22px 12px 56px",
    background:
      "radial-gradient(900px 360px at 12% 0%, rgba(34, 211, 238, 0.12), transparent 60%), linear-gradient(180deg, #f8fafc, #e0f2fe)",
  },
  pageMobile: {
    padding: `22px 12px ${MOBILE_PAGE_BOTTOM_PADDING}px`,
  },
  pageActive: {
    minHeight: 0,
    padding: "10px 12px 12px",
  },
  shell: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
  },
  header: {
    marginBottom: 18,
  },
  headerActive: {
    display: "none",
  },
  eyebrow: {
    display: "inline-flex",
    padding: "4px 9px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    fontSize: 11,
    fontWeight: 900,
  },
  title: {
    margin: "12px 0 8px",
    color: "#0f172a",
    fontSize: "clamp(30px, 5vw, 46px)",
    lineHeight: 1.08,
    letterSpacing: 0,
  },
  lead: {
    margin: 0,
    maxWidth: 720,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.7,
  },
  leadActive: {
    display: "none",
  },
  layout: {
    display: "grid",
    gap: 18,
    gridTemplateColumns: "minmax(240px, 280px) minmax(0, 1fr)",
  },
  layoutMobile: {
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 12,
  },
  layoutState: {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  layoutActive: {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  side: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  sideState: {
    width: "100%",
    maxWidth: 860,
    margin: "0 auto",
  },
  sideHidden: {
    display: "none",
  },
  sideMobile: {
    order: 2,
  },
  card: {
    borderRadius: 8,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    background: "rgba(15, 23, 42, 0.93)",
    color: "#f8fafc",
    padding: 18,
    boxShadow: "0 16px 34px rgba(15, 23, 42, 0.16)",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 900,
    marginBottom: 8,
  },
  cardText: {
    margin: 0,
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.65,
  },
  statusList: {
    display: "grid",
    gap: 8,
    marginTop: 16,
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 13,
    color: "#cbd5e1",
  },
  weaponCard: {
    marginTop: 16,
    paddingTop: 14,
    borderTop: "1px solid rgba(226, 232, 240, 0.16)",
  },
  weaponCardTitle: {
    marginBottom: 8,
    color: "#fef08a",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.8,
  },
  weaponGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 6,
  },
  weaponButton: {
    minHeight: 46,
    padding: "6px 7px",
    border: "1px solid rgba(125, 211, 252, 0.25)",
    borderRadius: 7,
    background: "rgba(30, 41, 59, 0.88)",
    color: "#e0f2fe",
    textAlign: "left",
    cursor: "pointer",
  },
  weaponButtonSelected: {
    border: "1px solid #facc15",
    background: "rgba(14, 116, 144, 0.72)",
    boxShadow: "0 0 14px rgba(250, 204, 21, 0.28)",
  },
  weaponButtonLocked: {
    opacity: 0.42,
    cursor: "not-allowed",
  },
  weaponButtonSmall: {
    display: "block",
    marginTop: 3,
    color: "#94a3b8",
    fontSize: 10,
  },
  modeCard: {
    marginTop: 16,
    paddingTop: 14,
    borderTop: "1px solid rgba(226, 232, 240, 0.16)",
  },
  modeCardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
    color: "#e0f2fe",
    fontSize: 12,
    fontWeight: 900,
  },
  modeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 5,
  },
  modeButton: {
    minHeight: 42,
    padding: "4px 2px",
    border: "1px solid rgba(125, 211, 252, 0.25)",
    borderRadius: 7,
    background: "rgba(30, 41, 59, 0.72)",
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  modeButtonSelected: {
    border: "1px solid #22d3ee",
    background: "rgba(14, 116, 144, 0.88)",
    color: "#ecfeff",
    boxShadow: "0 0 14px rgba(34, 211, 238, 0.24)",
  },
  modeDescription: {
    margin: "6px 0 0",
    color: "#94a3b8",
    fontSize: 10,
    lineHeight: 1.35,
  },
  primaryButton: {
    width: "100%",
    minHeight: 44,
    marginTop: 16,
    border: "none",
    borderRadius: 8,
    background: "#facc15",
    color: "#422006",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryButton: {
    width: "100%",
    minHeight: 38,
    marginTop: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(226, 232, 240, 0.34)",
    borderRadius: 8,
    background: "rgba(15, 23, 42, 0.25)",
    color: "#e0f2fe",
    fontWeight: 900,
    cursor: "pointer",
  },
  disabledButton: {
    opacity: 0.52,
    cursor: "not-allowed",
  },
  hiddenPanel: {
    display: "none",
  },
  resultCard: {
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.1)",
    background: "linear-gradient(145deg, #0f172a, #164e63)",
    color: "#f8fafc",
    padding: "24px clamp(18px, 4vw, 42px)",
    boxShadow: "0 20px 44px rgba(15, 23, 42, 0.2)",
  },
  resultEyebrow: {
    color: "#67e8f9",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.5,
  },
  resultIcon: {
    marginTop: 14,
    fontSize: 34,
  },
  resultTitle: {
    margin: "8px 0 6px",
    fontSize: "clamp(24px, 4vw, 34px)",
    lineHeight: 1.15,
  },
  resultText: {
    maxWidth: 560,
    margin: 0,
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.6,
  },
  resultStats: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 8,
    marginTop: 20,
  },
  resultStat: {
    display: "grid",
    gap: 4,
  },
  resultStatsItem: {
    display: "grid",
    gap: 4,
    padding: "10px 11px",
    borderRadius: 9,
    background: "rgba(255, 255, 255, 0.08)",
  },
  graphCard: {
    borderRadius: 12,
    border: "1px solid rgba(14, 116, 144, 0.18)",
    background: "rgba(255, 255, 255, 0.88)",
    padding: "14px 16px 12px",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
  },
  graphHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  graphEyebrow: {
    display: "block",
    color: "#0e7490",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.1,
  },
  graphTitle: {
    display: "block",
    marginTop: 3,
    color: "#0f172a",
    fontSize: 18,
  },
  graphSummary: {
    color: "#475569",
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  progressGraph: {
    display: "block",
    width: "100%",
    height: "auto",
    marginTop: 8,
    overflow: "visible",
  },
  graphLabel: {
    fill: "#64748b",
    fontSize: 9,
    fontWeight: 800,
  },
  graphLegend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 12px",
    color: "#64748b",
    fontSize: 10,
    fontWeight: 800,
  },
  graphLegendDot: {
    display: "inline-block",
    width: 7,
    height: 7,
    marginRight: 4,
    borderRadius: 999,
  },
  progressCard: {
    borderRadius: 8,
    border: "1px solid rgba(14, 116, 144, 0.16)",
    background: "rgba(255, 255, 255, 0.86)",
    padding: 16,
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    color: "#0f172a",
    fontSize: 13,
    marginBottom: 10,
  },
  rescueMeter: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    background: "#dbeafe",
  },
  rescueFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #22c55e, #facc15)",
    transition: "width 0.2s ease",
  },
  totalRescueFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #38bdf8, #a78bfa)",
    transition: "width 0.2s ease",
  },
  message: {
    marginTop: 12,
    minHeight: 36,
    color: "#0369a1",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.45,
  },
  bossPanel: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 4,
    marginBottom: 12,
    padding: "9px 10px",
    borderRadius: 8,
    background: "rgba(15, 23, 42, 0.06)",
    color: "#334155",
    fontSize: 12,
    fontWeight: 800,
  },
  unlockNotice: {
    marginTop: 10,
    padding: "8px 10px",
    borderRadius: 8,
    background: "rgba(250, 204, 21, 0.18)",
    color: "#854d0e",
    fontSize: 12,
    fontWeight: 900,
  },
  maroLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    padding: "9px 10px",
    borderRadius: 8,
    background: "rgba(14, 165, 233, 0.1)",
    color: "#075985",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.45,
  },
  maroIcon: {
    fontSize: 20,
    lineHeight: 1,
  },
  gameCard: {
    position: "relative",
    minWidth: 0,
    borderRadius: 8,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    background: "rgba(255, 255, 255, 0.82)",
    padding: 12,
    boxShadow: "0 16px 34px rgba(15, 23, 42, 0.1)",
  },
  gameCardMobile: {
    order: 1,
    padding: 8,
  },
  gameCardActive: {
    overflow: "hidden",
  },
  gameCardHidden: {
    display: "none",
  },
  mobileStatusBar: {
    display: "grid",
    gap: 7,
    marginBottom: 8,
    padding: "10px 11px",
    borderRadius: 10,
    background: "#0f172a",
    color: "#e0f2fe",
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.18)",
  },
  mobileStatusLine: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "4px 10px",
    fontSize: 11,
    lineHeight: 1.3,
  },
  mobileStatusLife: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
    paddingTop: 7,
    borderTop: "1px solid rgba(248, 113, 113, 0.35)",
    color: "#fecaca",
    fontSize: 11,
    lineHeight: 1.3,
  },
  mobileStatusLifeDanger: {
    color: "#fef08a",
  },
  mobileStatusBarrier: {
    color: "#bae6fd",
    fontWeight: 800,
  },
  mobileBossBand: {
    display: "grid",
    gap: 4,
    paddingTop: 7,
    borderTop: "1px solid rgba(251, 113, 133, 0.5)",
    color: "#f8fafc",
  },
  mobileBossBandTitle: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    color: "#fda4af",
    fontSize: 11,
    fontWeight: 900,
  },
  mobileBossBandMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    color: "#e2e8f0",
    fontSize: 10,
    fontWeight: 800,
  },
  boardHudHiddenMobile: {
    display: "none",
  },
  viewport: {
    width: "100%",
    overflow: "hidden",
  },
  scaler: {
    width: "100%",
    maxWidth: "100%",
    margin: "0 auto",
    position: "relative",
  },
  board: {
    position: "relative",
    width: WIDTH,
    height: HEIGHT,
    overflow: "hidden",
    borderRadius: 8,
    border: "1px solid rgba(148, 163, 184, 0.22)",
    background:
      "linear-gradient(180deg, #0f172a 0%, #075985 48%, #0f172a 100%)",
    transformOrigin: "top left",
  },
  stagePlanet: {
    position: "absolute",
    left: 26,
    bottom: 24,
    zIndex: 6,
    width: 154,
    height: 46,
    borderRadius: "50%",
    background:
      "linear-gradient(180deg, rgba(74, 222, 128, 0.64), rgba(14, 165, 233, 0.4))",
    boxShadow:
      "inset 0 8px 14px rgba(255, 255, 255, 0.18), 0 0 22px rgba(34, 197, 94, 0.22)",
  },
  stagePlanetLabel: {
    position: "absolute",
    left: 38,
    top: 14,
    color: "#dcfce7",
    fontSize: 12,
    fontWeight: 900,
    textShadow: "0 2px 8px rgba(15, 23, 42, 0.8)",
  },
  skyGlow: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 20% 8%, rgba(250, 204, 21, 0.22), transparent 24%), radial-gradient(circle at 80% 18%, rgba(236, 72, 153, 0.16), transparent 20%), radial-gradient(circle at 50% 82%, rgba(34, 197, 94, 0.12), transparent 26%)",
  },
  stageAtmosphere: {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    opacity: 0.95,
    pointerEvents: "none",
  },
  stageDistantLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 236,
    zIndex: 2,
    height: 172,
    opacity: 0.9,
    pointerEvents: "none",
    transform: "skewY(-1deg)",
  },
  stageMidgroundLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 118,
    zIndex: 3,
    height: 170,
    opacity: 0.86,
    pointerEvents: "none",
    clipPath: "polygon(0 30%, 100% 6%, 100% 100%, 0 100%)",
  },
  stageForegroundLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    height: 174,
    opacity: 0.88,
    pointerEvents: "none",
  },
  star: {
    position: "absolute",
    zIndex: 6,
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.84)",
  },
  hud: {
    position: "absolute",
    left: 14,
    top: 14,
    zIndex: 25,
    display: "grid",
    gap: 4,
    width: 286,
    maxWidth: "calc(100% - 180px)",
    padding: "9px 12px",
    borderRadius: 8,
    background: "rgba(15, 23, 42, 0.62)",
    color: "#e0f2fe",
    fontSize: 11,
    lineHeight: 1.25,
    backdropFilter: "blur(8px)",
  },
  hudLine: {
    display: "flex",
    flexWrap: "wrap",
    gap: "3px 10px",
  },
  lifeHud: {
    position: "absolute",
    left: 14,
    top: 62,
    zIndex: 25,
    display: "grid",
    gap: 4,
    width: 154,
    padding: "7px 10px",
    borderRadius: 9,
    border: "1px solid rgba(248, 113, 113, 0.52)",
    background: "rgba(69, 10, 10, 0.82)",
    color: "#fee2e2",
    boxShadow: "0 0 18px rgba(248, 113, 113, 0.18)",
    backdropFilter: "blur(8px)",
  },
  lifeHudDanger: {
    border: "1px solid rgba(254, 240, 138, 0.9)",
    background: "rgba(127, 29, 29, 0.92)",
    boxShadow: "0 0 24px rgba(250, 204, 21, 0.36)",
  },
  lifeHudHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.8,
  },
  lifePips: {
    display: "flex",
    gap: 3,
    minHeight: 8,
  },
  lifePip: {
    width: 10,
    height: 7,
    borderRadius: 999,
    border: "1px solid rgba(254, 226, 226, 0.44)",
  },
  lifePipAlive: {
    background: "#fb7185",
    boxShadow: "0 0 8px rgba(251, 113, 133, 0.72)",
  },
  lifePipLost: {
    background: "rgba(30, 41, 59, 0.8)",
  },
  lifeHudBarrier: {
    color: "#fecaca",
    fontSize: 10,
    fontWeight: 800,
  },
  stageBanner: {
    position: "absolute",
    right: 14,
    top: 14,
    zIndex: 25,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
    padding: "9px 12px",
    borderRadius: 8,
    background: "rgba(254, 243, 199, 0.9)",
    color: "#422006",
    fontSize: 12,
    fontWeight: 900,
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.12)",
  },
  bossBanner: {
    position: "absolute",
    left: "50%",
    top: 86,
    zIndex: 25,
    width: "min(460px, calc(100% - 28px))",
    transform: "translateX(-50%)",
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(251, 113, 133, 0.55)",
    background: "rgba(15, 23, 42, 0.78)",
    color: "#f8fafc",
    boxShadow: "0 0 24px rgba(251, 113, 133, 0.2)",
    backdropFilter: "blur(8px)",
  },
  bossBannerTitle: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    color: "#fda4af",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.8,
  },
  bossBannerMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 3,
    color: "#e2e8f0",
    fontSize: 10,
    fontWeight: 800,
  },
  bossBannerMeter: {
    height: 6,
    marginTop: 5,
    overflow: "hidden",
    borderRadius: 999,
    background: "rgba(148, 163, 184, 0.35)",
  },
  bossBannerMeterFill: {
    display: "block",
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #22c55e, #facc15, #fb7185)",
    transition: "width 0.12s ease",
  },
  subStageFlash: {
    position: "absolute",
    left: "50%",
    top: 70,
    zIndex: 26,
    transform: "translate(-50%, 0)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    padding: "6px 14px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    background: "rgba(15, 23, 42, 0.72)",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.6,
    pointerEvents: "none",
    animation: "penguinShooterSubStageFlash 0.9s ease-out forwards",
  },
  stageWarpOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 30,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    pointerEvents: "none",
    background:
      "radial-gradient(ellipse at 50% 50%, rgba(15, 23, 42, 0.42), rgba(15, 23, 42, 0.78))",
    animation: "penguinShooterStageWarp 1.9s ease-in-out forwards",
  },
  stageWarpWipe: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    animation: "penguinShooterStageWipe 1.9s ease-in-out forwards",
  },
  stageWarpPanel: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: "22px 36px",
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: "solid",
    background: "rgba(15, 23, 42, 0.84)",
    color: "#f8fafc",
  },
  stageWarpEyebrow: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 4,
    color: "#e2e8f0",
  },
  stageWarpStage: {
    fontSize: 38,
    fontWeight: 900,
    letterSpacing: 2,
    lineHeight: 1,
  },
  stageWarpLabel: {
    fontSize: 18,
    fontWeight: 800,
    color: "#fef08a",
    letterSpacing: 1,
  },
  stageWarpStory: {
    fontSize: 13,
    fontWeight: 600,
    color: "#cbd5e1",
    letterSpacing: 0.5,
  },
  bullet: {
    position: "absolute",
    zIndex: 18,
    width: BULLET_WIDTH,
    height: BULLET_HEIGHT,
    borderRadius: "999px 999px 4px 4px",
    background: "linear-gradient(180deg, #fef08a, #22d3ee)",
    boxShadow: "0 0 14px rgba(250, 204, 21, 0.82)",
  },
  bulletLaser: {
    width: 14,
    height: 30,
    borderRadius: 999,
    background: "linear-gradient(180deg, #fef08a, #f0abfc, #22d3ee)",
    boxShadow: "0 0 18px rgba(240, 171, 252, 0.92)",
  },
  bulletMissile: {
    width: 12,
    height: 22,
    borderRadius: "9px 9px 3px 3px",
    background: "linear-gradient(180deg, #fef3c7, #fb7185, #7c3aed)",
    boxShadow: "0 0 14px rgba(251, 113, 133, 0.82)",
  },
  bulletBeam: {
    width: 16,
    height: 26,
    borderRadius: "999px 999px 4px 4px",
    background: "linear-gradient(180deg, #ecfeff, #67e8f9, #0891b2)",
    boxShadow: "0 0 18px rgba(103, 232, 249, 0.9)",
  },
  bulletCannon: {
    width: 18,
    height: 32,
    borderRadius: 999,
    background: "linear-gradient(180deg, #fff7ed, #f59e0b, #b45309)",
    boxShadow: "0 0 20px rgba(245, 158, 11, 0.95)",
  },
  enemyBullet: {
    position: "absolute",
    zIndex: 17,
    width: ENEMY_BULLET_SIZE,
    height: ENEMY_BULLET_SIZE,
    borderRadius: 999,
  },
  enemyBulletWarm: {
    background: "radial-gradient(circle at 35% 35%, #fde68a, #f97316 60%, #7c2d12)",
    boxShadow: "0 0 12px rgba(249, 115, 22, 0.85)",
  },
  enemyBulletCool: {
    background: "radial-gradient(circle at 35% 35%, #bae6fd, #0ea5e9 60%, #1e3a8a)",
    boxShadow: "0 0 12px rgba(14, 165, 233, 0.85)",
  },
  enemyBulletWhite: {
    background: "radial-gradient(circle at 35% 35%, #ffffff, #e2e8f0 60%, #475569)",
    boxShadow: "0 0 14px rgba(248, 250, 252, 0.9)",
  },
  enemyLaser: {
    position: "absolute",
    zIndex: 17,
    transformOrigin: "50% 0%",
    pointerEvents: "none",
    borderRadius: 999,
  },
  enemyLaserWarning: {
    background:
      "linear-gradient(180deg, rgba(248, 113, 113, 0.95), rgba(248, 113, 113, 0.05))",
    boxShadow: "0 0 12px rgba(248, 113, 113, 0.7)",
    animation: "penguinShooterLaserBlink 0.18s steps(2) infinite",
  },
  enemyLaserWarm: {
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(249, 115, 22, 0.85) 18%, rgba(180, 83, 9, 0))",
    boxShadow:
      "0 0 22px rgba(249, 115, 22, 0.85), 0 0 8px rgba(255, 255, 255, 0.95)",
  },
  enemyLaserCool: {
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(14, 165, 233, 0.85) 18%, rgba(30, 58, 138, 0))",
    boxShadow:
      "0 0 22px rgba(14, 165, 233, 0.85), 0 0 8px rgba(255, 255, 255, 0.95)",
  },
  enemyLaserWhite: {
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(217, 70, 239, 0.78) 22%, rgba(76, 29, 149, 0))",
    boxShadow:
      "0 0 26px rgba(217, 70, 239, 0.85), 0 0 10px rgba(255, 255, 255, 0.95)",
  },
  enemyMissile: {
    position: "absolute",
    zIndex: 17,
    width: MISSILE_SIZE,
    height: MISSILE_SIZE,
    borderRadius: "12px 12px 4px 4px",
    transformOrigin: "50% 50%",
  },
  enemyMissileWarm: {
    background:
      "linear-gradient(180deg, #fde68a, #f97316 56%, #7c2d12)",
    boxShadow: "0 0 14px rgba(249, 115, 22, 0.8)",
  },
  enemyMissileCool: {
    background:
      "linear-gradient(180deg, #bae6fd, #0ea5e9 56%, #1e3a8a)",
    boxShadow: "0 0 14px rgba(14, 165, 233, 0.8)",
  },
  enemy: {
    position: "absolute",
    zIndex: 16,
    display: "grid",
    placeItems: "center",
    filter: "drop-shadow(0 8px 10px rgba(2, 6, 23, 0.42))",
    userSelect: "none",
  },
  bossEnemy: {
    fontSize: 43,
    animation: "penguinShooterBob 1.6s ease-in-out infinite",
  },
  midBossEnemy: {
    width: 84,
    height: 96,
  },
  stageBossEnemy: {
    width: 176,
    height: 132,
    animation: "penguinShooterStageBossHover 2.2s ease-in-out infinite",
    filter:
      "drop-shadow(0 16px 18px rgba(2, 6, 23, 0.5)) drop-shadow(0 0 22px rgba(250, 204, 21, 0.22))",
  },
  stageBossSvg: {
    position: "absolute",
    inset: 0,
    zIndex: 3,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%",
    filter: "drop-shadow(0 0 16px rgba(125, 211, 252, 0.58))",
  },
  bossAura: {
    position: "absolute",
    left: 8,
    top: 0,
    zIndex: 0,
    width: 68,
    height: 68,
    borderRadius: 999,
    background:
      "radial-gradient(circle, rgba(250, 204, 21, 0.36), rgba(217, 70, 239, 0.2) 46%, transparent 72%)",
    animation: "penguinShooterPulse 1.2s ease-in-out infinite",
  },
  stageBossAura: {
    left: 4,
    top: -2,
    width: 168,
    height: 112,
    background:
      "radial-gradient(ellipse, rgba(250, 204, 21, 0.34), rgba(217, 70, 239, 0.22) 48%, transparent 74%)",
  },
  bossRing: {
    position: "absolute",
    left: 14,
    top: 8,
    zIndex: 1,
    width: 56,
    height: 34,
    borderRadius: "50%",
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "rgba(250, 204, 21, 0.72)",
    boxShadow: "0 0 18px rgba(250, 204, 21, 0.4)",
    transform: "rotate(-8deg)",
  },
  stageBossRing: {
    left: 32,
    top: 18,
    width: 112,
    height: 58,
    borderColor: "rgba(125, 211, 252, 0.76)",
    boxShadow: "0 0 24px rgba(125, 211, 252, 0.42)",
  },
  midBossWingLeft: {
    position: "absolute",
    left: 8,
    top: 34,
    zIndex: 2,
    width: 24,
    height: 20,
    borderRadius: "16px 4px 14px 14px",
    background: "linear-gradient(180deg, #facc15, #fb7185)",
    transform: "rotate(14deg)",
  },
  midBossWingRight: {
    position: "absolute",
    right: 8,
    top: 34,
    zIndex: 2,
    width: 24,
    height: 20,
    borderRadius: "4px 16px 14px 14px",
    background: "linear-gradient(180deg, #22d3ee, #a78bfa)",
    transform: "rotate(-14deg)",
  },
  midBossCore: {
    position: "absolute",
    left: 22,
    top: 18,
    zIndex: 3,
    width: 40,
    height: 36,
    borderRadius: "50% 50% 42% 42%",
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "rgba(254, 243, 199, 0.82)",
    background:
      "radial-gradient(circle at 50% 36%, #fef08a 0 6px, transparent 7px), linear-gradient(180deg, #64748b, #1e293b)",
    boxShadow: "inset 0 8px 12px rgba(255, 255, 255, 0.18)",
  },
  stageBossDeck: {
    position: "absolute",
    left: 26,
    top: 34,
    zIndex: 3,
    width: 124,
    height: 50,
    borderRadius: "46px 46px 28px 28px",
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "rgba(226, 232, 240, 0.76)",
    background:
      "linear-gradient(180deg, rgba(226, 232, 240, 0.96), rgba(71, 85, 105, 0.96) 58%, rgba(15, 23, 42, 0.98))",
    boxShadow: "inset 0 11px 14px rgba(255, 255, 255, 0.24)",
  },
  stageBossCore: {
    position: "absolute",
    left: 66,
    top: 16,
    zIndex: 4,
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "rgba(254, 243, 199, 0.88)",
    background:
      "radial-gradient(circle at 50% 48%, #fef08a 0 9px, #22d3ee 10px 15px, #1e293b 16px)",
    boxShadow: "0 0 18px rgba(250, 204, 21, 0.44)",
  },
  stageBossWeaponLeft: {
    position: "absolute",
    left: 2,
    top: 50,
    zIndex: 2,
    width: 54,
    height: 24,
    borderRadius: "18px 6px 12px 18px",
    background: "linear-gradient(180deg, #facc15, #b45309)",
    transform: "rotate(8deg)",
  },
  stageBossWeaponRight: {
    position: "absolute",
    right: 2,
    top: 50,
    zIndex: 2,
    width: 54,
    height: 24,
    borderRadius: "6px 18px 18px 12px",
    background: "linear-gradient(180deg, #22d3ee, #2563eb)",
    transform: "rotate(-8deg)",
  },
  stageBossCannon: {
    position: "absolute",
    left: 77,
    top: 72,
    zIndex: 5,
    width: 22,
    height: 40,
    borderRadius: "8px 8px 16px 16px",
    background: "linear-gradient(180deg, #f8fafc, #475569)",
    boxShadow: "0 0 16px rgba(248, 250, 252, 0.34)",
  },
  bossName: {
    position: "absolute",
    left: "50%",
    top: -18,
    zIndex: 3,
    minWidth: 110,
    transform: "translateX(-50%)",
    padding: "3px 6px",
    borderRadius: 8,
    background: "rgba(15, 23, 42, 0.72)",
    color: "#fef08a",
    fontSize: 10,
    fontWeight: 900,
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  stageBossName: {
    top: -20,
    minWidth: 156,
    fontSize: 11,
    background: "rgba(15, 23, 42, 0.82)",
  },
  bossAttack: {
    position: "absolute",
    left: "50%",
    top: 76,
    zIndex: 3,
    minWidth: 92,
    transform: "translateX(-50%)",
    padding: "3px 6px",
    borderRadius: 8,
    background: "rgba(217, 70, 239, 0.72)",
    color: "#fdf4ff",
    fontSize: 10,
    fontWeight: 900,
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  stageBossAttack: {
    top: 112,
    minWidth: 166,
    background: "rgba(190, 24, 93, 0.78)",
  },
  bossHp: {
    position: "absolute",
    left: "50%",
    top: 62,
    zIndex: 4,
    width: 70,
    height: 7,
    transform: "translateX(-50%)",
    overflow: "hidden",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(254, 243, 199, 0.78)",
    background: "rgba(15, 23, 42, 0.68)",
  },
  stageBossHp: {
    top: 96,
    width: 132,
    height: 9,
  },
  bossHpFill: {
    display: "block",
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #22c55e, #facc15, #fb7185)",
    transition: "width 0.12s ease",
  },
  bossBeam: {
    position: "absolute",
    left: 31,
    top: 36,
    zIndex: 1,
    width: 22,
    height: 52,
    borderRadius: "0 0 999px 999px",
    background:
      "linear-gradient(180deg, rgba(250, 204, 21, 0.55), rgba(250, 204, 21, 0))",
    transformOrigin: "top center",
    animation: "penguinShooterPulse 1.1s ease-in-out infinite",
  },
  stageBossBeam: {
    position: "absolute",
    left: 78,
    top: 104,
    zIndex: 1,
    width: 20,
    height: 76,
    borderRadius: "0 0 999px 999px",
    background:
      "linear-gradient(180deg, rgba(248, 250, 252, 0.7), rgba(34, 211, 238, 0.46), rgba(34, 211, 238, 0))",
    transformOrigin: "top center",
    animation: "penguinShooterPulse 0.9s ease-in-out infinite",
  },
  obstacle: {
    position: "absolute",
    zIndex: 17,
    width: OBSTACLE_SIZE,
    height: OBSTACLE_SIZE,
    display: "grid",
    placeItems: "center",
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: "solid",
    filter: "drop-shadow(0 10px 12px rgba(2, 6, 23, 0.36))",
    userSelect: "none",
  },
  obstacleBreakable: {
    borderColor: "rgba(250, 204, 21, 0.74)",
    background:
      "linear-gradient(180deg, rgba(254, 243, 199, 0.86), rgba(251, 146, 60, 0.72))",
  },
  obstacleSolid: {
    borderColor: "rgba(203, 213, 225, 0.72)",
    background:
      "linear-gradient(180deg, rgba(100, 116, 139, 0.94), rgba(15, 23, 42, 0.9))",
  },
  obstacleRuins: {
    borderColor: "rgba(167, 139, 250, 0.85)",
    background:
      "linear-gradient(180deg, rgba(245, 208, 254, 0.88), rgba(124, 58, 237, 0.86))",
    boxShadow:
      "0 0 18px rgba(167, 139, 250, 0.55), inset 0 0 12px rgba(255, 255, 255, 0.28)",
  },
  obstacleIcon: {
    fontSize: 28,
    lineHeight: 1,
  },
  obstacleHp: {
    position: "absolute",
    left: 7,
    right: 7,
    bottom: 5,
    height: 5,
    overflow: "hidden",
    borderRadius: 999,
    background: "rgba(15, 23, 42, 0.48)",
  },
  obstacleHpFill: {
    display: "block",
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #22c55e, #facc15)",
    transition: "width 0.12s ease",
  },
  obstacleHpFillRuins: {
    background: "linear-gradient(90deg, #a78bfa, #f0abfc)",
  },
  barrierItem: {
    position: "absolute",
    zIndex: 16,
    width: BARRIER_ITEM_SIZE,
    height: BARRIER_ITEM_SIZE,
    fontSize: 24,
    lineHeight: 1,
    display: "grid",
    placeItems: "center",
    filter: "drop-shadow(0 0 10px rgba(96, 165, 250, 0.85))",
    animation: "penguinShooterPulse 1.2s ease-in-out infinite",
  },
  playerBarrier: {
    position: "absolute",
    zIndex: 19,
    width: PLAYER_SIZE + 20,
    height: PLAYER_SIZE + 20,
    borderRadius: 999,
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: "rgba(125, 211, 252, 0.85)",
    background:
      "radial-gradient(circle at 50% 50%, rgba(125, 211, 252, 0.12), rgba(125, 211, 252, 0.32) 70%, rgba(59, 130, 246, 0.05) 100%)",
    boxShadow:
      "0 0 18px rgba(125, 211, 252, 0.7), inset 0 0 18px rgba(186, 230, 253, 0.6)",
    pointerEvents: "none",
    animation: "penguinShooterPulse 0.8s ease-in-out infinite",
  },
  coin: {
    position: "absolute",
    zIndex: 15,
    width: COIN_SIZE,
    height: COIN_SIZE,
    fontSize: 20,
    lineHeight: 1,
    filter: "drop-shadow(0 0 8px rgba(250, 204, 21, 0.74))",
  },
  burst: {
    position: "absolute",
    zIndex: 30,
    color: "#fef08a",
    fontSize: 18,
    fontWeight: 900,
    textShadow: "0 2px 8px rgba(15, 23, 42, 0.8)",
    pointerEvents: "none",
    animation: "penguinShooterFloat 0.52s ease-out forwards",
  },
  shootCage: {
    position: "absolute",
    right: 24,
    top: 68,
    zIndex: 14,
    width: 58,
    height: 58,
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(250, 204, 21, 0.68)",
    background: "rgba(15, 23, 42, 0.42)",
    fontSize: 30,
  },
  shootCageFinal: {
    borderStyle: "solid",
    borderColor: "rgba(250, 204, 21, 0.95)",
    boxShadow: "0 0 22px rgba(250, 204, 21, 0.42)",
  },
  cageBeam: {
    position: "absolute",
    left: 25,
    top: -48,
    width: 8,
    height: 50,
    borderRadius: 999,
    background:
      "linear-gradient(180deg, rgba(250, 204, 21, 0), rgba(250, 204, 21, 0.72))",
    animation: "penguinShooterPulse 1.2s ease-in-out infinite",
  },
  cageFace: {
    position: "relative",
    zIndex: 2,
    lineHeight: 1,
  },
  maroBeacon: {
    position: "absolute",
    left: 24,
    bottom: 82,
    zIndex: 18,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 8px",
    borderRadius: 8,
    background: "rgba(224, 242, 254, 0.9)",
    color: "#075985",
    fontSize: 11,
    fontWeight: 900,
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.16)",
  },
  maroBeaconIcon: {
    fontSize: 18,
    lineHeight: 1,
  },
  maroBeaconText: {
    lineHeight: 1,
  },
  shuty: {
    position: "absolute",
    zIndex: 22,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    userSelect: "none",
    filter: "drop-shadow(0 10px 14px rgba(15, 23, 42, 0.45))",
  },
  shutyGlass: {
    position: "absolute",
    left: 15,
    top: 8,
    width: 36,
    height: 32,
    borderRadius: "50% 50% 42% 42%",
    background: "linear-gradient(180deg, #dffafe, #67e8f9)",
    border: "2px solid rgba(224, 242, 254, 0.9)",
  },
  penFace: {
    position: "absolute",
    left: 18,
    top: 4,
    zIndex: 3,
    fontSize: 31,
    lineHeight: 1,
  },
  shutyBody: {
    position: "absolute",
    left: 5,
    top: 35,
    width: 56,
    height: 22,
    borderRadius: "60% 60% 44% 44%",
    background: "linear-gradient(180deg, #f8fafc, #94a3b8 62%, #475569)",
    border: "1px solid rgba(226, 232, 240, 0.9)",
  },
  shutyWingLeft: {
    position: "absolute",
    left: 0,
    top: 43,
    width: 18,
    height: 12,
    borderRadius: "12px 4px 10px 12px",
    background: "#38bdf8",
  },
  shutyWingRight: {
    position: "absolute",
    right: 0,
    top: 43,
    width: 18,
    height: 12,
    borderRadius: "4px 12px 12px 10px",
    background: "#38bdf8",
  },
  shutyFlame: {
    position: "absolute",
    left: 27,
    top: 57,
    width: 12,
    height: 12,
    borderRadius: "0 0 999px 999px",
    background: "linear-gradient(180deg, #f97316, #fde047)",
    boxShadow: "0 0 16px rgba(250, 204, 21, 0.8)",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    zIndex: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(2, 6, 23, 0.5)",
    backdropFilter: "blur(2px)",
  },
  overlayPanel: {
    width: "min(86%, 380px)",
    borderRadius: 8,
    border: "1px solid rgba(226, 232, 240, 0.24)",
    background: "rgba(15, 23, 42, 0.9)",
    color: "#f8fafc",
    padding: "26px 22px",
    textAlign: "center",
    boxShadow: "0 18px 42px rgba(2, 6, 23, 0.34)",
  },
  overlayIcon: {
    fontSize: 52,
    marginBottom: 8,
  },
  overlayTitle: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.18,
  },
  overlayText: {
    margin: "10px 0 0",
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 1.65,
  },
  openingOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 45,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(2, 6, 23, 0.72)",
  },
  openingPanel: {
    width: "min(86%, 430px)",
    borderRadius: 8,
    border: "1px solid rgba(125, 211, 252, 0.34)",
    background: "linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(8, 47, 73, 0.94))",
    color: "#f8fafc",
    padding: 24,
    textAlign: "center",
  },
  openingKicker: {
    color: "#67e8f9",
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 12,
  },
  openingViewport: {
    position: "relative",
    height: 126,
    marginBottom: 14,
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(125, 211, 252, 0.24)",
    background:
      "linear-gradient(180deg, rgba(2, 6, 23, 0.55), rgba(8, 47, 73, 0.52))",
  },
  openingStarField: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 16% 24%, rgba(255,255,255,0.9) 0 2px, transparent 3px), radial-gradient(circle at 44% 58%, rgba(255,255,255,0.8) 0 1px, transparent 2px), radial-gradient(circle at 78% 28%, rgba(255,255,255,0.9) 0 2px, transparent 3px), radial-gradient(circle at 88% 70%, rgba(250,204,21,0.85) 0 2px, transparent 3px)",
  },
  openingTrail: {
    position: "absolute",
    left: "50%",
    top: 54,
    width: 128,
    height: 14,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(34, 211, 238, 0), rgba(34, 211, 238, 0.72), rgba(250, 204, 21, 0.68))",
    transition: "transform 0.18s ease, opacity 0.18s ease",
  },
  openingIcon: {
    position: "absolute",
    left: "50%",
    top: 24,
    zIndex: 2,
    width: 92,
    height: 72,
    marginLeft: -46,
    display: "grid",
    placeItems: "center",
    fontSize: 62,
    lineHeight: 1,
    transition: "transform 0.18s ease",
  },
  openingCutBadge: {
    position: "absolute",
    right: 10,
    top: 10,
    zIndex: 3,
    padding: "4px 7px",
    borderRadius: 8,
    background: "rgba(15, 23, 42, 0.7)",
    color: "#e0f2fe",
    fontSize: 11,
    fontWeight: 900,
  },
  openingTitle: {
    margin: 0,
    fontSize: 28,
  },
  openingText: {
    margin: "10px 0 16px",
    color: "#cbd5e1",
    lineHeight: 1.6,
  },
  openingCuts: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 6,
    marginBottom: 12,
  },
  openingCut: {
    height: 6,
    borderRadius: 999,
    background: "rgba(148, 163, 184, 0.28)",
  },
  openingCutActive: {
    background: "linear-gradient(90deg, #22d3ee, #facc15)",
  },
  openingMeter: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    background: "rgba(148, 163, 184, 0.28)",
  },
  openingMeterFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #22d3ee, #facc15)",
  },
  skipButton: {
    minWidth: 120,
    minHeight: 40,
    marginTop: 16,
    borderRadius: 8,
    border: "1px solid rgba(226, 232, 240, 0.24)",
    background: "rgba(255, 255, 255, 0.08)",
    color: "#f8fafc",
    fontWeight: 900,
    cursor: "pointer",
  },
  touchPanel: {
    marginTop: 12,
    borderRadius: 8,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    background: "rgba(248, 250, 252, 0.92)",
    padding: 12,
  },
  touchPanelMobile: {
    marginBottom: 20,
    padding: 10,
  },
  touchPanelActive: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 60,
    marginTop: 0,
    marginBottom: 0,
    background: "rgba(248, 250, 252, 0.9)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.2)",
  },
  touchTitle: {
    marginBottom: 10,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  touchWeaponHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
    color: "#475569",
    fontSize: 11,
    fontWeight: 800,
  },
  touchWeaponRow: {
    display: "flex",
    gap: 6,
    overflowX: "auto",
    paddingBottom: 8,
    scrollbarWidth: "thin",
  },
  touchWeaponWrap: {
    flexWrap: "wrap",
    overflowX: "visible",
  },
  touchWeaponButton: {
    flex: "0 0 auto",
    minHeight: 38,
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid rgba(14, 116, 144, 0.22)",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  touchWeaponSelected: {
    borderColor: "#0e7490",
    background: "#cffafe",
    boxShadow: "0 0 0 2px rgba(14, 116, 144, 0.12)",
  },
  touchWeaponLocked: {
    opacity: 0.42,
  },
  touchGrid: {
    display: "flex",
    gap: 12,
    maxWidth: 420,
    margin: "0 auto",
  },
  joystick: {
    flex: 1,
    minWidth: 0,
    height: 132,
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    border: "1px solid rgba(14, 116, 144, 0.2)",
    background:
      "radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.22), rgba(240, 249, 255, 0.96) 54%)",
    boxShadow: "inset 0 0 0 10px rgba(255, 255, 255, 0.35), 0 8px 18px rgba(15, 23, 42, 0.08)",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  },
  joystickCompact: {
    height: 108,
    borderRadius: 18,
  },
  joystickHint: {
    position: "absolute",
    top: 8,
    left: "50%",
    transform: "translateX(-50%)",
    color: "#0e7490",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 1.2,
    pointerEvents: "none",
  },
  joystickKnob: {
    width: 52,
    height: 52,
    borderRadius: 999,
    border: "2px solid rgba(14, 116, 144, 0.42)",
    background: "rgba(255, 255, 255, 0.96)",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.22), 0 0 0 6px rgba(34, 211, 238, 0.1)",
    pointerEvents: "none",
    transition: "transform 0.08s ease-out",
  },
  joystickKnobCompact: {
    width: 44,
    height: 44,
  },
  actionGrid: {
    width: "clamp(76px, 28%, 118px)",
    display: "grid",
    gap: 8,
  },
  touchButton: {
    minHeight: 46,
    borderRadius: 8,
    border: "1px solid rgba(14, 116, 144, 0.18)",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 900,
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.06)",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  },
  touchButtonAccent: {
    background: "#22d3ee",
    color: "#083344",
  },
  touchButtonPressed: {
    transform: "translateY(1px) scale(0.98)",
    boxShadow: "inset 0 2px 6px rgba(15, 23, 42, 0.1)",
  },
};
