const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('zhimengAuth', {
    loadAuth: () => ipcRenderer.invoke('zhimeng-auth:load'),
    saveAuth: bundle => ipcRenderer.invoke('zhimeng-auth:save', bundle),
    clearAuth: () => ipcRenderer.invoke('zhimeng-auth:clear')
});
