---
stepsCompleted:
  - step-01-init
  - step-02-discovery
inputDocuments:
  - _bmad-output/project-context.md
  - docs/project-context.md
  - docs/zhimeng-agpl-compliance.md
  - docs/zhimeng-auth-entitlement-design.md
  - docs/zhimeng-api-contract.md
  - docs/zhimeng-coming-soon-inventory.md
  - docs/agpl-source-disclosure.md
  - docs/zhimeng-curl-examples.md
  - docs/zhimeng-payment-flow.md
  - docs/app-naming.md
  - docs/bmad-skills-sync.md
  - docs/zhimeng-packaging-delivery.md
  - docs/zhimeng-backend-local-dev.md
  - docs/zhimeng-acceptance-risk.md
  - docs/zhimeng-env-example.md
documentCounts:
  productBrief: 0
  research: 0
  brainstorming: 0
  projectDocs: 14
  projectContext: 2
workflowType: 'prd'
project_name: scratch-gui
user_name: 新知祥团队
date: '2026-04-14'
classification:
  projectType: desktop_app
  domain: edtech
  complexity: medium
  projectContext: brownfield
---

# Product Requirements Document - scratch-gui

**Author:** 新知祥团队
**Date:** 2026-04-14

## 1. 产品定位

新祥编程是一款面向 6-10 岁儿童与家庭用户的少儿创意编程启蒙桌面应用，首发优先服务 6-8 岁少儿编程启蒙家庭。产品基于 Scratch GUI 分叉进行品牌化与商业化改造，核心价值是让孩子用积木编程完成故事、动画和小游戏，同时让家长可以通过账号订阅获得可控、可交付的学习工具。

本阶段不追求完整社区生态，而是优先完成一个能真实售卖、能开通授权、能交付安装包、能被运营确认订单的 MVP 闭环。作为售卖型产品，未登录或未付费用户不应默认进入完整编辑器；客户端应先进入新祥编程锁定体验，只开放登录、注册、购买、授权刷新和必要的产品说明。

## 2. 最终目标

新祥编程最终目标是形成完整产品化链路：

1. 用户从官网下载 Windows 客户端。
2. 用户安装并打开新祥编程桌面应用。
3. 客户端进入新祥编程锁定体验，引导用户登录或注册新祥编程账号。
4. 未订阅用户在客户端订阅中心创建订单。
5. 客户端展示微信/支付宝收款二维码、订单号、付款备注和应付金额。
6. 用户扫码付款后在客户端提交付款凭证。
7. 运营在后台核对真实到账记录并人工确认订单。
8. 客户端刷新授权后 entitlement 变为 active。
9. 用户获得与套餐匹配的功能能力。

最终商业化形态应支持账号售卖、设备限制、订阅到期、离线短期可用、运营核账、发布回滚与后续云能力灰度开放。

## 3. MVP 范围

MVP 必须完成以下能力：

- 新祥编程品牌化：应用名、窗口标题、图标、下载页、基础文案、AGPL 源码链接。
- 桌面应用：Electron 打包，macOS Apple 芯片版、macOS Intel 芯片版、Windows 安装版和便携版作为首发交付物。
- 账号登录：客户端支持账号密码登录、登出、refresh token、会话缓存。
- 授权控制：客户端拉取 entitlement，并根据状态决定是否允许进入完整编辑器；未登录、未订阅、待确认、已过期、账号冻结、设备超限用户只能使用锁定体验和必要运营处理流程。
- 离线租约：仅 active 用户在租约有效期内可继续使用完整编辑器；租约过期后回到锁定体验并要求联网刷新授权。
- 设备限制：一个账号最多绑定 3 台设备；第 4 台设备进入锁定态，解绑只由运营在 `ops.html` 完成。
- 账号冻结：运营可冻结/解冻账号；客户端一旦联网刷新到 frozen 即锁定，离线最多受 7 天租约约束。
- 客户端订阅中心：在应用内完成创建订单、查看二维码、提交付款凭证、刷新订单/授权。
- 手动二维码支付：MVP 使用固定收款二维码 + 用户付款凭证 + 运营人工确认。
- 运营确认：运营通过 admin token 查看待确认订单，核对真实到账后开通 entitlement。
- 发布交付：生产环境变量、下载链接、发布检查、真库验收、运维 runbook 必须完整。

## 4. 非目标

以下内容不进入 MVP 已上线承诺：

