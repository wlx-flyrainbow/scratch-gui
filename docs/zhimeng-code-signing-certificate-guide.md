# 知萌桌面应用签名、公证与代码签名证书指引

本文面向第一次做桌面应用分发的流程。目标是让知萌的 macOS / Windows 安装包从“能下载”变成“更适合正式公开售卖”。

## 1. 为什么要做

桌面应用下载后，操作系统会判断这个安装包是否来自可信开发者、是否被篡改、是否通过平台安全检查。

如果不做签名：

- macOS 用户可能看到“无法验证开发者”“Apple 无法检查是否包含恶意软件”等 Gatekeeper 提示。
- Windows 用户可能看到 SmartScreen 的未知发布者/不常见下载提示。
- 对熟人种子验证还能勉强解释，但对陌生用户售卖会严重影响信任和转化。

知萌当前策略：

- 小范围种子用户：可以临时允许未签名包，但客服必须提前说明系统安全提示。
- 正式公开售卖：必须完成 macOS Developer ID 签名与公证，Windows 包必须完成代码签名。

仓库已有闸门：

```bash
npm run release:check-signing
ZHIMENG_REQUIRE_CODE_SIGNING=1 npm run release:check-signing
ZHIMENG_ALLOW_UNSIGNED_SEED_RELEASE=1 npm run release:check-signing
```

正式公开分发前必须让强制模式通过：

```bash
ZHIMENG_REQUIRE_CODE_SIGNING=1 npm run release:check-signing
```

## 2. macOS：Apple Developer ID 与公证

### 2.1 你需要准备什么

必须准备：

- 一个 Apple Account，开启双重认证。
- Apple Developer Program 会员。
- Developer ID Application 证书。
- Apple notarization 凭证。
- 一台 macOS 构建机，或 CI 中配置好证书和 Apple 凭证。

Apple Developer Program 可以个人或组织身份加入。个人/个体户通常用个人身份；如果希望展示公司主体，通常需要以组织身份注册，并满足 Apple 对组织法律实体、授权人等要求。

官方入口：

- Apple Developer Program：`https://developer.apple.com/programs/`
- 加入/注册说明：`https://developer.apple.com/programs/enroll/`

### 2.2 注册 Apple Developer Program

建议步骤：

1. 准备 Apple Account，开启双重认证。
2. 进入 Apple Developer Program 注册页面。
3. 选择个人或组织身份。
4. 按 Apple 要求提交姓名、联系方式、组织信息等。
5. 通过审核后完成年度会员购买。

选择建议：

- 如果当前还没有公司主体，先用个人身份最快。
- 如果知萌要长期以公司品牌对外售卖，建议尽早准备公司主体并注册组织账号。
- 组织账号需要更长审核时间，不要等到发布当天才处理。

### 2.3 创建 Developer ID Application 证书

Developer ID Application 用于签名“在 Mac App Store 之外分发”的 macOS 应用。

常见方式：

1. 打开 Apple Developer 账号后台。
2. 进入 Certificates, Identifiers & Profiles。
3. 创建证书，选择 Developer ID Application。
4. 按提示在本机 Keychain Access 生成 CSR，上传 CSR。
5. 下载证书并安装到本机构建机钥匙串。
6. 在钥匙串中确认有类似身份：

```text
Developer ID Application: Your Name or Company (TEAMID)
```

本机验证：

```bash
security find-identity -v -p codesigning
```

如果列表里能看到 `Developer ID Application`，说明本机构建机具备签名身份。

### 2.4 准备 notarization 凭证

macOS 10.15 之后，站外分发通常需要 notarization。Apple 会扫描 Developer ID 签名后的软件并返回公证结果。

electron-builder 支持两类 notarization 凭证：

方式 A：Apple ID + App 专用密码

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID"
```

方式 B：App Store Connect API Key

```bash
export APPLE_API_KEY="/path/to/AuthKey_XXXXXXXXXX.p8"
export APPLE_API_KEY_ID="XXXXXXXXXX"
export APPLE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

建议优先用方式 B，适合 CI 和长期维护；个人本机临时操作可以先用方式 A。

### 2.5 electron-builder 配置建议

当前仓库已经有：

```json
"mac": {
  "category": "public.app-category.education",
  "icon": "static/app-icon.icns",
  "target": ["dmg", "zip"]
}
```

正式公证建议补充：

