// Dedicated synthetic API wiring; production build does not fetch fixture-shaped unrelated routes.
import { spawnSync, spawn } from "node:child_process";
const build = spawnSync(process.execPath, ["scripts/run-next-build-filtered.mjs"], {
  stdio: "inherit", env: { ...process.env, MARKET_INFO_API_BASE_URL: "", NEXT_PUBLIC_GA_ID: "" },
});
if (build.status !== 0) process.exit(build.status ?? 1);
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "19443"], {
  stdio: "inherit", env: { ...process.env, MARKET_INFO_API_BASE_URL: "http://127.0.0.1:19441", NEXT_PUBLIC_GA_ID: "" },
});
app.on("exit", code => process.exit(code ?? 0));
process.on("SIGTERM", () => app.kill("SIGTERM"));
process.on("SIGINT", () => app.kill("SIGINT"));
