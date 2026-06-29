# 新祥编程 GEO / AI 搜索可见性优化方案

适用阶段：老师渠道 MVP、Web 体验入口、首批家庭/老师获客。

本方案承接：

- `website/index.html`：新祥编程官网与下载页。
- `website/teacher.html`：老师联名体验页。
- `website/app.html`：Web 体验入口。
- `website/purchase.html`：客服辅助下单与购买链路。
- `docs/zhimeng-teacher-channel-web-battle-map.md`：老师渠道与 Web 体验作战图。
- `docs/zhimeng-teacher-channel-web-product-plan.md`：老师渠道与 Web 体验产品方案。
- 微信文章：`/Users/apple/wanlexiang/doc/ai/wechat-articles/Topify -AI GEO/raw/codex-preview/2247483994-Andrew Ng：网站做GEO；真的能冲谷歌第1.md`。

## 1. 结论

这篇 GEO 文章对新祥编程的价值不是“3 天冲 Google 第一”，而是提醒我们把官网、老师联名页和 Web 体验入口改造成 AI 能理解、摘取和推荐的公开证据资产。

新祥编程当前的核心机会是：

> 当家长、编程老师、KOL 或小机构问 AI “有没有适合 6-10 岁孩子低成本体验的少儿编程工具”“Scratch 改造产品是否靠谱”“老师怎么推荐少儿编程产品并获得收益”时，AI 能清楚识别新祥编程的定位、价格、边界、入口、开通流程和老师渠道方案。

因此 GEO 优化不单独做成一批文章，而是服务三条业务链路：

| 链路 | GEO 目标 | 关键页面 |
| --- | --- | --- |
| 家长购买 | 回答“孩子是否适合、多少钱、怎么开通、是否靠谱” | `website/index.html`；`website/purchase.html` 仅作客服辅助，不进入公开索引 |
| 老师推广 | 回答“老师如何推荐、佣金如何算、责任边界是什么” | `website/teacher.html`、老师渠道销售包 |
| Web 体验 | 回答“不安装能不能先试、体验后如何购买” | `website/app.html` |

## 2. 不采纳的部分

文章中的以下表达不能直接作为执行依据：

- 不把“3 天冲 Google 第一”作为目标或承诺。
- 不把 Reddit 当作中国家长/老师渠道的主战场。
- 不批量生成低质量问答页，不为覆盖关键词而制造重复页面。
- 不做虚假外部引用、虚构老师反馈或伪造社区讨论。
- 不把 Schema 当作排名保证；结构化数据只用于帮助机器理解真实页面内容。

执行原则：

- 先对真实用户有用，再考虑 AI 摘取。
- 所有对外内容必须符合老师渠道合规边界：不冒充 Scratch 官方、不承诺学校合作、不承诺升学竞赛、不把工具包装成长期一对一课。
- AGPL、源码披露、Scratch 关系说明必须清楚保留，不能为了转化隐藏。

## 3. 问题地图

先建立 `docs/zhimeng-geo-question-map.csv`，用于记录 AI/搜索当前如何回答这些问题。第一版不超过 40 个问题，避免失控。

建议字段：

| 字段 | 说明 |
| --- | --- |
| question | 用户真实问题 |
| audience | 家长、老师、机构、运营 |
| intent | 购买、比较、信任、安装、开通、渠道合作 |
| current_ai_answer | ChatGPT / Gemini / Perplexity / Kimi / 豆包等当前回答摘要 |
| mentioned_zhimeng | 是否提到新祥编程 |
| competitor_or_alt | AI 当前推荐的替代产品或方案 |
| target_page | 应承接的页面 |
| missing_evidence | 当前缺少的公开证据 |
| priority | P0 / P1 / P2 |
| checked_at | 检查日期 |

P0 问题清单：

