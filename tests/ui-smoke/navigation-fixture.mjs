// Synthetic loopback-only read API for navigation tests; no live credentials or DB access.
import http from "node:http";
let next = {delay:0,status:200};
const theme = i => ({id:`theme-${i}`,slug:`fixture-${i}`,displayName:`Fixture Theme ${i}`,status:"draft",summary:`Fixture summary ${i}`});
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1:18841");
 if(url.pathname==="/control") {next={delay:Number(url.searchParams.get("delay")||0),status:Number(url.searchParams.get("status")||200)};res.end("ok");return;}
 const mode=url.pathname.startsWith("/viewer/") ? next : {delay:0,status:200}; if(url.pathname.startsWith("/viewer/")) next={delay:0,status:200};
 await new Promise(r=>setTimeout(r,mode.delay));
 res.setHeader("content-type","application/json");res.statusCode=mode.status;
 if(mode.status!==200) {res.end(JSON.stringify({detail:"fixture-private-upstream-body"}));return;}
 if(url.pathname==="/viewer/theme-cards"){
  const cursor=url.searchParams.get("cursor");const page=cursor==="page2"?2:1;
  res.end(JSON.stringify({schemaVersion:"theme-viewer-list.v2",nextCursor:page===1?"page2":null,hasMore:page===1,themes:[theme(page)]}));return;
 }
 if(url.pathname.startsWith("/viewer/themes/")){
  res.end(JSON.stringify({schemaVersion:"theme-viewer.v1",theme:theme(Number(url.pathname.split("-").at(-1))||1),currentThesis:null,analysisHistory:[],evidence:[],directLinks:[],taxonomyMap:{nodes:[],themeLinks:[],stockLinks:[],edges:[]},metrics:{definitions:[],snapshots:[],values:[]},openActions:[]}));return;
 }
 res.end(JSON.stringify({dates:[],weeks:[],latest:null,items:[]}));
});
server.listen(18841,"127.0.0.1",()=>console.log("fixture API ready"));
