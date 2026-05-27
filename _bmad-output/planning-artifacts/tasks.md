# 新祥编程产品化改造 TASKS（原知萌）

**Source PRD:** `_bmad-output/planning-artifacts/prd.md`
**Date:** 2026-05-23
**Goal:** 将新祥编程从 Scratch GUI 分叉推进为可上线售卖的桌面产品，优先完成客户端内置购买闭环；“知萌”仅作为历史项目代号和商标风险记录保留。

## Execution Order

按风险和依赖顺序推进：

1. 先固化验收口径，避免后续实现被错误 PASS 掩盖。
2. 再改客户端锁定体验和账号/订阅入口，因为这是售卖主路径。
3. 再迁入购买和付款凭证流程。
4. 最后收口网页兜底、运营确认和发布交付。

## Milestone 0: 品牌与合规

- [x] 确认 Electron 窗口标题、产品名、图标、下载页品牌均为新祥编程。
- [x] 确认下载页和客户端帮助菜单都指向当前版本对应源码。
- [x] 检查 AGPL 说明文档与下载页页脚一致。
- [x] 将 `README.md` 中仍明显指向上游 Scratch 的首屏说明补充新祥编程开发/发布入口，避免交付文档割裂。
- [x] 在国家知识产权公共服务平台商标数据中完成“知萌”文字商标检索，重点检索第 9/41/42 类。
- [x] 建立商标检索准备清单：知萌、知萌编程、ZHIMENG、zhimeng、智萌、芝萌、萌知等检索词，以及第 9/41/42 类首批申请建议。
- [x] 完成公开网页商标风险初筛并归档：北京知萌咨询、知萌辰、智萌、智萌体、知 ME、技萌等线索需要官方复核。
- [x] 基于实查结果确认：“知萌”在第 9/41/42 类均为高风险，不建议直接提交原计划商标申请。
- [x] 完成第一批新主品牌候选生成与第 9/41/42 类首轮商标筛选，首选候选为“构芽”，备选为“构乐芽、童启构、构作星”。
- [x] 对“构芽”逐条复核同音和近似风险：未发现相同文字商标，主要风险来自同音“购丫 / 购芽 / 够芽”，其中第 42 类“购丫”覆盖 4220 软件服务项目。
- [x] 完成三字备用候选筛选，“构芽盒”在第 9/41/42 类精准和同音均未发现结果，可作为同步防守申请或备用替换名称。
- [x] 完成公司名“新知祥”纳入产品品牌的分析：如必须包含公司字，推荐“构祥芽”；如优先传播效率，推荐“新知祥出品｜构芽”。
- [x] 根据口语反馈完成顺口优先二轮筛选：“构祥芽 / 构芽”因拗口和理解成本高降级为历史候选，当时推荐继续复核“巧创盒”，备选“妙创盒”。
- [x] 团队内部决定采用“新祥编程”作为新主品牌，历史候选“巧创盒 / 妙创盒”降级为备选记录。
- [x] 完成“新祥编程”第 9/41/42 类初筛：完整文字未发现相同或同音结果；“新祥”和 `XINXIANG` 单独方向风险较高，不作为主推。
- [x] 团队决定不使用拼音简称；英文备用标识统一为 `NewSiang`。
- [x] 完成 `NewSiang` 第 9/41/42 类初筛：未发现相同或同音结果。
- [ ] 对“新祥编程”第 9/41/42 类近似结果逐条复核，重点看“新祥”“新翔编程”“鑫祥编程”“欣祥编程”“XINXIANG”等在 0901、4101、4220 上的状态和指定项目。
- [ ] 如 `NewSiang` 进入公开下载页、安装包、域名或英文物料，完成 `NewSiang` 第 9/41/42 类近似结果逐条复核。
- [x] 首批真实售卖前完成主品牌改名决策。
- [ ] 提交“新祥编程”文字商标申请，优先覆盖第 9 类软件、第 41 类教育培训、第 42 类软件服务。
- [ ] 视觉资产稳定后评估 Logo/图形商标申请；第 35 类、第 16 类按营销和纸质资料业务进展扩展。
- [x] 建立品牌资产清单：Logo、应用图标、官网 favicon、主色、定位语、源码披露链接、客服/支付文案。
- [x] 建立品牌使用规则：“知萌”仅作为历史项目代号和商标风险记录保留；Scratch 只用于开源合规和必要技术说明，不作为售卖品牌。
- [x] 官网、客户端、安装包、付款页、运营后台、客服 FAQ 的对外展示统一切换为“新祥编程”；英文环境仅使用 `NewSiang`，不使用拼音简称。

