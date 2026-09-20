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

## 每日自动更新

Pages 工作流每天 UTC 03:17 自动查询 `agent_repo.json` 和 `rwkv_projects.json` 中的 GitHub、Codeberg 仓库，并同步更新时间、Stars、Watch 和 Fork，然后在同一次运行中重新构建部署。GitHub 的更新时间使用实际代码推送时间 `pushed_at`，不会把 Stars 或仓库设置变化误判为代码更新。

`rwkv_projects.json` 维护经过核验的 RWKV 傻瓜包、推理项目和训练项目。`rwkv_repository_review.json` 保存 GitHub 搜索 10 页共 937 个结果的完整审核记录、分类和排除原因。每日工作流使用 GitHub 官方 Search API 和 `GITHUB_TOKEN`，以每页 100 条的方式扫描最多 10 页（GitHub 搜索接口上限 1000 条），跳过未变化的已审核仓库后生成 `rwkv-search-candidates` Artifact；新仓库以及审核后又有代码提交的仓库会重新进入候选列表。

本地生成待审核列表时，需要设置 `GITHUB_TOKEN` 或 `GH_TOKEN`，然后运行 `npm run discover:rwkv`。输出文件 `rwkv_search_candidates.json` 已加入 `.gitignore`。

工作流使用 GitHub Actions 自带的 `GITHUB_TOKEN`。如果仓库设置限制了工作流写入权限，请在 `Settings → Actions → General → Workflow permissions` 中允许读写仓库内容。

## 检查

```powershell
npm run lint
npm run build
```
