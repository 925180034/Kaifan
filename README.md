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
npm run analytics    # 汇总 SQLite event_log 产品指标
npm run clean        # 清理测试产物、缓存和构建目录
```

## 本地配置

复制 `.env.example` 到 `.env.local`，再填入 DeepSeek 配置。不要提交 `.env.local`、数据库文件、日志、缓存和测试生成物；这些已经在 `.gitignore` 中排除。

## 隐私与可靠性

- 浏览器首次访问会建立匿名会话；会话令牌只保存在本机，服务端仅保存其哈希。用户数据接口必须携带该令牌。
- “清空本地数据”会废弃本机的匿名会话，并在下次使用时建立新的匿名会话。
- 设置中的“所在城市”为可选项。填写后，客户端每天通过 Open-Meteo 获取一次当前天气；不填写或天气服务失败时保留原有推荐上下文。
- 同一匿名会话的模型生成最多 `4 次/分钟`。超过上限时会返回本地规则方案，不会把模型错误直接暴露给用户；单卡换菜另有 `12 次/分钟` 上限。

## 数据报告

服务器上执行 `npm run analytics` 会读取 `data/kaifan.sqlite` 的 `event_log`，输出问卷完成率、采纳率、反馈率、平台跳转 fallback、平均换一批次数等核心指标。需要 JSON 时可运行：

```bash
python3 scripts/analytics_report.py --json
```

## 清理规则

保留源码测试目录：`tests/`、`tests_backend/`、`tests_e2e/`。只清理可再生成内容，例如 `test-results/`、`playwright-report/`、`coverage/`、`dist/`、`__pycache__/` 和 `.pytest_cache/`。
