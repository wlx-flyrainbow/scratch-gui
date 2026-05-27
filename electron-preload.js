const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('zhimengAuth', {
    loadAuth: () => ipcRenderer.invoke('zhimeng-auth:load'),
    saveAuth: bundle => ipcRenderer.invoke('zhimeng-auth:save', bundle),
    clearAuth: () => ipcRenderer.invoke('zhimeng-auth:clear'),
    loadDevice: () => ipcRenderer.invoke('zhimeng-device:load'),
    saveDevice: identity => ipcRenderer.invoke('zhimeng-device:save', identity)
});
