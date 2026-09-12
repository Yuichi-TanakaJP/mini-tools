"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DEFAULT_VISIBLE_STATES,
  MARKET_DATA_AVAILABILITY,
  MARKET_DATA_FLOW,
  MARKET_DATA_TOUCHPOINTS,
  SYSTEM_CONTEXT_EDGES,
  SYSTEM_CONTEXT_NODES,
  SYSTEM_MAP_LAYERS,
  filterEdgesByStates,
  nodesByLayer,
  orderedFlow,
  type OpportunityClass,
  type SystemMapNode,
  type SystemMapState,
} from "./model";
import styles from "./SystemMap.module.css";

type ViewMode = "context" | "market-data";

const STATE_LABEL: Record<SystemMapState, string> = {
  current: "Current",
  runtime_observed: "Runtime observed",
  approved_proposed: "Approved proposed",
  in_development: "In development",
};

const OPPORTUNITY_LABEL: Record<OpportunityClass, string> = {
  "keep-human": "Keep human",
  "ai-assist": "AI assist",
  automate: "Automate",
  "needs-investigation": "Needs investigation",
};

function stateClass(state: SystemMapState) {
  if (state === "runtime_observed") return styles.runtime;
  if (state === "approved_proposed") return styles.proposed;
  if (state === "in_development") return styles.development;
  return styles.current;
}

function opportunityClass(opportunity: OpportunityClass) {
  if (opportunity === "keep-human") return styles.keepHuman;
  if (opportunity === "ai-assist") return styles.aiAssist;
  if (opportunity === "automate") return styles.automate;
  return styles.investigate;
}

function StateBadge({ state }: { state: SystemMapState }) {
  return <span className={`${styles.badge} ${stateClass(state)}`}>{STATE_LABEL[state]}</span>;
}

function SectionHeading({
  title,
  description,
  count,
}: {
  title: string;
  description: string;
  count?: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {count ? <span className={styles.count}>{count}</span> : null}
    </div>
  );
}

function NodeCard({ node }: { node: SystemMapNode }) {
  return (
    <article className={styles.node}>
      <div className={styles.nodeHeader}>
        <h3>{node.label}</h3>
        <StateBadge state={node.state} />
      </div>
      <p>{node.description}</p>
      <div className={styles.facts}>
        <div className={styles.fact}>
          <span>Access surface</span>
          <b>{node.accessSurfaces.length ? node.accessSurfaces.join(" · ") : "—"}</b>
        </div>
        <div className={styles.fact}>
          <span>Execution locus</span>
          <b>{node.executionLocus}</b>
        </div>
        <div className={styles.fact}>
          <span>Data residency</span>
          <b>{node.dataResidency ?? "—"}</b>
        </div>
      </div>
      <details>
        <summary className={styles.secondaryLink}>Evidence</summary>
        <ul className={styles.evidence}>
          {node.evidence.map((item) => <li key={`${node.id}-${item}`}>{item}</li>)}
        </ul>
      </details>
    </article>
  );
}

