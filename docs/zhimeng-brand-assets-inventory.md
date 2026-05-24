# 知萌品牌资产清单与商标检索准备包

更新日期：2026-05-24

## 1. 品牌基础

| 项目 | 当前值 | 用途 |
| --- | --- | --- |
| 主品牌名 | 知萌 | 官网、客户端、安装包、支付、客服、运营后台统一使用 |
| 拼音/英文标识 | ZHIMENG | 域名、技术配置、文件名、商标备选检索 |
| 定位语 | 少儿创意编程启蒙 | 官网首屏、客户端锁定页、宣传文案 |
| 产品描述 | 用积木编程做故事、动画和小游戏 | 家长理解产品价值的核心表达 |
| 首发套餐 | 家庭年卡 199 元/年 | 官网套餐、客户端订阅中心、客服话术 |
| 首发交付 | 桌面客户端 + 账号授权 + 完整编辑器 + 人工确认开通 | 商业承诺边界 |

## 2. 视觉与文件资产

| 资产 | 路径 | 大小 | SHA-256 | 说明 |
| --- | --- | --- | --- | --- |
| 官网主 Logo | `website/assets/logo.png` | 850K | `715be622c7ac53a5216847f532dd9e0cdac44d43149184ab55b183fcc50249c8` | 官网首屏与下载页使用 |
| 桌面应用图标 | `static/app-icon.png` | 248K | `6d997d262777b18a84ae7d6e259e786a492d6b8e772f7304b5193c0fadbb0734` | macOS/Linux 应用图标 |
| Windows 图标 | `static/favicon.ico` | 364K | `aef79a9c6775107ce68e5b1f101078456c0c0764ad75713d614087e5ad789bc7` | Windows 安装器/任务栏图标 |
| 兼容 Logo | `static/xzx_logo.png` | 248K | `6d997d262777b18a84ae7d6e259e786a492d6b8e772f7304b5193c0fadbb0734` | 兼容旧路径或构建产物 |
| 微信收款码 | `website/assets/siang_wxpay_qrcode.jpg` | 135K | `f2467d9e7ec69c2801a842a3d3cbf4e04228de28def4f8e3c90448a22e2f5731` | MVP 固定二维码收款 |
| 支付宝收款码 | `website/assets/siang_alipay_qrcode.jpg` | 129K | `1201a7c0db3dfbc2a970452c8879a5cca1ae613cce82d1d041ab7091d0c816d7` | MVP 固定二维码收款 |
| 首发海报：直接转化版 | `website/assets/posters/zhimeng-poster-direct.png` | 375K | `692e47bc4312bd7c1748b400351bd13bdb3e249df4202f879f4ec57d5fcfe2fb` | 私域朋友圈/社群投放，主打家庭低成本编程启蒙 |
| 首发海报：家长痛点版 | `website/assets/posters/zhimeng-poster-pain.png` | 327K | `88ba17d0097ee89359b56b60df2f717beb26d43d88d78c4f2178ce09775d946e` | 私域转化投放，主打报课前低成本试错 |
| 首发海报：种子用户版 | `website/assets/posters/zhimeng-poster-seed.png` | 411K | `c6926ce7ea4bc496705380d55123c12f971b7c9ee378294eb32a4aee92120d7a` | 首批 20 个种子用户招募 |
| 首发海报源文件 | `website/posters/launch-posters.html` | 11K | `1f15a07930a4d82077405a04c201a8c33416fc4d6f6c3fb8e1dec706bc489c33` | 通过 query 参数生成 direct/pain/seed 三版海报 |
| 30 秒演示视频 | `website/assets/videos/zhimeng-demo-30s.mp4` | 1.8M | `b66e6359643178f4b5ccf7753e5dc2bee44478f41d8b48a2b9e2b539479ef207` | 私域首发转化视频，无旁白字幕版 |
| 30 秒演示视频封面 | `website/assets/videos/zhimeng-demo-30s-cover.jpg` | 120K | `ae538ece34dc5bb1379eb8424f5fc78ecd109d509270e9c4aafa13e930cbf397` | 视频发布封面图 |
| 演示视频生成脚本 | `scripts/generate-zhimeng-demo-video.js` | 16K | `7d83549a5165667dc5cd28354c83078ad5be46ebe552bc8b91c94af1d90d5554` | 生成 1920x1080、30 秒、24fps MP4 |

图标生成规则：

- 若更新 `website/assets/logo.png`，需执行 `npm run generate-icons`。
- 生成后复核 `static/favicon.ico`、`static/app-icon.png`、`static/xzx_logo.png` 是否同步变化。
- 视觉稳定前，商标申请优先文字商标；Logo/图形商标暂缓到视觉资产确认后。

## 3. 对外页面与文案资产

