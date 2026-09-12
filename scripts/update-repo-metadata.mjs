import { readFile, writeFile } from "node:fs/promises";

const metadataFile = "agent_repo.json";
const catalogFile = "agent.json";
const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractArrayObjects(source) {
  const openIndex = source.indexOf("[");
  if (openIndex < 0) throw new Error("JSON array opening bracket not found");

  const objects = [];
  let index = openIndex + 1;
  let closeIndex = -1;
  let indent = "";

  while (index < source.length) {
    while (index < source.length && /[\s,]/.test(source[index])) index += 1;
    if (source[index] === "]") {
      closeIndex = index;
      break;
    }
    if (source[index] !== "{") {
      throw new Error(`Expected object at offset ${index}`);
    }

    const objectStart = index;
    const lineStart = source.lastIndexOf("\n", objectStart - 1) + 1;
    indent = source.slice(lineStart, objectStart);
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (; index < source.length; index += 1) {
      const character = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          index += 1;
          break;
        }
      }
    }

    const text = source.slice(objectStart, index);
    objects.push({ text, data: JSON.parse(text) });
  }

  if (closeIndex < 0) throw new Error("JSON array closing bracket not found");
  return { objects, openIndex, closeIndex, indent };
}

function updateField(text, key, value, pattern) {
  const keyPattern = escapeRegExp(JSON.stringify(key));
  const matcher = new RegExp(`(${keyPattern}\\s*:\\s*)${pattern}`);
  if (!matcher.test(text)) throw new Error(`Field ${key} not found`);
  return text.replace(matcher, `$1${JSON.stringify(value)}`);
}

function updateObjectText(text, update, catalog) {
  let result = text;
  if (catalog) {
    result = updateField(result, "最后更新时间", update.lastUpdated, '"(?:\\\\.|[^"\\\\])*"');
    result = updateField(result, "Stars", update.stars, "-?\\d+");
    result = updateField(result, "Watch", update.watchers, "-?\\d+");
    result = updateField(result, "Fork", update.forks, "-?\\d+");
  } else {
    result = updateField(result, "lastUpdated", update.lastUpdated, '"(?:\\\\.|[^"\\\\])*"');
    result = updateField(result, "stars", update.stars, "-?\\d+");
    result = updateField(result, "watchers", update.watchers, "-?\\d+");
    result = updateField(result, "forks", update.forks, "-?\\d+");
  }
  return { text: result, data: JSON.parse(result) };
}

function rebuildArray(source, parsed) {
  const sorted = [...parsed.objects].sort(
    (left, right) => Date.parse(right.data.lastUpdated ?? right.data["最后更新时间"]) -
      Date.parse(left.data.lastUpdated ?? left.data["最后更新时间"]),
  );
  return `${source.slice(0, parsed.openIndex + 1)}\n${sorted
    .map((item) => parsed.indent + item.text)
    .join(",\n")}${source.slice(parsed.closeIndex)}`;
}

async function fetchJson(url, headers = {}) {
  let lastError;
  for (const delay of [0, 1000, 3000]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(30000),
      });
      if (response.ok) return response.json();
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`${url} returned HTTP ${response.status}`);
      }
      lastError = new Error(`${url} returned HTTP ${response.status}`);
    } catch (error) {
      if (error instanceof Error && /^.* returned HTTP 4\d\d$/.test(error.message) && !error.message.endsWith("HTTP 429")) {
        throw error;
      }
      lastError = error;
    }
  }
  throw lastError;
}

async function fetchRepositoryMetadata(repositoryUrl) {
  const parsedUrl = new URL(repositoryUrl);
  const pathParts = parsedUrl.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (pathParts.length !== 2) throw new Error(`Unsupported repository URL: ${repositoryUrl}`);

  if (parsedUrl.hostname === "github.com") {
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "rwkv-agent-objects-metadata-updater",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
    const repository = await fetchJson(
      `https://api.github.com/repos/${pathParts[0]}/${pathParts[1]}`,
      headers,
    );
    return {
      lastUpdated: repository.pushed_at || repository.updated_at,
      stars: repository.stargazers_count,
      watchers: repository.subscribers_count,
      forks: repository.forks_count,
    };
  }

  if (parsedUrl.hostname === "codeberg.org") {
    const repository = await fetchJson(
      `https://codeberg.org/api/v1/repos/${pathParts[0]}/${pathParts[1]}`,
      { "User-Agent": "rwkv-agent-objects-metadata-updater" },
    );
    return {
      lastUpdated: repository.updated_at,
      stars: repository.stars_count,
      watchers: repository.watchers_count,
      forks: repository.forks_count,
    };
  }

  throw new Error(`Unsupported repository host: ${parsedUrl.hostname}`);
}

async function main() {
  const metadataSource = await readFile(metadataFile, "utf8");
  const catalogSource = await readFile(catalogFile, "utf8");
  const metadataParsed = extractArrayObjects(metadataSource);
  const catalogParsed = extractArrayObjects(catalogSource.replace(/^\uFEFF/, ""));
  const metadataByUrl = new Map();

  for (const item of metadataParsed.objects) {
    const repositoryUrl = item.data.repositoryUrl;
    if (!repositoryUrl) throw new Error("agent_repo.json contains an entry without repositoryUrl");
    metadataByUrl.set(repositoryUrl, await fetchRepositoryMetadata(repositoryUrl));
  }

  const updatedMetadataObjects = metadataParsed.objects.map((item) => {
    const update = metadataByUrl.get(item.data.repositoryUrl);
    return updateObjectText(item.text, update, false);
  });
  const updatedCatalogObjects = catalogParsed.objects.map((item) => {
    const repositoryUrl = item.data["GitHub地址"];
    const update = metadataByUrl.get(repositoryUrl);
    if (!update) throw new Error(`No metadata found for ${repositoryUrl}`);
    return updateObjectText(item.text, update, true);
  });

  const updatedMetadataSource = rebuildArray(metadataSource, {
    ...metadataParsed,
    objects: updatedMetadataObjects,
  });
  const updatedCatalogSource = rebuildArray(catalogSource.replace(/^\uFEFF/, ""), {
    ...catalogParsed,
    objects: updatedCatalogObjects,
  });
  const catalogWithBom = catalogSource.startsWith("\uFEFF")
    ? `\uFEFF${updatedCatalogSource}`
    : updatedCatalogSource;

  if (updatedMetadataSource !== metadataSource) await writeFile(metadataFile, updatedMetadataSource);
  if (catalogWithBom !== catalogSource) await writeFile(catalogFile, catalogWithBom);
  console.log(updatedMetadataSource === metadataSource && catalogWithBom === catalogSource ? "No metadata changes" : "Metadata updated");
}

await main();