- 不接入真实微信支付/支付宝开放平台回调。
- 不承诺自动到账确认。
- 不上线公开社区、作品广场、在线分享生态。
- 不承诺云保存、背包、社区等云能力已经可用；这些能力只通过 entitlement gate 预留。
- 不提供免费完整编辑器体验；如后续需要试用期，必须作为独立售卖策略另行设计。
- 不做多套餐复杂定价；首期只支持 `family_yearly` 与 `bootcamp_7d` 两个可售套餐。
- 不做 iOS、Android 或 Web 端完整产品。
- 不做闭源商业分发假设；MVP 继续按 AGPL 合规公开对应源码。

## 5. 核心用户旅程

### 5.1 新用户购买

1. 用户打开官网下载页，下载新祥编程 Windows 客户端。
2. 用户安装并启动客户端。
3. 客户端显示新祥编程锁定体验，不展示完整编辑器操作区。
4. 用户进入新祥编程账号登录/注册。
5. 登录后若 entitlement inactive，客户端继续保持锁定体验，并显示订阅引导。
6. 用户点击“订阅解锁”，打开客户端订阅中心。
7. 用户选择家庭年卡或 7 天项目陪跑包，并选择付款渠道。
8. 客户端调用 `POST /order/create` 创建订单。
9. 客户端展示订单号、金额、付款备注和二维码。
10. 用户扫码付款，并在客户端提交付款凭证。
11. 客户端显示“等待人工确认”，仍不开放完整编辑器。
12. 运营在 `ops.html` 核对到账并确认。
13. 用户点击“刷新授权”，客户端 entitlement 变 active。
14. 客户端解锁完整编辑器。

### 5.2 网页兜底

1. 客户端保留“在浏览器打开付款页”按钮。
2. 用户可打开 `pay.html?order_id=...&proof_token=...`。
3. 网页付款页展示同一订单信息，并允许提交付款凭证。
4. 网页提交凭证后仍需运营人工确认。

### 5.3 运营确认

1. 运营打开 `ops.html`。
2. 输入 API 地址和 `ZHIMENG_ADMIN_TOKEN`。
3. 查看已提交付款凭证且状态为 created 的订单。
4. 对照真实微信/支付宝账单核对金额、币种、付款时间、平台订单号、商家订单号和交易尾号。
5. 确认后调用 manual-confirm API。
6. 后端将订单置为 fulfilled，并激活用户 entitlement。

## 6. 产品化 Milestones

### Milestone 0: 品牌与合规

目标：

- 将上游 Scratch GUI 包装为新祥编程桌面应用。
- 完成 AGPL 合规披露与源码链接。
- 建立新祥编程商标与品牌资产的基础防守，避免真实售卖后出现抢注、近似冲突或被迫改名。

商标与品牌管理要求：

- 首批真实售卖前完成主品牌文字商标在第 9 类、第 41 类、第 42 类的近似检索与申请决策。
- 2026-05-25 实查结论：“知萌”在第 9/41/42 类均为高风险，不建议作为长期售卖主品牌直接提交申请；项目文档中“知萌”可暂作过渡代号。
- 团队内部已决定新主品牌采用“新祥编程”。第 9/41/42 类初筛未发现完整文字相同或同音结果，但“新祥”与 `XINXIANG` 单独方向已有较多相同或近似记录，因此申请和对外使用应坚持完整中文“新祥编程”。
- 不使用拼音简称。需要英文展示时统一使用 `NewSiang`，不使用 `XINXIANG`、`Xinxiang`、`XinXiang`。`NewSiang` 第 9/41/42 类初筛未发现相同或同音结果；如进入公开下载页、安装包、域名或英文物料，应完成逐条近似复核。
- 第 9 类优先保护桌面客户端、可下载软件、计算机程序等软件交付场景。
- 第 41 类优先保护少儿编程启蒙、教育、培训、在线教育等产品定位。
- 第 42 类优先保护后续云能力、软件服务、AI 辅导、平台服务等长期能力。
- 第 35 类与第 16 类作为可选扩展：分别用于线上推广/渠道销售、纸质资料/课程包等后续业务。
- Logo/图形商标在视觉资产稳定后补充申请，不替代文字商标优先级。
- 过渡期减少“知萌”长期品牌资产沉淀；新品牌确定并申请后，官网、客户端、安装包、付款页、运营后台、客服话术统一替换为新主品牌。
- 不得把 Scratch 作为产品名或售卖品牌；Scratch 只出现在 AGPL 合规、源码披露和必要技术说明中。