| 问题 | 目标页面 | 页面必须回答 |
| --- | --- | --- |
| 6-10 岁孩子适合用什么工具开始学编程？ | `index.html` | 新祥编程是少儿创意编程启蒙工具，适合先做故事、动画、小游戏 |
| 孩子学 Scratch 前要不要先报课？ | `index.html` | 可以先低成本做第一个作品，再判断是否继续系统学习 |
| 新祥编程和 Scratch 是什么关系？ | `index.html`、`teacher.html` | 基于 Scratch GUI 开源项目改造，不是 Scratch 官方产品，遵守 AGPLv3 |
| 新祥编程多少钱？ | `index.html`；`purchase.html` 仅作客服辅助 | 家庭年卡 199 元/年，7 天项目陪跑包 699 元/期 |
| 新祥编程付款后多久开通？ | `index.html`；`purchase.html` 仅作客服辅助 | 首发 MVP 人工确认到账，通常 24 小时内确认 |
| 不安装软件能不能先体验少儿编程？ | `app.html` | Web 入口用于低摩擦注册、授权检查、购买归因和灰度编辑器体验 |
| 编程老师怎么推荐新祥编程？ | `teacher.html`、销售包 | 老师发联名页，家长体验/下载/购买，订单保留推荐码 |
| 老师推荐新祥编程是否等于老师负责售后？ | `teacher.html` | 账号、付款、授权、客服和退款由新祥编程统一承接 |

## 4. 页面改造方案

### 4.1 官网首页

目标：让家长和 AI 在 30 秒内理解“是什么、适合谁、多少钱、怎么开始、边界是什么”。

建议改造：

- 在首屏或首个正文区增加 3-5 句可摘取定义块：
  - 新祥编程是面向 6-10 岁孩子的少儿创意编程启蒙工具。
  - 孩子可以用积木编程做故事、动画和小游戏。
  - 家庭年卡 199 元/年，适合先低成本验证孩子兴趣。
  - 新祥编程基于 Scratch GUI 开源项目改造，不是 Scratch 官方产品。
- 将 FAQ 从 4 条扩展到 8-10 条，覆盖适龄、价格、Scratch 关系、安装、Web 体验、付款开通、云保存边界、7 天陪跑包。
- 增加 `SoftwareApplication`、`Product`、`Offer`、`FAQPage` JSON-LD。
- 增加 Open Graph / Twitter Card 元信息，使用真实 logo 或视频封面图。
- 增加 canonical URL，避免 `index.html`、根路径和参数页被重复理解。

建议文件：

- `website/index.html`
- `docs/zhimeng-customer-faq.md`

### 4.2 老师联名页

目标：让老师渠道页面既能成交，也能被 AI 理解为“老师推荐入口”，而不是一个泛泛的动态页面。

当前风险：

- `teacher.html` 依赖 JS 从 `website/data/teacher-channels.json` 动态渲染老师信息。
- 搜索引擎或 AI 抓取时可能只看到默认 demo 文案，无法识别具体老师/机构页面。
- 只有 query 参数入口，不利于形成稳定可引用 URL。

建议改造：

- 第一阶段保留 `teacher.html?teacher=xxx`，同时增加静态生成方案：从 `teacher-channels.json` 生成 `website/t/<slug>/index.html`。
- 每个静态老师页写入独立 `<title>`、`description`、canonical、老师展示名、推荐语和推荐码。
- 老师页 JSON-LD 使用 `WebPage` + `Organization`/`Person` + `Offer` + `FAQPage`，但不把老师包装成官方教育机构。
- FAQ 中继续保留“不是 Scratch 官方”“不是直播课”“付款后由新祥编程运营开通”。
- 对未审核老师配置不生成静态页。

建议文件：

- `website/teacher.html`
- `website/data/teacher-channels.json`
- `scripts/generate-zhimeng-teacher-pages.js`（新增）
- `website/t/<slug>/index.html`（生成产物，可按发布策略决定是否提交）

### 4.3 Web 体验入口

目标：让 AI 和用户明确 Web 入口的定位，避免误解为完整云 IDE。

建议改造：

- 页面开头增加清晰定义：Web V0 用于低摩擦注册、授权检查、购买归因和灰度在线编辑器体验。
- FAQ 增加：
  - Web 体验和桌面客户端有什么区别？
  - 未付费用户能体验什么？
  - 为什么在线编辑器需要灰度地址？
  - Web 体验后如何购买？
- 增加 `WebApplication` / `SoftwareApplication` JSON-LD，但明确 `applicationCategory` 为教育/创作工具，不写未上线能力。

建议文件：

- `website/app.html`
- `docs/zhimeng-teacher-channel-web-product-plan.md`

### 4.4 购买信息和客服辅助下单页

目标：让 AI 对“价格、付款、开通、人工确认”的回答稳定一致。

当前边界：