```json
"mac": {
  "category": "public.app-category.education",
  "icon": "static/app-icon.icns",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "notarize": true,
  "target": ["dmg", "zip"]
}
```

说明：

- `hardenedRuntime: true` 是 notarization 所需的重要条件。
- `notarize: true` 让 electron-builder 使用环境变量自动走公证。
- 如果需要特定权限，再补 entitlements 文件。当前知萌先不主动加复杂权限。

### 2.6 macOS 打包与验收命令

本机先检查签名材料：

```bash
ZHIMENG_REQUIRE_CODE_SIGNING=1 npm run release:check-signing
```

正式打包：

```bash
npm run dist:desktop:prod
```

签名验收：

```bash
ZHIMENG_REQUIRE_MAC_SIGNED=1 npm run test:zhimeng-mac-release
```

如果要手动检查 `.app`：

```bash
codesign --verify --deep --strict --verbose=2 "dist/mac-arm64/知萌.app"
spctl --assess --type execute --verbose=2 "dist/mac-arm64/知萌.app"
```

## 3. Windows：代码签名证书

### 3.1 你需要准备什么

Windows 需要代码签名证书给 `.exe` 安装包和可执行文件签名。

可选路线：

1. Azure Artifact Signing / Trusted Signing。
2. 传统 OV/EV Code Signing Certificate。

建议优先评估 Azure Artifact Signing，因为 Microsoft 当前把它作为 Windows 应用分发更推荐的路径之一；如果你的主体、地区或 Azure 条件不满足，再购买传统代码签名证书。

### 3.2 方案 A：Azure Artifact Signing / Trusted Signing

适合：

- 有 Azure 账号和可验证主体。
- 希望证书由 Microsoft 托管，减少本地证书文件泄露风险。
- 能接受 Azure 上的身份验证、资源配置和签名集成。

大致流程：

1. 准备 Azure 订阅。
2. 启用 Artifact Signing 资源提供程序。
3. 创建 Artifact Signing 资源。
4. 做身份验证。
5. 创建 Public Trust 证书配置。
6. 在 CI 或本机通过 Microsoft 工具签名 Windows 产物。

注意：

- Public Trust 可用地区和身份类型有限，注册前先看 Microsoft 当前支持范围。
- Artifact Signing 与 electron-builder 的直接集成可能需要额外脚本，不一定只靠 `CSC_LINK` 即可完成。
- 如果采用此方案，建议后续单独做 `scripts/sign-zhimeng-windows.js` 或 CI 签名步骤。

官方入口：

- Artifact Signing 文档：`https://learn.microsoft.com/en-us/azure/trusted-signing/`
- Quickstart：`https://learn.microsoft.com/en-us/azure/trusted-signing/quickstart`
- Trust models：`https://learn.microsoft.com/en-us/azure/artifact-signing/concept-trust-models`

### 3.3 方案 B：传统 OV/EV 代码签名证书

适合：

- 希望直接用 electron-builder 支持的 `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`。
- 已有公司主体，能通过 CA 的组织验证。
- 希望先走成熟通用方案。

大致流程：

1. 选择代码签名证书供应商。
2. 购买 Windows Code Signing Certificate，通常是 OV 或 EV。
3. 按供应商要求完成个人/企业身份验证。
4. 下载或导出证书为 `.pfx` / `.p12`。
5. 设置证书密码。
6. 配置 electron-builder 环境变量。

本机/CI 环境变量：

```bash
export WIN_CSC_LINK="/absolute/path/to/windows-code-signing.pfx"
export WIN_CSC_KEY_PASSWORD="certificate-password"
```

如果要用同一套通用变量：

```bash
export CSC_LINK="/absolute/path/to/windows-code-signing.pfx"
export CSC_KEY_PASSWORD="certificate-password"
```

安全建议：

- 不要把 `.pfx`、`.p12`、密码提交到 Git。
- 本机放在 1Password、iCloud Keychain、macOS Keychain 或加密磁盘中。
- CI 中使用 Secret 管理。
- 证书泄露后要立即撤销。

### 3.4 Windows SmartScreen 预期

代码签名不等于立即没有 SmartScreen 提示。

一般规律：

- 未签名：最容易被拦。
- OV 签名：能证明发布者身份，但新证书/新应用仍可能需要积累声誉。
- EV 签名或 Microsoft 托管签名：通常更有利于建立信任，但仍要以 Microsoft 当前机制为准。
- Microsoft Store 分发另有机制，但知萌当前是官网下载分发，不走 Store。