验收口径：

- `package.json` 中 appId、productName 指向新祥编程。
- Electron 窗口标题显示“新祥编程”。
- 官网下载页展示新祥编程品牌。
- 客户端帮助菜单打开官网；官网页脚能打开当前版本对应源码链接。
- `docs/agpl-source-disclosure.md` 和 `docs/zhimeng-agpl-compliance.md` 可作为上线合规材料。
- 发布前已有商标近似检索记录、改名候选筛选记录、申请类别决策和品牌资产清单。

### Milestone 1: 账号授权

目标：

- 完成新祥编程账号登录、刷新、登出、授权拉取、离线租约和能力门禁。

验收口径：

- 未登录、未订阅、active、过期、租约过期、设备超限都有明确客户端状态。
- 冻结账号有独立锁定文案，且不能创建新订单。
- 一个账号最多绑定 3 台设备；同一设备重复绑定只刷新最近使用时间，第 4 台设备返回设备超限。
- token 不在 Electron renderer 长期明文落地；优先使用 preload + safeStorage。
- entitlement status 决定是否开放完整编辑器，entitlement features 决定 `cloud_save`、`share`、`community`、`backpack` 等高级能力。
- 未登录、未订阅、待确认、已过期、冻结、设备超限、租约过期用户不能进入完整编辑器，只能进入锁定体验和购买/刷新/联系运营流程。
- active 用户在离线租约有效期内可继续使用完整编辑器；租约过期后必须联网刷新。

### Milestone 2: 购买支付

目标：

- 将正式购买主流程从 `purchase.html` / `pay.html` 迁入客户端订阅中心。

验收口径：

- 用户登录后无需跳转 `purchase.html` 即可创建订单。
- 客户端展示 `order_id`、套餐、金额、币种、付款备注、微信/支付宝二维码。
- 客户端可提交付款凭证，字段与 `pay.html` 保持一致。
- 提交凭证后只显示待人工确认，不自动开通。
- 客户端提供 `pay_url` 外部打开兜底。
- 订单确认后按套餐续期：`family_yearly` 延长 365 天，`bootcamp_7d` 延长 7 天；续期基准为 `max(now, 当前未来到期时间)`，陪跑包不得缩短已有年卡授权。

### Milestone 3: 运营确认

目标：

- 形成可人工核账、可追溯、可幂等确认的订单开通流程。

验收口径：

- `ops.html` 可查询已提交付款凭证的待确认订单。
- manual-confirm 需要 `X-Zhimeng-Admin-Token`。
- 金额不匹配、币种不匹配、重复交易号必须拒绝。
- 重复确认同一订单保持幂等。
- 只有人工确认成功后，订单进入 fulfilled 并激活 entitlement。

### Milestone 4: 发布交付

目标：

- 完成可上线的 macOS / Windows 客户端和官网分发链路。

验收口径：

- `npm run release:check` 通过。
- `website/releases.json` 不包含 `YOUR-CDN`、`example.com`、localhost 等占位链接。
- macOS Apple 芯片版、macOS Intel 芯片版、Windows NSIS 和 portable 下载链接真实可用。
- 真库验收脚本验证真实新祥编程页面内容，不只检查 HTTP 200。
- `docs/zhimeng-ops-runbook.md` 包含发布前闸门、监控指标、告警建议和回滚流程。

### Milestone 5: 后续云能力

目标：

- 在 MVP 商业闭环稳定后，逐步自建 Project/Asset/Backpack/Community 服务。

验收口径：

- 每个云能力必须有真实后端服务、权限控制、失败降级和单独验收。
- 未完成的云能力继续保持 feature gate，不在客户端作为已上线能力宣传。
- 云能力上线前，下载页和客户端卖点不得误导用户。

## 7. 客户端体验要求

### 7.0 锁定体验

- 客户端启动后先完成本地会话和 entitlement bootstrap。
- entitlement 不是 active 且租约不可用时，不渲染完整 Scratch 编辑器工作区。
- 锁定体验展示新祥编程品牌、产品说明、登录入口、订阅入口、刷新授权入口和必要错误提示。
- 锁定体验不得展示可长期使用的代码区、舞台、角色区、造型/声音编辑等完整功能。
- 已提交付款凭证但未人工确认时，锁定体验显示“等待人工确认”，并提供刷新授权。

### 7.1 账号入口

