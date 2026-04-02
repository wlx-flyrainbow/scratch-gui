---
project_name: scratch-gui
user_name: Xinxiang
date: '2026-04-02'
sections_completed:
  - technology_stack
  - language_rules
  - framework_rules
  - testing_rules
  - quality_rules
  - workflow_rules
  - anti_patterns
status: complete
rule_count: 28
optimized_for_llm: true
---

# Project Context for AI Agents

_本文件供在本仓库中实现或修改代码的 AI 代理阅读：强调容易忽略的项目约定与「知萌」定制部分，不重复显而易见的通用知识。_

---

## Technology Stack & Versions

| 类别 | 技术 | 说明 |
|------|------|------|
| 运行时 | Node.js（与本地开发一致） | 构建与脚本依赖 npm |
| UI | React **16.x**（peer）、react-redux **5.x**、redux **3.x** | 与 upstream scratch-gui 一致，勿擅自升大版本 |
| 构建 | Webpack **5.x**、`scratch-webpack-configuration` | 入口见 `webpack.config.js` |
| 语言 | JavaScript（.js / .jsx），Babel 7 | 非 TypeScript 项目 |
| 测试 | Jest **21.x**、Enzyme 3、Selenium（integration） | 见 `package.json` scripts |
| 质量 | ESLint **8.x**、`eslint-config-scratch` | `npm run test:lint` |
| 桌面 | Electron **~39**、electron-builder **~26** | `electron-main.js`、`package.json` → `build` |
| 上游核心 | scratch-vm、scratch-blocks、scratch-storage、scratch-paint 等 | 版本以 `package.json` 为准 |

**知萌定制（商业/授权）**

- 授权与会话：`src/lib/auth-hoc.jsx`、`src/lib/auth/*`、`src/reducers/session.js`
- 本地 mock 后端：`backend/server.js`；启动：`npm run auth-server`
- 并行联调：`npm run dev:full`（已注入 `ZHIMENG_AUTH_API_BASE=http://localhost:3001`）
- 前端 API 基址等通过 **webpack DefinePlugin** 注入的 `process.env.ZHIMENG_*`（见 `webpack.config.js`）

---

## Critical Implementation Rules

### Language-Specific Rules

- 使用 **ESLint** 与仓库既有风格；提交前应能通过 `npm run test:lint`。
- **async/await** 与 Promise 混用时可接受，但避免无意义的 `async`（会触发 `require-await`）。
- 错误信息：网络/API 失败时优先解析服务端 JSON 的 `message` / `error` 再展示给用户。
- **许可证**：`package.json` 为 **AGPL-3.0-only**；商业分发与源码公开义务见 `docs/zhimeng-agpl-compliance.md` 与 `docs/agpl-source-disclosure.md`，不要在未确认合规时假设可闭源分发。

### Framework-Specific Rules（React / Redux / Scratch GUI）

- **GUI 根组件**通过 **HOC 组合链** 包装（`src/containers/gui.jsx`）：顺序敏感；新增横切能力（如授权）应作为独立 HOC 插入，避免在深层组件重复造会话逻辑。
- **Redux**：`scratchGui` 为 GUI 状态；**知萌会话**在 `session` reducer（`src/reducers/session.js`），与 `menu-bar`、`backpack` 等消费的 `state.session.session.user.{token,username}` **形状保持一致**。
- **功能开关**：顶层通过 props 传入（如 `canSave`、`showComingSoon`、`backpackVisible`、`backpackHost`）；`AuthHOC` 会覆盖部分能力 props，修改时注意 **props 展开顺序**（后写覆盖先写）。
- **国际化**：沿用 `react-intl` / `FormattedMessage`；新增用户可见中文文案时保持与现有 id 约定一致。
- **Electron**：主进程使用 `contextIsolation` + **preload**（`electron-preload.js`）；敏感 token 经 IPC + **`safeStorage`** 持久化，**不要在 renderer 明文长期存 refresh token**（`src/lib/auth/storage.js` 在有无 bridge 时分支）。

### Testing Rules

- 修改行为后：至少运行 `npm run test:lint`；若动到核心流程，再跑 `npm run test:unit` 或相关 integration。
- 新测试放在 `test/unit` 或 `test/integration`，命名与现有文件一致。
- Jest 对静态资源、CSS 有 `moduleNameMapper`（见 `package.json` jest 段），新增资源类型时需同步配置。

### Code Quality & Style Rules

- **最小必要改动**：不为了「好看」而大规模格式化无关文件。
- 组件：容器逻辑多在 `src/containers/`，展示多在 `src/components/`。
- 新增配置优先走 **环境变量 + webpack DefinePlugin**，避免硬编码生产域名。

### Development Workflow Rules

- 本地全栈联调：`npm run dev:full`；仅后端：`npm run auth-server`。
- 环境变量示例：`docs/zhimeng-env-example.md`；curl 示例：`docs/zhimeng-curl-examples.md`。
- 构建产物：`npm run build` → `build/`（playground）；`BUILD_MODE=dist` 等见 README。

### Critical Don't-Miss Rules

- **勿默认连接 Scratch 线上账号体系**：知萌使用自有 `ZHIMENG_AUTH_API_BASE`；`onStorageInit` / `storage` 的 project/asset host 可通过 env 指向自有服务，改动前确认与产品策略一致。
- **mock 后端** `backend/server.js` 为内存态，**重启即清空**；不可当生产唯一数据源。
- **electron-builder** `files` 列表若新增主进程文件，必须加入 `package.json` → `build.files`，否则打包缺文件。
- 修改 `Coming Soon` 相关 UX 时，对照 `docs/zhimeng-coming-soon-inventory.md`，区分「产品未上线」与「未登录/无权益」。

---

## Usage Guidelines

**对 AI 代理**

- 实现新功能前先读本文件与 `docs/zhimeng-*.md` 中与任务相关的章节。
- 与授权、支付、合规相关的改动，默认需要 **文档或产品确认**，不要自行假设可闭源或可接官方 Scratch 服务。

**对维护者**

- 技术栈或授权方案变更时，同步更新本文件与 `docs/zhimeng-env-example.md`。
- 每季度可删减已变得「常识化」的条目，保持精简。

**最后更新：** 2026-04-02
