import { describe, expect, it } from "vitest";
import {
  buildForest,
  countLeaves,
  flattenTree,
  layoutRadial,
  maxDepth,
  seedSimNodes,
  simExtent,
  stepForce,
  type SimLink,
} from "./graph-layout";
import type { IndustryDomain, IndustryEdge, IndustryNode, RelationType } from "./types";

function makeNode(id: string, displayName = id): IndustryNode {
  return {
    id,
    domain: "d",
    kind: "classification",
    slug: id,
    displayName,
    description: "",
    status: "active",
    layer: null,
  };
}

function makeEdge(
  id: string,
  sourceId: string,
  targetId: string,
  relationType: RelationType = "contains",
): IndustryEdge {
  return { id, domain: "d", sourceId, targetId, relationType, note: "" };
}

function makeDomain(nodes: IndustryNode[], edges: IndustryEdge[], rootIds: string[]): IndustryDomain {
  return {
    domain: "d",
    label: "d",
    rootIds,
    nodes,
    edges,
    companyLinks: [],
    themeLinks: [],
  };
}

describe("buildForest", () => {
  it("contains と part_of の両方から親子を組み立てる", () => {
    const domain = makeDomain(
      [makeNode("root"), makeNode("a"), makeNode("b")],
      [makeEdge("e1", "root", "a"), makeEdge("e2", "b", "root", "part_of")],
      ["root"],
    );

    const roots = buildForest(domain);
    expect(roots).toHaveLength(1);
    expect(roots[0].children.map((child) => child.node.id).sort()).toEqual(["a", "b"]);
    expect(maxDepth(roots)).toBe(1);
  });

  it("親が複数あるノードは最初の親の下だけに置き、残りを記録する", () => {
    const domain = makeDomain(
      [makeNode("root"), makeNode("p2"), makeNode("child")],
      [
        makeEdge("e1", "root", "p2"),
        makeEdge("e2", "root", "child"),
        makeEdge("e3", "p2", "child"),
      ],
      ["root"],
    );

    const flat = flattenTree(buildForest(domain));
    const child = flat.filter((item) => item.node.id === "child");
    expect(child).toHaveLength(1);
    expect(child[0].extraParentIds).toEqual(["p2"]);
  });

  it("循環があっても停止し、全ノードを1度ずつ返す", () => {
    const domain = makeDomain(
      [makeNode("a"), makeNode("b"), makeNode("c")],
      [makeEdge("e1", "a", "b"), makeEdge("e2", "b", "c"), makeEdge("e3", "c", "a")],
      ["a"],
    );

    const flat = flattenTree(buildForest(domain));
    expect(flat.map((item) => item.node.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("木から漏れたノードも独立した根として拾う", () => {
    const domain = makeDomain(
      [makeNode("root"), makeNode("orphan")],
      [],
      ["root"],
    );

    const roots = buildForest(domain);
    expect(roots.map((item) => item.node.id).sort()).toEqual(["orphan", "root"]);
  });

  it("横断する関係はノードに添えるが、子として展開しない", () => {
    const domain = makeDomain(
      [makeNode("root"), makeNode("a"), makeNode("tech")],
      [makeEdge("e1", "root", "a"), makeEdge("e2", "tech", "a", "enables")],
      ["root"],
    );

    const flat = flattenTree(buildForest(domain));
    const a = flat.find((item) => item.node.id === "a");
    expect(a?.children).toHaveLength(0);
    expect(a?.crossEdges.map((item) => item.relationType)).toEqual(["enables"]);
  });
});

describe("countLeaves", () => {
  it("葉を数える", () => {
    const domain = makeDomain(
      [makeNode("root"), makeNode("a"), makeNode("b"), makeNode("c")],
      [makeEdge("e1", "root", "a"), makeEdge("e2", "root", "b"), makeEdge("e3", "a", "c")],
      ["root"],
    );

    const roots = buildForest(domain);
    expect(countLeaves(roots[0])).toBe(2);
  });
});

describe("layoutRadial", () => {
  it("根が1つなら中心に置き、子を円周に配る", () => {
    const domain = makeDomain(
      [makeNode("root"), makeNode("a"), makeNode("b")],
      [makeEdge("e1", "root", "a"), makeEdge("e2", "root", "b")],
      ["root"],
    );

    const layout = layoutRadial(buildForest(domain), 100);
    const root = layout.points.find((point) => point.id === "root");
    expect(root?.radius).toBe(0);
    expect(root?.x).toBeCloseTo(0);
    expect(root?.y).toBeCloseTo(0);

    const children = layout.points.filter((point) => point.id !== "root");
    expect(children.every((point) => point.radius === 100)).toBe(true);
    // 葉が2つなので、子の角度は半周ぶん離れる。
    const [first, second] = children;
    expect(Math.abs(first.angle - second.angle)).toBeCloseTo(Math.PI);
    expect(layout.links).toHaveLength(2);
    expect(layout.extent).toBe(100);
  });

  it("根が複数あるときは中心を空けて全体を1周に収める", () => {
    const domain = makeDomain([makeNode("a"), makeNode("b")], [], ["a", "b"]);
    const layout = layoutRadial(buildForest(domain), 100);
    expect(layout.points.every((point) => point.radius === 100)).toBe(true);
  });

  it("最も葉の多い木を中心に置き、それ以外の根は外側の環へ逃がす", () => {
    const domain = makeDomain(
      [makeNode("root"), makeNode("child"), makeNode("loose")],
      [makeEdge("e1", "root", "child")],
      ["root", "loose"],
    );

    const layout = layoutRadial(buildForest(domain), 100);
    const byId = new Map(layout.points.map((point) => [point.id, point]));
    expect(byId.get("root")?.radius).toBe(0);
    expect(byId.get("child")?.radius).toBe(100);
    // 中心の木の深さ(1)の1つ外側。
    expect(byId.get("loose")?.radius).toBe(200);
    expect(layout.extent).toBe(200);
    expect(byId.get("root")?.childCount).toBe(1);
    expect(byId.get("loose")?.childCount).toBe(0);
  });

  it("ノードが無ければ空の配置を返す", () => {
    const layout = layoutRadial([], 100);
    expect(layout.points).toHaveLength(0);
    expect(layout.links).toHaveLength(0);
  });
});

describe("force layout", () => {
  it("同じ入力からは必ず同じ初期配置になる", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    expect(seedSimNodes(nodes, 200)).toEqual(seedSimNodes(nodes, 200));
  });

  it("反発によって重なったノードが離れる", () => {
    const simNodes = seedSimNodes([makeNode("a"), makeNode("b")], 0);
    for (let i = 0; i < 40; i += 1) stepForce(simNodes, []);

    const distance = Math.hypot(simNodes[0].x - simNodes[1].x, simNodes[0].y - simNodes[1].y);
    expect(distance).toBeGreaterThan(1);
    expect(Number.isFinite(distance)).toBe(true);
  });

  it("辺で結ばれたノードは自然長の近くへ落ち着く", () => {
    const simNodes = seedSimNodes([makeNode("a"), makeNode("b")], 600);
    const links: SimLink[] = [
      { id: "e1", sourceId: "a", targetId: "b", relationType: "contains" },
    ];
    for (let i = 0; i < 600; i += 1) stepForce(simNodes, links);

    const distance = Math.hypot(simNodes[0].x - simNodes[1].x, simNodes[0].y - simNodes[1].y);
    expect(distance).toBeGreaterThan(40);
    expect(distance).toBeLessThan(400);
  });

  it("存在しないノードを指す辺があっても壊れない", () => {
    const simNodes = seedSimNodes([makeNode("a")], 100);
    const links: SimLink[] = [
      { id: "e1", sourceId: "a", targetId: "missing", relationType: "depends_on" },
    ];
    expect(() => stepForce(simNodes, links)).not.toThrow();
    expect(Number.isFinite(simNodes[0].x)).toBe(true);
  });

  it("simExtent は最小値を下回らない", () => {
    expect(simExtent(seedSimNodes([makeNode("a")], 0), 240)).toBe(240);
  });
});
