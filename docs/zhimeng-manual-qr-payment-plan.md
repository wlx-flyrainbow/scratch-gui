# 知萌：静态二维码收款与人工确权计划（方案 A）

## 目标

用最小改动完成“能收钱、能开通、能查账”的 MVP 闭环：

1. 用户创建订单后看到固定收款二维码、订单号和应付金额。
2. 用户付款后提交付款凭证信息。
3. 运营人员核对到账记录后人工确认订单。
4. 后端开通或续期 entitlement，客户端通过刷新授权生效。

本方案不追求支付自动化，不接真实支付网关回调；公开售卖前可平滑升级到订单专属二维码和自动回调。

## 适用范围

- 内测、早期付费用户、小范围人工销售。
- 微信/支付宝商家收款码、银行转账等能人工核账的收款方式。
- 订单量较低，运营可以接受人工确认。

不适用于高并发公开销售、无人值守交付、强实时开通、自动退款等场景。

## 用户流程

1. 用户在客户端点击“订阅解锁”。
2. 客户端打开订阅中心。
3. 用户登录后在客户端创建订单：
   - 选择套餐。
   - 系统生成 `order_id`。
   - 系统生成订单专用 `proof_token`，只用于支付页展示订单和提交凭证。
   - 客户端显示固定收款二维码、订单号、应付金额、备注填写说明。
4. 用户扫码付款：
   - 付款备注建议填写订单号后 6 位或用户名。
   - 若支付工具不支持备注，用户保留交易单号或付款截图。
5. 用户在客户端点击“我已付款”并提交付款凭证：
   - 提交付款方式、实付金额、付款时间、渠道订单号、交易尾号、可选备注。
   - 微信账单提交“转账单号”；支付宝账单提交“订单号”和“商家订单号”。
   - 可选上传付款截图，用于运营肉眼核对；截图不能替代订单号字段。
   - 系统记录付款凭证，订单状态仍保持 `created`，表示尚未人工确认。
6. 运营人员核对到账记录。
7. 运营调用人工确认接口：
   - 确认金额、交易号、操作人、备注。
   - 后端将订单置为 `fulfilled`，并开通或续期 entitlement。
8. 用户回到客户端点击“刷新订单/授权”或重新登录。

## 订单状态

沿用现有订单模型，不新增支付状态；付款凭证仅作为留痕字段保存。

| 状态 | 含义 | 进入条件 |
| --- | --- | --- |
| `created` | 已创建，等待付款或等待人工核对 | `/order/create` 成功；用户提交凭证后仍保持该状态 |
| `paid` | 已确认到账，准备开通权益 | 管理员人工确认接口完成收款校验 |
| `fulfilled` | 已开通权益 | entitlement 更新成功 |

运营侧通过 `payment_proof_json` 是否存在来区分“未提交凭证”和“已提交待核对”，不把用户声明付款等同于 `paid`。

## 后端改造计划

### 1. 订单创建响应

`POST /order/create` 保持现有入口，返回固定收款配置：

```json
{
  "order_id": "o_123",
  "status": "created",
  "amount_cents": 19900,
  "currency": "CNY",
  "plan": "family_yearly",
  "payment_mode": "manual_qr",
  "qr_code_url": "https://cdn.example.com/zhimeng/pay/wechat.png",
  "pay_url": "https://billing.example.com/pay.html?order_id=o_123&proof_token=pay_xxx",
  "payment_account_label": "知萌官方收款",
  "payment_note": "付款备注请填写：ZM-o_123"
}
```

配置来源：

- `ZHIMENG_PAYMENT_MODE=manual_qr`
- `ZHIMENG_PAYMENT_API_BASE`
- `ZHIMENG_WECHAT_PAYMENT_QR_URL`
- `ZHIMENG_ALIPAY_PAYMENT_QR_URL`
- `ZHIMENG_PAYMENT_QR_URL`（兜底）
- `ZHIMENG_PAYMENT_ACCOUNT_LABEL`
- 套餐金额配置，禁止由前端传入最终金额。