- 公开购买信息由 `website/index.html` 承接。
- `website/purchase.html` 当前是本地验收与客服辅助订单创建工具，必须保留 `noindex,nofollow`，不进入 sitemap。

建议改造：

- 首页和客服辅助页都保留 Offer 结构化数据，明确家庭年卡和 7 天项目陪跑包。
- 增加 FAQ：
  - 为什么不是自动开通？
  - 付款截图是否一定能开通？
  - 多久开通？
  - 退款/重复付款如何处理？
- 保持客服话术与 `docs/zhimeng-customer-faq.md` 一致。

建议文件：

- `website/purchase.html`
- `docs/zhimeng-customer-faq.md`

## 5. 技术基建

P0：

- 新增 `website/robots.txt`，允许抓取公开页面，并指向 sitemap。
- 新增 `website/sitemap.xml`，包含首页、Web 体验、老师联名入口、海报页；后续生成老师静态页后同步加入。
- 给核心页面补 canonical。
- 给核心页面补 Open Graph / Twitter Card。
- 给核心页面补 JSON-LD。
- 增加脚本校验核心页面是否包含 title、description、canonical、OG、JSON-LD。

P1：

- 新增 `scripts/validate-zhimeng-seo.js`，纳入 `npm run release:check` 或单独 `npm run test:zhimeng-seo`。
- 新增老师页静态生成脚本，避免动态 query 页成为唯一外部入口。
- 在部署校验中检查 sitemap URL 是否为正式域名 `https://zhimeng.codevalley.cn`。
- 为视频封面和 logo 增加稳定绝对 URL，提升分享和搜索展示效果。

P2：

- 增加短内容页或资源页，例如 `parents-guide.html`、`teacher-guide.html`，但必须基于真实 FAQ 和渠道材料，不批量灌水。

## 6. 外部引用信号

外部信号的目标不是“刷存在感”，而是让公开渠道里的表述与官网一致。

优先级：

| 渠道 | 目标 | 内容形式 |
| --- | --- | --- |
| 老师/KOC 私域 | 真实转发和反馈 | 联名页链接、3 个入门作品、家长 FAQ |
| 公众号/文章 | 解释产品边界 | “为什么先做低成本编程启蒙工具” |
| 知乎/小红书 | 承接家长问题 | 适龄、Scratch 关系、报课前试错、安装开通 |
| B站/视频号 | 展示真实体验 | 30 秒 demo、老师演示第一个作品 |
| GitHub 公开源码 | 建立开源合规信任 | AGPL 源码披露、问题反馈、发布说明 |

统一口径：

- 新祥编程是少儿创意编程启蒙工具。
- 适合 6-10 岁孩子，首发重点观察 6-8 岁家庭。
- 家庭年卡 199 元/年。
- 7 天项目陪跑包 699 元/期。
- 不是 Scratch 官方产品。
- 不承诺直播课、长期一对一、竞赛、考级或学校官方合作。
- Web 体验降低首次打开成本，桌面端承接稳定创作。

## 7. 衡量指标

### 7.1 可见性指标

每周检查一次问题地图：

- AI 是否能回答“新祥编程是什么”。
- AI 是否能准确说出适龄、价格、Scratch 关系、开通方式。
- AI 是否开始引用官网、老师联名页、GitHub 源码或公开文章。
- Google / Bing / 百度是否收录首页、Web 体验和老师页；客服辅助购买页应保持不收录。

### 7.2 转化指标

与老师渠道已有指标对齐：

- 老师联名页打开数。
- 老师页到 Web 体验点击率。
- Web 打开到注册率。
- 注册到创建订单率。
- 创建订单到确认付款率。
- 首作完成率。
- 老师来源订单退款/投诉风险。

### 7.3 质量指标

- AI 回答中不出现“Scratch 官方”“自动开通”“已支持云保存/社区”等错误。
- 页面 FAQ 与客服 FAQ 不冲突。
- 老师页不出现未经审核的承诺。
- 结构化数据通过 Google Rich Results Test 或 Schema Markup Validator。

## 8. 两周执行计划

### 第 1-2 天：基线与问题地图

- 建立 `docs/zhimeng-geo-question-map.csv`。
- 选 20 个 P0 问题，记录 ChatGPT / Gemini / Perplexity / Kimi / 豆包当前回答。
- 记录当前核心页面是否被搜索收录。

