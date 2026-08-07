// ルーティン可視化ツールの型定義。
// 実行実績のログではなく「いま自分が回している定期作業の棚卸し」を静的に表す。

/** 実行のされ方。 */
export type RoutineMode =
  /** Windows タスクスケジューラ等で無人実行される */
  | "auto"
  /** リマインダーが飛んできて、自分で実行する */
  | "semi"
  /** 完全に自分の意思で起動する */
  | "manual";

/** どの領域の作業か。 */
export type RoutineDomain =
  | "market-data"
  | "x-post"
  | "line-notify"
  | "dev-ops"
  /** 自分の保有・優待・入金まわりの目視確認 */
  | "portfolio-check";

/** 0=日曜 ... 6=土曜。JS の Date#getDay と揃える。 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RoutineSchedule =
  /** 毎日。週次グリッドでは全曜日に並ぶ */
  | { kind: "daily"; times: string[] }
  /** 特定曜日。週次グリッドでは該当曜日だけに並ぶ */
  | { kind: "weekly"; weekdays: Weekday[]; times: string[] }
  /** 平日のみ。weekly の糖衣だが意図が読み取りやすいので分ける */
  | { kind: "weekday"; times: string[] }
  /** 毎月の指定日。週次グリッドには出さず、月次セクションに並ぶ */
  | { kind: "monthly"; daysOfMonth: number[]; times: string[] }
  /** 決まった周期がないもの。件数の集計対象からも外す */
  | { kind: "adhoc" };

export type Routine = {
  id: string;
  /** 画面に出す短い名前 */
  label: string;
  /** 何をしているかの一行説明 */
  description: string;
  mode: RoutineMode;
  domain: RoutineDomain;
  schedule: RoutineSchedule;
  /** タスク名やスキル名など、実体をたどるための識別子 */
  source: string;
  /** 実体があるリポジトリ/フォルダ。証券会社サイトの目視確認などコードを伴わないものは持たない */
  repo?: string;
};
