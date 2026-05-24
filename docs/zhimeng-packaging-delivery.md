# 知萌：安装包分发与更新策略

## 当前产物

- `npm run dist:win` 生成 Windows 安装包（`nsis` + `portable`）
- `npm run dist:mac:arm64` 生成 macOS Apple 芯片版 DMG/ZIP
- `npm run dist:mac:x64` 生成 macOS Intel 芯片版 DMG/ZIP
- `npm run dist:desktop:local` 生成本地验收包：macOS Intel DMG/ZIP、macOS Apple 芯片 DMG/ZIP、Windows x64 安装版与便携版。该命令显式跳过 macOS 自动证书发现，用于本地流程验证，正式发布仍需签名与公证。
- 品牌信息：
  - `build.appId = com.zhimeng.desktop`
  - `build.productName = 知萌`

## 分发建议

1. 官网下载页：提供最新版安装包与版本号，按 macOS / Windows 分组
2. 渠道区分：`stable`（默认）/ `beta`（内测）
3. 下载后首次启动引导：登录、订阅、常见问题
4. macOS 以 DMG 为主下载入口，并明确区分 Apple 芯片（arm64）与 Intel 芯片（x64）；ZIP 可保留给后续自动更新或内部分发。

## 发布流程（建议）

1. 若本次更新了主视觉 **`website/assets/logo.png`**（官网下载页与桌面端需同一套形象）：先执行 **`npm run generate-icons`**，再进入构建。该命令会依据该 PNG 生成 `static/favicon.ico`（Windows 安装器/任务栏）、`static/app-icon.png`（macOS/Linux 与 Electron 非 Windows 窗口图标）及 `static/xzx_logo.png`（产出说明见 `scripts/generate-icons.mjs` 顶部注释）。
2. 复制 `.env.production.example` 为 `.env.production`，填入生产 API、二维码、价格、CORS、admin token、数据库和下载 CDN 地址。
3. 构建 macOS 与 Windows 包：

   ```bash
   npm run dist:mac:arm64
   npm run dist:mac:x64
   npm run dist:win
   ```

4. 上传 `dist/` 中的 macOS arm64 DMG、macOS x64 DMG、Windows NSIS 安装包与 portable 包到对象存储/CDN。
5. 用真实下载地址更新下载页版本信息：

   ```bash
   set -a
   . ./.env.production
   set +a
   npm run release:update-downloads
   ```

6. 执行发布检查：`npm run release:check`。`website/releases.json` 不得保留 `YOUR-CDN` / `example` / localhost 占位。
7. 打版本 tag，对外公告（更新说明 + 回滚说明）。

## codevalley.cn 宝塔部署

当前规划的公网环境：

- 测试：`https://zhimeng-test.codevalley.cn`
- 正式：`https://zhimeng.codevalley.cn`

部署到阿里云 + 宝塔时，按 [zhimeng-codevalley-deployment.md](./zhimeng-codevalley-deployment.md) 执行。仓库内同时提供：

- `deploy/env/zhimeng-test.env.example`
- `deploy/env/zhimeng-prod.env.example`
- `deploy/bt/nginx/zhimeng-test.codevalley.cn.conf`
- `deploy/bt/nginx/zhimeng.codevalley.cn.conf`

注意：桌面客户端的 `ZHIMENG_AUTH_API_BASE` / `ZHIMENG_BILLING_URL` 是构建期注入，测试包和正式包需要分别带对应环境变量构建。

## 本地完整流程

用于在上传 CDN 和正式签名/公证前，先确认打包、下载页和本机安装包链路可走通：

```bash
npm run dist:desktop:local
npm run release:update-local-downloads
python3 -m http.server 4173 --bind 127.0.0.1 --directory website
```

打开 `http://127.0.0.1:4173/index.html`，页面会优先读取 `website/releases.local.json`，四个下载按钮会指向本机 `dist/` 产物：

- macOS Apple 芯片版：`dist/知萌-5.2.16-arm64.dmg`
- macOS Intel 芯片版：`dist/知萌-5.2.16.dmg`
- Windows 安装版：`dist/知萌 Setup 5.2.16.exe`
- Windows 便携版：`dist/知萌 5.2.16.exe`

注意：本地包用于流程验收；生产 macOS 包需启用 Developer ID 签名、timestamp 与 notarization，Windows 包需使用正式代码签名证书。

## 购买闭环验收

发布前需同时跑 mock 与真库购买闭环。真库脚本会拉起隔离 MySQL 容器，不连接生产库，跑完默认清理容器：

```bash
npm run test:zhimeng-purchase-flow
npm run test:zhimeng-purchase-flow:realdb
npm run test:zhimeng-new-user-flow:realdb
```

验收覆盖 inactive 用户登录、创建订单、提交付款凭证、运营待确认列表、人工确认、刷新授权后 entitlement 变为 active。新用户完整流程会从 `/auth/register` 开始，确认注册后仍是 inactive，只有运营确认并刷新授权后才 active。

## 生产变量文件

- 模板：`.env.production.example`
- 本机真实值：`.env.production`（已加入 `.gitignore`，不要提交）
- 下载页更新脚本使用：
  - `ZHIMENG_RELEASE_CHANNEL`
  - `ZHIMENG_RELEASE_VERSION`
  - `ZHIMENG_RELEASED_AT`
  - `ZHIMENG_WINDOWS_NSIS_URL`
  - `ZHIMENG_WINDOWS_PORTABLE_URL`
  - `ZHIMENG_MACOS_ARM64_URL`
  - `ZHIMENG_MACOS_X64_URL`

## 自动更新（后续阶段）

- 使用 Electron autoUpdater（需提供更新 feed）
- 先灰度到 beta 渠道，再推广到 stable
- 失败回滚到上一稳定版本

## 验收清单

- [ ] 安装包显示“知萌”品牌名
- [ ] 安装图标正确
- [ ] 启动窗口标题正确
- [ ] 下载页可访问并可下载 macOS Apple 芯片版、macOS Intel 芯片版、Windows 安装版、Windows 便携版
- [ ] `npm run release:check` 通过
- [ ] 应用内「帮助」菜单可打开当前版本对应源码与 AGPL 许可说明
- [ ] 生产 macOS 包已完成 Developer ID 签名与公证
