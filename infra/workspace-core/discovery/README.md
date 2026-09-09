# Workspace Core Executable Discovery

Repository内の実行入口、呼出候補、端末・実行場所、手動介入、制約を、**対象コードを実行せず**静的に抽出するScannerです。

- 親Issue: #598
- 実装Issue: #601
- 実装PR: #603

## 位置づけ

このScannerの出力は、Workspace Coreへ確定登録する事実ではありません。

```text
Repository source / manifest / docs / declared map
→ read-only Scanner
→ discovered candidates
→ Evidence review
→ accepted / rejected
→ typed registry / flow read model
```

全候補は`review_status: discovered`で出力されます。Scanner自身はDBへ接続せず、accepted化もしません。

## 単一Repositoryを走査する

Python 3.11以上の標準ライブラリだけで動作します。

```bash
python infra/workspace-core/discovery/discover_executables.py \
  --repo ../market_info \
  --repository Yuichi-TanakaJP/market_info \
  --repository-ref <commit-sha> \
  --output ./tmp/market_info.executables.json
```

`--repository-ref`は呼出側が取得して渡します。単一Repository Scannerは`git`を起動しません。省略時は`unknown`です。

標準出力へ出す場合:

```bash
python infra/workspace-core/discovery/discover_executables.py \
  --repo . \
  --repository Yuichi-TanakaJP/mini-tools
```

## Windows PC上の初期6Repositoryを一括走査する

初期対象はprivate Repositoryです。通常の`mini-tools`用`GITHUB_TOKEN`へ横断checkout権限を追加せず、ユーザーPC上ですでに認証・管理されているcloneを読み取ります。

対象:

- `mini-tools`
- `market_info`
- `pc-saas-health-monitor`
- `market-info-api`
- `stock-notes`
- `claude-skills`

`~/dev`配下にcloneがある場合:

```powershell
python infra/workspace-core/discovery/run_initial_scan.py --strict
```

別の親フォルダを使う場合:

```powershell
python infra/workspace-core/discovery/run_initial_scan.py `
  --dev-root D:/dev `
  --output-root D:/tmp/workspace-core-discovery `
  --strict
