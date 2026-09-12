export type SystemMapState = "current" | "runtime_observed" | "approved_proposed" | "in_development";
export type SystemMapLayer = "access" | "control" | "system" | "execution" | "data";
export type OpportunityClass = "keep-human" | "ai-assist" | "automate" | "needs-investigation";

export type SystemMapNode = {
  id: string;
  label: string;
  description: string;
  layer: SystemMapLayer;
  state: SystemMapState;
  accessSurfaces: string[];
  executionLocus: string;
  dataResidency: string | null;
  evidence: string[];
};

export type SystemMapEdge = {
  id: string;
  source: string;
  target: string;
  relation: "instructs" | "approves" | "invokes" | "schedules" | "reads" | "writes" | "publishes" | "consumes" | "mirrors" | "observes" | "verifies" | "deploys";
  label: string;
  state: SystemMapState;
  evidence: string[];
};

export type FlowStep = {
  id: string;
  sequence: number;
  label: string;
  role: "human" | "interface" | "executable" | "data" | "service";
  executionLocus: string;
  accessSurface: string | null;
  dataResidency: string | null;
  state: SystemMapState;
  manual: boolean;
  evidence: string[];
};

export type ManualTouchpoint = {
  id: string;
  label: string;
  currentReason: string;
  constraint: string;
  opportunity: OpportunityClass;
  nextQuestion: string | null;
};

export type AvailabilityScenario = {
  scenario: string;
  newGeneration: string;
  existingView: string;
  note: string;
};

export const SYSTEM_MAP_LAYERS: Array<{
  id: SystemMapLayer;
  label: string;
  question: string;
}> = [
  { id: "access", label: "User / Access", question: "誰が、どの端末から触るか" },
  { id: "control", label: "AI / Control", question: "意図・指示・承認をどこで扱うか" },
  { id: "system", label: "Products / Systems", question: "価値や機能をどのProductが提供するか" },
  { id: "execution", label: "Execution / Runtime", question: "処理本体がどこで動くか" },
  { id: "data", label: "Data / Evidence", question: "正本・成果物・履歴がどこに残るか" },
];

