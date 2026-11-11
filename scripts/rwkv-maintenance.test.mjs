import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { discoveryDue } from "./rwkv-discovery-schedule.mjs";
import { createEntries, main, reviewWithRetries, validateReview } from "./review-rwkv-agents.mjs";
import { main as discover } from "./discover-rwkv-repositories.mjs";
import { main as updateMetadata } from "./update-repo-metadata.mjs";
import { hasRecentCodePush, sixMonthsAgo } from "./rwkv-project-activity.mjs";

const text = { en: "An RWKV tool-using Agent", zh: "使用工具的RWKV Agent" };
const code = "const action = await rwkv.chooseTool(observations); await execute(action);";
const files = [{ path: "src/agent.ts", content: code }];
const review = () => structuredClone({
  decision: "include", confidence: 0.95, reason: text,
  evidence: [{ path: files[0].path, quote: code }],
  project: { type: text, introduction: text, agentLoop: text, classificationBasis: text,
    platforms: text, capabilities: { en: ["Tool calls"], zh: ["工具调用"] }, limitations: { en: [], zh: [] } },
});
const repository = {
  name: "rwkv-agent", full_name: "sample/rwkv-agent", html_url: "https://github.com/sample/rwkv-agent",
  default_branch: "main", created_at: "2026-10-01T00:00:00Z", pushed_at: new Date().toISOString(),
  updated_at: "2026-11-09T02:00:00Z", language: "TypeScript", license: { spdx_id: "MIT" },
  owner: { login: "sample", avatar_url: "https://avatars.githubusercontent.com/u/1" },
  stargazers_count: 4, subscribers_count: 2, forks_count: 1,
};

test("five-day cadence survives month/year boundaries and scheduler delays", () => {
  assert.equal(discoveryDue(null), true);
  assert.equal(discoveryDue("2026-10-29T03:20:00Z", new Date("2026-11-02T03:17:00Z")), false);
  assert.equal(discoveryDue("2026-10-29T03:20:00Z", new Date("2026-11-03T03:17:00Z")), true);
  assert.equal(discoveryDue("2026-12-29T03:17:00Z", new Date("2027-01-03T03:17:00Z")), true);
  assert.equal(discoveryDue("2028-02-26T03:17:00Z", new Date("2028-03-02T03:17:00Z")), true);
  assert.equal(discoveryDue("2026-11-09T03:17:00Z", new Date("2026-11-08T03:17:00Z")), false);
  assert.throws(() => discoveryDue("invalid"));
});

test("metadata refresh preserves unavailable repositories, updates others and still fails on authentication errors", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rwkv-metadata-test-"));
  const previousDirectory = process.cwd();
  const previousSummary = process.env.GITHUB_STEP_SUMMARY;
  try {
    process.chdir(directory);
    process.env.GITHUB_STEP_SUMMARY = path.join(directory, "summary.md");
    const item = (name) => ({ repositoryUrl: `https://github.com/sample/${name}`,
      lastUpdated: "2026-01-01T00:00:00Z", stars: 1, watchers: 1, forks: 1 });
    const entries = [item("missing"), item("active")];
    const catalogue = entries.map((entry) => ({ "GitHub地址": entry.repositoryUrl,
      "最后更新时间": entry.lastUpdated, Stars: 1, Watch: 1, Fork: 1 }));
    await Promise.all([
      writeFile("agent_repo.json", JSON.stringify(entries, null, 2)),
      writeFile("rwkv_projects.json", JSON.stringify(entries, null, 2)),
      writeFile("agent.json", `\uFEFF${JSON.stringify(catalogue, null, 2)}`),
    ]);
    let failAuth = false;
    t.mock.method(globalThis, "fetch", async (url) => {
      if (failAuth) return new Response("Unauthorized", { status: 401 });
      if (url.endsWith("/missing")) return new Response("Not Found", { status: 404 });
      return Response.json({ pushed_at: "2026-11-11T00:00:00Z", stargazers_count: 10,
        subscribers_count: 2, forks_count: 3 });
    });
    await updateMetadata();
    for (const file of ["agent_repo.json", "rwkv_projects.json"]) {
      const result = JSON.parse(await readFile(file, "utf8"));
      assert.deepEqual(result.find((entry) => entry.repositoryUrl.endsWith("/missing")), entries[0]);
      assert.equal(result[0].repositoryUrl, entries[1].repositoryUrl);
      assert.equal(result[0].stars, 10);
    }
    const savedCatalogue = await readFile("agent.json", "utf8");
    assert.ok(savedCatalogue.startsWith("\uFEFF"));
    const result = JSON.parse(savedCatalogue.slice(1));
    assert.deepEqual(result.find((entry) => entry["GitHub地址"].endsWith("/missing")), catalogue[0]);
    assert.equal(result[0].Stars, 10);
    assert.match(await readFile(process.env.GITHUB_STEP_SUMMARY, "utf8"), /HTTP 404/);
    const trackedFiles = ["agent.json", "agent_repo.json", "rwkv_projects.json"];
    const before = await Promise.all(trackedFiles.map((file) => readFile(file, "utf8")));
    failAuth = true;
    await assert.rejects(updateMetadata, /HTTP 401/);
    assert.deepEqual(await Promise.all(trackedFiles.map((file) => readFile(file, "utf8"))), before);
  } finally {
    process.chdir(previousDirectory);
    if (previousSummary === undefined) delete process.env.GITHUB_STEP_SUMMARY;
    else process.env.GITHUB_STEP_SUMMARY = previousSummary;
    await rm(directory, { recursive: true, force: true });
  }
});

