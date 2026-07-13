# Kaifan 晚餐决策助手

Kaifan 是一个 H5/PWA 晚餐决策助手 MVP，目标是帮助用户基于画像、预算、口味、做饭意愿和历史反馈，在“自己做、点外卖、出去吃、买食材”之间快速做决定。

## 目录结构

- `index.html`、`styles.css`、`manifest.webmanifest`、`sw.js`：静态 H5/PWA 外壳、样式和离线缓存。
- `src/`：前端业务模块，包括推荐排序、用户画像、历史、收藏、反馈学习、行动方案和 API 客户端。
- `server/`：FastAPI 后端，包含 DeepSeek 调用、SQLite 持久化、推荐接口和健康检查。
- `tests/`：Node.js 单元测试，覆盖前端核心逻辑。
- `tests_backend/`：Python `unittest` 后端测试。
- `tests_e2e/`：Playwright 移动端端到端测试。
- `docs/`：产品文档、前端设计文档、部署说明和阶段计划。
- `deploy/`：Nginx 与 systemd 生产部署示例。
- `scripts/`：项目维护脚本，例如清理生成物。
- `assets/`：图标和视觉参考素材。

## 常用命令

```bash
npm run dev          # 启动 FastAPI + 静态前端，默认 http://127.0.0.1:6053
npm test             # 运行前端 Node.js 单元测试
npm run backend:test # 运行 Python 后端测试
npm run e2e          # 运行 Playwright 端到端测试
npm run check        # 运行当前前后端检查
npm run clean        # 清理测试产物、缓存和构建目录
```

## 本地配置

复制 `.env.example` 到 `.env.local`，再填入 DeepSeek 配置。不要提交 `.env.local`、数据库文件、日志、缓存和测试生成物；这些已经在 `.gitignore` 中排除。

## 清理规则

保留源码测试目录：`tests/`、`tests_backend/`、`tests_e2e/`。只清理可再生成内容，例如 `test-results/`、`playwright-report/`、`coverage/`、`dist/`、`__pycache__/` 和 `.pytest_cache/`。
