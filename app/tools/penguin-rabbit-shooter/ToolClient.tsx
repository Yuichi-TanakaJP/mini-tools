"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

const WIDTH = 720;
const HEIGHT = 880;
const PLAYER_SIZE = 44;
const BULLET_WIDTH = 6;
const BULLET_HEIGHT = 18;
const ENEMY_WIDTH = 42;
const ENEMY_HEIGHT = 38;
const STAR_COUNT = 40;
const COMPACT_PORTRAIT_MAX_WIDTH = 500;
const TOUCH_PANEL_MIN_VIEWPORT = 768;

type GameState = "idle" | "playing" | "gameover";

type Player = {
  x: number;
  y: number;
  speed: number;
};

type Bullet = {
  id: number;
  x: number;
  y: number;
  speed: number;
};

type Enemy = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  drift: number;
  hp: number;
};

type Explosion = {
  id: number;
  x: number;
  y: number;
};

type Star = {
  id: number;
  x: number;
  y: number;
  r: number;
  speed: number;
};

type ControlKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Space";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function createStars(): Star[] {
  return Array.from({ length: STAR_COUNT }, (_, index) => ({
    id: index,
    x: pseudoRandom(index + 1) * WIDTH,
    y: pseudoRandom(index + 101) * HEIGHT,
    r: pseudoRandom(index + 201) * 2 + 1,
    speed: pseudoRandom(index + 301) * 1.5 + 0.5,
  }));
}

function createEnemy(id: number, level = 1, immediate = false): Enemy {
  return {
    id,
    x: Math.random() * (WIDTH - ENEMY_WIDTH - 40) + 20,
    y: immediate ? Math.random() * 180 + 20 : -Math.random() * 220 - ENEMY_HEIGHT,
    width: ENEMY_WIDTH,
    height: ENEMY_HEIGHT,
    speed: 2 + Math.random() * 1.8 + level * 0.18,
    drift: (Math.random() - 0.5) * 1.6,
    hp: 1 + Math.floor((level - 1) / 4),
  };
}

function Penguin({ x, y, invincible }: { x: number; y: number; invincible: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        zIndex: 20,
        left: x,
        top: y,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        fontSize: 40,
        lineHeight: 1,
        opacity: invincible ? 0.7 : 1,
        transform: invincible ? "scale(1.08)" : "scale(1)",
        transition: "transform 0.15s ease, opacity 0.15s ease",
        filter:
          "drop-shadow(0 10px 14px rgba(15, 23, 42, 0.55)) drop-shadow(0 0 14px rgba(255,255,255,0.2))",
      }}
    >
      <span style={{ transform: "translateY(-1px)" }}>🐧</span>
    </div>
  );
}

function Bunny({ enemy }: { enemy: Enemy }) {
  return (
    <div
      style={{
        position: "absolute",
        zIndex: 10,
        left: enemy.x,
        top: enemy.y,
        width: enemy.width,
        height: enemy.height,
        userSelect: "none",
        fontSize: 34,
        filter: "drop-shadow(0 6px 8px rgba(236, 72, 153, 0.35))",
      }}
    >
      🐰
    </div>
  );
}

function BulletView({ bullet }: { bullet: Bullet }) {
  return (
    <div
      style={{
        position: "absolute",
        zIndex: 20,
        left: bullet.x,
        top: bullet.y,
        width: BULLET_WIDTH,
        height: BULLET_HEIGHT,
        borderRadius: 999,
        background: "#67e8f9",
        boxShadow: "0 0 14px rgba(103, 232, 249, 0.85)",
      }}
    />
  );
}

function ExplosionView({ x, y }: { x: number; y: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: 30,
        pointerEvents: "none",
        fontSize: 24,
        animation: "penguinShooterPing 0.25s ease-out",
      }}
    >
      ✨
    </div>
  );
}

