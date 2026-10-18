import { describe, expect, it } from 'vitest';
import { inspectSource, routeForPage, validateContracts, transitionCells, renderTransitionTables, run, collectTestNames } from '../check-navigation-contracts.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ref='tests/ui-smoke/navigation.spec.ts#entry';
function fixture(extra={}) {
  const files={
    'app/page.tsx':'export default function Home(){return <h1>Home</h1>}',
    'app/layout.tsx':'import NavigationProvider from "@/components/navigation/NavigationProvider"; export default function Layout(){return <NavigationProvider/>}',
    'app/loading.tsx':'import Loading from "@/components/navigation/RouteLoading"; export default function Load(){return <Loading/>}',
    'app/error.tsx':'export default function ErrorPage(){return <h1>Error</h1>}',
    'components/navigation/Link.tsx':'import Link from "next/link"; export default Link;',
    'components/navigation/NavigationProvider.tsx':'export default function Provider(){return null}',...extra,
  };
  const transitions=[{id:'R01',from:'D',to:'`/`',details:['S1'],tests:[ref],coverage:'entry-only'}];
  const sources={};
  for(const [file,source] of Object.entries(files)){const {sites}=inspectSource(file,source);if(sites.length)sources[file]={transitions:['R01'],sites};}
  const contract={schemaVersion:1,transitions,sources,tables:[{name:'pages',prefixes:['R'],headers:['ID','From','To','Policy']}]};
  const markdown='intro\n<!-- navigation-contracts:pages -->\n| ID | From | To | Policy |\n| --- | --- | --- | --- |\n| R01 | D | `/` | S1 |\n<!-- /navigation-contracts:pages -->\nend';
  return {files,contract,markdown,tests:new Set([ref])};
}
const errors=input=>validateContracts(input).errors.join('\n');

