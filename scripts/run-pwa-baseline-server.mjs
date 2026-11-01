import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
const baseline = process.env.PWA_BASELINE_DIR;
if (!baseline) throw new Error('PWA_BASELINE_DIR must reference the isolated original build');
for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  if (fs.existsSync(path.join(baseline, name))) throw new Error('Baseline must not contain real environment files');
}
const child = spawn(process.execPath, [path.join(baseline, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '38222'], { cwd: baseline, env: process.env, stdio: 'inherit', shell: false });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
child.on('error', error => { console.error(error.message); process.exit(1); });
