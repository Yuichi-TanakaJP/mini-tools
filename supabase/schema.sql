-- mini-tools クロスデバイス同期（Phase 1）用スキーマ
-- Supabase の SQL Editor で実行する。
-- 設計: docs/plans/phase1-cross-device-sync-plan.md

-- ユーザー × LocalStorage キー × 値 の汎用テーブル。
-- ツールごとにテーブルを増やさず、既存の保存キー（*_v1）をそのまま預かる。
create table if not exists public.tool_data (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- 自分の行だけ読み書きできるよう RLS を有効化する。
alter table public.tool_data enable row level security;

-- 既存ポリシーがあれば作り直す（再実行を安全にする）。
drop policy if exists "tool_data select own" on public.tool_data;
drop policy if exists "tool_data insert own" on public.tool_data;
drop policy if exists "tool_data update own" on public.tool_data;
drop policy if exists "tool_data delete own" on public.tool_data;

create policy "tool_data select own"
  on public.tool_data for select
  using (auth.uid() = user_id);

create policy "tool_data insert own"
  on public.tool_data for insert
  with check (auth.uid() = user_id);

create policy "tool_data update own"
  on public.tool_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tool_data delete own"
  on public.tool_data for delete
  using (auth.uid() = user_id);