describe('navigation contract omissions',()=>{
 it('accepts an aligned contract without claiming interaction coverage',()=>{const f=fixture();expect(validateContracts(f).errors).toEqual([]);expect(f.contract.transitions[0].coverage).toBe('entry-only');});
 it('fails on new and removed pages rather than silently expanding coverage',()=>{const f=fixture();f.files['app/new/page.tsx']='export default function New(){return null}';expect(errors(f)).toContain('Page routes differ');delete f.files['app/new/page.tsx'];delete f.files['app/page.tsx'];expect(errors(f)).toContain('Page routes differ');});
 it('ignores comments but rejects aliased next/link imports',()=>{expect(inspectSource('app/page.tsx','// import Link from "next/link"').errors).toEqual([]);expect(inspectSource('app/page.tsx','import Alias from "next/link"').errors).toHaveLength(1);});
 it('detects a new shared Link even when its href already exists',()=>{const f=fixture();f.files['app/page.tsx']='import Nav from "@/components/navigation/Link";export default function Page(){return <Nav href="/"/>}';expect(errors(f)).toContain('sites changed');});
 it('rejects registered static hrefs with no destination page',()=>{const f=fixture({'app/page.tsx':'import Nav from "@/components/navigation/Link";export default function Page(){return <Nav href="/missing"/>}'});expect(errors(f)).toContain('internal href has no page');});
 it('requires a reason for native links even after registering the site',()=>{const f=fixture({'app/page.tsx':'export default function Page(){return <a href="/"/>}'});expect(errors(f)).toContain('reviewed exception reason');f.contract.sources['app/page.tsx'].exceptions={'native-link':'Supabase login entry keeps document navigation.'};expect(errors(f)).toBe('');});
 it('does not gate static external, hash, download and new-tab anchors',()=>{const result=inspectSource('app/page.tsx','const x=<><a href="https://example.com"/><a href="#section"/><a download href="/file.csv"/><a href={externalUrl} target="_blank"/></>');expect(result.sites).toEqual([]);});
 it('keeps dynamic native hrefs visible for human classification',()=>expect(inspectSource('app/page.tsx','const x=<a href={destination}/>;').sites[0].kind).toBe('native-link'));
 it('captures aliased routers and direct hook calls',()=>{const sites=inspectSource('app/A.tsx','import {useRouter as route} from "next/navigation";const r=route();r.push("/");r.refresh();route().back();').sites;expect(sites.filter(s=>s.kind==='router')).toHaveLength(2);expect(sites.filter(s=>s.kind==='router-hook')).toHaveLength(2);});
 it('tracks Client fetch and aliased read helpers without inventing server reads',()=>{const source='import {readNavigationJson as read} from "@/lib/navigation-read";read("/api/a");fetch("/api/b");window.fetch("/api/c")';expect(inspectSource('app/a.tsx','"use client";'+source).sites.filter(s=>s.kind==='client-request')).toHaveLength(3);expect(inspectSource('app/a.tsx',source).sites).toEqual([]);});
 it('detects query whitespace changes inside literal values',()=>{const a=inspectSource('app/A.tsx','import Link from "@/components/navigation/Link";const a=<Link href="/?q=a b"/>;');const b=inspectSource('app/A.tsx','import Link from "@/components/navigation/Link";const a=<Link href="/?q=a  b"/>;');expect(a.sites).not.toEqual(b.sites);});
 it('rejects new dynamic imports without a reviewed fallback exception',()=>{const f=fixture({'app/A.tsx':'import lazy from "next/dynamic";const A=lazy(()=>import("./B"));'});expect(errors(f)).toContain('dynamic-without-fallback requires');});
 it('detects removing a dynamic loading fallback',()=>{const f=fixture({'app/A.tsx':'import lazy from "next/dynamic";const A=lazy(()=>import("./B"),{loading:()=> <p>Loading</p>});'});f.files['app/A.tsx']='import lazy from "next/dynamic";const A=lazy(()=>import("./B"));';expect(errors(f)).toContain('sites changed');});
 it('detects GET form condition changes and distinguishes intercepted submit forms',()=>{const result=inspectSource('app/A.tsx','const x=<><form method="get" action="/"/><form onSubmit={submit}/><form method="dialog"/></>');expect(result.sites.map(s=>s.kind)).toEqual(['form-submit','form-submit','get-form']);});
 it('fails missing loading/error and a disconnected Provider even when the import remains',()=>{const f=fixture();delete f.files['app/loading.tsx'];delete f.files['app/error.tsx'];expect(errors(f)).toContain('Missing shared fallback');f.files['app/layout.tsx']='import NavigationProvider from "@/components/navigation/NavigationProvider";export default ()=> <main/>';expect(errors(f)).toContain('is not mounted');});
 it('fails a disconnected segment loading component',()=>{const f=fixture({'app/tools/loading.tsx':'export default ()=> <p>Loading</p>'});expect(errors(f)).toContain('disconnected from shared activity');});
 it('fails changed docs, duplicate IDs, missing test mappings and unrecognized coverage',()=>{const f=fixture();f.markdown=f.markdown.replace('| D |','| Different |');expect(errors(f)).toContain('transition tables differ');f.contract.transitions.push({...f.contract.transitions[0],tests:['not-a-test'],coverage:'all-passed'});expect(errors(f)).toContain('Duplicate transition');expect(errors(f)).toContain('test not found');expect(errors(f)).toContain('coverage scope required');});
 it('fails invalid syntax instead of accepting a partial parse',()=>{const f=fixture({'app/page.tsx':'export default function Broken( {'});expect(errors(f)).toContain('syntax error');});
 it('normalizes route groups and refuses unmodeled parallel/intercepted routes',()=>{expect(routeForPage('app/(public)/tools/[id]/page.tsx')).toBe('/tools/[id]');expect(routeForPage('app/somepage.tsx')).toBeNull();expect(()=>routeForPage('app/@modal/page.tsx')).toThrow('Unsupported');expect(()=>routeForPage('app/(.)detail/page.tsx')).toThrow('Unsupported');});
 it('does not claim static coverage of a local state-only switch',()=>{expect(inspectSource('app/A.tsx','"use client";const x=<button onClick={()=>setView("table")}/>;').sites).toEqual([]);});
 it('renders only marked tables from canonical From/To and preserves surrounding prose',()=>{const f=fixture();f.contract.transitions[0].from='Header';const rendered=renderTransitionTables(f.markdown,f.contract);expect(rendered).toContain('| R01 | Header | `/` | S1 |');expect(rendered.startsWith('intro\n')).toBe(true);expect(rendered.endsWith('\nend')).toBe(true);expect(renderTransitionTables(rendered,f.contract)).toBe(rendered);});
 it('refuses missing or duplicate generated markers',()=>{const f=fixture();expect(()=>renderTransitionTables('no marker',f.contract)).toThrow('markers');expect(()=>renderTransitionTables(f.markdown+'<!-- navigation-contracts:pages -->',f.contract)).toThrow('markers');});
 it('does not change protocol-relative hrefs into internal navigation',()=>expect(inspectSource('app/a.tsx','const x=<a href="//example.com/"/>;').sites).toEqual([]));
 it('keeps table values in named canonical fields',()=>expect(transitionCells({id:'Q01',from:'list',to:'cursor',details:['V1']})).toEqual(['Q01','list','cursor','V1']));
 it('checks the actual repository, including existing E2E references',()=>{const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');const result=run(root);expect(result.errors).toEqual([]);expect(result.pages).toBeGreaterThan(0);expect(result.transitions).toBeGreaterThan(0);expect(result.review.length).toBeGreaterThan(0);});
});

 describe('valid maintenance forms from independent review',()=>{
  it('recognizes each tables, tagged tables and ordinary tests',()=>{
    const names=collectTestNames({'components/navigation/a.test.ts':'it.each([1,2])("case %s", value=>{}); test.each`a | b`("tagged $a",()=>{}); it("plain",()=>{});'});
    expect([...names]).toEqual(['components/navigation/a.test.ts#case %s','components/navigation/a.test.ts#tagged $a','components/navigation/a.test.ts#plain']);
  });
  it('keeps provider identity when its default import is renamed',()=>{
    const f=fixture();f.files['app/layout.tsx']='import NavProvider from "@/components/navigation/NavigationProvider";export default function Layout(){return <NavProvider/>}';
    expect(errors(f)).toBe('');
  });
  it('resolves existing colocated and parameterized navigation references',()=>{
    const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
    const fsModule=fs;
    const original=fsModule.readFileSync;
    const contract=JSON.parse(original(path.join(root,'config/navigation-contracts.json'),'utf8'));
    contract.transitions.find(row=>row.id==='G07').tests=[
      'components/navigation/navigation-target.test.ts#preserves a valid opaque cursor',
      'lib/__tests__/premium-navigation.test.ts#許可した内部パスへ復帰できる: %s',
    ];
    fsModule.readFileSync=function(file,...args){return path.resolve(String(file))===path.join(root,'config/navigation-contracts.json') ? JSON.stringify(contract) : original.call(this,file,...args);};
    try{expect(run(root).errors).toEqual([]);}finally{fsModule.readFileSync=original;}
  });
 });