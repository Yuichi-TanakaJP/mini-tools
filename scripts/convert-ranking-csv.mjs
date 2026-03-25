#!/usr/bin/env node
/**
 * convert-ranking-csv.mjs
 *
 * 内藤形式 9tables CSV を stock-ranking ページ用の JSON に変換するスクリプト。
 *
 * 使い方:
 *   node scripts/convert-ranking-csv.mjs <CSVファイルパス>
 *
 * 例:
 *   node scripts/convert-ranking-csv.mjs ~/Downloads/naito_9tables_20260131_cleaned_final.csv
 *
 * 出力:
 *   app/tools/stock-ranking/data/20260131.json
 *   app/tools/stock-ranking/data/manifest.json (更新)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../app/tools/stock-ranking/data");

function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("使い方: node scripts/convert-ranking-csv.mjs <CSVファイルパス>");
    process.exit(1);
  }

  const absPath = path.resolve(csvPath);
  if (!existsSync(absPath)) {
    console.error(`ファイルが見つかりません: ${absPath}`);
    process.exit(1);
  }

  // UTF-8 BOM 付きを考慮して読み込み
  const raw = readFileSync(absPath, "utf-8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (lines.length < 2) {
    console.error("CSVにデータ行がありません");
    process.exit(1);
  }

  const headers = lines[0].split(",");
  // 期待するカラム順: date,market,ranking,page,rank,銘柄名,コード,市場,業種,現在値,時刻,前日比値,前日比率(%),売買高(万株),売買代金(百万)
  const COL = {
    date: headers.indexOf("date"),
    market: headers.indexOf("market"),
    ranking: headers.indexOf("ranking"),
    page: headers.indexOf("page"),
    rank: headers.indexOf("rank"),
    name: headers.findIndex((h) => h.includes("銘柄") || h === "銘柄名"),
    code: headers.findIndex((h) => h.includes("コード") || h === "コード"),
    marketLabel: headers.findIndex((h) => h.includes("市場") && !h.includes("market")),
    industry: headers.findIndex((h) => h.includes("業種")),
    price: headers.findIndex((h) => h.includes("現在値")),
    time: headers.findIndex((h) => h.includes("時刻")),
    change: headers.findIndex((h) => h.includes("前日比値")),
    changeRate: headers.findIndex((h) => h.includes("前日比率")),
    volume: headers.findIndex((h) => h.includes("売買高")),
    value: headers.findIndex((h) => h.includes("売買代金")),
  };

  // カラムインデックスが取れない場合、位置で補完
  const fallback = (idx, pos) => (idx >= 0 ? idx : pos);
  const C = {
    date: fallback(COL.date, 0),
    market: fallback(COL.market, 1),
    ranking: fallback(COL.ranking, 2),
    page: fallback(COL.page, 3),
    rank: fallback(COL.rank, 4),
    name: fallback(COL.name, 5),
    code: fallback(COL.code, 6),
    marketLabel: fallback(COL.marketLabel, 7),
    industry: fallback(COL.industry, 8),
    price: fallback(COL.price, 9),
    time: fallback(COL.time, 10),
    change: fallback(COL.change, 11),
    changeRate: fallback(COL.changeRate, 12),
    volume: fallback(COL.volume, 13),
    value: fallback(COL.value, 14),
  };

  const records = [];
  let dateStr = "";

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 10) continue;

    if (!dateStr) dateStr = cols[C.date]?.trim() ?? "";

    records.push({
      market: cols[C.market]?.trim() ?? "",
      ranking: cols[C.ranking]?.trim() ?? "",
      rank: Number(cols[C.rank]) || 0,
      name: cols[C.name]?.trim() ?? "",
      code: cols[C.code]?.trim() ?? "",
      marketLabel: cols[C.marketLabel]?.trim() ?? "",
      industry: cols[C.industry]?.trim() ?? "",
      price: parseFloat(cols[C.price]) || 0,
      time: cols[C.time]?.trim() ?? "",
      change: parseFloat(cols[C.change]) || 0,
      changeRate: parseFloat(cols[C.changeRate]) || 0,
      volume: parseFloat(cols[C.volume]) || 0,
      value: parseFloat(cols[C.value]) || 0,
    });
  }

  if (!dateStr) {
    console.error("date カラムが読み取れませんでした");
    process.exit(1);
  }

  // YYYY-MM-DD → YYYYMMDD (ファイル名用)
  const fileKey = dateStr.replace(/-/g, "");
  const outJson = { date: dateStr, records };

  // data ディレクトリ作成
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // JSON 書き出し
  const outPath = path.join(DATA_DIR, `${fileKey}.json`);
  writeFileSync(outPath, JSON.stringify(outJson, null, 2), "utf-8");
  console.log(`✅ 書き出し完了: ${outPath} (${records.length} 件)`);

  // manifest 更新
  const manifestPath = path.join(DATA_DIR, "manifest.json");
  let manifest = { dates: [] };
  if (existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    } catch {
      // 壊れていれば初期化
    }
  }

  if (!manifest.dates.includes(dateStr)) {
    manifest.dates.push(dateStr);
    manifest.dates.sort((a, b) => (a < b ? 1 : -1)); // 新しい順
  }
  manifest.latest = manifest.dates[0];

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`✅ manifest 更新: ${manifestPath}`);
}

main();