产物：

- 问题地图 CSV。
- 第一版 AI 回答基线。

### 第 3-5 天：首页和购买口径 GEO 改造

- 扩展 `index.html` FAQ 和定义块。
- 补首页 JSON-LD、OG、canonical。
- 补客服辅助页 Offer 和支付开通 FAQ，但保持 `noindex,nofollow`。
- 更新 `docs/zhimeng-customer-faq.md`，保持客服口径一致。

产物：

- 首页可摘取内容块。
- 首页和客服辅助页结构化数据。

### 第 6-8 天：老师页和 Web 体验入口改造

- 给 `teacher.html` 补老师渠道 FAQ、OG、canonical、基础 JSON-LD。
- 设计老师静态页生成脚本。
- 给 `app.html` 补 Web 体验定位 FAQ 和结构化数据。

产物：

- 老师页对外解释更清楚。
- Web 体验入口不被误解为完整云 IDE。

### 第 9-10 天：索引基建和校验

- 新增 `robots.txt`。
- 新增 `sitemap.xml`。
- 新增 SEO/GEO 校验脚本。
- 将校验接入发布检查或形成手动发布清单。

产物：

- 可抓取、可提交、可校验的静态站。

### 第 11-14 天：外部内容和复测

- 根据老师渠道销售包生成 2-3 条老师转发素材。
- 根据客服 FAQ 生成 1 篇公众号/知乎风格说明稿。
- 复测 20 个 P0 问题，看 AI 回答是否更准确。
- 汇总仍缺少的公开证据。

产物：

- 第一轮外部引用素材。
- GEO 复测报告。

## 9. Backlog

| 优先级 | 任务 | 文件/产物 | 验收 |
| --- | --- | --- | --- |
| P0 | 新增问题地图 | `docs/zhimeng-geo-question-map.csv` | 至少 20 个 P0 问题有基线 |
| P0 | 首页 FAQ 和定义块改造 | `website/index.html` | 家长问题能直接在页面找到答案 |
| P0 | 首页结构化数据 | `website/index.html` | JSON-LD 校验通过 |
| P0 | robots 和 sitemap | `website/robots.txt`、`website/sitemap.xml` | sitemap 包含核心公开页 |
| P0 | 购买口径和客服辅助 FAQ | `website/index.html`、`website/purchase.html` | 首页公开承接价格；客服辅助页保持 noindex 且开通口径清楚 |
| P0 | 老师页风险边界强化 | `website/teacher.html` | 不误导为 Scratch 官方、直播课或学校课程 |
| P1 | Web 体验 FAQ | `website/app.html` | 明确 Web V0 与桌面端区别 |
| P1 | SEO 校验脚本 | `scripts/validate-zhimeng-seo.js` | 核心页面缺 meta/JSON-LD 时失败 |
| P1 | 老师静态页生成 | `scripts/generate-zhimeng-teacher-pages.js` | 已启用老师能生成稳定 URL |
| P1 | 外部内容素材包 | `docs/zhimeng-geo-external-content-kit.md` | 老师/家长/文章三类素材统一口径 |

## 10. 风险

- 如果下载链接仍是占位 URL，GEO 引流会放大转化失败。
- 如果老师页只靠 JS 渲染，搜索和 AI 抓取可能拿不到真实老师内容。
- 如果外部内容夸大“课程、直播、学校合作、自动开通”，后续客服和退款风险会上升。
- 如果只做 Schema 不改正文，AI 仍然缺少可引用内容。
- 如果页面写了未上线能力，如云保存、社区、自动支付确认，会破坏信任并影响客服。

## 11. 第一轮推荐范围

第一轮只做“可见性基础 + 真实问答 + 老师渠道页”，暂不做大规模内容矩阵。

推荐先进入实现的最小范围：

1. `docs/zhimeng-geo-question-map.csv`
2. `website/index.html` FAQ / JSON-LD / OG / canonical
3. `website/purchase.html` Offer / FAQ，并保持 `noindex,nofollow`
4. `website/teacher.html` FAQ / JSON-LD / OG / canonical
5. `website/app.html` Web 体验定位 FAQ
6. `website/robots.txt`
7. `website/sitemap.xml`
8. `scripts/validate-zhimeng-seo.js`

完成后再根据真实 AI 复测结果决定是否做老师静态页生成和外部内容素材包。
