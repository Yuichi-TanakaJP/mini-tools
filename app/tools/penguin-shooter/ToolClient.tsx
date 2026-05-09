"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  CLEAR_TARGET,
  FINAL_STAGE,
  MAX_LIVES,
  STAGE_DEFINITIONS,
  TWO_PLAYER_UNLOCK_STAGE,
  getBossDefinition,
  getStageDefinition,
  getStageGoal,
  getSubStage,
} from "./stageData";
import type { BossCheckpoint, BossDefinition, StageDefinition } from "./stageData";

const WIDTH = 720;
const HEIGHT = 820;
const PLAYER_SIZE = 66;
const ENEMY_SIZE = 46;
const BULLET_WIDTH = 8;
const BULLET_HEIGHT = 18;
const COIN_SIZE = 24;
const OPENING_MS = 10_000;
const STAR_COUNT = 56;
const MUTE_STORAGE_KEY = "penguin-shooter-muted";

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
};

type Enemy = {
  id: number;
  x: number;
  y: number;
  speed: number;
  drift: number;
  hp: number;
  kind: "scout" | "boss";
  checkpoint?: "mid" | "stage";
  boss?: BossDefinition;
};

type Coin = {
  id: number;
  x: number;
  y: number;
  speed: number;
};

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

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

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
    return (
      <div
        aria-label={bossName}
        style={{
          ...styles.enemy,
          ...styles.bossEnemy,
          left: enemy.x,
          top: enemy.y,
        }}
      >
        <span style={styles.bossBeam} />
        <span style={styles.bossBody}>🛸</span>
        <span style={styles.bossName}>{bossName}</span>
        <span style={styles.bossAttack}>{attackLabel}</span>
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

export default function ToolClient() {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [openingProgress, setOpeningProgress] = useState(0);
  const [player, setPlayer] = useState<Player>({
    x: WIDTH / 2 - PLAYER_SIZE / 2,
    y: HEIGHT - 100,
    speed: 6,
  });
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [coinsOnBoard, setCoinsOnBoard] = useState<Coin[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [stars, setStars] = useState<Star[]>(createStars);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [coins, setCoins] = useState(0);
  const [rescued, setRescued] = useState(0);
  const [stage, setStage] = useState(1);
  const [stageProgress, setStageProgress] = useState(0);
  const [weaponLevel, setWeaponLevel] = useState(1);
  const [bombs, setBombs] = useState(1);
  const [message, setMessage] = useState("Shuty、発進準備OK");
  const [boardScale, setBoardScale] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const frameRef = useRef(0);
  const spawnTickRef = useRef(0);
  const fireTickRef = useRef(0);
  const enemyIdRef = useRef(1);
  const bulletIdRef = useRef(1);
  const coinIdRef = useRef(1);
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

  const playerRef = useRef(player);
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const coinsOnBoardRef = useRef<Coin[]>([]);
  const livesRef = useRef(MAX_LIVES);
  const scoreRef = useRef(0);
  const coinsRef = useRef(0);
  const rescuedRef = useRef(0);
  const stageRef = useRef(1);
  const stageProgressRef = useRef(0);
  const weaponLevelRef = useRef(1);
  const bombsRef = useRef(1);

  const isPlaying = gameState === "playing";
  const powered = weaponLevel >= 2;
  const isMobileLayout = viewportWidth > 0 && viewportWidth < 768;
  const rescueProgress = Math.min(100, Math.round((rescued / CLEAR_TARGET) * 100));
  const currentStage = getStageDefinition(stage);
  const currentSubStage = getSubStage(stage, stageProgress);
  const currentStageGoal = currentStage.smallStages.length;
  const twoPlayerUnlocked = rescued >= TWO_PLAYER_UNLOCK_STAGE;
  const stageTheme = currentStage;
  const boardBackground = `linear-gradient(180deg, rgba(15, 23, 42, 0.22), rgba(15, 23, 42, 0.1)), url("${stageTheme.background}")`;
  const stageProgressPercent = Math.min(
    100,
    Math.round((stageProgress / currentStageGoal) * 100),
  );

  const syncPlayer = useCallback((next: Player) => {
    playerRef.current = next;
    setPlayer(next);
  }, []);

  const syncBullets = useCallback((next: Bullet[]) => {
    bulletsRef.current = next;
    setBullets(next);
  }, []);

  const syncEnemies = useCallback((next: Enemy[]) => {
    enemiesRef.current = next;
    setEnemies(next);
  }, []);

  const syncCoinsOnBoard = useCallback((next: Coin[]) => {
    coinsOnBoardRef.current = next;
    setCoinsOnBoard(next);
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

  const fire = useCallback(() => {
    const current = playerRef.current;
    const base = {
      x: current.x + PLAYER_SIZE / 2 - BULLET_WIDTH / 2,
      y: current.y + 14,
    };
    const nextBullets =
      weaponLevelRef.current >= 2
        ? [
            { id: bulletIdRef.current++, ...base, vx: 0, vy: -11 },
            { id: bulletIdRef.current++, ...base, vx: -3, vy: -10 },
            { id: bulletIdRef.current++, ...base, vx: 3, vy: -10 },
          ]
        : [{ id: bulletIdRef.current++, ...base, vx: 0, vy: -11 }];
    syncBullets([...bulletsRef.current, ...nextBullets]);
    playSfx("shoot");
  }, [playSfx, syncBullets]);

  const triggerBomb = useCallback(() => {
    if (bombsRef.current <= 0 || enemiesRef.current.length === 0) return;
    playSfx("bomb");
    bombsRef.current -= 1;
    setBombs(bombsRef.current);
    const destroyed = enemiesRef.current.length;
    const progressGain = enemiesRef.current.reduce(
      (sum, enemy) =>
        sum + getRescueGain(enemy, stageProgressRef.current + sum),
      0,
    );
    const nextScore = scoreRef.current + destroyed * 140;
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
    enemiesRef.current.forEach((enemy) => {
      markBossCleared(enemy);
      addBurst(enemy.x, enemy.y, "BOOM");
    });
    syncEnemies([]);
    if (stageRef.current === FINAL_STAGE && nextStageProgress >= getStageGoal(FINAL_STAGE)) {
      playSfx("clear");
      stopBgm();
      setGameState("cleared");
      resetControls();
    } else if (nextStageProgress >= getStageGoal(stageRef.current)) {
      stageRef.current += 1;
      stageProgressRef.current = 0;
      setStage(stageRef.current);
      setStageProgress(0);
      playSfx("stage");
      startBgm(getStageDefinition(stageRef.current));
      setMessage(`Stage ${stageRef.current} へワープ！`);
    }
  }, [
    addBurst,
    getRescueGain,
    markBossCleared,
    playSfx,
    resetControls,
    startBgm,
    stopBgm,
    syncEnemies,
  ]);

  const resetRun = useCallback(() => {
    frameRef.current = 0;
    spawnTickRef.current = 0;
    fireTickRef.current = 0;
    enemyIdRef.current = 1;
    bulletIdRef.current = 1;
    coinIdRef.current = 1;
    burstIdRef.current = 1;
    seedRef.current = 20260507;
    bossMarkersRef.current = {};
    resetControls();

    const initialPlayer = {
      x: WIDTH / 2 - PLAYER_SIZE / 2,
      y: HEIGHT - 100,
      speed: 6,
    };

    playerRef.current = initialPlayer;
    bulletsRef.current = [];
    enemiesRef.current = [];
    coinsOnBoardRef.current = [];
    livesRef.current = MAX_LIVES;
    scoreRef.current = 0;
    coinsRef.current = 0;
    rescuedRef.current = 0;
    stageRef.current = 1;
    stageProgressRef.current = 0;
    weaponLevelRef.current = 1;
    bombsRef.current = 1;

    setPlayer(initialPlayer);
    setBullets([]);
    setEnemies([]);
    setCoinsOnBoard([]);
    setBursts([]);
    setStars(createStars());
    setScore(0);
    setLives(MAX_LIVES);
    setCoins(0);
    setRescued(0);
    setStage(1);
    setStageProgress(0);
    setWeaponLevel(1);
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
    const resize = () => {
      setViewportWidth(window.innerWidth);
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const heightLimit = Math.max(360, window.innerHeight * 0.64);
      setBoardScale(Math.min(1, rect.width / WIDTH, heightLimit / HEIGHT));
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

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
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
          event.key,
        ) ||
        isSpace ||
        isBomb
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

      if ((keys[" "] || keys.Space || keys.Spacebar) && fireTickRef.current > 9) {
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
      const spawnInterval = activeSubStage.spawnInterval;
      if (spawnTickRef.current >= spawnInterval) {
        spawnTickRef.current = 0;
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
        const width = kind === "boss" ? 66 : ENEMY_SIZE;
        if (kind === "boss" && boss) {
          setMessage(`${boss.name} 出現！ ${boss.attackLabel}`);
          playSfx("stage");
        }
        syncEnemies([
          ...enemiesRef.current,
          {
            id: enemyIdRef.current++,
            x: Math.round(createRandom(seedRef) * (WIDTH - width - 36) + 18),
            y: -70,
            speed:
              kind === "boss" && boss
                ? 2.1 + stageRef.current * 0.08 + activeSubStage.enemySpeedBonus
                  + boss.speedBonus
                : 2.5 +
                  activeSubStage.enemySpeedBonus +
                  createRandom(seedRef) * 1.5,
            drift:
              (createRandom(seedRef) - 0.5) *
              (kind === "boss" && boss ? boss.driftScale : 1.5),
            hp: kind === "boss" && boss ? boss.hp : 1,
            kind,
            checkpoint: kind === "boss" ? checkpoint : undefined,
            boss: kind === "boss" ? boss : undefined,
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
        .map((bullet) => ({
          ...bullet,
          x: bullet.x + bullet.vx,
          y: bullet.y + bullet.vy,
        }))
        .filter((bullet) => bullet.y > -30 && bullet.x > -30 && bullet.x < WIDTH + 30);
      const usedBullets = new Set<number>();
      const nextEnemies: Enemy[] = [];
      const droppedCoins: Coin[] = [];
      let scoreGain = 0;
      let rescuedGain = 0;
      let playerHit = false;

      for (const enemy of enemiesRef.current) {
        let updatedEnemy = {
          ...enemy,
          x: clamp(enemy.x + enemy.drift, 6, WIDTH - (enemy.kind === "boss" ? 66 : ENEMY_SIZE) - 6),
          y: enemy.y + enemy.speed,
        };
        const enemyWidth = updatedEnemy.kind === "boss" ? 66 : ENEMY_SIZE;
        const enemyHeight = updatedEnemy.kind === "boss" ? 54 : ENEMY_SIZE;
        let destroyed = false;

        for (const bullet of movedBullets) {
          if (usedBullets.has(bullet.id)) continue;
          const hit = rectsHit(
            { x: bullet.x, y: bullet.y, width: BULLET_WIDTH, height: BULLET_HEIGHT },
            { x: updatedEnemy.x, y: updatedEnemy.y, width: enemyWidth, height: enemyHeight },
          );
          if (!hit) continue;
          usedBullets.add(bullet.id);
          updatedEnemy = { ...updatedEnemy, hp: updatedEnemy.hp - 1 };
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

      syncBullets(movedBullets.filter((bullet) => !usedBullets.has(bullet.id)));
      syncEnemies(nextEnemies);
      syncCoinsOnBoard(nextCoinsOnBoard);

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
      }

      if (coinGain > 0) {
        playSfx("coin");
        coinsRef.current += coinGain;
        setCoins(coinsRef.current);
        if (coinsRef.current >= 6 && weaponLevelRef.current === 1) {
          weaponLevelRef.current = 2;
          setWeaponLevel(2);
          setMessage("3-Way Spread Shot 解放！");
        }
      }

      if (playerHit) {
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
        setStage(stageRef.current);
        setStageProgress(0);
        playSfx("stage");
        startBgm(getStageDefinition(stageRef.current));
        setMessage(
          stageRef.current === FINAL_STAGE
            ? "最終ステージ！捕獲UFOを追い詰めよう"
            : `Stage ${stageRef.current} 到達。Maro-kunが補給中！`,
        );
        if (stageRef.current === 3 && bombsRef.current === 0) {
          bombsRef.current = 1;
          setBombs(1);
        }
        syncEnemies([]);
        syncBullets([]);
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
    resetControls,
    startBgm,
    stopBgm,
    syncBullets,
    syncCoinsOnBoard,
    syncEnemies,
    syncPlayer,
    triggerBomb,
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
        ? "PenとShutyが5ステージを突破。Shootを無事に救出しました。"
        : gameState === "gameover"
          ? "コインで3-Wayを早めに解放すると救出しやすくなります。"
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
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.header}>
          <span style={styles.eyebrow}>New bonus game</span>
          <h1 style={styles.title}>ペンギンシューター</h1>
          <p style={styles.lead}>
            宇宙船Shutyに乗ったPenを操作して、捕まったShootを助けよう。
            コインを集めると3-Wayショットへ強化されます。
          </p>
        </section>

        <div
          style={{
            ...styles.layout,
            ...(isMobileLayout ? styles.layoutMobile : {}),
          }}
        >
          <aside
            style={{
              ...styles.side,
              ...(isMobileLayout ? styles.sideMobile : {}),
            }}
          >
            <section style={styles.card}>
              <div style={styles.cardTitle}>Mission</div>
              <p style={styles.cardText}>
                5つの大ステージ、全100小ステージを進み、最後の捕獲UFOを倒すとShoot救出。
                Bキーまたはボムボタンで1回だけ全画面ボムを使えます。
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
                  <strong>{weaponLevel >= 2 ? "3-Way" : "Standard"}</strong>
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
                  <span>2P</span>
                  <strong>{twoPlayerUnlocked ? "Unlocked" : `${rescued}/${TWO_PLAYER_UNLOCK_STAGE}`}</strong>
                </div>
              </div>
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

            <section style={styles.progressCard}>
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
                    ? "補給OK。焦ったらボムだよ。"
                    : "コインを6枚集めると武器が広がるよ。"}
                </span>
              </div>
            </section>
          </aside>

          <section
            style={{
              ...styles.gameCard,
              ...(isMobileLayout ? styles.gameCardMobile : {}),
            }}
          >
            <div ref={viewportRef} style={styles.viewport}>
              <div style={{ ...styles.scaler, height: HEIGHT * boardScale }}>
                <div
                  style={{
                    ...styles.board,
                    background: boardBackground,
                    transform: `scale(${boardScale})`,
                  }}
                >
                  <div style={styles.skyGlow} />
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

                  <div style={styles.hud}>
                    Stage {stage}/{FINAL_STAGE} {currentStage.label} / Small{" "}
                    {currentSubStage.globalNumber}/{CLEAR_TARGET} / Score {score} /
                    Life {lives} / Coin {coins}
                  </div>
                  <div
                    style={{
                      ...styles.stageBanner,
                      boxShadow: `0 0 22px ${stageTheme.accent}66`,
                    }}
                  >
                    <span>STAGE {stage}</span>
                    <strong>
                      {stage === FINAL_STAGE
                        ? `${stageTheme.label} / Capture UFO`
                        : `${currentSubStage.label} ${stageProgress}/${currentStageGoal}`}
                    </strong>
                  </div>

                  {bullets.map((bullet) => (
                    <div
                      key={bullet.id}
                      style={{ ...styles.bullet, left: bullet.x, top: bullet.y }}
                    />
                  ))}

                  {enemies.map((enemy) => (
                    <EnemyView key={enemy.id} enemy={enemy} />
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

            <div style={styles.touchPanel}>
              <div style={styles.touchTitle}>スマホ操作</div>
              <div style={styles.touchGrid}>
                <div style={styles.dpadGrid}>
                  <span />
                  <TouchButton
                    label="↑"
                    onPressChange={(pressed) =>
                      setControlPressed("ArrowUp", pressed)
                    }
                  />
                  <span />
                  <TouchButton
                    label="←"
                    onPressChange={(pressed) =>
                      setControlPressed("ArrowLeft", pressed)
                    }
                  />
                  <TouchButton
                    label="↓"
                    onPressChange={(pressed) =>
                      setControlPressed("ArrowDown", pressed)
                    }
                  />
                  <TouchButton
                    label="→"
                    onPressChange={(pressed) =>
                      setControlPressed("ArrowRight", pressed)
                    }
                  />
                </div>
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
  shell: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
  },
  header: {
    marginBottom: 18,
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
  layout: {
    display: "grid",
    gap: 18,
    gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
  },
  layoutMobile: {
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 12,
  },
  side: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
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
  viewport: {
    width: "100%",
    overflow: "hidden",
  },
  scaler: {
    width: "100%",
    maxWidth: WIDTH,
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
    zIndex: 4,
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
  star: {
    position: "absolute",
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.84)",
  },
  hud: {
    position: "absolute",
    left: 14,
    top: 14,
    zIndex: 25,
    padding: "9px 12px",
    borderRadius: 8,
    background: "rgba(15, 23, 42, 0.62)",
    color: "#e0f2fe",
    fontSize: 13,
    backdropFilter: "blur(8px)",
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
  bullet: {
    position: "absolute",
    zIndex: 18,
    width: BULLET_WIDTH,
    height: BULLET_HEIGHT,
    borderRadius: "999px 999px 4px 4px",
    background: "linear-gradient(180deg, #fef08a, #22d3ee)",
    boxShadow: "0 0 14px rgba(250, 204, 21, 0.82)",
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
    width: 72,
    height: 82,
    fontSize: 43,
    animation: "penguinShooterBob 1.6s ease-in-out infinite",
  },
  bossBody: {
    position: "relative",
    zIndex: 2,
    lineHeight: 1,
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
  bossAttack: {
    position: "absolute",
    left: "50%",
    top: 70,
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
  bossBeam: {
    position: "absolute",
    left: 26,
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
  touchTitle: {
    marginBottom: 10,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  touchGrid: {
    display: "flex",
    gap: 12,
    maxWidth: 420,
    margin: "0 auto",
  },
  dpadGrid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
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
