import { describe, expect, it } from "vitest";
import { buildIndustryMap, type RawIndustryMap } from "./data-loader";
import { formatAsOf } from "./presentation";

function node(overrides: Record<string, unknown>) {
  return {
    id: "n1",
    domain: "semiconductors",
    kind: "classification",
    slug: "root",
    display_name: "半導体産業",
    description: "",
    status: "active",
    metadata: {},
    ...overrides,
  };
}

function edge(overrides: Record<string, unknown>) {
  return {
    id: "e1",
    domain: "semiconductors",
    source_node_id: "n1",
    target_node_id: "n2",
    relation_type: "contains",
    relation_note: "",
    ...overrides,
  };
}

function companyLink(overrides: Record<string, unknown>) {
  return {
    company_taxonomy_link_id: "cl1",
    company_entity_id: "c1",
    company_name: "ＮＴＴ",
    company_slug: "ntt",
    company_status: "active",
    country_code: "JP",
    listing_status: "domestic_listed",
    node_id: "n1",
    strategic_role: "core",
    control_type: "controlled",
    confidence: "medium",
    source_type: "manual",
    relation_note: "",
    as_of: "2026-08-01",
    stock_id: "s1",
    stock_code: "9432",
    stock_name: "ＮＴＴ",
    ...overrides,
  };
}

const EMPTY: RawIndustryMap = {
  nodes: [],
  edges: [],
  companyLinks: [],
  themeLinks: [],
  themes: [],
};

