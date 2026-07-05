// 日興 / SBI 信用データの判定ロジック。
// 判定ルールの正本は docs/specs/cross-cutting/market-tools-data-fetch-paths.md の
// 「yutai-candidates の日興信用 badge 判定」を参照。
// yutai-candidates と yutai-dashboard で共用するため UI（styles）には依存しない。
import type { NikkoCreditRecord, SbiCreditRecord } from "@/app/tools/yutai-candidates/types";

export function hasNikkoSellStop(credit: NikkoCreditRecord | undefined) {
  return Boolean(credit?.regulation_details?.some((detail) => (
    detail.includes("新規売建規制") && detail.includes("取引停止")
  )));
}

export function hasNikkoLendingCaution(credit: NikkoCreditRecord | undefined) {
  return Boolean(credit?.regulation_details?.some((detail) => detail.includes("貸株注意喚起")));
}

export function canNikkoGeneralCrossNow(credit: NikkoCreditRecord | undefined) {
  return Boolean(credit?.general_short && (credit.available_shares ?? 0) > 0 && !hasNikkoSellStop(credit));
}

// 一般信用売建の対象だが在庫が尽きている（＝今はクロス約定できない）状態。
// available_shares が明示的に 0 = 在庫枠を管理している銘柄で残数 0。
// general_short は在庫連動で false に倒れるため条件に含めない（在庫0なら false でも対象扱い）。
// available_shares が null（在庫データを持たない非対象）は対象外で、従来どおり表示しない。
export function isNikkoGeneralOutOfStock(credit: NikkoCreditRecord | undefined) {
  return Boolean(credit && credit.available_shares === 0 && !hasNikkoSellStop(credit));
}

export function shouldWatchNikkoGeneral(credit: NikkoCreditRecord | undefined) {
  if (!credit) return false;
  return hasNikkoSellStop(credit) || canNikkoGeneralCrossNow(credit) || (
    !credit.general_short &&
    (credit.available_shares ?? 0) > 0 &&
    !hasNikkoSellStop(credit)
  );
}

// SBI は「15営業日短期売りの扱い有無」だけを見る。在庫状態（position_status）は使わない。
// 判断理由: docs/decision-log/2026-04-05-yutai-candidates-sbi-short-handling.md
export function isHandledBySbiShort(record: SbiCreditRecord | undefined) {
  return Boolean(record?.is_short);
}

export type NikkoCreditBadgeKind =
  | "generalStop"
  | "generalCaution"
  | "generalOk"
  | "generalOutOfStock"
  | "institutional";

export type NikkoCreditBadge = {
  kind: NikkoCreditBadgeKind;
  label: string;
  title: string;
};

// バッジの表示文言と優先順位の正本。UI 側は kind をスタイルに割り当てて描画する。
export function getNikkoCreditBadges(credit: NikkoCreditRecord | undefined): NikkoCreditBadge[] {
  if (!credit) return [];
  const badges: NikkoCreditBadge[] = [];
  if (hasNikkoSellStop(credit)) {
    badges.push({ kind: "generalStop", label: "一般停止", title: "一般信用 売建規制（取引停止）" });
  } else if (canNikkoGeneralCrossNow(credit) && hasNikkoLendingCaution(credit)) {
    badges.push({ kind: "generalCaution", label: "一般注意", title: "一般信用 売建可（貸株注意喚起）" });
  } else if (canNikkoGeneralCrossNow(credit)) {
    badges.push({ kind: "generalOk", label: "一般可", title: "一般信用 売建可（在庫あり）" });
  } else if (isNikkoGeneralOutOfStock(credit)) {
    badges.push({ kind: "generalOutOfStock", label: "一般×", title: "一般信用売建の対象だが在庫0（今クロス不可）" });
  }
  if (credit.institutional_short) {
    badges.push({ kind: "institutional", label: "制度可", title: "制度信用 売建可" });
  }
  return badges;
}