export const SYSTEM_CONTEXT_NODES: SystemMapNode[] = [
  {
    id: "user",
    label: "User",
    description: "目的を入力し、重要な判断・認証・承認を行う。",
    layer: "access",
    state: "current",
    accessSurfaces: ["Windows PC", "Smartphone"],
    executionLocus: "human",
    dataResidency: null,
    evidence: ["Issue #598", "Workstream personal-system-architecture-loop"],
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    description: "相談・調査・Connected Tool経由のクラウド操作を行う主要Control Surface。",
    layer: "control",
    state: "runtime_observed",
    accessSurfaces: ["PC browser", "Smartphone app"],
    executionLocus: "hosted AI runtime",
    dataResidency: "chat history（SoTではない）",
    evidence: ["Issue #598 runtime observation", "Portfolio chat-first operating model"],
  },
  {
    id: "claude-code",
    label: "Claude Code",
    description: "ローカルRepository・Windows環境で実装、テスト、実機確認を行うCoding Agent。",
    layer: "control",
    state: "current",
    accessSurfaces: ["Windows PC terminal", "VS Code"],
    executionLocus: "local Windows PC",
    dataResidency: "local working tree / GitHub after push",
    evidence: ["AGENTS.md", "pc-saas-health-monitor/docs/TEAM_WORKFLOW.md"],
  },
  {
    id: "mini-tools",
    label: "Mini Tools",
    description: "保存済みデータと判断をWeb画面で横断表示するUser Interface。",
    layer: "system",
    state: "current",
    accessSurfaces: ["PC browser", "Smartphone browser"],
    executionLocus: "Vercel / browser",
    dataResidency: "read models and client-local data by tool",
    evidence: ["Workspace Core Product Map V1", "Workspace Dashboard"],
  },
  {
    id: "stock-notes",
    label: "Stock Notes",
    description: "投資判断・テーマ・ポートフォリオのAPIと正本契約を提供する。",
    layer: "system",
    state: "current",
    accessSurfaces: ["ChatGPT Actions", "API"],
    executionLocus: "Cloud Run",
    dataResidency: "Supabase investment domain",
    evidence: ["stock-notes/docs/portfolio-platform-v2.md", "Workspace Core registry"],
  },
  {
    id: "market-info",
    label: "Market Info",
    description: "市場データをローカルで取得・変換し、成果物を生成する。",
    layer: "system",
    state: "current",
    accessSurfaces: ["Windows PowerShell", "local browser session"],
    executionLocus: "local Windows PC",
    dataResidency: "local artifacts then R2",
    evidence: ["market_info/docs/operations/daily_operations.md", "market_info/scripts/run_naito_and_backup.ps1"],
  },
  {
    id: "market-info-api",
    label: "Market Info API",
    description: "R2の市場成果物をMini Tools向けに配信するthin API。",
    layer: "system",
    state: "current",
    accessSurfaces: ["HTTP API"],
    executionLocus: "Cloud Run",
    dataResidency: "runtime cache / R2 source",
    evidence: ["Workspace Core product relation: Mini Tools consumes Market Info"],
  },
  {
    id: "health-monitor",
    label: "PC / SaaS Health Monitor",
    description: "PC・SaaS状態をlocal-firstで収集・判定し、警告と履歴を管理する。",
    layer: "system",
    state: "current",
    accessSurfaces: ["Windows tray", "localhost dashboard", "CLI"],
    executionLocus: "local Windows PC",
    dataResidency: "local SQLite Operational SoT",
    evidence: ["pc-saas-health-monitor/docs/ARCHITECTURE.md", "Issue #168"],
  },
  {
    id: "local-windows",
    label: "Windows Local Runtime",
    description: "認証済みブラウザ、PowerShell、Python、Task Scheduler、ローカルAgentを実行する。",
    layer: "execution",
    state: "current",
    accessSurfaces: ["Windows PC"],
    executionLocus: "local Windows PC",
    dataResidency: "local filesystem / process state",
    evidence: ["Issue #598 device boundary observations"],
  },
  {
    id: "github",
    label: "GitHub / Actions",
    description: "Code・Issue・PRの正本と、lint・test・buildのCloud Verification Plane。",
    layer: "execution",
    state: "current",
    accessSurfaces: ["Web", "Git CLI", "Connected Tool"],
    executionLocus: "GitHub cloud",
    dataResidency: "Git repository / issue / CI evidence",
    evidence: ["mini-tools/AGENTS.md", "mini-tools/.github/workflows/ci.yml"],
  },
  {
    id: "vercel",
    label: "Vercel",
    description: "Mini ToolsのWeb runtimeとPreview / Production deploymentを提供する。",
    layer: "execution",
    state: "current",
    accessSurfaces: ["Web runtime", "deployment dashboard"],
    executionLocus: "Vercel cloud",
    dataResidency: "deployment artifacts / runtime logs",
    evidence: ["mini-tools Product Map runtime provider"],
  },
  {
    id: "cloud-run",
    label: "Google Cloud Run",
    description: "Stock NotesやMarket Info APIのAPI runtimeを提供する。",
    layer: "execution",
    state: "current",
    accessSurfaces: ["HTTP API", "Cloud console"],
    executionLocus: "Google Cloud",
    dataResidency: "container revision / runtime logs",
    evidence: ["stock-notes Cloud Build / Cloud Run contract", "market-info-api runtime"],
  },
  {
    id: "workspace-core",
    label: "Workspace Core",
    description: "システム構造、関係、Workstream、重要な観測履歴の正本。",
    layer: "data",
    state: "current",
    accessSurfaces: ["server-only API", "Connected Tool"],
    executionLocus: "Supabase",
    dataResidency: "workspace-core database",
    evidence: ["registry / flow / coordination schemas", "Product Map read views"],
  },
  {
    id: "investment-db",
    label: "Investment Supabase",
    description: "ポートフォリオ・テーマ・判断履歴など投資ドメインの正本。",
    layer: "data",
    state: "current",
    accessSurfaces: ["Stock Notes API", "Mini Tools server reads"],
    executionLocus: "Supabase",
    dataResidency: "investment domain database",
    evidence: ["Portfolio Platform V2"],
  },
  {
    id: "r2",
    label: "Cloudflare R2",
    description: "Market Infoが生成したJSON等をクラウド配信するObject Storage。",
    layer: "data",
    state: "current",
    accessSurfaces: ["Publisher", "Market Info API"],
    executionLocus: "Cloudflare cloud",
    dataResidency: "published market artifacts",
    evidence: ["market_info architecture", "market_info publish wrapper"],
  },
  {
    id: "local-artifacts",
    label: "Local Files / SQLite",
    description: "市場成果物・ログ・Health Monitor履歴など、ローカル実行の一次証跡。",
    layer: "data",
    state: "current",
    accessSurfaces: ["Windows filesystem", "localhost services"],
    executionLocus: "local Windows PC",
    dataResidency: "local filesystem / SQLite",
    evidence: ["market_info output contract", "health_center.db contract"],
  },
];