describe("buildIndustryMap", () => {
  it("domain ごとにノードと辺をまとめ、根の表示名をラベルにする", () => {
    const data = buildIndustryMap({
      ...EMPTY,
      nodes: [
        node({}),
        node({ id: "n2", slug: "foundry", display_name: "ファウンドリ", kind: "product_segment" }),
        node({ id: "n3", domain: "synthetic-fuels", slug: "efuel", display_name: "e-Fuel産業" }),
      ],
      edges: [edge({})],
    });

    expect(data.domains).toHaveLength(2);
    const semiconductors = data.domains.find((item) => item.domain === "semiconductors");
    expect(semiconductors?.label).toBe("半導体産業");
    expect(semiconductors?.nodes).toHaveLength(2);
    expect(semiconductors?.rootIds).toEqual(["n1"]);

    const fuels = data.domains.find((item) => item.domain === "synthetic-fuels");
    expect(fuels?.label).toBe("e-Fuel産業");
    expect(fuels?.rootIds).toEqual(["n3"]);
  });

  it("part_of も親子として扱い、根から除外する", () => {
    const data = buildIndustryMap({
      ...EMPTY,
      nodes: [node({}), node({ id: "n2", display_name: "先端パッケージ" })],
      edges: [edge({ source_node_id: "n2", target_node_id: "n1", relation_type: "part_of" })],
    });

    expect(data.domains[0]?.rootIds).toEqual(["n1"]);
  });

  it("必須項目が欠けた行と、未知の種別・関係を落とす", () => {
    const data = buildIndustryMap({
      ...EMPTY,
      nodes: [
        node({}),
        node({ id: "", display_name: "IDなし" }),
        node({ id: "n3", kind: "unknown_kind" }),
        node({ id: "n4", display_name: "   " }),
      ],
      edges: [edge({ relation_type: "supersedes" }), edge({ id: "e2", target_node_id: "n1" })],
    });

    expect(data.domains[0]?.nodes.map((item) => item.id)).toEqual(["n1"]);
    // 未知の関係と自己ループはどちらも落ちる。
    expect(data.domains[0]?.edges).toHaveLength(0);
  });

  it("両端が同じ domain にある辺だけを採る", () => {
    const data = buildIndustryMap({
      ...EMPTY,
      nodes: [node({}), node({ id: "n2", domain: "synthetic-fuels", display_name: "e-SAF" })],
      edges: [edge({})],
    });

    expect(data.domains.every((item) => item.edges.length === 0)).toBe(true);
  });

  it("metadata.layer を読み、形が違えば null にする", () => {
    const data = buildIndustryMap({
      ...EMPTY,
      nodes: [
        node({ metadata: { layer: "service" } }),
        node({ id: "n2", display_name: "B", metadata: { layer: 3 } }),
        node({ id: "n3", display_name: "C", metadata: null }),
      ],
    });

    const nodes = data.domains[0]?.nodes ?? [];
    expect(nodes[0]?.layer).toBe("service");
    expect(nodes[1]?.layer).toBeNull();
    expect(nodes[2]?.layer).toBeNull();
  });

  it("存在しないノードへの企業紐付けと、紐付けのないテーマを落とす", () => {
    const data = buildIndustryMap({
      ...EMPTY,
      nodes: [node({})],
      companyLinks: [
        companyLink({}),
        companyLink({ company_taxonomy_link_id: "cl2", node_id: "missing" }),
      ],
      themes: [{ id: "t1", slug: "ai", display_name: "AI", status: "active" }],
    });

    expect(data.domains[0]?.companyLinks).toHaveLength(1);
    expect(data.themes).toHaveLength(0);
  });

  it("上場していない企業も落とさず、銘柄コードなしとして保持する", () => {
    const data = buildIndustryMap({
      ...EMPTY,
      nodes: [node({})],
      companyLinks: [
        companyLink({
          company_entity_id: "c2",
          company_name: "NVIDIA",
          company_status: "draft",
          country_code: null,
          listing_status: "unknown",
          stock_id: null,
          stock_code: null,
          stock_name: null,
        }),
      ],
    });

    const link = data.domains[0]?.companyLinks[0];
    expect(link?.companyName).toBe("NVIDIA");
    expect(link?.stockCode).toBeNull();
    expect(link?.countryCode).toBeNull();
    // status / listing は Supabase 側で値が増えうるので、そのまま持つ。
    expect(link?.companyStatus).toBe("draft");
    expect(link?.listingStatus).toBe("unknown");
  });

  it("基準日はタイムスタンプでも日付だけを表示できる形で保持する", () => {
    const data = buildIndustryMap({
      ...EMPTY,
      nodes: [node({})],
      companyLinks: [companyLink({ as_of: "2026-08-26T05:26:40.59522+00:00" })],
    });

    expect(data.domains[0]?.companyLinks[0]?.asOf).toBe("2026-08-26T05:26:40.59522+00:00");
    expect(formatAsOf(data.domains[0]!.companyLinks[0]!.asOf!)).toBe("2026-08-26");
  });

  it("役割・関与・確度が未知の企業紐付けは落とす", () => {
    const data = buildIndustryMap({
      ...EMPTY,
      nodes: [node({})],
      companyLinks: [
        companyLink({ company_taxonomy_link_id: "cl3", strategic_role: "unknown_role" }),
        companyLink({ company_taxonomy_link_id: "cl4", control_type: "leased" }),
        companyLink({ company_taxonomy_link_id: "cl5", confidence: "very-high" }),
        companyLink({ company_taxonomy_link_id: "cl6", company_name: "  " }),
      ],
    });

    expect(data.domains[0]?.companyLinks).toHaveLength(0);
  });

  it("ノード数の多い domain を先に並べる", () => {
    const data = buildIndustryMap({
      ...EMPTY,
      nodes: [
        node({ id: "a1", domain: "small", display_name: "小さい業界" }),
        node({ id: "b1", domain: "large", display_name: "大きい業界" }),
        node({ id: "b2", domain: "large", display_name: "子" }),
      ],
    });

    expect(data.domains.map((item) => item.domain)).toEqual(["large", "small"]);
  });

  it("すべてのノードが親を持つ循環でも根を1つ返す", () => {
    const data = buildIndustryMap({
      ...EMPTY,
      nodes: [node({}), node({ id: "n2", display_name: "B" })],
      edges: [
        edge({}),
        edge({ id: "e2", source_node_id: "n2", target_node_id: "n1" }),
      ],
    });

    expect(data.domains[0]?.rootIds).toEqual(["n1"]);
  });
});