Acceptance:

- `package.json`、Electron 窗口、官网下载页、帮助菜单均体现新祥编程；英文环境仅出现 `NewSiang`。
- AGPL 源码链接可从官网和客户端找到。
- 有商标近似检索记录、申请类别决策和品牌资产清单；真实售卖前不带着商标未知风险大规模投放。

## Milestone 1: 账号授权产品化

- [x] 新增未授权锁定体验：未登录、未订阅、待确认、已过期、租约过期时不渲染完整编辑器。
- [x] 锁定体验展示新祥编程品牌、产品说明、登录入口、订阅入口、刷新授权和错误提示。
- [x] 将右上角“加入 Scratch / 登录”改为新祥编程账号入口。
- [x] 将当前裸登录表单改为正式登录弹窗。
- [x] 客户端内置注册账号，注册成功后自动登录并保持未订阅锁定态。
- [x] 未登录、未订阅、待确认、已过期、租约过期时，顶部提示条显示状态文案和操作按钮。
- [x] 已登录时账号菜单展示用户名、订阅状态、刷新授权、退出登录。
- [x] 设备超限、账号密码错误、refresh 失效、网络失败使用用户可理解错误文案。

Acceptance:

- 未登录或未付费用户不能进入完整代码区、舞台、角色区、造型/声音编辑等产品功能。
- 截图中的右上角裸输入框不再出现。
- 用户可以从客户端完成注册、登录、退出、刷新授权。
- 未订阅用户能清楚看到订阅入口。

## Milestone 2: 客户端内置购买支付

- [x] 新增客户端“订阅中心”弹窗。
- [x] 订阅中心展示当前账号、entitlement 状态、套餐和价格。
- [x] 使用当前登录 token 调用 `POST /order/create` 创建订单。
- [x] 展示订单号、金额、币种、付款备注、微信/支付宝二维码。
- [x] 提供“在浏览器打开付款页”兜底按钮，使用后端返回的 `pay_url`。
- [x] 在客户端实现付款凭证表单：付款方式、付款时间、实付金额、平台订单号、支付宝商家订单号、交易尾号、备注。
- [x] 调用 `POST /order/:id/payment-proof` 提交凭证。
- [x] 提交成功后展示“等待人工确认”，不显示已开通。
- [x] 支持刷新订单状态和刷新 entitlement。
- [x] 将付款渠道选择做成显式控件，而不是创建订单时固定 `wechat`。

Acceptance:

- 用户无需打开 `purchase.html` 即可完成下单。
- 用户无需打开 `pay.html` 即可提交付款凭证。
- 提交凭证后仍是待确认和锁定状态，运营确认后刷新授权才 active 并解锁编辑器。

## Milestone 3: 网页兜底与运营确认

- [x] 保留 `pay.html` 作为订单专属付款页，确保客户端 `pay_url` 可打开并加载同一订单。
- [x] 将 `purchase.html` 文案改为本地验收/客服辅助，不再作为官网主购买入口。
- [x] 保留 `ops.html` 作为运营工具，只通过 `X-Zhimeng-Admin-Token` 访问 admin API。
- [x] 运营确认前展示金额、币种、付款时间、平台订单号、商家订单号、交易尾号和备注。
- [x] 确认前强制填写操作人、真实交易号、确认金额和币种，并做客户端防误确认校验。
- [x] 确认后订单进入 fulfilled，并激活 entitlement。

