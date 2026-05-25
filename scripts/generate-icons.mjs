/**
 * 从 website/assets/logo.png 生成：
 * - static/favicon.ico（Windows 任务栏 / 安装器 / Electron win32）
 * - static/app-icon.png（512×512，带透明圆角，Electron 非 Windows 窗口图标）
 * - static/app-icon.icns（macOS 应用图标）
 * - static/xzx_logo.png（与 app-icon 相同，供静态资源引用）
 *
 * 更换主 logo 后执行：npm run generate-icons
 */
import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';
import {fileURLToPath} from 'url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'website', 'assets', 'logo.png');
const outIco = path.join(root, 'static', 'favicon.ico');
const outPng = path.join(root, 'static', 'app-icon.png');
const outIcns = path.join(root, 'static', 'app-icon.icns');
const outLegacy = path.join(root, 'static', 'xzx_logo.png');
const iconsetDir = path.join(root, 'static', 'app-icon.iconset');

const makeRoundedMask = size => Buffer.from(`
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" ry="${Math.round(size * 0.22)}" fill="#fff"/>
</svg>
`);

const makeAppIconPng = size => sharp(src)
    .resize(size, size, {fit: 'cover'})
    .ensureAlpha()
    .composite([{
        input: makeRoundedMask(size),
        blend: 'dest-in'
    }])
    .png()
    .toBuffer();

const writeIconset = async () => {
    fs.rmSync(iconsetDir, {recursive: true, force: true});
    fs.mkdirSync(iconsetDir, {recursive: true});

    const entries = [
        ['icon_16x16.png', 16],
        ['icon_16x16@2x.png', 32],
        ['icon_32x32.png', 32],
        ['icon_32x32@2x.png', 64],
        ['icon_128x128.png', 128],
        ['icon_128x128@2x.png', 256],
        ['icon_256x256.png', 256],
        ['icon_256x256@2x.png', 512],
        ['icon_512x512.png', 512],
        ['icon_512x512@2x.png', 1024]
    ];

    await Promise.all(entries.map(async ([name, size]) => {
        const buffer = await makeAppIconPng(size);
        fs.writeFileSync(path.join(iconsetDir, name), buffer);
    }));

    try {
        childProcess.execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', outIcns], {
            stdio: 'inherit'
        });
        console.log('Wrote', path.relative(root, outIcns));
    } catch (err) {
        console.warn('Skipped app-icon.icns generation because iconutil failed:', err.message);
    } finally {
        fs.rmSync(iconsetDir, {recursive: true, force: true});
    }
};

const main = async () => {
    if (!fs.existsSync(src)) {
        console.error('Missing source:', src);
        process.exit(1);
    }

    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const buffers = await Promise.all(sizes.map(s => makeAppIconPng(s)));
    const ico = await pngToIco(buffers);
    fs.mkdirSync(path.dirname(outIco), {recursive: true});
    fs.writeFileSync(outIco, ico);
    console.log('Wrote', path.relative(root, outIco));

    fs.writeFileSync(outPng, await makeAppIconPng(512));
    console.log('Wrote', path.relative(root, outPng));

    await writeIconset();

    fs.copyFileSync(outPng, outLegacy);
    console.log('Wrote', path.relative(root, outLegacy));
};

main().catch(err => {
    console.error(err);
    process.exit(1);
});