### 2. 用户提交付款凭证

新增：

```text
GET /order/:id/payment-page?proof_token=pay_xxx
```

支付页用订单专用 token 拉取订单号、金额、二维码和付款备注；该 token 不授予账号权限。

```text
POST /order/:id/payment-proof
```

请求：

```json
{
  "proof_token": "pay_xxx",
  "method": "wechat",
  "paid_at": "2026-05-23T10:00:00.000Z",
  "amount": "199.00",
  "currency": "CNY",
  "transfer_no": "10001073012026022000408766083107",
  "merchant_order_no": "",
  "trade_no_tail": "8766083107",
  "payer_note": "已付款，备注 ZM-o_123",
  "proof_attachment": {
    "filename": "wechat-bill.jpg",
    "mime_type": "image/jpeg",
    "data_url": "data:image/jpeg;base64,..."
  }
}
```

支付宝账单详情建议同时提交：

```json
{
  "method": "alipay",
  "transfer_no": "2026042522001495731403194971",
  "merchant_order_no": "17771025413602210395734",
  "trade_no_tail": "1403194971"
}
```

只提交后 4-6 位不足以单独证明到账，只适合作为运营在收款方账单中快速检索的辅助信息。人工确认必须以收款方微信/支付宝账单实际到账记录为准。

服务端校验：

- 订单属于当前登录用户。
- 订单状态允许提交凭证。
- `method`、`paid_at`、`amount`、`transfer_no` / `merchant_order_no` / `trade_no_tail` 做基本格式校验。
- `proof_attachment` 为可选字段，仅允许 JPG、PNG、WebP，默认最大 5MB。
- 写入凭证记录，订单状态仍保持 `created`，等待人工确认。

响应：

```json
{
  "order_id": "o_123",
  "status": "created"
}
```

### 3. 管理员查询待确认订单

新增或扩展：

```text
GET /admin/orders?has_payment_proof=1
GET /admin/order/:id
```

返回订单、用户、套餐、应付金额、付款凭证、截图元数据、历史确认记录。

截图文件不得放在公开静态目录。MVP 本地存储到 `ZHIMENG_PAYMENT_PROOF_STORAGE_DIR`，管理员查看时走受保护接口：

```text
GET /admin/order/:id/payment-proof-attachment/:attachment_id
```

### 4. 管理员人工确认

沿用现有：

```text
POST /admin/order/:id/manual-confirm
```

要求生产使用时必须填写：

```json
{
  "operator": "ops",
  "provider_trade_no": "wechat-20260523-xxx",
  "amount_cents": 19900,
  "currency": "CNY",
  "note": "微信商家账单核对到账"
}
```

确认逻辑：

- 金额必须等于订单应付金额，特殊减免必须写入备注并受管理员权限控制。
- `provider_trade_no` 必须全局唯一，防止一笔付款重复开通。
- `fulfillOrderFromPayment` 保持幂等。
- 成功后写入审计日志，并更新 entitlement。

### 5. 管理员驳回或关闭（后续增强）

MVP 可先用订单备注和客服流程处理；订单量上来后再新增：

```text
POST /admin/order/:id/reject
POST /admin/order/:id/cancel
```

用于处理金额不符、无法核账、用户重复提交、超时未付款等情况。

## 前端改造计划

### 客户端

- “订阅解锁”打开客户端订阅中心并在客户端创建订单。
- “刷新授权”继续调用 entitlement，不依赖支付自动回调。
- 授权提示文案补充“付款后通常需人工确认”的预期。

### 购买页

