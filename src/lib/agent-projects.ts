import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  normalizeAgentProjects,
  type AgentProject,
} from "@/lib/agent-project-normalizer";
import type { Locale } from "@/lib/i18n";
import { decodeJsonSource } from "@/lib/json-source";

export type { AgentProject } from "@/lib/agent-project-normalizer";

export async function readAgentProjects(locale: Locale): Promise<AgentProject[]> {
  const filePath = path.join(process.cwd(), "agent.json");
  const source = decodeJsonSource(await readFile(filePath));
  const parsed: unknown = JSON.parse(source);

  return normalizeAgentProjects(parsed, locale);
}