Acceptance:

- `pay.html` 能作为客户端兜底付款链接使用。
- `purchase.html` 不再被官网主流程推荐。
- `ops.html` 可完成待确认订单人工开通。

## Milestone 4: 发布交付与验收闸门

- [x] 修正 `scripts/run-zhimeng-goal-check.js`，前端检查必须断言真实新祥编程页面内容，不能只看 HTTP 200。
- [x] `release:check` 覆盖生产 API、账单地址、注册链接、二维码、套餐价格、下载链接、admin token、CORS。
- [x] `website/releases.json` 发布前必须配置真实 macOS Apple 芯片版、macOS Intel 芯片版、Windows NSIS 和 portable 下载地址。
- [x] 新增自包含购买闭环验收脚本：inactive 登录、创建订单、提交付款凭证、运营列表、人工确认、刷新授权 active。
- [x] 新增隔离 MySQL 容器的真库购买闭环验收命令 `npm run test:zhimeng-purchase-flow:realdb`。
- [x] 新增新用户完整流程真库验收命令 `npm run test:zhimeng-new-user-flow:realdb`，从注册账号开始验证到开通授权。
- [x] 新增 macOS / Windows 客户端发布元数据检查：产品名、appId、图标、窗口标题、源码链接、AGPL 文件、下载页与 releases 版本一致。
- [x] 新增本地完整打包命令 `npm run dist:desktop:local`，可生成 macOS Apple 芯片版、macOS Intel 芯片版、Windows x64 安装版与便携版。
- [x] 新增本地下载清单 `website/releases.local.json` 生成流程，下载页本地验收时优先读取本机 `dist/` 产物。
- [x] 真库验收覆盖 inactive 用户创建订单、提交付款凭证、人工确认、刷新授权 active。
- [x] 本地 macOS 与 Windows 打包后检查安装包名称、架构、DMG 校验、下载页按钮和源码链接。
- [x] 新增签名/公证发布闸门 `npm run release:check-signing`，正式公开分发必须设置 `ZHIMENG_REQUIRE_CODE_SIGNING=1`。
- [ ] 生产 macOS 包完成 Developer ID 签名、timestamp、公证；Windows 包完成正式代码签名。
- [ ] 上传“新祥编程”正式安装包到 `https://zhimeng.codevalley.cn/downloads/` 并验证四个下载 URL 可访问。

Acceptance:

- `npm run release:check` 在生产环境变量齐全时通过，缺项时失败。
- `npm run test:zhimeng-purchase-flow` 可在 mock 后端上验证购买到开通的完整闭环。
- `npm run test:zhimeng-purchase-flow:realdb` 可在隔离 MySQL 容器上验证真实表结构与 SQL 路径下的购买到开通闭环。
- `npm run test:zhimeng-new-user-flow:realdb` 可验证新用户注册后仍为 inactive，完成下单、提交凭证、运营确认、刷新授权后才 active。
- `npm run test:zhimeng-package-metadata` 可在打包前验证客户端发布元数据和品牌/合规配置。
- `npm run dist:desktop:local` 可在本机生成 macOS Apple 芯片版、macOS Intel 芯片版、Windows x64 安装版与便携版，并可通过 `npm run release:update-local-downloads` 接入本地下载页。
- 目标验收报告不会因 nginx 默认页返回 200 而误判 PASS。
- 真实下载页和 macOS / Windows 客户端安装包可交付。

2026-05-25 验收记录：

- `website/releases.json` 中 Windows 安装版、Windows 便携版、macOS Apple 芯片版、macOS Intel 芯片版四个 URL 均返回 HTTP 200。
- 微信、支付宝收款码 URL 均返回 HTTP 200。
- `npm run release:check` 在生产模板变量加临时高强度 admin token 下通过。
- `node scripts/verify-zhimeng-public-release.js` 通过，确认 `https://zhimeng.codevalley.cn @ 1.0.0` 可作为公开下载页。