export default function ToolClient() {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [player, setPlayer] = useState<Player>({
    x: WIDTH / 2 - PLAYER_SIZE / 2,
    y: HEIGHT - 110,
    speed: 6,
  });
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [bestScore, setBestScore] = useState(0);
  const [stars, setStars] = useState<Star[]>(createStars);
  const [message, setMessage] = useState("ペンギン出撃準備OK");
  const [isInvincible, setIsInvincible] = useState(false);
  const [boardScale, setBoardScale] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const gameViewportRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const frameRef = useRef(0);
  const spawnTickRef = useRef(0);
  const bulletTickRef = useRef(0);
  const playerRef = useRef<Player>({
    x: WIDTH / 2 - PLAYER_SIZE / 2,
    y: HEIGHT - 110,
    speed: 6,
  });
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const levelRef = useRef(1);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const invincibleRef = useRef(false);
  const invincibleTimeoutRef = useRef<number | null>(null);
  const enemyIdRef = useRef(1);
  const explosionIdRef = useRef(1);

  const setControlPressed = useCallback((key: ControlKey, pressed: boolean) => {
    keysRef.current[key] = pressed;
    if (key === "Space") {
      keysRef.current[" "] = pressed;
      keysRef.current.Spacebar = pressed;
    }
  }, []);

  const resetControls = useCallback(() => {
    keysRef.current = {};
  }, []);

  function syncPlayer(next: Player) {
    playerRef.current = next;
    setPlayer(next);
  }

  function syncBullets(next: Bullet[]) {
    bulletsRef.current = next;
    setBullets(next);
  }

  function syncEnemies(next: Enemy[]) {
    enemiesRef.current = next;
    setEnemies(next);
  }

  const fireBullet = useCallback(() => {
    const currentPlayer = playerRef.current;
    syncBullets([
      ...bulletsRef.current,
      {
        id: Date.now() + Math.random(),
        x: currentPlayer.x + PLAYER_SIZE / 2 - BULLET_WIDTH / 2,
        y: currentPlayer.y - 8,
        speed: 10,
      },
    ]);
  }, []);

  const startGame = useCallback(() => {
    frameRef.current = 0;
    spawnTickRef.current = 0;
    bulletTickRef.current = 0;
    enemyIdRef.current = 1;
    explosionIdRef.current = 1;
    levelRef.current = 1;
    scoreRef.current = 0;
    livesRef.current = 3;
    invincibleRef.current = false;
    resetControls();
    if (invincibleTimeoutRef.current !== null) {
      window.clearTimeout(invincibleTimeoutRef.current);
      invincibleTimeoutRef.current = null;
    }

    const initialPlayer = {
      x: WIDTH / 2 - PLAYER_SIZE / 2,
      y: HEIGHT - 110,
      speed: 6,
    };

    syncPlayer(initialPlayer);
    syncBullets([]);
    syncEnemies([
      createEnemy(enemyIdRef.current++, 1, true),
      createEnemy(enemyIdRef.current++, 1, true),
      createEnemy(enemyIdRef.current++, 1, true),
    ]);
    setExplosions([]);
    setScore(0);
    setLives(3);
    setLevel(1);
    setStars(createStars());
    setIsInvincible(false);
    setMessage("発進！うさぎ軍団をかわそう");
    setGameState("playing");
  }, [resetControls]);

  useEffect(() => {
    const clearControls = () => {
      resetControls();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const isSpace =
        event.key === " " || event.key === "Spacebar" || event.code === "Space";

      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) ||
        isSpace
      ) {
        event.preventDefault();
      }

      keysRef.current[event.key] = true;
      if (isSpace) {
        setControlPressed("Space", true);
      }

      if (isSpace && gameState === "idle") {
        startGame();
        return;
      }

      if (isSpace && gameState === "playing" && bulletTickRef.current >= 8) {
        bulletTickRef.current = 0;
        fireBullet();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const isSpace =
        event.key === " " || event.key === "Spacebar" || event.code === "Space";
      keysRef.current[event.key] = false;
      if (isSpace) {
        setControlPressed("Space", false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearControls);
    document.addEventListener("visibilitychange", clearControls);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearControls);
      document.removeEventListener("visibilitychange", clearControls);
    };
  }, [fireBullet, gameState, resetControls, setControlPressed, startGame]);

  useEffect(() => {
    if (gameState !== "playing") {
      return;
    }

    const loop = () => {
      frameRef.current += 1;
      spawnTickRef.current += 1;
      bulletTickRef.current += 1;

      const keys = keysRef.current;
      const currentPlayer = playerRef.current;
      const nextPlayer = {
        ...currentPlayer,
        x: clamp(
          currentPlayer.x +
            (keys.ArrowLeft ? -currentPlayer.speed : 0) +
            (keys.ArrowRight ? currentPlayer.speed : 0),
          8,
          WIDTH - PLAYER_SIZE - 8,
        ),
        y: clamp(
          currentPlayer.y +
            (keys.ArrowUp ? -currentPlayer.speed : 0) +
            (keys.ArrowDown ? currentPlayer.speed : 0),
          8,
          HEIGHT - PLAYER_SIZE - 8,
        ),
      };
      syncPlayer(nextPlayer);

      if ((keys[" "] || keys.Spacebar || keys.Space) && bulletTickRef.current >= 10) {
        bulletTickRef.current = 0;
        fireBullet();
      }

      const spawnInterval = Math.max(16, 36 - levelRef.current * 2);
      if (spawnTickRef.current >= spawnInterval) {
        spawnTickRef.current = 0;
        const waveSize = Math.random() < 0.2 ? 2 : 1;
        syncEnemies([
          ...enemiesRef.current,
          ...Array.from({ length: waveSize }, () =>
            createEnemy(enemyIdRef.current++, levelRef.current),
          ),
        ]);
      }

      setStars((current) =>
        current.map((star) => {
          const nextY = star.y + star.speed + levelRef.current * 0.05;
          const wrapped = nextY > HEIGHT;
          return {
            ...star,
            y: wrapped ? -5 : nextY,
            x: wrapped ? Math.random() * WIDTH : star.x,
          };
        }),
      );

      const movedBullets = bulletsRef.current
        .map((bullet) => ({ ...bullet, y: bullet.y - bullet.speed }))
        .filter((bullet) => bullet.y > -30);

      const bulletUsage = new Set<number>();
      const nextEnemies: Enemy[] = [];
      const nextExplosions: Explosion[] = [];
      let scoreGain = 0;
      let playerHit = false;
      const invincible = invincibleRef.current;

      for (const enemy of enemiesRef.current) {
        let updatedEnemy = {
          ...enemy,
          y: enemy.y + enemy.speed,
          x: clamp(enemy.x + enemy.drift, 0, WIDTH - enemy.width),
        };
        let destroyed = false;

        for (const bullet of movedBullets) {
          if (bulletUsage.has(bullet.id)) {
            continue;
          }

          const hit =
            bullet.x < updatedEnemy.x + updatedEnemy.width &&
            bullet.x + BULLET_WIDTH > updatedEnemy.x &&
            bullet.y < updatedEnemy.y + updatedEnemy.height &&
            bullet.y + BULLET_HEIGHT > updatedEnemy.y;

          if (!hit) {
            continue;
          }

          bulletUsage.add(bullet.id);
          updatedEnemy = { ...updatedEnemy, hp: updatedEnemy.hp - 1 };
          if (updatedEnemy.hp <= 0) {
            destroyed = true;
            scoreGain += 100;
            nextExplosions.push({
              id: explosionIdRef.current++,
              x: updatedEnemy.x + 10,
              y: updatedEnemy.y,
            });
          }
          break;
        }

        if (destroyed) {
          continue;
        }

        const hitsPlayer =
          updatedEnemy.x < nextPlayer.x + PLAYER_SIZE &&
          updatedEnemy.x + updatedEnemy.width > nextPlayer.x &&
          updatedEnemy.y < nextPlayer.y + PLAYER_SIZE &&
          updatedEnemy.y + updatedEnemy.height > nextPlayer.y;

        if (hitsPlayer && !invincible) {
          playerHit = true;
          nextExplosions.push({
            id: explosionIdRef.current++,
            x: nextPlayer.x + 6,
            y: nextPlayer.y + 2,
          });
          continue;
        }

        if (updatedEnemy.y <= HEIGHT + 50 && !hitsPlayer) {
          nextEnemies.push(updatedEnemy);
        }
      }

      const nextBullets = movedBullets.filter((bullet) => !bulletUsage.has(bullet.id));
      syncBullets(nextBullets);
      syncEnemies(nextEnemies);

      if (nextExplosions.length > 0) {
        setExplosions((current) => [...current, ...nextExplosions]);
        window.setTimeout(() => {
          setExplosions((current) =>
            current.filter(
              (explosion) =>
                !nextExplosions.some((nextExplosion) => nextExplosion.id === explosion.id),
            ),
          );
        }, 250);
      }

      if (scoreGain > 0) {
        scoreRef.current += scoreGain;
        setScore(scoreRef.current);
        setBestScore((current) => Math.max(current, scoreRef.current));
        setMessage("うさぎをやっつけた！");
      }

      if (playerHit) {
        const nextLives = livesRef.current - 1;
        livesRef.current = nextLives;
        setLives(nextLives);
        if (nextLives <= 0) {
          setGameState("gameover");
          setMessage("ゲームオーバー… うさぎに囲まれた！");
        } else {
          invincibleRef.current = true;
          setIsInvincible(true);
          setMessage("ヒット！少し無敵時間");
          if (invincibleTimeoutRef.current !== null) {
            window.clearTimeout(invincibleTimeoutRef.current);
          }
          invincibleTimeoutRef.current = window.setTimeout(() => {
            invincibleRef.current = false;
            setIsInvincible(false);
            invincibleTimeoutRef.current = null;
          }, 1600);
        }
      }

      if (frameRef.current % 240 === 0) {
        levelRef.current += 1;
        setLevel(levelRef.current);
        setMessage("うさぎの波が強くなった！");
      }
    };

    const interval = window.setInterval(loop, 16);
    return () => window.clearInterval(interval);
  }, [fireBullet, gameState]);

  useEffect(() => {
    return () => {
      if (invincibleTimeoutRef.current !== null) {
        window.clearTimeout(invincibleTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const element = gameViewportRef.current;
    if (!element) {
      return;
    }

    const updateScale = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const isCompactPortrait =
        viewportWidth <= COMPACT_PORTRAIT_MAX_WIDTH && viewportHeight > viewportWidth;
      const heightCap = isCompactPortrait
        ? Math.min(Math.max(viewportHeight * 0.52, 380), 560)
        : HEIGHT;
      const nextScale = Math.min(
        element.clientWidth / WIDTH,
        heightCap / HEIGHT,
        1,
      );
      setViewportSize({ width: viewportWidth, height: viewportHeight });
      setBoardScale(nextScale > 0 ? nextScale : 1);
    };

    updateScale();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateScale())
        : null;

    observer?.observe(element);
    window.addEventListener("resize", updateScale);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  const statusLabel =
    gameState === "playing"
      ? "プレイ中"
      : gameState === "gameover"
        ? "ゲームオーバー"
        : "待機中";
  const isCompactPortrait =
    viewportSize.width > 0 &&
    viewportSize.width <= COMPACT_PORTRAIT_MAX_WIDTH &&
    viewportSize.height > viewportSize.width;
  const showTouchPanel =
    isCompactPortrait ||
    viewportSize.width === 0 ||
    viewportSize.width >= TOUCH_PANEL_MIN_VIEWPORT;

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section
          style={{
            ...styles.hero,
            ...(isCompactPortrait ? styles.heroCompact : {}),
          }}
        >
          <div style={styles.eyebrow}>extras / mini game</div>
          <h1
            style={{
              ...styles.title,
              ...(isCompactPortrait ? styles.titleCompact : {}),
            }}
          >
            ペンギン・バニーシューター
          </h1>
          <p
            style={{
              ...styles.note,
              ...(isCompactPortrait ? styles.noteCompact : {}),
            }}
          >
            矢印キーでペンギンを動かし、Space でショット。絵文字だけで遊べる最短版のミニゲームです。
          </p>
        </section>

        <div
          style={{
            ...styles.layout,
            ...(isCompactPortrait ? styles.layoutCompact : {}),
          }}
        >
          <section
            style={{
              ...styles.sideColumn,
              ...(isCompactPortrait ? styles.sideColumnCompact : {}),
            }}
          >
            <article style={styles.card}>
              <div style={styles.cardTitle}>あそび方</div>
              <p style={styles.cardText}>
                自機はペンギン🐧、敵はうさぎ🐰です。矢印キーで移動、Spaceキーでショット。
              </p>
              <div style={styles.badgeRow}>
                <span style={{ ...styles.badge, ...styles.badgeMove }}>←↑↓→ 移動</span>
                <span style={{ ...styles.badge, ...styles.badgeShot }}>Space 発射</span>
              </div>

              <div style={styles.statusBox}>
                <div style={styles.statusRow}>
                  <span>状態</span>
                  <span>{statusLabel}</span>
                </div>
                <div style={styles.statusRow}>
                  <span>メッセージ</span>
                  <span style={styles.messageValue}>{message}</span>
                </div>
                <div style={styles.statusRow}>
                  <span>ベストスコア</span>
                  <span>{bestScore}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={startGame}
                style={{
                  ...styles.primaryButton,
                  ...(isCompactPortrait ? styles.primaryButtonCompact : {}),
                }}
              >
                {gameState === "idle" ? "スタート" : "リスタート"}
              </button>
            </article>

            <div
              style={{
                ...styles.statGrid,
                ...(isCompactPortrait ? styles.statGridCompact : {}),
              }}
            >
              <article style={styles.statCard}>
                <div>
                  <div style={styles.statLabel}>スコア</div>
                  <div style={styles.statValue}>{score}</div>
                </div>
                <span style={styles.statIcon}>🏆</span>
              </article>
              <article style={styles.statCard}>
                <div>
                  <div style={styles.statLabel}>ライフ</div>
                  <div style={styles.statValue}>{lives}</div>
                </div>
                <span style={styles.statIcon}>❤️</span>
              </article>
              <article style={styles.statCard}>
                <div>
                  <div style={styles.statLabel}>レベル</div>
                  <div style={styles.statValue}>{level}</div>
                </div>
                <span style={styles.statIcon}>🚀</span>
              </article>
            </div>
          </section>

          <section
            style={{
              ...styles.gameCard,
              ...(isCompactPortrait ? styles.gameCardCompact : {}),
            }}
          >
            <div ref={gameViewportRef} style={styles.gameViewport}>
              <div
                style={{
                  ...styles.gameScaler,
                  height: HEIGHT * boardScale,
                }}
              >
                <div
                  style={{
                    ...styles.gameArea,
                    transform: `scale(${boardScale})`,
                  }}
                >
                  <div style={styles.gameGlow} />

                  {stars.map((star) => (
                    <div
                      key={star.id}
                      style={{
                        position: "absolute",
                        left: star.x,
                        top: star.y,
                        width: star.r,
                        height: star.r,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.8)",
                        opacity: 0.7,
                      }}
                    />
                  ))}

                  <div style={styles.hud}>
                    Score {score} / Life {lives} / Lv {level} / Enemies {enemies.length}
                  </div>

                  {bullets.map((bullet) => (
                    <BulletView key={bullet.id} bullet={bullet} />
                  ))}

                  {enemies.map((enemy) => (
                    <Bunny key={enemy.id} enemy={enemy} />
                  ))}

                  {explosions.map((explosion) => (
                    <ExplosionView key={explosion.id} x={explosion.x} y={explosion.y} />
                  ))}

                  <Penguin x={player.x} y={player.y} invincible={isInvincible} />

                  {gameState !== "playing" ? (
                    <div style={styles.overlay}>
                      <div style={styles.overlayCard}>
                        <div style={styles.overlayIcon}>🐧</div>
                        <h2 style={styles.overlayTitle}>
                          {gameState === "gameover" ? "もう一回！" : "シューティングゲーム"}
                        </h2>
                        <p style={styles.overlayText}>
                          {gameState === "gameover"
                            ? "うさぎの猛攻をしのいで、記録更新を目指そう。"
                            : "スタートを押すか、Spaceキーで出撃。"}
                        </p>
                        <button type="button" onClick={startGame} style={styles.primaryButton}>
                          {gameState === "gameover" ? "リトライ" : "スタート"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {showTouchPanel && (
            <div
              style={{
                ...styles.touchPanel,
                ...(isCompactPortrait ? styles.touchPanelCompact : {}),
              }}
            >
              <div style={styles.touchPanelTitle}>スマホ操作</div>
              <div
                style={{
                  ...styles.touchGrid,
                  ...(isCompactPortrait ? styles.touchGridCompact : {}),
                }}
              >
                <div style={styles.touchPad}>
                  <div />
                  <TouchButton
                    label="↑"
                    compact={isCompactPortrait}
                    onPressChange={(pressed) => setControlPressed("ArrowUp", pressed)}
                  />
                  <div />
                  <TouchButton
                    label="←"
                    compact={isCompactPortrait}
                    onPressChange={(pressed) => setControlPressed("ArrowLeft", pressed)}
                  />
                  <TouchButton
                    label="↓"
                    compact={isCompactPortrait}
                    onPressChange={(pressed) => setControlPressed("ArrowDown", pressed)}
                  />
                  <TouchButton
                    label="→"
                    compact={isCompactPortrait}
                    onPressChange={(pressed) => setControlPressed("ArrowRight", pressed)}
                  />
                </div>

                <div style={styles.touchActionCol}>
                  <TouchButton
                    label="発射"
                    wide
                    accent
                    compact={isCompactPortrait}
                    onPressChange={(pressed) => {
                      if (pressed && gameState === "idle") {
                        startGame();
                      }
                      setControlPressed("Space", pressed);
                    }}
                  />
                </div>
              </div>
            </div>
            )}
          </section>
        </div>
      </div>

      <style>{`
        @keyframes penguinShooterPing {
          from {
            opacity: 1;
            transform: scale(0.85);
          }
          to {
            opacity: 0;
            transform: scale(1.35);
          }
        }
      `}</style>
    </main>
  );
}

function TouchButton({
  label,
  onPressChange,
  wide = false,
  accent = false,
  compact = false,
}: {
  label: string;
  onPressChange: (pressed: boolean) => void;
  wide?: boolean;
  accent?: boolean;
  compact?: boolean;
}) {
  const [pressed, setPressed] = useState(false);

  const updatePressed = (next: boolean) => {
    setPressed(next);
    onPressChange(next);
  };

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={() => updatePressed(true)}
      onPointerUp={() => updatePressed(false)}
      onPointerCancel={() => updatePressed(false)}
      onPointerLeave={() => updatePressed(false)}
      style={{
        ...styles.touchButton,
        ...(compact ? styles.touchButtonCompact : {}),
        ...(wide ? styles.touchButtonWide : {}),
        ...(accent ? styles.touchButtonAccent : {}),
        ...(pressed ? styles.touchButtonPressed : {}),
      }}
    >
      {label}
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "20px 12px 56px",
    background:
      "radial-gradient(1000px 420px at 12% 0%, rgba(56, 189, 248, 0.1), transparent 55%), #eef2f7",
  },
  shell: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
  },
  hero: {
    marginBottom: 18,
  },
  heroCompact: {
    marginBottom: 12,
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#0369a1",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  title: {
    margin: "12px 0 6px",
    fontSize: "clamp(28px, 4.5vw, 42px)",
    lineHeight: 1.1,
    letterSpacing: -1,
    color: "#0f172a",
  },
  titleCompact: {
    margin: "10px 0 4px",
    fontSize: "clamp(24px, 7vw, 30px)",
  },
  note: {
    margin: 0,
    maxWidth: 720,
    fontSize: 14,
    lineHeight: 1.7,
    color: "#64748b",
  },
  noteCompact: {
    fontSize: 12,
    lineHeight: 1.55,
  },
  layout: {
    display: "grid",
    gap: 20,
    gridTemplateColumns: "minmax(0, 320px) minmax(0, 1fr)",
  },
  layoutCompact: {
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 12,
  },
  sideColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  sideColumnCompact: {
    order: 2,
    gap: 10,
  },
  card: {
    borderRadius: 28,
    border: "1px solid rgba(15, 23, 42, 0.06)",
    background: "rgba(15, 23, 42, 0.94)",
    color: "#fff",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
    padding: 22,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 900,
    marginBottom: 10,
  },
  cardText: {
    margin: 0,
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 1.7,
  },
  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 14,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  },
  badgeMove: {
    background: "rgba(6, 182, 212, 0.18)",
    color: "#a5f3fc",
  },
  badgeShot: {
    background: "rgba(217, 70, 239, 0.18)",
    color: "#f5d0fe",
  },
  statusBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
    background: "rgba(30, 41, 59, 0.88)",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    color: "#cbd5e1",
    fontSize: 13,
    marginBottom: 10,
  },
  messageValue: {
    color: "#67e8f9",
    textAlign: "right",
  },
  primaryButton: {
    width: "100%",
    marginTop: 16,
    minHeight: 46,
    border: "none",
    borderRadius: 18,
    background: "#22d3ee",
    color: "#082f49",
    fontSize: 15,
    fontWeight: 900,
    cursor: "pointer",
  },
  primaryButtonCompact: {
    marginTop: 12,
    minHeight: 42,
    fontSize: 14,
  },
  statGrid: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
  statGridCompact: {
    gap: 8,
  },
  statCard: {
    borderRadius: 24,
    border: "1px solid rgba(15, 23, 42, 0.04)",
    background: "rgba(15, 23, 42, 0.94)",
    color: "#fff",
    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.15)",
    padding: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 30,
    fontWeight: 900,
    lineHeight: 1,
  },
  statIcon: {
    fontSize: 24,
  },
  gameCard: {
    borderRadius: 32,
    border: "1px solid rgba(15, 23, 42, 0.06)",
    background: "rgba(15, 23, 42, 0.06)",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.1)",
    padding: 14,
  },
  gameCardCompact: {
    order: 1,
    padding: 10,
    borderRadius: 24,
  },
  gameViewport: {
    width: "100%",
    overflow: "hidden",
  },
  gameScaler: {
    width: "100%",
    maxWidth: WIDTH,
    margin: "0 auto",
    position: "relative",
  },
  gameArea: {
    position: "relative",
    width: WIDTH,
    height: HEIGHT,
    overflow: "hidden",
    borderRadius: 32,
    border: "1px solid rgba(148, 163, 184, 0.18)",
    background:
      "linear-gradient(180deg, rgb(15, 23, 42) 0%, rgb(8, 47, 73) 52%, rgb(2, 6, 23) 100%)",
    transformOrigin: "top left",
  },
  gameGlow: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at top, rgba(56,189,248,0.18), transparent 35%), radial-gradient(circle at bottom, rgba(236,72,153,0.14), transparent 28%)",
  },
  hud: {
    position: "absolute",
    left: 16,
    top: 16,
    zIndex: 30,
    padding: "10px 14px",
    borderRadius: 16,
    background: "rgba(15, 23, 42, 0.6)",
    color: "#e2e8f0",
    fontSize: 13,
    backdropFilter: "blur(8px)",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    zIndex: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(2, 6, 23, 0.45)",
    backdropFilter: "blur(2px)",
  },
  overlayCard: {
    width: "min(88%, 380px)",
    borderRadius: 30,
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(15, 23, 42, 0.88)",
    color: "#fff",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.25)",
    padding: "28px 24px",
    textAlign: "center",
  },
  overlayIcon: {
    fontSize: 52,
    marginBottom: 8,
  },
  overlayTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
  },
  overlayText: {
    margin: "10px 0 0",
    fontSize: 14,
    lineHeight: 1.7,
    color: "#cbd5e1",
  },
  touchPanel: {
    marginTop: 14,
    borderRadius: 24,
    border: "1px solid rgba(15, 23, 42, 0.06)",
    background: "rgba(255, 255, 255, 0.82)",
    padding: 14,
  },
  touchPanelCompact: {
    marginTop: 10,
    borderRadius: 18,
    padding: 10,
  },
  touchPanelTitle: {
    marginBottom: 10,
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    letterSpacing: 0.2,
  },
  touchGrid: {
    display: "flex",
    gap: 12,
    alignItems: "stretch",
    maxWidth: 420,
    margin: "0 auto",
  },
  touchGridCompact: {
    gap: 8,
  },
  touchPad: {
    flex: 1,
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
  },
  touchActionCol: {
    flexShrink: 0,
    width: "clamp(72px, 28%, 110px)",
    display: "flex",
    flexDirection: "column",
  },
  touchButton: {
    height: 52,
    padding: "0 16px",
    borderRadius: 18,
    border: "1px solid rgba(37, 84, 255, 0.12)",
    background: "#f8fbff",
    color: "#1e293b",
    fontSize: 24,
    fontWeight: 900,
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.06)",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  },
  touchButtonCompact: {
    height: 44,
    padding: "0 10px",
    borderRadius: 14,
    fontSize: 20,
  },
  touchButtonWide: {
    flex: 1,
    width: "100%",
    height: "auto",
    fontSize: 18,
  },
  touchButtonAccent: {
    background: "#22d3ee",
    color: "#082f49",
    border: "1px solid rgba(8, 47, 73, 0.08)",
  },
  touchButtonPressed: {
    transform: "translateY(1px) scale(0.98)",
    boxShadow: "inset 0 2px 6px rgba(15, 23, 42, 0.08)",
  },
};
