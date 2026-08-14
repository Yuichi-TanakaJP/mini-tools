-- Supabase環境によってはanonへの既定EXECUTEが残るため、明示的に除去する。
revoke execute on function public.get_stock_notes_delta(jsonb) from anon;
revoke execute on function public.get_stock_notes_delta(jsonb) from public;
grant execute on function public.get_stock_notes_delta(jsonb) to authenticated;
