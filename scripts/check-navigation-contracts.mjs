import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const specPath = 'docs/specs/cross-cutting/navigation-transitions.md';
const normalize = value => value.replaceAll('\\', '/');
const printer = ts.createPrinter({ removeComments: true });
const text = node => printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile()).trim();
const stringValue = node => node && (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
const attrValue = attr => !attr?.initializer ? null : ts.isJsxExpression(attr.initializer) ? attr.initializer.expression : attr.initializer;
const external = value => value !== null && (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value));

export function inspectSource(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const sites = [], errors = [];
  const linkNames = new Set(), dynamicNames = new Set(), routerHooks = new Set(), routers = new Set(), reads = new Set(["fetch", "window.fetch", "globalThis.fetch", "readNavigationJson"]), feedbackComponents = new Map();
  const client = ast.statements.some(s => ts.isExpressionStatement(s) && stringValue(s.expression) === 'use client');
  const add = (kind, signature) => sites.push({ kind, signature });
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node)) continue;
    const moduleName = stringValue(node.moduleSpecifier);
    const clause = node.importClause;
    if (moduleName === 'next/link' && file !== 'components/navigation/Link.tsx') errors.push(`${file}: next/link must use the shared navigation/Link wrapper`);
    if (moduleName?.endsWith('/navigation/Link') && clause?.name) linkNames.add(clause.name.text);
    if (moduleName === 'next/dynamic' && clause?.name) dynamicNames.add(clause.name.text);
    if (moduleName === 'next/navigation' && clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const item of clause.namedBindings.elements) if ((item.propertyName?.text ?? item.name.text) === 'useRouter') routerHooks.add(item.name.text);
    }
  }
  for(const node of ast.statements) {
    if(!ts.isImportDeclaration(node)) continue;
    const moduleName=stringValue(node.moduleSpecifier), clause=node.importClause;
    if(moduleName && /navigation\/(?:PendingRegion|RouteLoading|LoadingActivity|NavigationProvider)$/.test(moduleName) && clause?.name) feedbackComponents.set(clause.name.text, moduleName.split('/').at(-1));
    if(clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for(const item of clause.namedBindings.elements) if((item.propertyName?.text ?? item.name.text)==='readNavigationJson') reads.add(item.name.text);
  }
  for(const error of ast.parseDiagnostics) errors.push(file+': syntax error: '+ts.flattenDiagnosticMessageText(error.messageText,' '));
  function findRouters(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer) && routerHooks.has(node.initializer.expression.getText(ast))) routers.add(node.name.text);
    ts.forEachChild(node, findRouters);
  }
  findRouters(ast);
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
      const get = name => attrs.find(a => a.name.getText(ast) === name);
      const href = attrValue(get('href'));
      if (feedbackComponents.has(tag)) add('feedback', feedbackComponents.get(tag) + ' ' + text(node.attributes));
      if (linkNames.has(tag)) add('link', href ? text(href) : '<spread-or-missing-href>');
      if (tag === 'a' && !get('download') && stringValue(attrValue(get('target'))) !== '_blank' && !external(stringValue(href))) add('native-link', href ? text(href) : '<spread-or-missing-href>');
      if (tag === 'form') add(stringValue(attrValue(get('method')))?.toLowerCase() === 'get' ? 'get-form' : 'form-submit', text(node.attributes));
    }
    if (ts.isCallExpression(node)) {
      if(routerHooks.has(node.expression.getText(ast))) add('router-hook', text(node));
      const call = node.expression.getText(ast);
      if (ts.isPropertyAccessExpression(node.expression) && routers.has(node.expression.expression.getText(ast)) && ['push', 'replace', 'refresh', 'back', 'forward'].includes(node.expression.name.text)) add('router', text(node));
      if (/^(?:window\.)?(?:location\.(?:assign|replace|reload)|history\.(?:back|forward|go))$/.test(call)) add('document-navigation', text(node));
      if (client && reads.has(call)) add('client-request', text(node));
      if (call === 'useNavigationActivity') add('activity', text(node));
      if (dynamicNames.has(call)) {
        const options = node.arguments[1];
        const loading = options && ts.isObjectLiteralExpression(options) && options.properties.some(p => p.name?.getText(ast) === 'loading');
        add(loading ? 'dynamic-fallback' : 'dynamic-without-fallback', text(node));
      }
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && /^(?:window\.)?location\.href$/.test(node.left.getText(ast))) add('document-navigation', text(node));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  // Identical source sites are counted, so adding a duplicate still needs registration.
  sites.sort((a,b) => `${a.kind}:${a.signature}`.localeCompare(`${b.kind}:${b.signature}`, 'en'));
  return { sites, errors, client };
}

