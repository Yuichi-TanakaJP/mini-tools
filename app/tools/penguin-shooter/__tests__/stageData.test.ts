import { describe, expect, it } from "vitest";
import {
  CLEAR_TARGET,
  FINAL_STAGE,
  GAME_MODE_DEFINITIONS,
  STAGE_DEFINITIONS,
  WEAPON_DEFINITIONS,
  WEAPON_ORDER,
  getSubStage,
} from "../stageData";

describe("penguin shooter stage data", () => {
  it("keeps ten stages and one hundred small stages", () => {
    expect(FINAL_STAGE).toBe(10);
    expect(CLEAR_TARGET).toBe(100);
    expect(STAGE_DEFINITIONS).toHaveLength(10);
    expect(STAGE_DEFINITIONS.every((stage) => stage.smallStages.length === 10)).toBe(
      true,
    );
  });

  it("places the mid and stage bosses at five and ten", () => {
    for (const stage of STAGE_DEFINITIONS) {
      expect(stage.smallStages[4].bossCheckpoint).toBe("mid");
      expect(stage.smallStages[9].bossCheckpoint).toBe("stage");
    }
  });

  it("keeps global small-stage numbers contiguous", () => {
    const numbers = STAGE_DEFINITIONS.flatMap((stage) =>
      stage.smallStages.map((smallStage) => smallStage.globalNumber),
    );
    expect(numbers).toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
  });

  it("assigns a dedicated SVG to every stage boss", () => {
    expect(
      STAGE_DEFINITIONS.every((stage) => stage.bosses.stage.assetPath?.endsWith(".svg")),
    ).toBe(true);
    expect(STAGE_DEFINITIONS[9].bosses.stage.assetPath).toContain("stage-10-world-rift.svg");
  });

  it("keeps weapon unlocks ordered by stage", () => {
    expect(WEAPON_ORDER).toHaveLength(6);
    expect(WEAPON_ORDER.map((weaponId) => WEAPON_DEFINITIONS[weaponId].unlockStage)).toEqual([
      1,
      2,
      4,
      6,
      7,
      8,
    ]);
    expect(getSubStage(10, 0).globalNumber).toBe(91);
  });

  it("keeps boss HP strong and increasing by stage", () => {
    const midBossHp = STAGE_DEFINITIONS.map((stage) => stage.bosses.mid.hp);
    const stageBossHp = STAGE_DEFINITIONS.map((stage) => stage.bosses.stage.hp);
    expect(midBossHp[0]).toBeGreaterThanOrEqual(30);
    expect(stageBossHp[0]).toBeGreaterThanOrEqual(80);
    expect(midBossHp.every((hp, index) => index === 0 || hp > midBossHp[index - 1])).toBe(
      true,
    );
    expect(
      stageBossHp.every((hp, index) => index === 0 || hp > stageBossHp[index - 1]),
    ).toBe(true);
    expect(stageBossHp[stageBossHp.length - 1]).toBe(600);
  });

  it("scales game modes from light to chaos", () => {
    const modes = Object.values(GAME_MODE_DEFINITIONS);
    expect(modes).toHaveLength(5);
    expect(modes.map((mode) => mode.maxEnemies)).toEqual([2, 3, 4, 5, 7]);
    expect(modes.map((mode) => mode.enemyHp)).toEqual([1, 1, 2, 2, 3]);
    expect(modes.map((mode) => mode.bossHpMultiplier)).toEqual([
      0.65,
      0.8,
      1,
      1.2,
      1.45,
    ]);
    expect(modes.every((mode, index) => index === 0 || mode.spawnIntervalMultiplier < modes[index - 1].spawnIntervalMultiplier)).toBe(true);
  });
});