- 右上角“加入 Scratch / 登录”改造为新祥编程账号入口。
- 未登录时打开正式登录弹窗。
- 已登录时显示账号菜单和订阅状态。
- 当前截图中的裸输入框应被移除，不能作为正式产品形态。

### 7.2 登录弹窗

登录弹窗应包含：

- 新祥编程品牌标题。
- 账号输入框。
- 密码输入框。
- 登录按钮。
- 客户端内置注册：用户可直接创建新祥编程账号，注册成功后进入已登录但未订阅状态。
- 错误提示。
- 关闭按钮。

### 7.3 授权提示条

提示条根据状态显示：

- 未登录：登录新祥编程账号后可解锁完整能力。
- 未订阅：当前账号未开通订阅，可订阅解锁。
- 待确认：付款凭证已提交，等待运营确认。
- 已过期：订阅已到期，续费后恢复。
- 已冻结：账号已被冻结，请联系运营。
- 设备超限：最多 3 台设备，请联系运营解绑旧设备。
- 租约过期：授权租约已过期，请联网刷新授权。
- active：不显示锁定提示，直接进入完整编辑器。

### 7.4 订阅中心

订阅中心应包含：

- 当前账号与订阅状态。
- 套餐名称和价格。
- 付款渠道选择。
- 创建订单按钮。
- 订单号、金额、二维码和付款备注。
- 付款凭证表单。
- 刷新订单状态。
- 刷新授权。
- 在浏览器打开付款页。

## 8. 接口与数据约定

客户端复用现有 API：

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /entitlement`
- `POST /entitlement/device/bind`
- `POST /order/create`
- `GET /order/:id/status`
- `POST /order/:id/payment-proof`

网页兜底复用：

- `GET /order/:id/payment-page?proof_token=...`
- `POST /order/:id/payment-proof`

运营接口：

- `GET /admin/orders`
- `GET /admin/order/:id`
- `GET /admin/user/:username`
- `POST /admin/order/:id/manual-confirm`
- `POST /admin/user/:username/freeze`
- `POST /admin/user/:username/unfreeze`
- `POST /admin/user/:username/device/unbind`

客户端不得把 `payment-proof` 成功等同于付款成功。只有以下任一条件成立才视为开通：

- 订单状态为 `fulfilled`。
- 刷新后的 entitlement `status` 为 `active`。

## 9. 发布与验收口径

### 9.1 自动化检查

必须覆盖：

- 单元测试：`npm run test:unit`。
- 后端订单测试：`npm run test:backend`。
- 发布检查：`npm run release:check`。
- 真库目标检查：`npm run test:zhimeng-goal:realdb`。

目标检查不能只验证 HTTP 200，必须断言：

- 官网页面包含“新祥编程”。
- 下载按钮存在。
- AGPL 源码链接存在。
- 购买/付款/运营兜底页关键元素存在。
- 后端 health 返回 MySQL 存储正常。
- inactive 用户可以创建订单并经过人工确认变 active。
- 未登录或 inactive 用户不能进入完整编辑器。

### 9.2 手工验收

必须完成一次端到端验收：

1. 创建 inactive 用户。
2. 客户端登录。
3. 确认客户端仍处于锁定体验，不能进入完整编辑器。
4. 打开订阅中心。
5. 创建订单。
6. 展示二维码。
7. 提交付款凭证。
8. 确认提交凭证后仍不解锁。
9. 运营确认。
10. 客户端刷新授权。
11. entitlement 变 active。
12. 完整编辑器解锁可用。

## 10. 风险与约束

- AGPL 合规风险：必须保持对应源码可获得。
- 支付核账风险：用户凭证只能辅助核对，最终以收款方真实到账为准。
- 云能力误导风险：未完成自建服务前，不宣传云保存、分享、社区、背包为已上线能力。
- 发布误判风险：目标验收必须检查真实页面内容，避免 nginx 默认页也 PASS。
- token 扩展风险：当前 access token 若仍为进程内存储，生产横向扩展前需升级为可验证短期 token。

## 11. 默认决策

- MVP 使用固定二维码 + 人工确认。
- 首发 macOS 与 Windows。
- 首期套餐为 `family_yearly`。
- 客户端锁定体验是未登录/未付费用户的默认入口。
- 客户端订阅中心是正式购买主流程。
- `pay.html` 是外部兜底付款页。
- `purchase.html` 降级为本地验收/客服辅助页。
- `ops.html` 保持运营工具定位。
- 后续云能力进入 Milestone 5，不进入 MVP 已上线承诺。
