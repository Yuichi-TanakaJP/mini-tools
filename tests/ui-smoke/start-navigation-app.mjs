// Build and run the production router for reproducible navigation checks.
import { spawnSync, spawn } from "node:child_process";
const built = spawnSync(process.execPath, ["scripts/run-next-build-filtered.mjs"], { stdio: "inherit", env: process.env });
if (built.status !== 0) process.exit(built.status ?? 1);
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "18842"], { stdio: "inherit", env: process.env });
server.on("exit", code => process.exit(code ?? 0));
process.on("SIGTERM", () => server.kill("SIGTERM"));
process.on("SIGINT", () => server.kill("SIGINT"));