export const SYSTEM_CONTEXT_EDGES: SystemMapEdge[] = [
  { id: "user-chatgpt", source: "user", target: "chatgpt", relation: "instructs", label: "相談・指示・承認", state: "runtime_observed", evidence: ["Issue #598 smartphone runtime evidence"] },
  { id: "user-claude", source: "user", target: "claude-code", relation: "instructs", label: "実装・ローカル確認を依頼", state: "current", evidence: ["Development workflow"] },
  { id: "chatgpt-workspace", source: "chatgpt", target: "workspace-core", relation: "reads", label: "構造・Workstreamを参照", state: "runtime_observed", evidence: ["Connected Tool runtime evidence"] },
  { id: "chatgpt-workspace-write", source: "chatgpt", target: "workspace-core", relation: "writes", label: "合意・進捗・Evidenceを記録", state: "runtime_observed", evidence: ["Connected Tool runtime evidence"] },
  { id: "chatgpt-stock-notes", source: "chatgpt", target: "stock-notes", relation: "invokes", label: "投資文脈の取得・保存", state: "current", evidence: ["Portfolio chat-first operating model"] },
  { id: "claude-github", source: "claude-code", target: "github", relation: "writes", label: "branch / commit / PR", state: "current", evidence: ["Development workflow"] },
  { id: "github-actions", source: "github", target: "github", relation: "verifies", label: "lint / test / build", state: "current", evidence: ["mini-tools CI"] },
  { id: "github-vercel", source: "github", target: "vercel", relation: "deploys", label: "Mini Toolsをdeploy", state: "current", evidence: ["mini-tools deployment contract"] },
  { id: "github-cloud-run", source: "github", target: "cloud-run", relation: "deploys", label: "API containerをdeploy", state: "current", evidence: ["Cloud Build contracts"] },
  { id: "mini-workspace", source: "mini-tools", target: "workspace-core", relation: "reads", label: "Product / Service read model", state: "current", evidence: ["PR #563 / #569"] },
  { id: "mini-stock-notes", source: "mini-tools", target: "stock-notes", relation: "consumes", label: "投資read model / API", state: "current", evidence: ["Workspace Core product relation"] },
  { id: "market-local", source: "market-info", target: "local-artifacts", relation: "writes", label: "CSV / JSON / PNG / logs", state: "current", evidence: ["market_info daily operations"] },
  { id: "market-r2", source: "market-info", target: "r2", relation: "publishes", label: "fresh artifactを公開", state: "current", evidence: ["market_info publish wrapper"] },
  { id: "r2-api", source: "r2", target: "market-info-api", relation: "consumes", label: "published artifactを配信", state: "current", evidence: ["market-info-api architecture"] },
  { id: "api-mini", source: "market-info-api", target: "mini-tools", relation: "consumes", label: "市場データを表示", state: "current", evidence: ["Workspace Core product relation"] },
  { id: "health-local", source: "health-monitor", target: "local-artifacts", relation: "writes", label: "Operational SoT", state: "current", evidence: ["Health Monitor architecture"] },
  { id: "health-workspace", source: "health-monitor", target: "workspace-core", relation: "mirrors", label: "重要状態・遷移をCloud Mirror", state: "approved_proposed", evidence: ["Issue #168; runtime not yet verified"] },
  { id: "stock-db", source: "stock-notes", target: "investment-db", relation: "reads", label: "投資文脈を取得", state: "current", evidence: ["Portfolio Platform V2"] },
  { id: "stock-db-write", source: "stock-notes", target: "investment-db", relation: "writes", label: "判断・Action・履歴を保存", state: "current", evidence: ["Portfolio Platform V2"] },
];

