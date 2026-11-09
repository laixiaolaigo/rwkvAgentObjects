import { appendFile, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { hasRecentCodePush, sixMonthsAgo } from "./rwkv-project-activity.mjs";

const outputFile = "rwkv_search_candidates.json";
const perPage = 100;
const maxPages = Math.min(
  10,
  Math.max(1, Number(process.env.RWKV_SEARCH_MAX_PAGES) || 10)
);
const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

function normalizeUrl(value) {
  return value.replace(/\/+$/, "").toLowerCase();
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchSearchPage(page, searchQuery) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("sort", "updated");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "rwkv-agent-objects-discovery",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(30000),
    });
    if (response.ok) return response.json();

    if (response.status !== 403 && response.status !== 429) {
      throw new Error(`GitHub search page ${page} returned HTTP ${response.status}`);
    }

    const resetAt = Number(response.headers.get("x-ratelimit-reset")) * 1000;
    const retryAfter = Number(response.headers.get("retry-after")) * 1000;
    const waitTime = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter
      : Math.max(1000, resetAt - Date.now() + 1000);
    if (attempt === 2 || waitTime > 65000) {
      throw new Error(
        `GitHub search rate limit reached on page ${page}; use GITHUB_TOKEN and retry after ${new Date(resetAt).toISOString()}`
      );
    }
    await delay(waitTime);
  }

  throw new Error(`GitHub search page ${page} could not be loaded`);
}

function matchSignals(repository) {
  const name = repository.name.toLowerCase();
  const description = (repository.description || "").toLowerCase();
  const topics = repository.topics || [];
  const signals = [];
  if (name.includes("rwkv")) signals.push("name");
  if (description.includes("rwkv")) signals.push("description");
  if (topics.includes("rwkv")) signals.push("topic");
  if (!signals.length) signals.push("readme");
  return signals;
}

export async function main({ now = new Date() } = {}) {
  const cutoff = sixMonthsAgo(now);
  const searchQuery = `rwkv pushed:>=${cutoff.toISOString().slice(0, 10)}`;
  const [curatedProjects, agentRepositories, repositoryReview, agentReviews] = await Promise.all([
    readFile("rwkv_projects.json", "utf8").then(JSON.parse),
    readFile("agent_repo.json", "utf8").then(JSON.parse),
    readFile("rwkv_repository_review.json", "utf8").then(JSON.parse),
    readFile("agent_repository_review.json", "utf8").then(JSON.parse),
  ]);
  const knownUrls = new Set([
    ...curatedProjects.map((item) => normalizeUrl(item.repositoryUrl)),
    ...agentRepositories.map((item) => normalizeUrl(item.repositoryUrl)),
  ]);
  const reviewByUrl = new Map(
    [...repositoryReview.repositories, ...agentReviews].map((item) => [normalizeUrl(item.repositoryUrl), item])
  );

  const repositories = [];
  let totalCount = 0;
  let pagesScanned = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await fetchSearchPage(page, searchQuery);
    totalCount = result.total_count;
    pagesScanned = page;
    repositories.push(
      ...result.items.map((repository) => ({ repository, searchPage: page }))
    );
    if (result.items.length < perPage) break;
    await delay(1200);
  }

  const candidates = repositories
    .filter(({ repository }) => !repository.fork && !repository.archived)
    .filter(({ repository }) => hasRecentCodePush(repository.pushed_at, now))
    .filter(({ repository }) => !knownUrls.has(normalizeUrl(repository.html_url)))
    .filter(({ repository }) => {
      const previousReview = reviewByUrl.get(normalizeUrl(repository.html_url));
      if (!previousReview) return true;
      if (previousReview.reviewStatus === "deferred") return true;
      return Date.parse(repository.pushed_at) > Date.parse(previousReview.lastPushed);
    })
    .map(({ repository, searchPage }) => ({
      repositoryUrl: repository.html_url,
      owner: repository.owner.login,
      name: repository.name,
      description: repository.description,
      lastUpdated: repository.pushed_at,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      language: repository.language,
      license: repository.license?.spdx_id || null,
      topics: repository.topics || [],
      searchPage,
      matchSignals: matchSignals(repository),
      previousReview: reviewByUrl.has(normalizeUrl(repository.html_url))
        ? {
            status: reviewByUrl.get(normalizeUrl(repository.html_url)).reviewStatus,
            reason: reviewByUrl.get(normalizeUrl(repository.html_url)).reason,
            lastPushed: reviewByUrl.get(normalizeUrl(repository.html_url)).lastPushed,
            reviewedAt: reviewByUrl.get(normalizeUrl(repository.html_url)).reviewedAt,
          }
        : null,
    }));

  const output = {
    generatedAt: new Date().toISOString(),
    query: `https://github.com/search?o=desc&p=1&q=${encodeURIComponent(searchQuery)}&s=updated&type=Repositories`,
    activityCutoff: cutoff.toISOString(),
    totalCount,
    scannedCount: repositories.length,
    pagesScanned,
    candidateCount: candidates.length,
    candidates,
  };
  await writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const preview = candidates.slice(0, 30).map((candidate) =>
      `| ${candidate.searchPage} | [${candidate.owner}/${candidate.name}](${candidate.repositoryUrl}) | ${candidate.lastUpdated} | ${candidate.stars} |`
    );
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      [
        "## RWKV repository discovery",
        "",
        `Scanned ${repositories.length} repositories across ${pagesScanned} pages; found ${candidates.length} new or changed candidates.`,
        `Only repositories with code pushed on or after ${cutoff.toISOString()} are eligible.`,
        "",
        "| Page | Repository | Updated | Stars |",
        "| ---: | --- | --- | ---: |",
        ...preview,
        "",
        `Download the \`${outputFile}\` workflow artifact for the complete candidate list.`,
        "",
      ].join("\n")
    );
  }

  console.log(
    `Scanned ${repositories.length} repositories across ${pagesScanned} pages; wrote ${candidates.length} new or changed candidates to ${outputFile}`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
