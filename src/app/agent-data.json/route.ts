import { readFile } from "node:fs/promises";
import path from "node:path";

import { decodeJsonSource } from "@/lib/json-source";

export const dynamic = "force-static";

export async function GET() {
  const filePath = path.join(process.cwd(), "agent.json");
  const source = decodeJsonSource(await readFile(filePath));

  return Response.json(JSON.parse(source), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