export function inspectRepository(root) {
  const files = {};
  function walk(relative) {
    for (const entry of fs.readdirSync(path.join(root, relative), {withFileTypes:true})) {
      if (entry.isSymbolicLink()) continue;
      const file = normalize(path.join(relative, entry.name));
      if (entry.isDirectory()) { if (!['__tests__', 'node_modules', '.next', '.git'].includes(entry.name)) walk(file); }
      else if (/\.[cm]?[jt]sx?$/.test(file) && !/\.(?:test|spec)\.[jt]sx?$/.test(file)) files[file] = fs.readFileSync(path.join(root,file),'utf8');
    }
  }
  for (const dir of ['app','components','lib']) if (fs.existsSync(path.join(root,dir))) walk(dir);
  return files;
}

export function routeForPage(file) {
  if (!/^app\/(?:.*\/)?page\.[jt]sx?$/.test(file)) return null;
  const segments = file.split('/').slice(1,-1).filter(segment => !/^\(.+\)$/.test(segment));
  if (segments.some(segment => segment.startsWith('@') || /^\(\./.test(segment))) throw new Error(`Unsupported parallel/intercepted route: ${file}; define its URL mapping before registering it`);
  return '/' + segments.join('/');
}

export const transitionCells = row => [row.id, row.from, row.to, ...(row.details ?? [])];

export function parseTransitionRows(markdown) {
  return markdown.split(/\r?\n/).filter(line => /^\| [RGEQDLX]\d{2} \|/.test(line)).map(line => line.slice(1,-1).split(' | ').map(cell=>cell.trim()));
}

export function collectTestNames(files) {
  const names = new Set();
  for (const [file,source] of Object.entries(files)) {
    if (!/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file)) continue;
    const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const expression=node.expression;
        const declaration = ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === 'each'
          ? expression.expression.expression.getText(ast)
          : ts.isTaggedTemplateExpression(expression) && ts.isPropertyAccessExpression(expression.tag) && expression.tag.name.text === 'each'
            ? expression.tag.expression.getText(ast)
            : expression.getText(ast);
        if (/^(?:test|it)(?:\.(?:skip|only))?$/.test(declaration)) {
        const argument=node.arguments[0]; const name=stringValue(argument) ?? (argument && ts.isTemplateExpression(argument) ? argument.getText(ast).slice(1,-1) : null); if(name) names.add(`${file}#${name}`);
        }
      }
      ts.forEachChild(node,visit);
    }
    visit(ast);
  }
  return names;
}

