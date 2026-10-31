import { getPositionAllocationBucket, type PortfolioAllocationDimension, type PortfolioAllocationItem, type PortfolioAllocationScope } from "./allocation";
import { reportedPeriodDividend } from "./dividend-display";
import { emptyDomesticDividendProjection, type DomesticDividendPosition, type DomesticDividendProjection } from "./dividend-income";
import type { PortfolioInstrumentAnalysis, PortfolioPosition } from "./types";

export type AnalysisGroup = PortfolioAllocationItem & {
  positions: PortfolioPosition[];
  missingValueCount: number;
  memberKeys: string[];
  isOther: boolean;
};

export function buildAnalysisGroups(positions: PortfolioPosition[], analysis: PortfolioInstrumentAnalysis[], dimension: PortfolioAllocationDimension, scope: PortfolioAllocationScope) {
  const analyses = new Map(analysis.map((item) => [item.instrumentId, item]));
  const groups = new Map<string, AnalysisGroup>();
  for (const position of positions) {
    if (scope === "equity" && !["domestic_stock", "foreign_stock"].includes(position.assetType)) continue;
    const bucket = getPositionAllocationBucket(position, dimension, analyses.get(position.instrumentId));
    const key = `bucket:${bucket.key}`;
    const group = groups.get(key) ?? { ...bucket, key, marketValue: 0, percentage: 0, positionCount: 0, instrumentCount: 0, positions: [], missingValueCount: 0, memberKeys: [key], isOther: false };
    group.positions.push(position);
    group.positionCount++;
    if (position.marketValue === null) group.missingValueCount++;
    else group.marketValue += position.marketValue;
    groups.set(key, group);
  }
  const total = [...groups.values()].reduce((sum, group) => sum + group.marketValue, 0);
  const all = [...groups.values()].map((group) => ({ ...group, percentage: total > 0 ? group.marketValue / total * 100 : 0, instrumentCount: new Set(group.positions.map((p) => p.instrumentId)).size }))
    .sort((a, b) => b.marketValue - a.marketValue || a.label.localeCompare(b.label, "ja"));
  const classified = all.filter((group) => !group.isUnclassified);
  if (classified.length <= 7) return { all, visible: all, total };
  const rest = classified.slice(6);
  const positionsInOther = rest.flatMap((group) => group.positions);
  const other: AnalysisGroup = {
    key: "aggregate:other", label: `その他 ${rest.length}分類`, isOther: true, isUnclassified: false,
    marketValue: rest.reduce((sum, group) => sum + group.marketValue, 0),
    percentage: rest.reduce((sum, group) => sum + group.percentage, 0),
    positionCount: positionsInOther.length, instrumentCount: new Set(positionsInOther.map((p) => p.instrumentId)).size,
    positions: positionsInOther, missingValueCount: rest.reduce((sum, group) => sum + group.missingValueCount, 0), memberKeys: rest.map((group) => group.key),
  };
  return { all, visible: [...classified.slice(0, 6), other, ...all.filter((group) => group.isUnclassified)], total };
}

function quantities(positions: PortfolioPosition[]) {
  const result = new Map<string, number>();
  for (const p of positions.filter((p) => p.assetType === "domestic_stock")) {
    const previous = result.get(p.instrumentId) ?? 0;
    result.set(p.instrumentId, p.quantityKnown === true && Number.isFinite(p.quantity) && p.quantity >= 0 && Number.isFinite(previous) ? previous + p.quantity : NaN);
  }
  return result;
}

