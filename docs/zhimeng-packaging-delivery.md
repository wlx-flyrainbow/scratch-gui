# 知萌：安装包分发与更新策略

## 当前产物

- `npm run dist:win` 生成 Windows 安装包（`nsis` + `portable`）
- 品牌信息：
  - `build.appId = com.zhimeng.desktop`
  - `build.productName = 知萌`

## 分发建议

1. 官网下载页：提供最新版安装包与版本号
2. 渠道区分：`stable`（默认）/ `beta`（内测）
3. 下载后首次启动引导：登录、订阅、常见问题

## 发布流程（建议）

1. 若本次更新了主视觉 **`website/assets/logo.png`**（官网下载页与桌面端需同一套形象）：先执行 **`npm run generate-icons`**，再进入构建。该命令会依据该 PNG 生成 `static/favicon.ico`（Windows 安装器/任务栏）、`static/app-icon.png`（macOS/Linux 与 Electron 非 Windows 窗口图标）及 `static/xzx_logo.png`（产出说明见 `scripts/generate-icons.mjs` 顶部注释）。
2. 设置生产环境变量并执行发布检查：`npm run release:check`
3. 打标签并构建：`npm run dist:win`
4. 上传产物到对象存储/CDN
5. 更新下载页版本信息（`website/releases.json` 不得保留 `YOUR-CDN` / `example` 占位）
6. 对外公告（更新说明 + 回滚说明）

## 自动更新（后续阶段）

- 使用 Electron autoUpdater（需提供更新 feed）
- 先灰度到 beta 渠道，再推广到 stable
- 失败回滚到上一稳定版本

## 验收清单

- [ ] 安装包显示“知萌”品牌名
- [ ] 安装图标正确
- [ ] 启动窗口标题正确
- [ ] 下载页可访问并可下载最新安装包
- [ ] `npm run release:check` 通过
- [ ] 应用内「帮助」菜单可打开当前版本对应源码与 AGPL 许可说明