- 本地验收/客服辅助页：`website/purchase.html`，用于登录、创建订单并跳转支付页；不作为官网主购买入口。
- 显示套餐、应付金额、订单号。
- 显示固定收款二维码。
- 明确付款备注格式。
- 提供“我已付款”表单。
- 显示订单状态：
  - `created` 且无付款凭证：等待付款。
  - `created` 且有付款凭证：已提交，等待人工确认。
  - `fulfilled`：已开通，请返回客户端刷新授权。

### 运营页面

MVP 已提供静态轻量后台 `website/ops.html`，支持：

- 待确认订单列表。
- 订单详情。
- 人工确认。
- 复制用户联系方式、订单号、交易号。

驳回、取消、权限分级和多人审计是后续增强项。

## 数据与审计

至少记录：

- `order_id`
- `user_id`
- `plan`
- `amount_cents`
- `currency`
- `payment_method`
- `payment_proof_json`（付款方式、金额、付款时间、平台订单号、商家订单号、交易尾号、备注、付款截图元数据）
- `provider_trade_no`
- `manual_confirm_operator`
- `manual_confirmed_at`
- `fulfillment_result`
- `audit_log`

不要把付款截图二进制直接存入数据库。当前 MVP 使用本地私有目录保存截图，数据库只保存文件 id、原始文件名、MIME、大小、hash、存储 key 和上传时间。后续迁移 OSS 时替换 storage 层，并保留受保护访问与脱敏策略。

## 验收标准

- 用户能创建订单并看到收款二维码、订单号和应付金额。
- 用户能提交付款凭证，订单仍为 `created`，且 `payment_proof` 可查询。
- 管理员能查询待确认订单。
- 管理员确认后，订单变为 `fulfilled`。
- 管理员重复确认同一订单不会重复开通。
- 同一 `provider_trade_no` 不能确认多笔订单。
- 金额不匹配时不能默认开通。
- 客户端刷新授权后能看到新的 entitlement。
- `npm run test:backend` 覆盖创建订单、提交凭证、人工确认、重复确认、交易号重复、金额不匹配。
- `npm run release:check` 不再要求真实支付网关回调；注册主路径为客户端内置注册，外部注册页变量仅在配置时校验。

## 风险与防护

| 风险 | 防护 |
| --- | --- |
| 用户付款备注缺失，难以核账 | 订单页突出订单号；允许提交交易尾号和付款时间 |
| 一笔付款重复开通 | `provider_trade_no` 唯一；确认接口幂等 |
| 金额不符 | 后端按订单金额校验；减免走受控备注 |
| 人工确认误操作 | 记录操作人、时间、原始凭证和审计日志 |
| 订单量增长后人工压力大 | 升级到订单专属二维码和自动回调 |
| 付款截图涉及隐私 | 优先不收截图；如收截图则走受控对象存储 |

## 分阶段实施

### Phase 1：文案与配置

- 增加 `manual_qr` 支付模式配置。
- 更新订单创建响应，返回固定二维码和付款备注。
- 更新购买页或客户端支付文案。

### Phase 2：付款凭证与订单审核

- 增加付款凭证提交接口。
- 增加 `payment_proof_json` 字段，不新增订单状态。
- 增加待确认订单查询能力。

### Phase 3：人工确认加固

- 加强 `manual-confirm` 参数校验。
- 增加 `provider_trade_no` 唯一性。
- 增加驳回、取消接口。
- 补齐审计日志。

### Phase 4：验收与发布

- 补后端单测。
- 跑本地订单闭环验收。
- 更新运维 runbook 的人工核账步骤。
- 发布时保留方案 B 升级口：后续将 `manual_qr` 切换为网关订单二维码。

## 后续升级口

当订单量或自动化要求上来后，将支付模式切换为：

- `gateway_qr`：每笔订单生成专属微信/支付宝二维码。
- 支付平台异步通知更新订单状态。
- 订单查询与日账单对账任务补偿漏单。

客户端仍消费 `qr_code_url` 和 `/order/:id/status`，因此从方案 A 升级到方案 B 时无需大改客户端主流程。
