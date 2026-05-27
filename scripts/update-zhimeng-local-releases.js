const fs = require('fs');
const path = require('path');
const {pathToFileURL} = require('url');

const packageJson = require('../package.json');

const distDir = path.resolve(__dirname, '../dist');
const outputPath = path.resolve(__dirname, '../website/releases.local.json');

const files = fs.existsSync(distDir) ? fs.readdirSync(distDir) : [];

const findFile = (id, predicate) => {
    const found = files.find(predicate);
    if (!found) {
        throw new Error(`Cannot find ${id} in dist/. Run local desktop packaging first.`);
    }
    return path.join(distDir, found);
};

const macArm64 = findFile('macOS arm64 DMG', name => name.endsWith('.dmg') && name.includes('arm64'));
const macX64 = findFile('macOS x64 DMG', name => name.endsWith('.dmg') && !name.includes('arm64'));
const windowsNsis = findFile('Windows NSIS installer', name => /^新祥编程 Setup .*\.exe$/.test(name));
const windowsPortable = findFile(
    'Windows portable EXE',
    name => /^新祥编程 .*\.exe$/.test(name) && !/^新祥编程 Setup /.test(name)
);

const release = {
    channel: 'local',
    version: packageJson.version,
    releasedAt: new Date().toISOString()
        .slice(0, 10),
    windows: {
        nsis: {
            label: 'Windows 安装版（本地）',
            url: pathToFileURL(windowsNsis).href
        },
        portable: {
            label: 'Windows 便携版（本地）',
            url: pathToFileURL(windowsPortable).href
        }
    },
    macos: {
        appleSilicon: {
            label: 'macOS Apple 芯片版（本地）',
            url: pathToFileURL(macArm64).href
        },
        intel: {
            label: 'macOS Intel 芯片版（本地）',
            url: pathToFileURL(macX64).href
        }
    },
    beta: null
};

fs.writeFileSync(outputPath, `${JSON.stringify(release, null, 2)}\n`);

// eslint-disable-next-line no-console
console.log(`Updated ${path.relative(process.cwd(), outputPath)} from local dist artifacts.`);
