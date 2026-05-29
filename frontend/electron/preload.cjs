const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('neurotrack', {
  onToggleFocus: (callback) => ipcRenderer.on('toggle-focus', callback),
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body })
});