```

既定の出力先は`~/dev/_workspace-core-discovery`です。

```text
summary.json
mini-tools.executables.json
market-info.executables.json
pc-saas-health-monitor.executables.json
market-info-api.executables.json
stock-notes.executables.json
claude-skills.executables.json
```

ローカルランナーが実行するGit操作は、現在の証跡を付けるための次の読み取りだけです。

```text
git rev-parse HEAD
git status --porcelain
```

fetch、checkout、reset、clean、commit、pushは行いません。未追跡ファイルもScanner対象になり得るため、未追跡ファイルがあるRepositoryは`dirty`として記録します。変更ファイル名やローカル絶対パスはsummaryへ出力しません。

Repositoryが見つからない場合は`missing_repositories`へ記録します。`--strict`指定時のみ、欠落があれば終了コード2を返します。

## 検出対象 v0.1

### Python

- `pyproject.toml`の`[project.scripts]`
- `if __name__ == "__main__"`
- `argparse`
- 静的に解決できる`subprocess`呼出し
- FastAPI app / `include_router`
- `PIPELINE_EDGES`を持つdeclared pipeline map

### Node / Next.js

- `package.json` scripts
- `app/api/**/route.*`のRoute Handler
  - `export function GET()`
  - `export async function GET()`
  - `export const GET = ...`

### Windows運用

- PowerShell / BAT / CMD
- `schtasks /Create` / `Register-ScheduledTask`
- 参照されるscript・主要CLI候補

### Cloud

- GitHub Actions workflow
- Cloud Build pipeline
- Docker `CMD` / `ENTRYPOINT`

### Agent Harness

- `AGENTS.md` / `CLAUDE.md`
- `.claude/skills/**/SKILL.md`
- Skill文書中のhelper command / script参照

### Existing Map

- `PIPELINE_EDGES`
- `system_map*.yaml`

## 5つの観測軸

Scanner候補は、親Workstreamで固定した次の軸へ接続する前提です。

1. Access Surface — ユーザーはどこから触るか
2. Device Capability — 閲覧・指示・承認・実行・復旧のどこまで可能か
3. Execution Locus — 処理本体はどこで動くか
4. Data Residency / SoT — 正本・履歴・成果物はどこにあるか
5. Availability Dependency — PC停止、Cloud障害、認証切れ等で何が止まるか

`スマホで見られる`と`スマホ上で処理が動く`は別の属性です。

## 出力契約

トップレベル:

```json
{
  "schema_version": "0.1",
  "repository": "owner/repo",
  "repository_ref": "commit-sha-or-unknown",
  "scan_mode": "read_only_static_candidate_discovery",
  "review_status": "discovered",
  "scanned_files": [],
  "candidate_count": 0,
  "candidates": []
}
```

Candidateには次を含みます。

- path / symbol_or_route / executable_type
- command
- trigger_types / actor_types / access_surfaces
- execution_locus
- invokes
- input_candidates / output_candidates
- manual_touchpoints / constraints
- verifier_candidates
- evidence
- confidence
- review_status

出力には生成時刻を含めません。同じRepository内容・同じ`repository_ref`に対して安定したJSONになることを優先します。

## 安全境界

Scannerは次を行いません。

- Repository内のPython、Node、PowerShell、Workflow等を実行する
- Browser login、API login、MFAを行う
- `.env*`を読む
- OS credential storeやSecret値を読む
- Supabaseや他DBへ書き込む
- discovered候補を自動accepted化する
- ローカルの絶対ホームパスを出力する

ローカル一括ランナーも、対象Repositoryに対するfetch、checkout、reset、clean、commit、pushを行いません。

以下は出力前に伏せます。

- Secretらしいflagの後続値
- `API_TOKEN=value`等の環境変数代入値
- Authorization値
- URLへ埋め込まれたcredential
- Windows、Linux、macOSのユーザーホーム部分

`node_modules`、`.git`、`.venv`、`.next`、build、dist等は、ファイルを除外するだけでなくDirectory探索前に枝刈りします。

## テスト

```bash
python -m unittest discover \
  -s infra/workspace-core/discovery/tests \
  -v
```

Fixtureで確認する内容:

- Python package entry / main / subprocess
- FastAPI app
- Next.js function / const Route Handler
- PowerShell Task Scheduler登録
- GitHub Actions
- Docker / Cloud Build
- Agent Skill / Harness Contract
- declared System Map
- 初期Repository一括ランナー
- 未追跡ファイルを含むdirty判定
- 出力の決定性
- `.env`、Secret値、ローカル絶対パスの非出力
- ignored directoryの枝刈り

## v0.1の限界

- Runtimeで実際に起動していることは証明しません。
- 動的に組み立てられたsubprocess、API URL、Pathは見落とす可能性があります。
- Script名やkeywordによる候補にはfalse positiveがあり得ます。
- 外部Scheduler、Cloud Console設定、ローカルTask Schedulerの実状態は取得しません。
- Documentationやhand-written mapは`declared design`であり、runtime factとは分離します。
- Input / Output / Constraintは候補で、Evidence review後に確定します。
- `dirty`なRepositoryのcommit SHAだけでは走査内容を完全再現できません。結果は実行時snapshotとしてレビューします。

## 既存Mapとの関係

### market_info Data Pipeline Map

`market_info/scripts/build_data_pipeline_map.py`の`PIPELINE_EDGES`は、人が保守する有用なdeclared pipelineです。Scannerはこれを削除・置換せず、codeやmanifestから得た候補と比較する入力にします。

### Health Monitor System Map

Health MonitorのSystem Mapは、手描きの意味ある配置と実測status overlayを両立しています。Workspace Coreは関係性とEvidenceのSoT、Health Monitorは運用状態を重ねる表示・観測面として再利用する想定です。

## 次の段階

1. Windows PC上の初期6cloneへローカルランナーを実行
2. 手作業のExecutable Inventory v0.1と差分比較
3. `declared-only / code-only / runtime-unverified / false-positive / false-negative`へ分類
4. false positive / false negativeをfixtureへ追加
5. `discovered → accepted / rejected`のレビュー手順を確定
6. 出力を見てから、Executable / Interface / Data Resourceの型付きDB schemaを決定
