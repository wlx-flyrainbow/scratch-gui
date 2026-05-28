const {app, BrowserWindow, Menu, ipcMain, safeStorage, shell} = require('electron');
const fs = require('fs');
const path = require('path');

const windowIconPath = () => {
    const base = path.join(__dirname, 'build/static');
    if (process.platform === 'win32') {
        return path.join(base, 'favicon.ico');
    }
    return path.join(base, 'app-icon.png');
};

let mainWindow;
let isQuitting = false;
const authFilePath = path.join(app.getPath('userData'), 'zhimeng-auth.json');
const deviceFilePath = path.join(app.getPath('userData'), 'zhimeng-device.json');
const websiteUrl = 'https://zhimeng.codevalley.cn/index.html';
const publicSourceUrl = 'https://github.com/wlx-flyrainbow/newsiang-client-public/tree/public-bootstrap-2026-05-28';

const readAuthBundle = () => {
    try {
        if (!fs.existsSync(authFilePath)) return null;
        const payload = fs.readFileSync(authFilePath, 'utf8');
        if (!payload) return null;
        if (safeStorage.isEncryptionAvailable()) {
            const decrypted = safeStorage.decryptString(Buffer.from(payload, 'base64'));
            return JSON.parse(decrypted);
        }
        return JSON.parse(payload);
    } catch (error) {
        return null;
    }
};

const writeAuthBundle = bundle => {
    const serialized = JSON.stringify(bundle || {});
    if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(serialized).toString('base64');
        fs.writeFileSync(authFilePath, encrypted, 'utf8');
        return;
    }
    fs.writeFileSync(authFilePath, serialized, 'utf8');
};

const clearAuthBundle = () => {
    if (fs.existsSync(authFilePath)) {
        fs.unlinkSync(authFilePath);
    }
};

const readDeviceIdentity = () => {
    try {
        if (!fs.existsSync(deviceFilePath)) return null;
        const payload = fs.readFileSync(deviceFilePath, 'utf8');
        return payload ? JSON.parse(payload) : null;
    } catch (error) {
        return null;
    }
};

const writeDeviceIdentity = identity => {
    fs.writeFileSync(deviceFilePath, JSON.stringify(identity || {}), 'utf8');
};

/**
 * Create and initialize the desktop main window.
 */
const createWindow = function () {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 640,
        title: '新祥编程',
        icon: windowIconPath(),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            webSecurity: true,
            preload: path.join(__dirname, 'electron-preload.js')
        }
    });

    // 加载构建后的 index.html
    mainWindow.loadFile(path.join(__dirname, 'build/index.html'));
    mainWindow.on('page-title-updated', event => {
        event.preventDefault();
        mainWindow.setTitle('新祥编程');
    });

    // 创建菜单
    const template = [
        {
            label: '文件',
            submenu: [
                {
                    label: '退出',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        isQuitting = true;
                        app.quit();
                    }
                }
            ]
        },
        {
            label: '编辑',
            submenu: [
                {label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo'},
                {label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo'},
                {type: 'separator'},
                {label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut'},
                {label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy'},
                {label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste'},
                {label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll'}
            ]
        },
        {
            label: '视图',
            submenu: [
                {label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload'},
                {label: '强制重新加载', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload'},
                {label: '开发者工具', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools'},
                {type: 'separator'},
                {label: '实际大小', accelerator: 'CmdOrCtrl+0', role: 'resetZoom'},
                {label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn'},
                {label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut'},
                {type: 'separator'},
                {label: '全屏', accelerator: 'F11', role: 'togglefullscreen'}
            ]
        },
        {
            label: '窗口',
            submenu: [
                {label: '最小化', accelerator: 'CmdOrCtrl+M', role: 'minimize'},
                {label: '关闭', accelerator: 'CmdOrCtrl+W', role: 'close'}
            ]
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '打开新祥编程官网',
                    click: () => shell.openExternal(websiteUrl)
                },
                {
                    label: '源码与 AGPL 许可',
                    click: () => shell.openExternal(publicSourceUrl)
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    mainWindow.webContents.on('will-prevent-unload', event => {
        // The renderer can block unload via window.onbeforeunload.
        // When user explicitly quits the app, allow force quit.
        if (isQuitting) {
            event.preventDefault();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};

app.on('ready', createWindow);

ipcMain.handle('zhimeng-auth:load', () => readAuthBundle());
ipcMain.handle('zhimeng-auth:save', (event, bundle) => {
    writeAuthBundle(bundle);
    return true;
});
ipcMain.handle('zhimeng-auth:clear', () => {
    clearAuthBundle();
    return true;
});
ipcMain.handle('zhimeng-device:load', () => readDeviceIdentity());
ipcMain.handle('zhimeng-device:save', (event, identity) => {
    writeDeviceIdentity(identity);
    return true;
});

app.on('before-quit', () => {
    isQuitting = true;
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
