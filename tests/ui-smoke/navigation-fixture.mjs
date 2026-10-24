// Synthetic loopback-only read API for navigation tests; no live credentials or DB access.
import http from "node:http";
import { readFileSync } from "node:fs";
const recordedMarketData = process.env.NAVIGATION_MARKET_DATA_FILE ? JSON.parse(readFileSync(process.env.NAVIGATION_MARKET_DATA_FILE, "utf8")) : null;
let next = {delay:0,status:200};
let investorVersion = 0;
const theme = i => ({id:`theme-${i}`,slug:`fixture-${i}`,displayName:`Fixture Theme ${i}`,status:"draft",summary:`Fixture summary ${i}`});
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1:18841");
 url.pathname=url.pathname.replace(/^\/(calendar-fixture|market-quality-fixture|market-observation-real-fixture)(?=\/)/, "");
 if(recordedMarketData && recordedMarketData[url.pathname]) {res.setHeader("content-type","application/json");res.end(JSON.stringify(recordedMarketData[url.pathname]));return;}
 if(process.env.NAVIGATION_MARKET_QUALITY_FIXTURE === "1" && ["/ranking/manifest","/nikkei/manifest","/topix33/manifest"].includes(url.pathname)) {
  res.setHeader("content-type","application/json");res.end(JSON.stringify({dates:["2026-10-20","2026-10-18","2026-10-17","2026-09-24"],latest:"2026-10-20",latest_date:"2026-10-20",generated_at:"2026-10-19T15:51:19Z"}));return;
 }
 if(process.env.NAVIGATION_MARKET_QUALITY_FIXTURE === "1" && /^\/(ranking|nikkei|topix33)\/\d{4}-\d{2}-\d{2}$/.test(url.pathname)) {
  const date=url.pathname.split("/").at(-1);
  const observation={snapshot_id:"a".repeat(32),source:"fixture",market_date:null,date_basis:"unknown",source_observed_at:null,collected_at:"2026-10-20T00:50:00Z",generated_at:"2026-10-20T00:51:00Z",input_sha256:"b".repeat(64)};
  res.setHeader("content-type","application/json");
  if(url.pathname.startsWith("/ranking/")) res.end(JSON.stringify({date,observation,records:[]}));
  else if(url.pathname.startsWith("/topix33/")) res.end(JSON.stringify({date,observation,index:"topix33",summary:{advancers:1,decliners:0,unchanged:0},top_positive:[],top_negative:[],sectors:[{sector_code:"fixture",sector_name:"Fixture",chg_pct:1,chg:1}]}));
  else res.end(JSON.stringify({date,observation,index:"nikkei225",summary:{total_contribution:1,advancers:1,decliners:0,unchanged:0},top_positive:[],top_negative:[],records:[{code:"0000",name:"Fixture",sector:"Fixture",price:1,minashi:1,weight_pct:1,chg_pct:1,chg:1,contribution:1,size_value:1,color_value:1}]}));
  return;
 }
 if(url.pathname==="/investor-flow-fixture-control") { investorVersion=Number(url.searchParams.get("version")||0);res.end("ok");return; }
 if(url.pathname.startsWith("/investor-flow/")) {
  const start="2026-10-13",end="2026-10-16",generated_at_jst=investorVersion?"2026-10-22T09:00:00Z":"2026-10-22T08:00:00Z";
  const week={start_date:start,end_date:end,path:"week.json"};
  const manifest={data_source:"JPX",latest:week,weeks:[week,{start_date:"2026-10-05",end_date:"2026-10-09",path:"previous.json"}],generated_at_jst};
  const payload={data_source:"JPX",start_date:start,end_date:end,source_url:"https://www.jpx.co.jp/fixture.xlsx",source_file:"fixture.xlsx",week_label_raw:"fixture",unit:"thousand_yen",market_scope:"二市場",generated_at_jst,records:[{row_index:1,category:"海外投資家",sell_thousand_yen:100000,buy_thousand_yen:200000,diff_thousand_yen:100000,sell_yen:100000000,buy_yen:200000000,diff_yen:investorVersion?900000000:100000000,share_sell_pct:50,share_buy_pct:50}]};
  payload.records.push({...payload.records[0],row_index:2,category:"個人"},{...payload.records[0],row_index:3,category:"個人現金"});
  const analysis={...payload,schema_version:"investor-flow-analysis-v1",analysis_scope:"weekly",previous_start_date:null,previous_end_date:null,source_snapshot_path:"week.json",lookback_weeks:13,summary:{largest_net_buy:null,largest_net_sell:null},buy_composition:[],sell_composition:[],net_ranking:[],reversals:[],streaks:[],major_flows:[]};
  let value=url.pathname.endsWith("manifest")?manifest:url.pathname.includes("analysis")?analysis:payload;
  if(url.pathname.includes("/weeks/")) {const parts=url.pathname.split("/");value={...value,start_date:parts.at(-2),end_date:parts.at(-1)};}
  res.setHeader("content-type","application/json");res.end(JSON.stringify(value));return;
 }
 if(url.pathname==="/health") {res.end("ok");return;}
 if(url.pathname==="/control") {next={delay:Number(url.searchParams.get("delay")||0),status:Number(url.searchParams.get("status")||200)};res.end("ok");return;}
 const mode=url.pathname.startsWith("/viewer/") ? next : {delay:0,status:200}; if(url.pathname.startsWith("/viewer/")) next={delay:0,status:200};
 await new Promise(r=>setTimeout(r,mode.delay));
 res.setHeader("content-type","application/json");res.statusCode=mode.status;
 if(mode.status!==200) {res.end(JSON.stringify({detail:"fixture-private-upstream-body"}));return;}
 if(url.pathname==="/econ-calendar/weekly/manifest") {res.end(JSON.stringify({generated_at:"2026-10-19",latest:"2026-10-19",weeks:["2026-10-19","2026-10-12"]}));return;}
 if(url.pathname==="/econ-calendar/weekly") {res.end(JSON.stringify({as_of_date:"2026-10-19",source:"fixture",week_start:"2026-10-19",week_end:"2026-10-25",calendar:[]}));return;}
 if(url.pathname==="/econ-calendar/weekly/meta") {res.end("null");return;}
 if(url.pathname==="/viewer/theme-cards"){
  const cursor=url.searchParams.get("cursor");const page=cursor==="page2"?2:1;
  res.end(JSON.stringify({schemaVersion:"theme-viewer-list.v2",nextCursor:page===1?"page2":null,hasMore:page===1,themes:[theme(page)]}));return;
 }
 if(url.pathname === "/viewer/themes/00000000-0000-4000-8000-000000000001") {
  res.end(JSON.stringify({schemaVersion:"theme-viewer.v1",theme:{...theme(1),id:"00000000-0000-4000-8000-000000000001"},textSources:[{section:"analysisHistory",recordId:"00000000-0000-4000-8000-000000000002",fields:["body","concerns"]}],analysisHistory:[{id:"00000000-0000-4000-8000-000000000002",analysisType:"update",conclusion:"Synthetic research",analyzedAt:"2026-08-26T12:52:00Z",createdAt:"2026-08-26T12:52:00Z"}],currentThesis:null}));return;
 }
 if(url.pathname.startsWith("/viewer/themes/")){
  res.end(JSON.stringify({schemaVersion:"theme-viewer.v1",theme:theme(Number(url.pathname.split("-").at(-1))||1),currentThesis:null,analysisHistory:[],evidence:[],directLinks:[],taxonomyMap:{nodes:[],themeLinks:[],stockLinks:[],edges:[]},metrics:{definitions:[],snapshots:[],values:[]},openActions:[]}));return;
 }
 if(process.env.NAVIGATION_CALENDAR_FIXTURE === "1" || process.env.NAVIGATION_MARKET_QUALITY_FIXTURE === "1") res.statusCode=404;
 res.end(JSON.stringify({dates:[],weeks:[],latest:null,items:[]}));
});
server.listen(Number(process.env.NAVIGATION_FIXTURE_PORT ?? 18841),"127.0.0.1",()=>console.log("fixture API ready"));
