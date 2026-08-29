import { describe, expect, it } from "vitest";
import {
  layoutRadialHierarchy,
  type RadialHierarchyNode,
} from "./radial-layout";

function leaf(id: string): RadialHierarchyNode {
  return {
    id,
    label: id,
    children: [],
    tone: "#000",
    fill: "#fff",
    stroke: "#000",
    radius: 4,
  };
}

function root(children: RadialHierarchyNode[]): RadialHierarchyNode {
  return {
    id: "root",
    label: "root",
    children,
    tone: "#000",
    fill: "#000",
    stroke: "#000",
    radius: 10,
  };
}

function pointAngle(layout: ReturnType<typeof layoutRadialHierarchy>, id: string) {
  const point = layout.points.find((candidate) => candidate.id === id);
  if (!point) throw new Error(`missing point: ${id}`);
  return point.angle;
}

describe("layoutRadialHierarchy adaptive child fan", () => {
  it("keeps the legacy full fan when childFanRatio is omitted", () => {
    const layout = layoutRadialHierarchy([root([leaf("a"), leaf("b")])], { radiusStep: 100 });
    const spread = Math.abs(pointAngle(layout, "b") - pointAngle(layout, "a"));
    expect(spread).toBeCloseTo(Math.PI, 6);
  });

  it("tightens sibling angles around the parent when requested", () => {
    const layout = layoutRadialHierarchy([root([leaf("a"), leaf("b")])], {
      radiusStep: 100,
      childFanRatio: 0.5,
    });
    const spread = Math.abs(pointAngle(layout, "b") - pointAngle(layout, "a"));
    expect(spread).toBeCloseTo(Math.PI / 2, 6);
  });

  it("backs off compression when the minimum leaf arc needs more room", () => {
    const children = Array.from({ length: 8 }, (_, index) => leaf(`leaf-${index}`));
    const layout = layoutRadialHierarchy([root(children)], {
      radiusStep: 100,
      childFanRatio: 0.5,
      minLeafArc: 80,
    });
    const first = pointAngle(layout, "leaf-0");
    const last = pointAngle(layout, "leaf-7");
    const spread = Math.abs(last - first);
    expect(spread).toBeGreaterThan(Math.PI);
  });
});
