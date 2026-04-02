/**
 * 从 website/assets/logo.png 生成：
 * - static/favicon.ico（Windows 任务栏 / 安装器 / Electron win32）
 * - static/app-icon.png（512×512，macOS/Linux 打包与 Electron 非 Windows）
 * - static/xzx_logo.png（与 app-icon 相同，供静态资源引用）
 *
 * 更换主 logo 后执行：npm run generate-icons
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'website', 'assets', 'logo.png');
const outIco = path.join(root, 'static', 'favicon.ico');
const outPng = path.join(root, 'static', 'app-icon.png');
const outLegacy = path.join(root, 'static', 'xzx_logo.png');

async function main () {
    if (!fs.existsSync(src)) {
        console.error('Missing source:', src);
        process.exit(1);
    }

    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const buffers = await Promise.all(
        sizes.map(s => sharp(src).resize(s, s, {fit: 'cover'}).png().toBuffer())
    );
    const ico = await pngToIco(buffers);
    fs.mkdirSync(path.dirname(outIco), {recursive: true});
    fs.writeFileSync(outIco, ico);
    console.log('Wrote', path.relative(root, outIco));

    await sharp(src)
        .resize(512, 512, {fit: 'cover'})
        .png()
        .toFile(outPng);
    console.log('Wrote', path.relative(root, outPng));

    fs.copyFileSync(outPng, outLegacy);
    console.log('Wrote', path.relative(root, outLegacy));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
