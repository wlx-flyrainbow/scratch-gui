# 知萌官网下载页（静态站）

本目录为独立静态资源，可直接部署到任意 Web 服务器或对象存储 + CDN。

## 部署方式

1. 将 `website/` 下全部文件（含 `assets/`、`releases.json`）上传到站点根目录或子路径（例如 `https://example.com/download/`）。
2. 若使用 **Nginx**，示例：

```nginx
server {
    listen 80;
    server_name download.example.com;
    root /var/www/zhimeng-download;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 发布新版本后应尽快刷新 CDN；安装包可设较长缓存
    location = /releases.json {
        add_header Cache-Control "public, max-age=300";
    }
}
```

3. 若使用 **OSS / 静态托管**：上传整个目录，确保 `index.html` 为默认首页；将 `releases.json` 的缓存策略设短（如 5 分钟），安装包 `.exe` 可设长缓存。

## 发布新版本流程

1. 本地执行 `npm run dist:mac:arm64`、`npm run dist:mac:x64`、`npm run dist:win` 生成 macOS Apple 芯片版、macOS Intel 芯片版、Windows 安装包与便携包。
2. 将产物上传到 CDN/OSS，记录可公网访问的 URL。
3. 配置 `.env.production` 中的 `ZHIMENG_MACOS_ARM64_URL`、`ZHIMENG_MACOS_X64_URL`、`ZHIMENG_WINDOWS_NSIS_URL` 与 `ZHIMENG_WINDOWS_PORTABLE_URL`，执行 `npm run release:update-downloads` 更新 **`releases.json`**。必要时更新 `beta` 对象；无内测则保持 `"beta": null`。
4. 重新上传 `releases.json`（及如更换了 logo 时的 `assets/`）。

无需修改 `index.html`，页面会自动读取 `releases.json` 显示版本号与下载按钮。

## 本地验收下载页

在正式上传 CDN 前，可先本地跑通完整下载链路：

```bash
npm run dist:desktop:local
npm run release:update-local-downloads
python3 -m http.server 4173 --bind 127.0.0.1 --directory website
```

打开 `http://127.0.0.1:4173/index.html`。页面会优先读取本地生成且不提交的 `releases.local.json`，下载按钮指向本机 `dist/` 中的 macOS Apple 芯片版、macOS Intel 芯片版、Windows 安装版和 Windows 便携版。

## `releases.json` 中 `beta` 字段

内测渠道示例（替换 URL）：

```json
"beta": {
  "version": "5.3.0-beta.1",
  "windows": {
    "nsis": { "label": "内测安装版", "url": "https://..." },
    "portable": { "label": "内测便携版", "url": "https://..." }
  }
}
```

设为 `null` 时页面不展示内测区块。