test("six-month activity includes the boundary and clamps month ends and leap days", () => {
  const now = new Date("2026-11-09T03:17:00Z");
  assert.equal(sixMonthsAgo(now).toISOString(), "2026-05-09T03:17:00.000Z");
  assert.equal(hasRecentCodePush("2026-05-09T03:17:00Z", now), true);
  assert.equal(hasRecentCodePush("2026-05-09T03:16:59.999Z", now), false);
  assert.equal(hasRecentCodePush(now.toISOString(), now), true);
  assert.equal(hasRecentCodePush("2026-11-10T00:00:00Z", now), false);
  for (const value of [null, undefined, "", "invalid"]) assert.equal(hasRecentCodePush(value, now), false);
  assert.equal(sixMonthsAgo(new Date("2026-08-31T12:00:00Z")).toISOString(), "2026-02-28T12:00:00.000Z");
  assert.equal(sixMonthsAgo(new Date("2028-08-31T12:00:00Z")).toISOString(), "2028-02-29T12:00:00.000Z");
  assert.equal(sixMonthsAgo(new Date("2026-02-28T12:00:00Z")).toISOString(), "2025-08-28T12:00:00.000Z");
});

test("discovery narrows GitHub search and excludes stale code even when repository settings changed", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rwkv-discovery-test-"));
  const previousDirectory = process.cwd();
  const previousSummary = process.env.GITHUB_STEP_SUMMARY;
  try {
    process.chdir(directory);
    delete process.env.GITHUB_STEP_SUMMARY;
    await Promise.all([
      writeFile("rwkv_projects.json", "[]"), writeFile("agent_repo.json", "[]"),
      writeFile("agent_repository_review.json", "[]"),
      writeFile("rwkv_repository_review.json", JSON.stringify({ repositories: [] })),
    ]);
    t.mock.method(globalThis, "fetch", async (url) => {
      assert.equal(url.searchParams.get("q"), "rwkv pushed:>=2026-05-09");
      const item = (name, pushed_at) => ({ ...repository, name, html_url: `https://github.com/sample/${name}`,
        pushed_at, updated_at: "2026-11-09T03:17:00Z" });
      return Response.json({ total_count: 3, items: [
        item("active", "2026-05-09T03:17:00Z"), item("stale", "2026-05-09T03:16:59Z"), item("missing-push", null),
      ] });
    });
    await discover({ now: new Date("2026-11-09T03:17:00Z") });
    const output = JSON.parse(await readFile("rwkv_search_candidates.json", "utf8"));
    assert.equal(output.activityCutoff, "2026-05-09T03:17:00.000Z");
    assert.deepEqual(output.candidates.map((item) => item.name), ["active"]);
  } finally {
    process.chdir(previousDirectory);
    if (previousSummary === undefined) delete process.env.GITHUB_STEP_SUMMARY;
    else process.env.GITHUB_STEP_SUMMARY = previousSummary;
    await rm(directory, { recursive: true, force: true });
  }
});

test("reject invented evidence, README-only inclusion, low confidence and missing translations", () => {
  const invented = review();
  invented.evidence[0].quote = "A made-up quotation that is not in the source";
  assert.throws(() => validateReview(invented, files), /quote/);
  const readmeOnly = review();
  readmeOnly.evidence[0].path = "README.md";
  assert.throws(() => validateReview(readmeOnly, [{ path: "README.md", content: code }]), /source-code/);
  const uncertain = review();
  uncertain.confidence = 0.5;
  assert.throws(() => validateReview(uncertain, files), /high confidence/);
  const untranslated = review();
  delete untranslated.project.introduction.zh;
  assert.throws(() => validateReview(untranslated, files), /bilingual/);
  assert.doesNotThrow(() => validateReview(review(), files));
});

