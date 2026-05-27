# 知萌 RC0 种子发布验收报告

日期：2026-05-27

## 1. 验收结论

RC0 本地种子发布包可以进入小范围种子用户验证。

本轮已经完成本地桌面安装包生成、本地官网下载清单更新、mock 购买闭环、真实 MySQL 新用户购买闭环、设备/冻结后端风控用例、账单首屏布局和 macOS DMG 可挂载校验。

注意：本轮产物是未正式签名/未公证的 RC 包，只适合内部和种子用户验证。正式公开售卖前仍必须完成 macOS Developer ID 签名、公证和 Windows 正式代码签名。

## 2. 本地产物

| 平台 | 产物 | 大小 | 用途 |
| --- | --- | ---: | --- |
| macOS Apple 芯片 | `dist/知萌-1.0.0-arm64.dmg` | 312M | Apple Silicon 用户安装 |
| macOS Intel | `dist/知萌-1.0.0.dmg` | 317M | Intel Mac 用户安装 |
| Windows x64 安装版 | `dist/知萌 Setup 1.0.0.exe` | 253M | Windows 推荐安装方式 |
| Windows x64 便携版 | `dist/知萌 1.0.0.exe` | 253M | Windows 免安装兜底 |
| macOS Apple zip | `dist/知萌-1.0.0-arm64-mac.zip` | 298M | 自动更新/备用分发 |
| macOS Intel zip | `dist/知萌-1.0.0-mac.zip` | 303M | 自动更新/备用分发 |

`website/releases.local.json` 已更新为本地 `file://` 下载地址。通过本地官网 `http://127.0.0.1:4178/index.html` 验证，四个主下载按钮已读取本地清单：

- macOS Apple 芯片版（本地）
- macOS Intel 芯片版（本地）
- Windows 安装版（本地）
- Windows 便携版（本地）

## 3. 验收命令

| 验收项 | 命令 | 结果 |
| --- | --- | --- |
| 本地完整打包 | `npm run dist:desktop:local` | PASS |
| 更新本地下载清单 | `npm run release:update-local-downloads` | PASS |
| 包元数据检查 | `npm run test:zhimeng-package-metadata` | PASS |
| 桌面 bundle 检查 | `npm run test:zhimeng-desktop-bundle` | PASS |
| macOS DMG 校验 | `npm run test:zhimeng-mac-release` | PASS，存在未签名警告 |
| 后端授权/设备/冻结用例 | `npm run test:backend` | PASS，mock 后端 22 passed，MySQL 集成套件按预检跳过 |
| mock 购买闭环 | `npm run test:zhimeng-purchase-flow` | PASS |
| 真实 MySQL 新用户闭环 | `npm run test:zhimeng-new-user-flow:realdb` | PASS |
| 真实 MySQL 购买闭环 | `npm run test:zhimeng-purchase-flow:realdb` | PASS |
| 账单首屏布局 | `npm run test:zhimeng-billing-layout` | PASS |

## 4. 关键报告

- mock 购买闭环：`_bmad-output/test-reports/zhimeng-purchase-flow-2026-05-27T03-00-51-743Z.md`
- 真实 MySQL 新用户闭环：`_bmad-output/test-reports/zhimeng-purchase-flow-2026-05-27T03-01-01-126Z.md`
- 真实 MySQL 购买闭环：`_bmad-output/test-reports/zhimeng-purchase-flow-2026-05-27T03-01-44-555Z.md`
- 账单布局报告：`_bmad-output/test-reports/zhimeng-billing-layout-2026-05-27T02-58-01-370Z.json`
- 账单布局截图：`_bmad-output/test-reports/zhimeng-billing-layout-1280x800.png`
- 账单布局截图：`_bmad-output/test-reports/zhimeng-billing-layout-1440x900.png`

## 5. 本轮发现并修复的问题

### 5.1 后端未配置账单地址时使用示例域名

问题：购买闭环报告显示，未配置 `ZHIMENG_BILLING_URL` 时后端 `pay_url` 会退到 `https://billing.zhimeng.example.com/pay.html`。

影响：客户端内置支付不受影响，但“浏览器付款页”兜底在本地 RC 环境会打开不可用示例域名。

处理：后端 `buildPaymentUrls` 已改为优先使用 `ZHIMENG_BILLING_URL`，否则使用当前请求 origin，再否则使用 `ZHIMENG_AUTH_API_BASE`，最后才回到本地默认 `http://localhost:3001`。新增后端单测断言不再返回 `billing.zhimeng.example.com`。

验证：修复后的 mock 和真实 MySQL 报告中，`pay_url` 已变为同源 `/pay.html`：

- `http://127.0.0.1:57765/pay.html?...`
- `http://127.0.0.1:57828/pay.html?...`

### 5.2 Docker daemon 初始未启动

问题：第一次运行 `npm run test:zhimeng-new-user-flow:realdb` 时，Docker daemon 未启动，真库验收无法开始。

处理：启动 Docker Desktop 后重跑通过。

## 6. 仍然不能进入正式公开发布的原因

- macOS App 和 DMG 未完成 Developer ID 签名与 notarization，Gatekeeper 仍会拒绝。
- Windows 安装包未使用正式代码签名证书。
- “知萌”作为长期主品牌已被判定高风险；首批真实售卖前应完成新主品牌决策、商标申请或明确记录暂缓原因。
- 当前支付仍是人工确认模式，适合种子阶段，不适合无人值守规模化投放。

## 7. 下一步

1. 用本轮 RC0 包找 3-5 个真实家庭做安装、注册、付款和开通验证。
2. 收集每个家庭的系统、安装阻塞、付款阻塞、首个作品完成情况和退款风险。
3. 正式发布前完成签名/公证材料准备。
4. 在大规模投放前完成“巧创盒 / 妙创盒”品牌决策和第 9/41/42 类商标动作。
