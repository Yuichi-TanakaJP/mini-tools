# Workspace Core Executable Discovery

Repository内の実行入口、呼出候補、端末・実行場所、手動介入、制約を、**コードを実行せず**静的に抽出するためのScannerです。

親Issue: #598  
実装Issue: #601

## 位置づけ

このScannerの出力はWorkspace Coreへ確定登録する事実ではありません。

```text
Repository source / manifest / docs / declared map
→ read-only Scanner
→ discovered candidates
→ Evidence review
→ accepted / rejected
→ typed registry / flow read model
```

全候補は `review_status: discovered` で出力されます。Scanner自身はDBへ接続せず、accepted化もしません。

## 実行

Python 3.11以上の標準ライブラリだけで動作します。

```bash
python infra/workspace-core/discovery/discover_executables.py \
  --repo ../market_info \
  --repository Yuichi-TanakaJP/market_info \
  --repository-ref <commit-sha> \
  --output ./tmp/market_info.executables.json
```

`--repository-ref` は呼出側が取得して渡します。Scannerは`git`を起動しません。省略時は`unknown`です。

標準出力へ出す場合:

```bash
python infra/workspace-core/discovery/discover_executables.py \
  --repo . \
  --repository Yuichi-TanakaJP/mini-tools
```

## 検出対象 v0.1

- Python
  - `pyproject.toml`の`[project.scripts]`
  - `if __name__ == "__main__"`
  - `argparse`
  - 静的に解決できる`subprocess`呼出し
  - FastAPI app / `include_router`
  - `PIPELINE_EDGES`を持つdeclared pipeline map
- Node / Next.js
  - `package.json` scripts
  - `app/api/**/route.ts`等のRoute Handler
- Windows運用
  - PowerShell / BAT / CMD
  - `schtasks /Create` / `Register-ScheduledTask`
  - 参照されるscript・主要CLI候補
- Cloud
  - GitHub Actions workflow
  - Cloud Build pipeline
  - Docker `CMD` / `ENTRYPOINT`
- Agent Harness
  - `AGENTS.md` / `CLAUDE.md`
  - `.claude/skills/**/SKILL.md`
  - Skill文書中のhelper command / script参照
- Existing Map
  - `system_map*.yaml`

## 5つの観測軸

Scanner候補は、親Workstreamで固定した以下の軸へ接続する前提です。

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

Candidateには以下を含みます。

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
- `git`、`gh`、Cloud CLIを呼ぶ
- `.env*`を読む
- OS credential storeやSecret値を読む
- Browser login、API login、MFAを行う
- Supabaseや他DBへ書き込む
- Repositoryへcommit / pushする
- discovered候補を自動accepted化する
- ローカルの絶対ホームパスを出力する

Sensitiveなflag名を検出した場合、後続値は`<redacted>`へ置換します。

## テスト

```bash
python -m unittest discover \
  -s infra/workspace-core/discovery/tests \
  -v
```

テストfixtureで確認する内容:

- Python package entry / main / subprocess
- FastAPI app
- Next.js Route Handler
- PowerShell Task Scheduler登録
- GitHub Actions
- Docker / Cloud Build
- Agent Skill / Harness Contract
- declared System Map
- 出力の決定性
- `.env`、Secret値、ローカル絶対パスの非出力

## v0.1の限界

- Runtimeで実際に起動していることは証明しません。
- 動的に組み立てられたsubprocess、API URL、Pathは見落とす可能性があります。
- Script名やkeywordによる候補にはfalse positiveがあり得ます。
- 外部Scheduler、Cloud Console設定、ローカルTask Schedulerの実状態は取得しません。
- Documentationやhand-written mapは`declared design`であり、runtime factとは分離します。
- Input / Output / Constraintは候補で、Evidence review後に確定します。

## 既存Mapとの関係

### market_info Data Pipeline Map

`market_info/scripts/build_data_pipeline_map.py`の`PIPELINE_EDGES`は、人が保守する有用なdeclared pipelineです。Scannerはこれを削除・置換せず、コードやmanifestから得た候補と比較する入力にします。

### Health Monitor System Map

Health MonitorのSystem Mapは、手描きの意味ある配置と実測status overlayを両立しています。Workspace Coreは関係性とEvidenceのSoT、Health Monitorは運用状態を重ねる表示・観測面として再利用する想定です。

## 次の段階

1. 初期6Repositoryのローカルcloneに対してScannerを実行
2. 既存手作業Inventoryと差分比較
3. false positive / false negativeをfixtureへ追加
4. `discovered → accepted / rejected`のレビュー手順を確定
5. Scanner出力を見てから、Executable / Interface / Data Resourceの型付きDB schemaを決定
