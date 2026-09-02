# RWKV Agent Project Directory

RWKV 社区 Agent 项目的双语只读目录。项目数据来自根目录的 `agent.json`，构建时生成英文与中文静态页面。

## 本地开发

```powershell
npm install
npm run dev
```

打开 `http://localhost:3000/en` 或 `http://localhost:3000/zh`。

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

Pages 工作流每天 UTC 03:17 自动查询 `agent_repo.json` 中的 GitHub 和 Codeberg 仓库，并同步更新时间、Stars、Watch 和 Fork 到 `agent.json` 与 `agent_repo.json`，然后在同一次运行中重新构建部署。GitHub 的更新时间使用实际代码推送时间 `pushed_at`，不会把 Stars 或仓库设置变化误判为代码更新。

工作流使用 GitHub Actions 自带的 `GITHUB_TOKEN`。如果仓库设置限制了工作流写入权限，请在 `Settings → Actions → General → Workflow permissions` 中允许读写仓库内容。

## 检查

```powershell
npm run lint
npm run build
```