function ContextView({ showProposed, showDevelopment }: { showProposed: boolean; showDevelopment: boolean }) {
  const states = useMemo(() => {
    const next: SystemMapState[] = [...DEFAULT_VISIBLE_STATES];
    if (showProposed) next.push("approved_proposed");
    if (showDevelopment) next.push("in_development");
    return next;
  }, [showDevelopment, showProposed]);
  const visibleState = useMemo(() => new Set(states), [states]);
  const visibleNodes = useMemo(
    () => SYSTEM_CONTEXT_NODES.filter((node) => visibleState.has(node.state)),
    [visibleState],
  );
  const grouped = useMemo(() => nodesByLayer(visibleNodes), [visibleNodes]);
  const visibleEdges = useMemo(
    () => filterEdgesByStates(SYSTEM_CONTEXT_EDGES, states),
    [states],
  );
  const nodeNames = useMemo(
    () => new Map(SYSTEM_CONTEXT_NODES.map((node) => [node.id, node.label])),
    [],
  );

  return (
    <>
      <section className={styles.panel}>
        <SectionHeading
          title="System Context / Current As-Is"
          description="Access SurfaceとExecution Locusを分け、ユーザーの入口からData / Evidenceまでをレイヤー表示します。横幅が狭い場合は縦に並びます。"
          count={`${visibleNodes.length} nodes`}
        />
        <div className={styles.layerGrid}>
          {SYSTEM_MAP_LAYERS.map((layer) => (
            <section className={styles.layer} key={layer.id}>
              <div className={styles.layerTitle}>
                <strong>{layer.label}</strong>
                <span>{layer.question}</span>
              </div>
              {(grouped.get(layer.id) ?? []).map((node) => <NodeCard node={node} key={node.id} />)}
            </section>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <SectionHeading
          title="Relationships"
          description="矢印は呼出・読書き・配信・検証などの意味を持ちます。Cloud Mirrorのような未稼働確認の関係は、Proposed overlayを有効にしたときだけ表示します。"
          count={`${visibleEdges.length} edges`}
        />
        <div className={styles.edgeGrid}>
          {visibleEdges.map((edge) => (
            <article className={styles.edge} key={edge.id}>
              <div className={styles.edgeHeader}>
                <h3>{edge.label}</h3>
                <StateBadge state={edge.state} />
              </div>
              <div className={styles.edgePath}>
                <span>{nodeNames.get(edge.source) ?? edge.source}</span>
                <i>→</i>
                <span>{nodeNames.get(edge.target) ?? edge.target}</span>
              </div>
              <p>{edge.relation}</p>
              <details>
                <summary className={styles.secondaryLink}>Evidence</summary>
                <ul className={styles.evidence}>
                  {edge.evidence.map((item) => <li key={`${edge.id}-${item}`}>{item}</li>)}
                </ul>
              </details>
            </article>
          ))}
        </div>
      </section>

      <div className={styles.notice}>
        Productの状態・Repository・Technology・Providerの詳細は既存の
        {" "}<Link href="/premium/product-map/dashboard">Workspace Dashboard</Link> と
        {" "}<Link href="/premium/product-map">Product Map</Link> が担当します。この画面は、その上にUser・AI・Execution・Data・Constraintの境界を重ねるための別Read Modelです。
      </div>
    </>
  );
}

function MarketDataView() {
  const flow = useMemo(() => orderedFlow(MARKET_DATA_FLOW), []);

  return (
    <>
      <section className={styles.panel}>
        <SectionHeading
          title="Market Data Flow / Current As-Is"
          description="人の認証、ローカル処理、成果物、クラウド配信、PC・スマホ閲覧までを端から端まで分離します。"
          count={`${flow.length} steps`}
        />
        <div className={styles.flow}>
          {flow.map((step, index) => (
            <div key={step.id} style={{ display: "contents" }}>
              <article className={`${styles.flowStep} ${step.manual ? styles.flowStepManual : ""}`}>
                <span className={styles.flowIndex}>STEP {String(step.sequence).padStart(2, "0")}</span>
                <strong>{step.label}</strong>
                <small>Role: {step.role}</small>
                <small>Execution: {step.executionLocus}</small>
                <small>Access: {step.accessSurface ?? "system-to-system"}</small>
                <small>Data: {step.dataResidency ?? "—"}</small>
                {step.manual ? <span className={`${styles.badge} ${styles.keepHuman}`}>Manual touchpoint</span> : null}
              </article>
              {index < flow.length - 1 ? <div className={styles.arrow} aria-hidden="true">→</div> : null}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <SectionHeading
          title="Manual Touchpoints / AI Opportunities"
          description="手作業を一律に負債とみなさず、安全境界として残すもの、AIが補助するもの、自動化するもの、調査が必要なものへ分けます。"
        />
        <div className={styles.touchGrid}>
          {MARKET_DATA_TOUCHPOINTS.map((item) => (
            <article className={styles.touchpoint} key={item.id}>
              <div className={styles.touchHeader}>
                <h3>{item.label}</h3>
                <span className={`${styles.badge} ${opportunityClass(item.opportunity)}`}>
                  {OPPORTUNITY_LABEL[item.opportunity]}
                </span>
              </div>
              <p>{item.currentReason}</p>
              <div className={styles.constraint}><b>Constraint:</b> {item.constraint}</div>
              {item.nextQuestion ? <p><b>Next:</b> {item.nextQuestion}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <SectionHeading
          title="Failure Domain / Availability"
          description="新しいデータを作れることと、既存のクラウド成果物を閲覧できることを分けて確認します。"
        />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Scenario</th>
                <th>New generation</th>
                <th>Existing view</th>
                <th>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {MARKET_DATA_AVAILABILITY.map((item) => (
                <tr key={item.scenario}>
                  <td><b>{item.scenario}</b></td>
                  <td>{item.newGeneration}</td>
                  <td>{item.existingView}</td>
                  <td>{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default function SystemMapClient() {
  const [view, setView] = useState<ViewMode>("context");
  const [showProposed, setShowProposed] = useState(false);
  const [showDevelopment, setShowDevelopment] = useState(false);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <Link className={styles.back} href="/premium">← Premium</Link>
          <div>
            <Link className={styles.secondaryLink} href="/premium/product-map/dashboard">Workspace Dashboard</Link>
            {" · "}
            <Link className={styles.secondaryLink} href="/premium/product-map">Product Map</Link>
          </div>
        </div>

        <header className={styles.hero}>
          <div className={styles.heroTop}>
            <div>
              <div className={styles.eyebrow}>WORKSPACE CORE / SYSTEM CONTEXT</div>
              <h1>System Context Map</h1>
            </div>
            <span className={styles.readOnly}>● Read-only v0.1</span>
          </div>
          <p>
            User・AI・Product・Execution・Dataの現在のつながりを可視化し、手動介入と制約からAI支援・自動化・ループ化の候補を探します。システムを操作する画面ではありません。
          </p>
          <div className={styles.purposeGrid}>
            <div className={styles.purposeStep}><span>01 / OBSERVE</span><strong>現在の構造と実行境界を確認</strong></div>
            <div className={styles.purposeStep}><span>02 / EXPLAIN</span><strong>手作業が残る理由と制約を説明</strong></div>
            <div className={styles.purposeStep}><span>03 / CLASSIFY</span><strong>Keep human / AI assist / Automateへ分類</strong></div>
            <div className={styles.purposeStep}><span>04 / IMPROVE</span><strong>改善Backlogと検証Loopへ接続</strong></div>
          </div>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.tabs} aria-label="Map view">
            <button className={`${styles.tab} ${view === "context" ? styles.tabActive : ""}`} type="button" onClick={() => setView("context")} aria-pressed={view === "context"}>
              System Context
            </button>
            <button className={`${styles.tab} ${view === "market-data" ? styles.tabActive : ""}`} type="button" onClick={() => setView("market-data")} aria-pressed={view === "market-data"}>
              Market Data Flow
            </button>
          </div>
          {view === "context" ? (
            <div className={styles.switches} aria-label="Optional overlays">
              <button className={`${styles.switch} ${showProposed ? styles.switchActive : ""}`} type="button" onClick={() => setShowProposed((value) => !value)} aria-pressed={showProposed}>
                Approved Proposed
              </button>
              <button className={`${styles.switch} ${showDevelopment ? styles.switchActive : ""}`} type="button" onClick={() => setShowDevelopment((value) => !value)} aria-pressed={showDevelopment}>
                In Development
              </button>
            </div>
          ) : null}
        </div>

        {view === "context" ? <ContextView showProposed={showProposed} showDevelopment={showDevelopment} /> : <MarketDataView />}
      </div>
    </main>
  );
}
