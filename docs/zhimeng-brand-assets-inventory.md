# 新祥编程品牌资产清单与商标检索准备包（原知萌）

更新日期：2026-05-27

## 1. 品牌基础

| 项目 | 当前值 | 用途 |
| --- | --- | --- |
| 历史/过渡代号 | 知萌 | 存量官网、客户端、安装包、支付、客服、运营后台可能仍有残留；不再作为新增对外物料主品牌 |
| 新主品牌 | 新祥编程 | 团队已决策，后续官网、客户端、安装包、支付、客服、运营后台统一切换 |
| 公司主体 | 新知祥 | 用于主体背书、版权、支付页、客服和关于页 |
| 英文备用标识 | NewSiang | 仅用于英文环境、安装包元数据、域名或技术分发说明；不使用拼音简称 |
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
| 首发海报：直接转化版 | `website/assets/posters/zhimeng-poster-direct.png` | 352K | `3cab798c1d35f26c7fa3e7d65139b60e3c5be87a53b9876e3f6c915f1614be1a` | 私域朋友圈/社群投放，主打家庭低成本编程启蒙 |
| 首发海报：家长痛点版 | `website/assets/posters/zhimeng-poster-pain.png` | 315K | `27d65baf021ad8fc5b90ce33fefd70a178ad35ebc594b73920a5ac3c72f5ec3e` | 私域转化投放，主打报课前低成本试错 |
| 首发海报：种子用户版 | `website/assets/posters/zhimeng-poster-seed.png` | 384K | `0e4691455719bc71b34e1904122d23c2f7c810a5574b8c7d83a4c432db8d39c1` | 首批 20 个种子用户招募 |
| 首发海报源文件 | `website/posters/launch-posters.html` | 12K | `592e3a3bd1292948e210507e7c8d8f389d016a6b428ff88c878178adb728536c` | 通过 query 参数生成 direct/pain/seed 三版海报 |
| 30 秒演示视频 | `website/assets/videos/zhimeng-demo-30s.mp4` | 1.9M | `dcde15fabe72a53b2409b73b7594f619d47914d2e849f803e71fe55a3adedf5e` | 私域首发转化视频，无旁白字幕版 |
| 30 秒演示视频封面 | `website/assets/videos/zhimeng-demo-30s-cover.jpg` | 68K | `bad072f6541ed90367761a7a7e87249610ec46d46fad3d79fd39de0c5aec6336` | 视频发布封面图 |
| 演示视频生成脚本 | `scripts/generate-zhimeng-demo-video.js` | 16K | `88c77bc6735e6554fc928eb77d942c8930a907ff462d47b340c7736fcb019295` | 生成 1920x1080、30 秒、24fps MP4 |

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
| 新祥编程 AGPL 合规 | `docs/zhimeng-agpl-compliance.md` | 上线合规材料 |

## 4. 品牌使用规则

- 存量页面和客户端可能仍残留“知萌”，但不再扩大长期品牌物料沉淀。
- 新主品牌统一写作“新祥编程”。
- 英文备用标识统一写作 `NewSiang`。
- 公司主体统一写作“新知祥”。
- 不把“新祥”作为独立简称，不使用拼音简称，不把 `XINXIANG` 作为独立主品牌。
- 需要英文展示时只使用 `NewSiang`，不得混用 `Xinxiang`、`XinXiang`、`XINXIANG`。
- 定位语统一写作“少儿创意编程启蒙”。
- 官网、客户端、安装包、付款页、运营后台、客服话术必须保持同一套品牌名称；切换时需一次性列出替换清单。
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
- 客户端主售卖路径已改为产品账号、产品订阅和新祥编程品牌。
- 仍存在 Scratch 字样的主要位置属于以下类型：上游 README 历史说明、代码内部依赖命名、技术注释、开源来源说明、资源库素材名称、Scratch Link 等外设兼容说明。
- 上述保留项不应进入对外销售文案；如后续打磨客户端帮助、浏览器兼容提示、崩溃提示，需要逐步替换为新祥编程语境或明确为技术来源说明。

## 6. 商标检索准备

首批检索名称：

- 新祥编程
- 新祥
- 新祥教育
- 新祥少儿编程
- 新翔编程
- 鑫祥编程
- 欣祥编程
- NewSiang
- XINXIANG
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

- [x] 已完成官网首页从“知萌”切换为“新祥编程”。
- [x] 已完成客户端产品名、窗口标题、安装包配置从“知萌”切换为“新祥编程”。
- [x] 商标与品牌管理计划已建立。
- [x] 品牌资产清单已建立。
- [x] 对外售卖页未发现 Scratch 品牌残留。
- [x] 完成“新祥编程”第 9/41/42 类初筛，完整文字未发现相同或同音结果。
- [x] 确认英文备用标识为 `NewSiang`，不使用拼音简称。
- [x] 完成 `NewSiang` 第 9/41/42 类初筛，未发现相同或同音结果。
- [ ] 完成“新祥编程”第 9/41/42 类逐条近似复核。
- [ ] 若 `NewSiang` 用于官网、安装包、域名或英文物料，完成第 9/41/42 类逐条近似复核。
- [ ] 确认申请主体和联系人信息。
- [ ] 首批真实售卖前提交“新祥编程”文字商标申请，或记录暂缓原因。
- [x] 官网、客户端、安装包、付款页、运营后台、客服话术统一切换为“新祥编程”。
