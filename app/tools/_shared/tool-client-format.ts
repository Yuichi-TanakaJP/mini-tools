export function formatToolDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

export function signPrefix(value: number) {
  return value > 0 ? "+" : "";
}