/** Derive only this selection's amount from DB-normalized values; never by market value. */
export function selectDividendProjection(source: DomesticDividendProjection | undefined, allPositions: PortfolioPosition[], selectedPositions: PortfolioPosition[]): DomesticDividendProjection | undefined {
  if (!source) return undefined;
  const whole = quantities(allPositions), selected = quantities(selectedPositions);
  if (selected.size === 0) return emptyDomesticDividendProjection("no_domestic_stocks", source.asOf);
  if (["error", "no_snapshot"].includes(source.status)) return { ...emptyDomesticDividendProjection(source.status, source.asOf), expectedStocks: selected.size };
  const byId = new Map(source.positions.map((p) => [p.instrumentId, p]));
  const uniqueSource = byId.size === source.positions.length && source.expectedStocks === whole.size && [...byId.keys()].every((id) => whole.has(id));
  const scoped: DomesticDividendPosition[] = [];
  for (const [id, quantity] of selected) {
    const original = byId.get(id);
    if (!original) continue;
    const fullQuantity = whole.get(id);
    const valid = source.sourceIntegrity === true && uniqueSource
      && fullQuantity !== undefined && Number.isFinite(fullQuantity) && fullQuantity > 0
      && Number.isFinite(quantity) && quantity >= 0 && quantity <= fullQuantity
      && original.quantity !== null && Math.abs(original.quantity - fullQuantity) < 0.00000001;
    // Check the full reported amount before scaling; a small selection must not hide its error.
    const reported = valid ? reportedPeriodDividend(source, original) : null;
    const ratio = valid ? quantity / fullQuantity! : null;
    const scale = (value: number | null) => value !== null && Number.isFinite(value) && ratio !== null ? value * ratio : null;
    scoped.push({ ...original, forecastDps: valid ? original.forecastDps : null, actualDps: valid ? original.actualDps : null, quantity: Number.isFinite(quantity) ? quantity : null,
      annualGross: valid && original.cashProjectionStatus === "resolved" ? scale(original.annualGross) : null,
      reportedForecastDps: reported?.dps ?? null,
      reportedForecastGross: reported ? scale(reported.gross) : null,
      priorRunRateGross: scale(original.priorRunRateGross), rateEffectGross: scale(original.rateEffectGross),
      cashProjectionStatus: valid ? original.cashProjectionStatus : "selection_quantity_or_source_unverified",
      changeType: valid ? original.changeType : "not_comparable",
    });
  }
  const at = Date.parse(source.asOf ?? "");
  const complete = source.sourceIntegrity === true && uniqueSource && scoped.length === selected.size
    && scoped.every((p) => p.cashProjectionStatus === "resolved" && p.annualGross !== null && p.annualGross >= 0
      && p.forecastDps !== null && p.forecastDps >= 0 && p.quantity !== null
      && p.forecastAsOf !== null && Number.isFinite(Date.parse(p.forecastAsOf)) && Date.parse(p.forecastAsOf) <= at);
  const comparable = scoped.filter((p) => ["increase", "decrease", "unchanged"].includes(p.changeType ?? ""));
  const sum = (key: "annualGross" | "priorRunRateGross" | "rateEffectGross", rows = scoped) => rows.reduce((total, p) => total + (p[key] ?? 0), 0);
  const wholeSelected = selected.size === whole.size && [...selected].every(([id, quantity]) => quantity === whole.get(id));
  return { ...source, status: complete ? "ready" : "incomplete", expectedStocks: selected.size, coveredStocks: scoped.length,
    projectedAnnualGross: complete ? wholeSelected && source.status === "ready" ? source.projectedAnnualGross : sum("annualGross") : null,
    priorRunRateGross: complete && scoped.every((p) => p.priorRunRateGross !== null) ? sum("priorRunRateGross") : null,
    comparableRateEffectGross: complete && comparable.length > 0 && comparable.every((p) => p.rateEffectGross !== null) ? sum("rateEffectGross", comparable) : null,
    comparableCount: comparable.length, increaseCount: scoped.filter((p) => p.changeType === "increase").length,
    decreaseCount: scoped.filter((p) => p.changeType === "decrease").length, unchangedCount: scoped.filter((p) => p.changeType === "unchanged").length,
    notComparableCount: scoped.length - comparable.length,
    latestForecastAsOf: scoped.map((p) => p.forecastAsOf).filter((v): v is string => Boolean(v)).sort().at(-1) ?? null,
    positions: scoped.sort((a, b) => (b.annualGross ?? -Infinity) - (a.annualGross ?? -Infinity) || (a.ticker ?? "").localeCompare(b.ticker ?? "")),
  };
}

/** Reveal a chosen small category without turning every tiny category into a slice. */
export function resolveAnalysisSelection(model: ReturnType<typeof buildAnalysisGroups>, key: string | null) {
  const selected = model.visible.find((group) => group.key === key) ?? model.all.find((group) => group.key === key);
  if (!selected || model.visible.some((group) => group.key === selected.key)) return { selected, chartGroups: model.visible };
  const rest = model.all.filter((group) => group.key !== selected.key && !group.isUnclassified);
  const positions = rest.flatMap((group) => group.positions);
  const remainder: AnalysisGroup = {
    key: "action:clear", label: "ほかの分類（全体に戻る）", isOther: true, isUnclassified: false,
    marketValue: rest.reduce((sum, group) => sum + group.marketValue, 0), percentage: rest.reduce((sum, group) => sum + group.percentage, 0),
    positionCount: positions.length, instrumentCount: new Set(positions.map((p) => p.instrumentId)).size,
    positions, missingValueCount: rest.reduce((sum, group) => sum + group.missingValueCount, 0), memberKeys: rest.map((group) => group.key),
  };
  return { selected, chartGroups: [selected, remainder, ...model.all.filter((group) => group.isUnclassified)] };
}