2026-05-27 RC0 种子发布验收记录：

- `npm run dist:desktop:local` 通过，已生成 macOS Apple 芯片、macOS Intel、Windows 安装版和 Windows 便携版本地产物。
- `npm run release:update-local-downloads` 通过，`website/releases.local.json` 已指向本地 `dist/` 产物。
- `npm run test:zhimeng-package-metadata`、`npm run test:zhimeng-desktop-bundle`、`npm run test:zhimeng-mac-release` 通过；macOS 校验存在未签名/Gatekeeper 警告，符合 RC0 未正式签名状态。
- `npm run test:backend`、`npm run test:zhimeng-purchase-flow`、`npm run test:zhimeng-new-user-flow:realdb`、`npm run test:zhimeng-purchase-flow:realdb`、`npm run test:zhimeng-billing-layout` 通过。
- 已修复未配置 `ZHIMENG_BILLING_URL` 时后端 `pay_url` 退到示例域名的问题，本地 RC 兜底付款页改为同源 `/pay.html`。
- 验收报告见 `docs/zhimeng-rc0-seed-release-acceptance-2026-05-27.md`。

2026-05-27 RC1 品牌切换验收记录：

- 官网、客户端、安装包产品名、付款页、运营后台、客服 FAQ、私域文案、海报和演示视频均已切换为“新祥编程”。
- `npm run dist:desktop:local` 通过，已生成 `新祥编程-1.0.0-arm64.dmg`、`新祥编程-1.0.0.dmg`、`新祥编程 Setup 1.0.0.exe`、`新祥编程 1.0.0.exe`。
- `npm run release:update-local-downloads` 通过，`website/releases.local.json` 已指向新祥编程本地安装包。
- `website/releases.json` 与 `deploy/env/zhimeng-prod.env.example` 已切到新祥编程命名安装包；`npm run release:check` 在生产模板变量加临时高强度 admin token 下通过。
- `npm run release:verify-public` 当前仍失败，因为线上首页、付款页和 `releases.json` 尚未部署新祥编程版本，服务器下载目录也尚未上传新命名安装包。
- `npm run test:zhimeng-package-metadata`、`npm run test:zhimeng-desktop-bundle`、`npm run test:zhimeng-mac-release` 通过；macOS 仍有未签名/Gatekeeper 警告，属于 RC 阶段已知限制。
- `npm run test:backend`、`npm run test:zhimeng-purchase-flow`、`npm run test:zhimeng-billing-layout` 和关键单元测试通过。
- 验收报告见 `docs/zhimeng-rc1-brand-migration-acceptance-2026-05-27.md`。

## Milestone 5: 后续云能力

- [ ] 规划 Project/Asset 服务，用于云保存。
- [ ] 规划 Backpack 服务，用于素材背包。
- [ ] 规划 Share/Community 服务，用于作品分享与社区。
- [ ] 每个云能力上线前补独立 API 契约、权限策略、失败降级和验收脚本。
- [ ] 未上线能力继续保持 entitlement feature gate，不作为已上线卖点。

Acceptance:

- 云能力没有真实服务前，客户端不误导用户。
- 每个云能力都有独立上线验收，不混入支付 MVP。

## Immediate Next Implementation Slice

优先做一个小而完整的切片：

1. 新增锁定体验组件，未登录/未付费时不进入完整编辑器。
2. 改造右上角账号入口，移除裸登录框。
3. 新增正式登录弹窗。
4. 新增订阅中心空壳，先显示当前 entitlement 状态和“创建订单”入口。
5. 让“订阅解锁”打开订阅中心，而不是直接跳外部网页。
6. 增加最小单元测试，保证未登录/未订阅不能看到完整编辑器，只能看到登录和订阅入口。

完成这个切片后，再接入二维码展示和付款凭证提交。
