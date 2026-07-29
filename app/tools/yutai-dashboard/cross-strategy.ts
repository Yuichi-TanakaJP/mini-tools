import type { CrossType } from "@/app/tools/yutai-memo/types";
import { getLongTermFlags, type YutaiLaunchDisplayRecord } from "./launch-display";

/**
 * getRowCrossType が必要とする行の最小情報。ToolClient の DashboardRow は
 * 構造的にこの型を満たすため、そのまま渡せる（純関数として単体テストできるよう
 * client component への依存を持たせない）。
 */
export type CrossStrategyRowInput = {
  code: string;
  memo: { crossType: CrossType } | null;
  candidate: { month: number } | null;
};

/**
 * 行のクロス戦略の実効値。手動メモがあればその値、無ければ公式条件から導出する。
 * - メモあり: ユーザー設定値をそのまま使う（derived=false）。
 * - メモ無し＋公式レコードあり＋長期特典なし: 戦略判断が不要なので「長期優遇なし」を導出（derived=true）。
 * - それ以外（特典あり未トリアージ／レコード無し＝不明）: null＝未設定のまま。
 * 公式レコードが無い（undefined）銘柄は「長期特典なし」と断定せず未設定に残す。
 * なお全月ビューでは launchDisplayByKey が空で渡されるため、この導出は働かず未設定になる
 * （launch-display は権利月単位のデータで、全月表示は per-month の公式条件を持たないため）。
 */
export function getRowCrossType(
  row: CrossStrategyRowInput,
  launchDisplayByKey: ReadonlyMap<string, YutaiLaunchDisplayRecord>,
): { value: CrossType; derived: boolean } | null {
  if (row.memo) return { value: row.memo.crossType, derived: false };
  const record = row.candidate ? launchDisplayByKey.get(`${row.code}:${row.candidate.month}`) : undefined;
  if (record && !getLongTermFlags(record).benefit) {
    return { value: "長期優遇なし", derived: true };
  }
  return null;
}
