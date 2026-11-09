# RWKV Agent Project Directory

RWKV 社区 Agent 项目的双语只读目录。项目数据来自根目录的 `agent.json`，构建时生成英文与中文静态页面。

## 本地开发

```powershell
npm install
npm run dev
```

打开 `http://localhost:3000/en` 或 `http://localhost:3000/zh`。傻瓜包、推理与训练项目目录位于 `/en/resources` 和 `/zh/resources`。

## 静态构建

```powershell
npm run build
```

构建产物位于 `out/`，可以由任意静态文件服务器托管。根入口 `out/index.html` 会跳转到英文页面；GitHub Pages 的语言入口分别为 `/en` 和 `/zh`。

## 部署到 GitHub Pages

仓库内的 `.github/workflows/deploy-pages.yml` 会在推送到 `main` 或 `master` 后自动构建和部署：

1. 将仓库推送到 GitHub。
2. 打开仓库的 `Settings → Pages`。
3. 将 `Build and deployment → Source` 设置为 `GitHub Actions`。
4. 推送代码，或在 `Actions` 页面手动运行 `Deploy Next.js site to Pages`。

工作流会自动处理仓库站点的子路径，因此不需要在代码中写死仓库名称。

## 每 5 天扫描并收录 Agent

Pages 工作流每天 UTC 03:17（北京时间 11:17）检查 `.github/rwkv-discovery-state.json`，距离上次成功完成扫描满 5 个 UTC 日历日才执行扫描、模型审核、自动收录、元数据更新和构建部署。首次启用时会立即执行下一次定时检查；失败不推进完成时间，下一天重试。这样跨月也能保持 5 天间隔，避免 cron 的 `*/5` 在月末产生短间隔。GitHub Actions 可能延迟触发，实际执行时间以 Actions 为准。

推送仍会更新已有项目元数据并构建部署，但不会触发模型审核；手动运行工作流会立即扫描和审核，并重置 5 天计时。GitHub 的更新时间使用实际代码推送时间 `pushed_at`。

`rwkv_projects.json` 维护经过核验的 RWKV 傻瓜包、推理项目和训练项目。`rwkv_repository_review.json` 保留历史搜索审核记录。扫描使用 GitHub 官方 Search API 和 `GITHUB_TOKEN`，限定最近 6 个日历月内有代码推送的仓库，按更新时间每页 100 条扫描最多 10 页（GitHub 搜索接口上限 1000 条），跳过已收录和审核后未变化的仓库。新仓库和发生代码变更的仓库进入候选清单。

自动收录 Agent 时以 GitHub `pushed_at` 为准，包含恰好半年前的时间点；仓库设置、Stars 等导致的 `updated_at` 变化不算代码更新。搜索时过滤一次，读取候选仓库最新元数据后再次核验，超过半年或缺少有效推送时间的仓库会跳过，不调用审核模型。例如 2026-11-09 扫描时，门槛是同一 UTC 时刻的 2026-05-09；月末日期按目标月份最后一天计算。

审核优先处理名称或描述带 Agent 信号的候选，每次最多 20 个（可配置，最大 100 个）。读取固定提交版本的 README 和最多 6 个实现文件，每个文件最多 10000 字符，不运行外部仓库代码。模型需要提供逐字引用的源码证据，以确认 RWKV 参与动作选择或规划，并在执行循环中接收工具结果；证据不足的项目暂缓收录。程序校验引文、置信度、双语字段和重复地址后，同时更新 `agent.json` 与 `agent_repo.json`。新增和排除决定及对应提交版本保存在 `agent_repository_review.json`；暂缓项目下次继续审核。

候选清单和审核报告作为 `rwkv-search-candidates` Artifact 保存 30 天。接口失败、输出无效或构建检查失败时不会提交本轮变更，也不会推进扫描时间。

### 配置模型接口

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 配置：

| 类型 | 名称 | 说明 |
| --- | --- | --- |
| Secret | `AGENT_REVIEW_API_KEY` | 模型服务 API 密钥，必填 |
| Variable | `AGENT_REVIEW_MODEL` | 可选，默认 `deepseek-flash`；可切换为 `deepseek-v4-pro` 或兼容服务的模型 ID |
| Variable | `AGENT_REVIEW_BASE_URL` | 可选，默认 `https://api.deepseek.com`；可填写其他兼容服务的 API 地址 |
| Variable | `AGENT_REVIEW_MAX_CANDIDATES` | 可选，默认每轮 20 个 |

默认使用 DeepSeek 官方接口和 `deepseek-flash`，关闭思考模式以直接生成审核 JSON。模型名以 [DeepSeek 官方文档](https://api-docs.deepseek.com/) 为准。只需配置 `AGENT_REVIEW_API_KEY` Secret 即可使用默认服务；密钥不会写入代码或审核报告。

模型接口需要支持 `/chat/completions`、system/user 消息及 `response_format: {"type":"json_object"}`。请使用能够理解代码并稳定输出中英文 JSON 的模型；每轮会消耗相应服务的 API 额度。密钥未配置时，审核步骤会明确失败，候选清单仍上传到 Artifact。

本地生成待审核列表时，设置 `GITHUB_TOKEN` 或 `GH_TOKEN` 后运行 `npm run discover:rwkv`；配置上述模型环境变量后运行 `npm run review:agents` 自动审核和收录。输出文件 `rwkv_search_candidates.json` 和 `rwkv_agent_review_report.json` 已加入 `.gitignore`。

工作流使用 GitHub Actions 自带的 `GITHUB_TOKEN`。如果仓库设置限制了工作流写入权限，请在 `Settings → Actions → General → Workflow permissions` 中允许读写仓库内容。

## 检查

```powershell
npm run lint
npm run test:maintenance
npm run build
```