export function validateContracts({contract, files, markdown, tests}) {
  const errors=[], review=[];
  if (contract.schemaVersion !== 1) errors.push('Unsupported contract schemaVersion');
  const transitions=contract.transitions ?? [];
  const ids=transitions.map(row=>row.id);
  if(new Set(ids).size!==ids.length) errors.push('Duplicate transition IDs');
  for(const row of transitions) {
    if (!/^[RGEQDLX]\d{2}$/.test(row.id) || !row.from?.trim() || !row.to?.trim() || !row.details?.length) errors.push(`Invalid From/To contract: ${row.id}`);
    if (!['entry-only','partial','interaction','unit'].includes(row.coverage)) errors.push(`${row.id}: explicit coverage scope required`);
    if (!row.tests?.length) errors.push(`${row.id}: test/UAT mapping is required`);
    for (const ref of row.tests ?? []) if (!tests.has(ref)) errors.push(`${row.id}: test not found: ${ref}`);
  }
  if(JSON.stringify(parseTransitionRows(markdown))!==JSON.stringify(transitions.map(transitionCells))) errors.push(`${specPath}: transition tables differ from config/navigation-contracts.json`);
  const routes=Object.keys(files).map(routeForPage).filter(route=>route!==null).sort();
  const registered=transitions.filter(row=>row.id.startsWith('R')).map(row=>row.to.replaceAll('`','')).sort();
  if (JSON.stringify(routes)!==JSON.stringify(registered)) errors.push('Page routes differ from R contracts (add/remove/rename must update From/To and tests)');
  for(const required of ['app/loading.tsx','app/error.tsx','components/navigation/NavigationProvider.tsx','components/navigation/Link.tsx']) if(!files[required]) errors.push(`Missing shared fallback/feedback: ${required}`);
  const current={};
  const staticTargetExists = value => routes.some(route => {
    const actual = value.split(/[?#]/)[0].split('/').filter(Boolean);
    const expected = route.split('/').filter(Boolean);
    for(let i=0;i<expected.length;i++) {
      if(expected[i].startsWith('[[...')) return actual.length>=i;
      if(expected[i].startsWith('[...')) return actual.length>i;
      if(!actual[i] || (!expected[i].startsWith('[') && expected[i]!==actual[i])) return false;
    }
    return actual.length===expected.length;
  });
  for(const [file,source] of Object.entries(files)) {
    const result=inspectSource(file,source); errors.push(...result.errors);
    if(result.sites.length) current[file]=result.sites;
    for(const site of result.sites.filter(site=>['link','native-link'].includes(site.kind))) {
      const expression=ts.createSourceFile('target.ts',site.signature,ts.ScriptTarget.Latest,true).statements[0];
      const href=expression && ts.isExpressionStatement(expression) ? stringValue(expression.expression) : null;
      if(href?.startsWith('/') && !href.startsWith('//') && !staticTargetExists(href)) errors.push(file+': internal href has no page: '+href);
    }
  }
  if(!current['app/layout.tsx']?.some(site=>site.kind==='feedback' && site.signature.startsWith('NavigationProvider '))) errors.push('app/layout.tsx: shared NavigationProvider is not mounted');
  for(const file of Object.keys(files).filter(file=>/(?:^|\/)loading\.tsx$/.test(file))) if(!current[file]?.some(site=>site.kind==='feedback')) errors.push(`${file}: loading boundary is disconnected from shared activity`);
  for(const file of new Set([...Object.keys(current),...Object.keys(contract.sources ?? {})])) {
    const entry=contract.sources?.[file];
    if (JSON.stringify(current[file] ?? [])!==JSON.stringify(entry?.sites ?? [])) errors.push(`${file}: navigation/read/fallback sites changed; review and update source contracts`);
    if(!entry) continue;
    if(!entry.transitions?.length || entry.transitions.some(id=>!ids.includes(id))) errors.push(`${file}: valid transition IDs required`);
    for(const site of entry.sites ?? []) {
      if(['native-link','document-navigation','dynamic-without-fallback'].includes(site.kind) && !entry.exceptions?.[site.kind]?.trim()) errors.push(`${file}: ${site.kind} requires a reviewed exception reason`);
    }
    if (entry.sites?.some(site=>site.kind==='client-request')) review.push(`${file}: classify read/write; verify read timeout/cancellation/latest-wins/retained conditions and real retry`);
  }
  return {errors,review,pages:routes.length,transitions:ids.length,sourceFiles:Object.keys(current).length};
}

function readTests(root) {
  const result={};
  function walk(dir) { if(!fs.existsSync(path.join(root,dir))) return; for(const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) {const file=normalize(path.join(dir,item.name)); if(item.isDirectory()){if(item.name!=='node_modules' && !item.isSymbolicLink())walk(file);}else if(/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file))result[file]=fs.readFileSync(path.join(root,file),'utf8');} }
  for(const dir of ['app','components','lib','tests','scripts']) walk(dir);
  return collectTestNames(result);
}

export function renderTransitionTables(markdown, contract) {
  let output=markdown;
  for(const table of contract.tables) {
    const start='<!-- navigation-contracts:'+table.name+' -->', end='<!-- /navigation-contracts:'+table.name+' -->';
    if(output.split(start).length!==2 || output.split(end).length!==2) throw new Error('Missing/duplicate generated table markers: '+table.name);
    const rows=contract.transitions.filter(row=>table.prefixes.includes(row.id[0])).map(transitionCells);
    if(rows.some(row=>row.length!==table.headers.length)) throw new Error('Wrong table column count: '+table.name);
    const lines=[table.headers,table.headers.map(()=> '---'),...rows].map(row=>'| '+row.join(' | ')+' |').join('\n');
    const from=output.indexOf(start), to=output.indexOf(end,from);
    if(to<from) throw new Error('Reversed table markers: '+table.name);
    output=output.slice(0,from)+start+'\n'+lines+'\n'+output.slice(to);
  }
  return output;
}

export function run(root,base) {
  const contract=JSON.parse(fs.readFileSync(path.join(root,'config/navigation-contracts.json'),'utf8'));
  const files=inspectRepository(root);
  const result=validateContracts({contract,files,markdown:fs.readFileSync(path.join(root,specPath),'utf8'),tests:readTests(root)});
  if(base) {
    const sha=execFileSync('git',['rev-parse','--verify','--end-of-options',`${base}^{commit}`],{cwd:root,encoding:'utf8'}).trim();
    const changed=execFileSync('git',['diff','--name-only',sha,'--','app','components','lib'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
    for(const file of changed) if(/\.[jt]sx?$/.test(file) && !/\.(?:test|spec)\./.test(file)) result.review.push(`${file}: changed UI/data path; review local switches, state labels, auth and measurement evidence`);
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2);
    const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
    const writeDocs=args.length===1 && args[0]==='--write-docs';
    if(args.length && !writeDocs && !(args.length===2 && args[0]==='--base')) throw new Error('Usage: node scripts/check-navigation-contracts.mjs [--base <commit-ish> | --write-docs]');
    if(writeDocs) {
      const contract=JSON.parse(fs.readFileSync(path.join(root,'config/navigation-contracts.json'),'utf8'));
      const destination=path.join(root,specPath), markdown=fs.readFileSync(destination,'utf8');
      const rendered=renderTransitionTables(markdown,contract);
      const checked=validateContracts({contract,files:inspectRepository(root),markdown:rendered,tests:readTests(root)});
      if(checked.errors.length) throw new Error(checked.errors.join('\n'));
      if(rendered!==markdown) fs.writeFileSync(destination,rendered);
    }
    const result=run(root,writeDocs?undefined:args[1]);
    for(const error of result.errors) console.error(`FAIL ${error}`);
    console.log(`${result.errors.length ? 'FAIL':'PASS (mechanical only)'}: ${result.pages} pages / ${result.transitions} transitions / ${result.sourceFiles} source files`);
    for(const item of result.review) console.log(`REVIEW ${item}`);
    console.log('REVIEW: static checks do not prove interaction correctness, real-data UAT, latency, request counts, auth or publication permission.');
    process.exitCode=result.errors.length?1:0;
  } catch(error) {console.error(`FAIL ${error.message}`); process.exitCode=1;}
}
