import { appendFile, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const stateFile = ".github/rwkv-discovery-state.json";

export function discoveryDue(lastCompletedAt, now = new Date()) {
  if (lastCompletedAt === null) return true;
  const previous = Date.parse(lastCompletedAt);
  if (!Number.isFinite(previous)) throw new Error("Invalid discovery completion date");
  // Count UTC calendar days so a slightly delayed Actions run does not skip a day.
  return Math.floor(now.getTime() / 86400000) - Math.floor(previous / 86400000) >= 5;
}

async function main() {
  if (process.argv.includes("--complete")) {
    await writeFile(stateFile, `${JSON.stringify({ lastCompletedAt: new Date().toISOString() }, null, 2)}\n`);
    return;
  }
  const state = JSON.parse(await readFile(stateFile, "utf8"));
  const event = process.env.GITHUB_EVENT_NAME;
  const due = event === "workflow_dispatch" ||
    (event === "schedule" && discoveryDue(state.lastCompletedAt));
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `due=${due}\n`);
  }
  console.log(`RWKV discovery due: ${due}; last completed: ${state.lastCompletedAt ?? "never"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
