# 知萌：安装包分发与更新策略

## 当前产物

- `npm run dist:win` 生成 Windows 安装包（`nsis` + `portable`）
- `npm run dist:mac:arm64` 生成 macOS Apple 芯片版 DMG/ZIP
- `npm run dist:mac:x64` 生成 macOS Intel 芯片版 DMG/ZIP
- `npm run dist:desktop:local` 生成本地验收包：macOS Intel DMG/ZIP、macOS Apple 芯片 DMG/ZIP、Windows x64 安装版与便携版。该命令显式跳过 macOS 自动证书发现，用于本地流程验证，正式发布仍需签名与公证。
- `npm run dist:desktop:prod` 生成正式分发包：构建期固定注入 `https://zhimeng.codevalley.cn` 作为认证、订阅和付款 API 地址，并在打包前校验产物不再包含 `localhost:3001`。
- 品牌信息：
  - `build.appId = com.zhimeng.desktop`
  - `build.productName = 新祥编程`

## 分发建议

1. 官网下载页：提供最新版安装包与版本号，按 macOS / Windows 分组
2. 渠道区分：`stable`（默认）/ `beta`（内测）
3. 下载后首次启动引导：登录、订阅、常见问题
4. macOS 以 DMG 为主下载入口，并明确区分 Apple 芯片（arm64）与 Intel 芯片（x64）；ZIP 可保留给后续自动更新或内部分发。

## 发布流程（建议）

1. 若本次更新了主视觉 **`website/assets/logo.png`**（官网下载页与桌面端需同一套形象）：先执行 **`npm run generate-icons`**，再进入构建。该命令会依据该 PNG 生成 `static/favicon.ico`（Windows 安装器/任务栏）、`static/app-icon.png`（带透明圆角，Electron 非 Windows 窗口图标）、`static/app-icon.icns`（macOS 应用图标）及 `static/xzx_logo.png`。
2. 复制 `.env.production.example` 为 `.env.production`，填入生产 API、二维码、价格、CORS、admin token、数据库和下载 CDN 地址。
3. 本地验收包可用：

   ```bash
   npm run dist:desktop:local
   ```

4. 正式分发包必须用：

   ```bash
   ZHIMENG_REQUIRE_CODE_SIGNING=1 npm run release:check-signing
   npm run dist:desktop:prod
   npm run test:zhimeng-desktop-bundle
   ZHIMENG_REQUIRE_MAC_SIGNED=1 npm run test:zhimeng-mac-release
   ```

   该流程会防止把连接本机 `localhost:3001` 的测试包发布给用户。macOS 对外包还必须通过 Developer ID 签名和 Apple notarization；Windows 对外包必须使用正式代码签名证书。未通过时不要上架到正式下载目录。

5. 上传 `dist/` 中的 macOS arm64 DMG、macOS x64 DMG、Windows NSIS 安装包与 portable 包到对象存储/CDN。上传后先下载回本机复查 macOS 包：

   ```bash
   ZHIMENG_REQUIRE_MAC_SIGNED=1 ZHIMENG_MAC_RELEASE_DMG_PATHS=/path/to/downloaded-arm64.dmg:/path/to/downloaded-x64.dmg npm run test:zhimeng-mac-release
   ```

   `ZHIMENG_MAC_RELEASE_DMG_PATHS` 用冒号分隔多个 DMG 路径。该检查会挂载 DMG，并对其中的 `.app` 执行 `codesign` 与 `spctl`。

6. 用真实下载地址更新下载页版本信息：

   ```bash
   set -a
   . ./.env.production
   set +a
   npm run release:update-downloads
   ```

7. 执行发布检查：`npm run release:check`。`website/releases.json` 不得保留 `YOUR-CDN` / `example` / localhost 占位。
8. 打版本 tag，对外公告（更新说明 + 回滚说明）。

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

- macOS Apple 芯片版：`dist/新祥编程-1.0.0-arm64.dmg`
- macOS Intel 芯片版：`dist/新祥编程-1.0.0.dmg`
- Windows 安装版：`dist/新祥编程 Setup 1.0.0.exe`
- Windows 便携版：`dist/新祥编程 1.0.0.exe`

注意：本地包用于流程验收；生产 macOS 包需启用 Developer ID 签名、timestamp 与 notarization，Windows 包需使用正式代码签名证书。Apple 官方要求站外分发的 macOS 软件使用 Developer ID，并通过 notarization 让 Gatekeeper 能确认软件来源和完整性；Electron Builder 也要求 macOS 自动更新和正式分发包走代码签名。

第一次办理 Apple Developer ID、公证凭证和 Windows 代码签名证书时，按 [zhimeng-code-signing-certificate-guide.md](./zhimeng-code-signing-certificate-guide.md) 执行。

## 签名与公证闸门

正式公开售卖前必须执行：

```bash
ZHIMENG_REQUIRE_CODE_SIGNING=1 npm run release:check-signing
```

通过条件：

- macOS：本机钥匙串存在 `Developer ID Application` 身份，或配置了 electron-builder 可用的 `CSC_LINK` / `CSC_NAME`。
- macOS：存在 Apple notarization 凭证，支持 `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`，或 `APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER`。
- Windows：存在 `WIN_CSC_LINK` 或 `CSC_LINK`，并配置 `WIN_CSC_KEY_PASSWORD` 或 `CSC_KEY_PASSWORD`。

如果只是小范围种子用户测试，且已经明确接受系统安全提示带来的转化损耗，可以临时使用：

```bash
ZHIMENG_ALLOW_UNSIGNED_SEED_RELEASE=1 npm run release:check-signing
```

该模式只允许内部/种子验证，不允许写入“正式发布已完成”。对外官网、销售页和客服话术不能把未签名包描述成已完成正式安全认证。

参考：

- Apple Developer: [Developer ID](https://developer.apple.com/support/developer-id/)
- Apple Developer: [Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- electron-builder: [macOS code signing](https://www.electron.build/code-signing-mac)

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

- [ ] 安装包显示“新祥编程”品牌名
- [ ] 安装图标正确
- [ ] 启动窗口标题正确
- [ ] 下载页可访问并可下载 macOS Apple 芯片版、macOS Intel 芯片版、Windows 安装版、Windows 便携版
- [ ] `npm run release:check` 通过
- [ ] `ZHIMENG_REQUIRE_CODE_SIGNING=1 npm run release:check-signing` 通过
- [ ] `npm run release:verify-public` 通过，确认线上页面、发布清单、演示视频和四个下载包均可访问
- [ ] `npm run test:zhimeng-desktop-bundle` 通过，确认正式包内 API 指向 `https://zhimeng.codevalley.cn`，不含 `localhost:3001`
- [ ] `npm run test:zhimeng-mac-release` 通过；正式发布时设置 `ZHIMENG_REQUIRE_MAC_SIGNED=1`
- [ ] 应用内「帮助」菜单可打开新祥编程官网，官网页脚可继续访问当前版本对应源码与 AGPL 许可说明
- [ ] 生产 macOS 包已完成 Developer ID 签名与公证