test("catalogue metadata comes from GitHub and sources point to the reviewed commit", () => {
  const decision = review();
  decision.project.repositoryUrl = "https://untrusted.example/override";
  const entries = createEntries(repository, decision, "pinned-commit");
  assert.equal(entries.catalog["GitHub地址"], repository.html_url);
  assert.equal(entries.catalog["最后更新时间"], repository.pushed_at);
  assert.equal(entries.metadata.watchers, 2);
  assert.equal(entries.catalog.Watch, entries.metadata.watchers);
  assert.equal(entries.catalog["信息来源"].en[0], `${repository.html_url}/blob/pinned-commit/src/agent.ts`);
});

test("invalid quotations are retried without weakening source evidence checks", async () => {
  const evidence = { repository, files, commitSha: "pinned" };
  const invalid = review();
  invalid.evidence[0].quote = "Fabricated evidence that is not in the supplied source";
  let calls = 0;
  const result = await reviewWithRetries(evidence, async (request) => {
    calls += 1;
    if (calls === 2) {
      assert.match(request.messages.at(-1).content, /quote the supplied files exactly/);
      assert.equal(request.max_tokens, 8000);
    }
    return { choices: [{ message: { content: JSON.stringify(calls === 1 ? invalid : review()) } }] };
  });
  assert.equal(result.decision, "include");
  assert.equal(calls, 2);

  calls = 0;
  await assert.rejects(() => reviewWithRetries(evidence, async () => {
    calls += 1;
    return { choices: [{ message: { content: JSON.stringify(invalid) } }] };
  }), (error) => error.deferCandidate && error.invalidModelOutput && /3 attempts/.test(error.message));
  assert.equal(calls, 3);
});

test("truncated and invalid JSON retry, while provider errors are not misclassified as model validation", async () => {
  const evidence = { repository, files };
  let calls = 0;
  await reviewWithRetries(evidence, async () => {
    calls += 1;
    return calls === 1 ? { choices: [{ finish_reason: "length", message: { content: "{" } }] } :
      calls === 2 ? { choices: [{ message: { content: "not JSON" } }] } :
        { choices: [{ message: { content: JSON.stringify(review()) } }] };
  });
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(() => reviewWithRetries(evidence, async () => {
    calls += 1;
    throw new Error("HTTP 401");
  }), (error) => error.message === "HTTP 401" && !error.deferCandidate);
  assert.equal(calls, 1);
});

