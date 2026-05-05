import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const staleBaselineWarning =
  /^\[baseline-browser-mapping\] The data in this module is over two months old\./;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next");
const forwardedArgs = process.argv.slice(2);

function writeFiltered(stream, output) {
  if (!output) {
    return;
  }

  const filtered = output
    .split(/\r?\n/)
    .filter((line) => !staleBaselineWarning.test(line))
    .join("\n");

  if (filtered.length === 0) {
    return;
  }

  stream.write(filtered);
  if (!filtered.endsWith("\n")) {
    stream.write("\n");
  }
}

const result = spawnSync(process.execPath, [nextBin, "build", "--webpack", ...forwardedArgs], {
  encoding: "utf8",
  env: {
    ...process.env,
    BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA: "true",
    BROWSERSLIST_IGNORE_OLD_DATA: "true",
  },
  maxBuffer: 1024 * 1024 * 100,
  shell: false,
  stdio: "pipe",
});

writeFiltered(process.stdout, result.stdout);
writeFiltered(process.stderr, result.stderr);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.signal) {
  process.kill(process.pid, result.signal);
}

process.exit(result.status ?? 1);
