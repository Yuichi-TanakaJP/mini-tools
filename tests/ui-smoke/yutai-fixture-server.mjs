import http from "node:http";
const stamp = "2026-09-09T00:00:00Z";
http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:3147");
  let body = {};
  if (url.pathname === "/yutai/manifest") body = { version: 1, generated_at: stamp, source: "synthetic", latest_month: "2026-09", latest_path: "2026-09.json",
    months: [8, 9].map(month => ({ year: 2026, month, path: `2026-${month}.json`, count: 1 })) };
  else if (url.pathname.startsWith("/yutai/monthly/")) {
    const month = Number(url.pathname.slice(-2));
    body = { year: 2026, month, generated_at: stamp, source: "synthetic", records: [{ code: "1234", company_name: "接続テスト銘柄", month,
      benefit_summary: "合成データ", minimum_investment_text: "", minimum_investment_yen: null, benefit_category_tags: [],
      minkabu_yutai_url: "https://example.com/", has_official_link: false, official_benefit_url: null, official_link_status: "missing", source: "synthetic", fetched_at: stamp }] };
  } else if (url.pathname === "/nikko/short-balance") body = { asOf: "2026-09-09", byCode: { "1234": { sellBalance: 0 }, "130A": { sellBalance: 1200 } } };
  else body = { date: "2026-09-09", generated_at: stamp, record_count: 0, by_code: {} };
  response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify(body));
}).listen(3147, "127.0.0.1");