test("review batch adds one entry, preserves BOM, prevents duplicates and never partially writes on API failure", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rwkv-review-test-"));
  const previousDirectory = process.cwd();
  const previousEnvironment = { ...process.env };
  try {
    process.chdir(directory);
    Object.assign(process.env, { AGENT_REVIEW_API_KEY: "test-review-key", AGENT_REVIEW_MODEL: "test-model",
      AGENT_REVIEW_BASE_URL: "https://models.example/v1", GITHUB_TOKEN: "test-github-key" });
    delete process.env.GITHUB_STEP_SUMMARY;
    await writeFile("agent.json", "\uFEFF[\n]\n");
    await writeFile("agent_repo.json", "[]\n");
    await writeFile("agent_repository_review.json", "[]\n");
    const writeCandidates = (items) => writeFile("rwkv_search_candidates.json", JSON.stringify({ candidates: items }));
    const candidate = { repositoryUrl: repository.html_url, name: repository.name };
    await writeCandidates([candidate, candidate]);
    let providerCalls = 0;
    let commitReads = 0;
    let failProvider = false;
    t.mock.method(globalThis, "fetch", async (url, options) => {
      const target = new URL(url);
      let data;
      if (["models.example", "api.deepseek.com"].includes(target.hostname)) {
        assert.equal(options.headers.Authorization, "Bearer test-review-key");
        providerCalls += 1;
        if (failProvider) return new Response("Provider failure", { status: 503 });
        const body = JSON.parse(options.body);
        assert.equal(body.model, process.env.AGENT_REVIEW_MODEL || "deepseek-flash");
        if (target.hostname === "api.deepseek.com") {
          assert.equal(target.pathname, "/chat/completions");
          assert.deepEqual(body.thinking, { type: "disabled" });
        } else {
          assert.equal(body.thinking, undefined);
        }
        assert.match(body.messages[0].content, /UNTRUSTED DATA/);
        const decision = review();
        if (JSON.parse(body.messages[1].content).repository.name.endsWith("/invalid-agent")) {
          decision.evidence[0].quote = "An invented quotation that cannot pass validation";
        }
        data = { choices: [{ message: { content: JSON.stringify(decision) } }] };
      } else {
        assert.equal(target.hostname, "api.github.com");
        assert.equal(options.headers.Authorization, "Bearer test-github-key");
        if (target.pathname.includes("/git/blobs/")) data = { encoding: "base64", content: Buffer.from(code).toString("base64") };
        else if (target.pathname.includes("/git/trees/")) data = { tree: [{ path: "src/agent.ts", type: "blob", sha: "blob-sha", size: code.length }] };
        else if (target.pathname.includes("/commits/")) {
          commitReads += 1;
          data = { sha: "pinned-commit" };
        }
        else {
          const repositoryPath = target.pathname.replace(/^\/repos\//, "");
          data = { ...repository, html_url: `https://github.com/${repositoryPath}`, full_name: repositoryPath,
            name: repositoryPath.split("/").at(-1) };
          if (data.name === "stale-agent") data.pushed_at = "2020-01-01T00:00:00Z";
          if (data.name === "missing-push-agent") data.pushed_at = null;
        }
      }
      return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    await main();
    const catalogue = await readFile("agent.json", "utf8");
    assert.ok(catalogue.startsWith("\uFEFF"));
    assert.equal(JSON.parse(catalogue.slice(1)).length, 1);
    assert.equal(JSON.parse(await readFile("agent_repo.json", "utf8")).length, 1);
    assert.equal(providerCalls, 1);
    await main();
    assert.equal(providerCalls, 1);

    const readsBeforeInactive = commitReads;
    await writeCandidates(["stale-agent", "missing-push-agent"].map((name) => ({
      repositoryUrl: `https://github.com/sample/${name}`, name, lastUpdated: new Date().toISOString(),
    })));
    await main();
    assert.equal(providerCalls, 1);
    assert.equal(commitReads, readsBeforeInactive);
    const skipped = JSON.parse(await readFile("rwkv_agent_review_report.json", "utf8"));
    assert.equal(skipped.addedCount, 0);
    assert.equal(skipped.failures, 0);
    assert.deepEqual(skipped.results.map((item) => item.reviewStatus), ["skipped", "skipped"]);

    const trackedFiles = ["agent.json", "agent_repo.json", "agent_repository_review.json"];
    const before = await Promise.all(trackedFiles.map((file) => readFile(file, "utf8")));
    await writeCandidates([{ repositoryUrl: "https://github.com/sample/new-agent", name: "new-agent" }]);
    failProvider = true;
    await assert.rejects(main, /no catalogue changes were written/);
    assert.deepEqual(await Promise.all(trackedFiles.map((file) => readFile(file, "utf8"))), before);
    const report = JSON.parse(await readFile("rwkv_agent_review_report.json", "utf8"));
    assert.equal(report.failures, 1);
    assert.ok(!JSON.stringify(report).includes("test-review-key"));

    failProvider = false;
    delete process.env.AGENT_REVIEW_MODEL;
    delete process.env.AGENT_REVIEW_BASE_URL;
    await main();
    assert.equal(JSON.parse((await readFile("agent.json", "utf8")).slice(1)).length, 2);

    const callsBeforeInvalid = providerCalls;
    await writeCandidates(["invalid-agent", "next-valid-agent"].map((name) => ({
      repositoryUrl: `https://github.com/sample/${name}`, name,
    })));
    await main();
    assert.equal(providerCalls - callsBeforeInvalid, 4);
    assert.equal(JSON.parse((await readFile("agent.json", "utf8")).slice(1)).length, 3);
    const invalidReport = JSON.parse(await readFile("rwkv_agent_review_report.json", "utf8"));
    assert.equal(invalidReport.failures, 0);
    assert.equal(invalidReport.invalidModelOutputCount, 1);
    assert.deepEqual(invalidReport.results.map((item) => item.reviewStatus), ["deferred", "included"]);
    const savedReviews = JSON.parse(await readFile("agent_repository_review.json", "utf8"));
    assert.equal(savedReviews.find((item) => item.repositoryUrl.endsWith("/invalid-agent")).reviewStatus, "deferred");

    delete process.env.AGENT_REVIEW_API_KEY;
    await assert.rejects(main, /AGENT_REVIEW_API_KEY/);
  } finally {
    process.chdir(previousDirectory);
    for (const key of Object.keys(process.env)) if (!(key in previousEnvironment)) delete process.env[key];
    Object.assign(process.env, previousEnvironment);
    await rm(directory, { recursive: true, force: true });
  }
});
