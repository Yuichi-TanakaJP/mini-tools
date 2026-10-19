// Synthetic loopback-only read API for navigation tests; no live credentials or DB access.
import http from "node:http";
let next = {delay:0,status:200};
const theme = i => ({id:`theme-${i}`,slug:`fixture-${i}`,displayName:`Fixture Theme ${i}`,status:"draft",summary:`Fixture summary ${i}`});
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1:18841");
 url.pathname=url.pathname.replace(/^\/calendar-fixture(?=\/)/, "");
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
 if(process.env.NAVIGATION_CALENDAR_FIXTURE === "1") res.statusCode=404;
 res.end(JSON.stringify({dates:[],weeks:[],latest:null,items:[]}));
});
server.listen(18841,"127.0.0.1",()=>console.log("fixture API ready"));
