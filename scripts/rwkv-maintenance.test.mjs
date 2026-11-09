import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { discoveryDue } from "./rwkv-discovery-schedule.mjs";
import { createEntries, main, validateReview } from "./review-rwkv-agents.mjs";

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
  default_branch: "main", created_at: "2026-10-01T00:00:00Z", pushed_at: "2026-11-09T01:00:00Z",
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
        data = { choices: [{ message: { content: JSON.stringify(review()) } }] };
      } else {
        assert.equal(target.hostname, "api.github.com");
        assert.equal(options.headers.Authorization, "Bearer test-github-key");
        if (target.pathname.includes("/git/blobs/")) data = { encoding: "base64", content: Buffer.from(code).toString("base64") };
        else if (target.pathname.includes("/git/trees/")) data = { tree: [{ path: "src/agent.ts", type: "blob", sha: "blob-sha", size: code.length }] };
        else if (target.pathname.includes("/commits/")) data = { sha: "pinned-commit" };
        else {
          const repositoryPath = target.pathname.replace(/^\/repos\//, "");
          data = { ...repository, html_url: `https://github.com/${repositoryPath}`, full_name: repositoryPath,
            name: repositoryPath.split("/").at(-1) };
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

    delete process.env.AGENT_REVIEW_API_KEY;
    await assert.rejects(main, /AGENT_REVIEW_API_KEY/);
  } finally {
    process.chdir(previousDirectory);
    for (const key of Object.keys(process.env)) if (!(key in previousEnvironment)) delete process.env[key];
    Object.assign(process.env, previousEnvironment);
    await rm(directory, { recursive: true, force: true });
  }
});
