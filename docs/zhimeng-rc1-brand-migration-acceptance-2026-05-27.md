# 新祥编程 RC1 品牌切换验收记录

日期：2026-05-27

## 结论

RC1 已将对外主品牌从“知萌”切换为“新祥编程”。

“知萌”仅作为历史项目代号、内部脚本/环境变量前缀、存量文件名和商标风险记录保留，不作为新增对外售卖品牌。

## 本次覆盖范围

- Electron 窗口标题与页面标题锁定为“新祥编程”。
- `package.json` 发布描述和 `build.productName` 切换为“新祥编程”。
- 官网首页、付款页、客服辅助下单页、运营页对外展示切换为“新祥编程”。
- 客户端登录/注册弹窗、订阅中心、锁定页、账号入口、默认作品名切换为“新祥编程”语境。
- 客户端错误文案、默认设备名、测试账号昵称、验收脚本断言切换为“新祥编程”。
- 私域文案、客服 FAQ、安装指引、种子用户执行手册、商业化计划等对外物料切换为“新祥编程”。
- 首发海报源文件、三张海报成图、30 秒演示视频和视频封面重新生成为“新祥编程”版。
- 本地桌面安装包重新打包，产物文件名切换为“新祥编程”。

## 本地产物

`npm run dist:desktop:local` 已生成：

- `dist/新祥编程-1.0.0-arm64.dmg`
- `dist/新祥编程-1.0.0.dmg`
- `dist/新祥编程 Setup 1.0.0.exe`
- `dist/新祥编程 1.0.0.exe`

`npm run release:update-local-downloads` 已更新本地下载清单：

- `website/releases.local.json`

该文件为本地验收清单，当前被 `.gitignore` 忽略，不作为源码交付文件。

正式下载清单代码层已切换为新祥编程命名安装包：

- `website/releases.json`
- `deploy/env/zhimeng-prod.env.example`

线上服务器尚未完成部署和安装包上传；在正式发布前需要上传新命名安装包并重新部署官网、付款页、运营页和 `releases.json`。

## 验证命令

已通过：

- `rg -n "知萌" package.json electron-main.js webpack.config.js README.md website src scripts test deploy/env`
- `./node_modules/.bin/eslint electron-main.js webpack.config.js src/components/gui/gui.jsx src/components/menu-bar/menu-bar.jsx src/components/menu-bar/zhimeng-login-form.jsx src/lib/auth/api.js src/lib/auth-hoc.jsx src/lib/auth/storage.js src/lib/titled-hoc.jsx scripts/validate-zhimeng-package-metadata.js scripts/update-zhimeng-local-releases.js scripts/verify-zhimeng-public-release.js scripts/run-zhimeng-goal-check.js scripts/validate-zhimeng-billing-layout.js scripts/generate-zhimeng-demo-video.js`
- `npm run test:unit -- --runTestsByPath test/unit/components/gui.test.jsx test/unit/components/menu-bar.test.jsx test/unit/lib/auth-api-request.test.js`
- `npm run build`
- `npm run test:zhimeng-package-metadata`
- `npm run test:zhimeng-desktop-bundle`
- `npm run test:zhimeng-billing-layout`
- `npm run test:zhimeng-purchase-flow`
- `npm run test:backend`
- `npm run dist:desktop:local`
- `npm run release:update-local-downloads`
- `npm run test:zhimeng-mac-release`
- `npm run release:check`

线上公开验收暂未通过：

- `npm run release:verify-public`

失败原因是线上站点仍服务旧“知萌”页面和旧 `zhimeng-*` 下载包名；这属于服务器部署/上传未完成，不是本地 RC1 代码未切换。

订阅弹窗布局验收报告：

- `_bmad-output/test-reports/zhimeng-billing-layout-2026-05-27T03-45-38-620Z.json`
- `_bmad-output/test-reports/zhimeng-billing-layout-1280x800.png`
- `_bmad-output/test-reports/zhimeng-billing-layout-1440x900.png`

购买闭环验收报告：

- `_bmad-output/test-reports/zhimeng-purchase-flow-2026-05-27T03-47-11-255Z.json`
- `_bmad-output/test-reports/zhimeng-purchase-flow-2026-05-27T03-47-11-255Z.md`

## 已知保留项

- `ZHIMENG_*` 环境变量、`X-Zhimeng-Admin-Token`、`zhimeng-*` 脚本名和内部存储 key 暂不迁移，避免影响现有部署、验收脚本和授权存量数据。
- 构建产物中仍可能包含上游多语言 catalog 的 Scratch 翻译字符串；当前产品入口、官网、支付、运营和发布元数据不使用这些字符串作为售卖品牌。
- macOS 产物仍未完成 Developer ID 签名和公证；`npm run test:zhimeng-mac-release` 因未签名给出 Gatekeeper 警告，但校验脚本通过。这属于 RC 阶段已知发布限制。
- “新祥编程”第 9/41/42 类逐条近似复核和文字商标申请仍未完成，真实大规模投放前需要继续推进。

## 下一步

1. 完成“新祥编程”第 9/41/42 类逐条近似复核并准备提交文字商标申请。
2. 若决定公开分发 macOS 包，配置 Developer ID 签名、公证和 Windows 正式代码签名。
3. 上传新祥编程正式服务器下载包，并部署官网、付款页、运营页和 `website/releases.json`。
4. 复查历史海报、视频、客服图片是否仍在外部渠道传播旧名，必要时替换。