因此，首发阶段即使完成 Windows 签名，也要继续记录用户安装阻塞率。

## 4. 知萌推荐执行路线

### 阶段 A：现在到种子用户

目标：先验证真实付费和首次创作。

可以做：

- 继续小范围熟人种子用户。
- 使用 `ZHIMENG_ALLOW_UNSIGNED_SEED_RELEASE=1 npm run release:check-signing` 记录“未签名种子分发”。
- 客服提前说明 macOS/Windows 可能有安全提示。

不能做：

- 官网写“已签名/已公证”。
- 大规模陌生流量投放。
- 把未签名包当正式公开售卖包。

### 阶段 B：准备公开售卖前

目标：让陌生用户下载安装时更可信。

必须完成：

- 注册 Apple Developer Program。
- 创建 Developer ID Application 证书。
- 配置 notarization 凭证。
- 购买或配置 Windows 代码签名方案。
- 强制签名闸门通过。

命令：

```bash
ZHIMENG_REQUIRE_CODE_SIGNING=1 npm run release:check-signing
npm run dist:desktop:prod
ZHIMENG_REQUIRE_MAC_SIGNED=1 npm run test:zhimeng-mac-release
npm run test:zhimeng-package-metadata
npm run release:check
```

### 阶段 C：正式发布后

目标：减少安装阻塞，提高支付转化。

持续做：

- 记录 macOS Gatekeeper 阻塞。
- 记录 Windows SmartScreen 阻塞。
- 对每个版本保留签名后的安装包、版本号、SHA256、发布时间。
- 证书快过期前提前 30-60 天续期。
- 证书更换后关注 Windows SmartScreen 声誉变化。

## 5. 知萌环境变量清单

macOS：

```bash
# 任选其一：本机钥匙串身份，或 CSC_LINK/CSC_NAME
export CSC_LINK="/path/to/developer-id-application.p12"
export CSC_KEY_PASSWORD="p12-password"

# notarization 方式 A
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID"

# notarization 方式 B
export APPLE_API_KEY="/path/to/AuthKey_XXXXXXXXXX.p8"
export APPLE_API_KEY_ID="XXXXXXXXXX"
export APPLE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Windows：

```bash
export WIN_CSC_LINK="/path/to/windows-code-signing.pfx"
export WIN_CSC_KEY_PASSWORD="certificate-password"
```

知萌发布闸门：

```bash
ZHIMENG_REQUIRE_CODE_SIGNING=1 npm run release:check-signing
```

## 6. 常见问题

### 6.1 只做 macOS，不做 Windows 签名可以吗？

不建议正式公开售卖这样做。知萌官网已经提供 Windows 安装版和便携版，Windows 用户也会遇到安全提示和信任问题。

如果资源有限，优先级可以是：

1. Apple Developer ID + notarization。
2. Windows 代码签名。
3. 后续再优化 Windows SmartScreen 声誉。

因为 macOS 未公证对启动拦截更直接。

### 6.2 Apple Developer Program 个人账号能做 Developer ID 吗？

可以先按个人开发者路径推进，但对外展示的是个人主体。若知萌要以公司品牌长期经营，建议最终切到组织主体。

### 6.3 Windows 买 OV 还是 EV？

如果只是早期小规模，先评估 Azure Artifact Signing 或 OV。EV 成本和硬件/审核要求通常更高，但在 SmartScreen 声誉方面可能更有优势。最终取决于预算、主体资格和发行规模。

### 6.4 未签名包能不能卖？

技术上可以下载运行，但商业上不建议公开售卖。种子用户阶段可以作为权宜方案，必须明确告知用户安装时可能看到系统安全提示。

## 7. 官方参考

- Apple Developer Program：`https://developer.apple.com/programs/`
- Apple Developer Program Enrollment：`https://developer.apple.com/programs/enroll/`
- Apple Notarizing macOS software：`https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution`
- Apple macOS code signing security：`https://support.apple.com/guide/security/app-code-signing-process-in-macos-sec3ad8e6e53/web`
- electron-builder macOS：`https://www.electron.build/docs/mac`
- electron-builder macOS code signing：`https://www.electron.build/code-signing-mac`
- electron-builder Windows：`https://www.electron.build/docs/win`
- Microsoft SmartScreen reputation：`https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation`
- Microsoft Artifact Signing：`https://learn.microsoft.com/en-us/azure/trusted-signing/`