| 资产 | 路径 | 状态 |
| --- | --- | --- |
| 官网首页/下载页 | `website/index.html` | 已升级为销售 + 下载一体页，包含视频和种子用户招募；投放话术保留在内部文档 |
| 官网样式 | `website/styles.css` | 已支持销售页、套餐区、FAQ、视频区和种子用户转化区 |
| 付款兜底页 | `website/pay.html` | 保留为客户端 `pay_url` 兜底 |
| 运营确认页 | `website/ops.html` | 保留给运营核账、人工确认和内部私域话术复制 |
| 发布下载清单 | `website/releases.json` | 已切换为正式域名下载路径，仍需服务器可访问验证 |
| 本地下载清单 | `website/releases.local.json` | 本地验收优先读取 |
| 商业化营销计划 | `docs/zhimeng-commercialization-marketing-plan.md` | 已包含价格、套餐、营销节奏、验收清单 |
| 客服 FAQ | `docs/zhimeng-customer-faq.md` | 已覆盖安装、注册、付款、开通、退款等首发问题 |
| 私域首发文案 | `docs/zhimeng-private-domain-launch-copy.md` | 已覆盖朋友圈、微信群、一对一私聊和跟进话术 |
| 首发海报文案 | `docs/zhimeng-launch-poster-copy.md` | 已覆盖直接转化、家长痛点、种子用户招募和流程说明 |
| 首发海报成图 | `website/assets/posters/zhimeng-poster-direct.png` / `website/assets/posters/zhimeng-poster-pain.png` / `website/assets/posters/zhimeng-poster-seed.png` | 已生成 1080x1440 PNG 三版 |
| 演示视频脚本 | `docs/zhimeng-demo-video-script.md` | 已覆盖 60 秒脚本、30 秒短版、分镜和拍摄清单 |
| 演示视频成片 | `website/assets/videos/zhimeng-demo-30s.mp4` | 已生成 30 秒无旁白字幕版 |
| 种子用户跟进表 | `docs/zhimeng-seed-user-tracking.md` / `docs/zhimeng-seed-user-tracking.csv` | 已提供 Markdown 说明和 20 人 CSV 模板 |
| 商标与品牌管理计划 | `docs/zhimeng-trademark-brand-management.md` | 已包含类别、阶段、品牌规则 |
| AGPL 源码披露 | `docs/agpl-source-disclosure.md` | 对外合规引用 |
| 知萌 AGPL 合规 | `docs/zhimeng-agpl-compliance.md` | 上线合规材料 |

## 4. 品牌使用规则

- 对外主品牌统一写作“知萌”。
- 定位语统一写作“少儿创意编程启蒙”。
- 官网、客户端、安装包、付款页、运营后台、客服话术均使用“知萌”。
- 不把 Scratch 作为产品名、套餐名、售卖品牌或注册账号体系名称。
- Scratch 仅用于开源来源、AGPL 合规、源码披露、技术依赖说明和必要的内部代码命名。
- 不把云保存、作品分享、社区、背包、自动支付确认写成首发已上线权益。

## 5. 品牌残留扫描

本次扫描命令：

```bash
rg -n "Scratch作品|Scratch 3\\.0 GUI|加入 Scratch|Scratch账号|Scratch 帐号|Scratch 账户|scratch作品|scratch 3\\.0|Join Scratch|Scratch" website src static package.json README.md docs _bmad-output/planning-artifacts --glob '!docs/zhimeng-trademark-brand-management.md' --glob '!docs/agpl-source-disclosure.md' --glob '!docs/zhimeng-agpl-compliance.md'
```

扫描结论：

- 官网售卖页未发现“Scratch 作品”“加入 Scratch”“Scratch 3.0 GUI”等对外售卖品牌残留。
- 客户端主售卖路径已改为知萌账号、知萌订阅和知萌品牌。
- 仍存在 Scratch 字样的主要位置属于以下类型：上游 README 历史说明、代码内部依赖命名、技术注释、开源来源说明、资源库素材名称、Scratch Link 等外设兼容说明。
- 上述保留项不应进入对外销售文案；如后续打磨客户端帮助、浏览器兼容提示、崩溃提示，需要逐步替换为知萌语境或明确为技术来源说明。

## 6. 商标检索准备

首批检索名称：

- 知萌
- 知萌编程
- 知萌少儿编程
- ZHIMENG
- ZhiMeng

首批申请建议：

| 类别 | 建议动作 | 说明 |
| --- | --- | --- |
| 第 9 类 | 首批申请 | 保护桌面客户端、可下载软件、计算机程序 |
| 第 41 类 | 首批申请 | 保护少儿编程启蒙、教育、培训、在线教育 |
| 第 42 类 | 首批申请 | 保护软件服务、云能力、AI 辅导和平台服务 |
| 第 35 类 | 后续评估 | 渠道销售、线上推广、商业运营扩展后补充 |
| 第 16 类 | 后续评估 | 纸质练习册、课程包或教材出现后补充 |

申请前待补充信息：

- 申请主体：待确认。
- 统一社会信用代码或个人主体材料：待确认。
- 联系人、手机号、邮箱、收件地址：待确认。
- 是否委托商标代理机构：待确认。
- 是否同时提交 Logo/图形商标：建议暂缓，待视觉稳定后再提交。

## 7. 发布前品牌检查

- [x] 官网首页使用“知萌”作为第一品牌信号。
- [x] 客户端产品名、窗口标题、安装包配置指向“知萌”。
- [x] 商标与品牌管理计划已建立。
- [x] 品牌资产清单已建立。
- [x] 对外售卖页未发现 Scratch 品牌残留。
- [ ] 完成国家知识产权局商标局/中国商标网近似检索。
- [ ] 确认申请主体和联系人信息。
- [ ] 首批真实售卖前提交“知萌”文字商标申请，或记录暂缓原因。