export const MARKET_DATA_FLOW: FlowStep[] = [
  { id: "md-user", sequence: 1, label: "User on Windows PC", role: "human", executionLocus: "human", accessSurface: "Windows PC", dataResidency: null, state: "current", manual: true, evidence: ["daily operations"] },
  { id: "md-auth", sequence: 2, label: "Browser login / 2FA", role: "interface", executionLocus: "local browser session", accessSurface: "Windows browser", dataResidency: "session state", state: "current", manual: true, evidence: ["market_info login contract"] },
  { id: "md-wrapper", sequence: 3, label: "PowerShell wrapper", role: "executable", executionLocus: "local Windows PC", accessSurface: "PowerShell / shortcut", dataResidency: null, state: "current", manual: true, evidence: ["scripts/run_naito_and_backup.ps1"] },
  { id: "md-orchestrator", sequence: 4, label: "Python orchestrator / child jobs", role: "executable", executionLocus: "local Python venv", accessSurface: null, dataResidency: null, state: "current", manual: false, evidence: ["src/cli/naito_daily_run.py"] },
  { id: "md-local", sequence: 5, label: "Local CSV / JSON / PNG / logs", role: "data", executionLocus: "local Windows PC", accessSurface: "filesystem", dataResidency: "local output and backup mirror", state: "current", manual: false, evidence: ["market_info output contract"] },
  { id: "md-r2", sequence: 6, label: "Cloudflare R2", role: "data", executionLocus: "Cloudflare cloud", accessSurface: null, dataResidency: "published artifacts", state: "current", manual: false, evidence: ["publish wrapper"] },
  { id: "md-api", sequence: 7, label: "Market Info API", role: "service", executionLocus: "Cloud Run", accessSurface: "HTTP API", dataResidency: "runtime cache", state: "current", manual: false, evidence: ["market-info-api"] },
  { id: "md-mini", sequence: 8, label: "Mini Tools", role: "interface", executionLocus: "Vercel / browser", accessSurface: "Web UI", dataResidency: "read model / fallback assets", state: "current", manual: false, evidence: ["mini-tools market views"] },
  { id: "md-view", sequence: 9, label: "PC / Smartphone view", role: "human", executionLocus: "human", accessSurface: "PC or Smartphone browser", dataResidency: null, state: "current", manual: true, evidence: ["device boundary observation; smartphone UAT pending"] },
];

export const MARKET_DATA_TOUCHPOINTS: ManualTouchpoint[] = [
  {
    id: "start-run",
    label: "日次処理を開始する",
    currentReason: "正式入口はWindows上のPowerShell wrapper。Task Schedulerの現行登録状態は未確認。",
    constraint: "local machine dependency / runtime evidence missing",
    opportunity: "needs-investigation",
    nextQuestion: "現在のTask Scheduler登録・最終成功runを確認する。",
  },
  {
    id: "login-mfa",
    label: "証券サイトへログイン・2FA",
    currentReason: "認証済みブラウザセッションを作るため、人間の操作を残している。",
    constraint: "authentication / MFA / session / terms",
    opportunity: "keep-human",
    nextQuestion: "ログイン完了後の自動再開だけを安全に改善できるか。",
  },
  {
    id: "failure-diagnosis",
    label: "失敗時にローカルログと成果物を調べる",
    currentReason: "主要ログとdebug artifactがローカルPCへ残る。",
    constraint: "local diagnostics dependency",
    opportunity: "ai-assist",
    nextQuestion: "ログ要約と原因分類をHealth Monitorへ渡せるか。",
  },
  {
    id: "freshness-check",
    label: "日付・件数・Schema・公開結果を確認する",
    currentReason: "複数成果物と公開先を人が横断確認する余地が残る。",
    constraint: "data quality / freshness verification",
    opportunity: "automate",
    nextQuestion: "manifest・API・Mini Tools表示を同じrun IDで検証できるか。",
  },
];

export const MARKET_DATA_AVAILABILITY: AvailabilityScenario[] = [
  {
    scenario: "Local PC off",
    newGeneration: "停止",
    existingView: "公開済みartifactとCloud serviceが生きていれば閲覧可能",
    note: "新規生成と既存成果物の閲覧可否を分離する。",
  },
  {
    scenario: "Network unavailable",
    newGeneration: "外部取得・publishは停止",
    existingView: "ローカル既存成果物は確認可能",
    note: "認証・外部Source・Cloud配信へ到達できない。",
  },
  {
    scenario: "R2 / API unavailable",
    newGeneration: "ローカル生成は継続可能",
    existingView: "Web表示は劣化。fallbackの鮮度確認が必要",
    note: "生成面と配信面を別Failure Domainとして扱う。",
  },
  {
    scenario: "Smartphone only",
    newGeneration: "現在の正式経路では不可",
    existingView: "公開済みWeb成果物は閲覧候補",
    note: "スマホ実機UATと安全なremote runnerの有無は未確認。",
  },
];

export const DEFAULT_VISIBLE_STATES: SystemMapState[] = ["current", "runtime_observed"];

export function filterEdgesByStates(
  edges: SystemMapEdge[],
  states: SystemMapState[],
): SystemMapEdge[] {
  const visible = new Set(states);
  return edges.filter((edge) => visible.has(edge.state));
}

export function nodesByLayer(nodes: SystemMapNode[]): Map<SystemMapLayer, SystemMapNode[]> {
  const result = new Map<SystemMapLayer, SystemMapNode[]>();
  for (const layer of SYSTEM_MAP_LAYERS) result.set(layer.id, []);
  for (const node of nodes) result.get(node.layer)?.push(node);
  return result;
}

export function orderedFlow(steps: FlowStep[]): FlowStep[] {
  return [...steps].sort((a, b) => a.sequence - b.sequence);
}
