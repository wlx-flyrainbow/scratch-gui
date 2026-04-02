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

1. 本地执行 `npm run dist:win` 生成安装包与便携包。
2. 将产物上传到 CDN/OSS，记录可公网访问的 URL。
3. 编辑 **`releases.json`**：更新 `version`、`releasedAt`，以及 `windows.nsis.url`、`windows.portable.url`（必要时更新 `beta` 对象；无内测则保持 `"beta": null`）。
4. 重新上传 `releases.json`（及如更换了 logo 时的 `assets/`）。

无需修改 `index.html`，页面会自动读取 `releases.json` 显示版本号与下载按钮。

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
