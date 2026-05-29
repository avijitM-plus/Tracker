const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, Notification, ipcMain } = require('electron');
const path = require('path');

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

let mainWindow = null;
let tray = null;

// 16x16 blue circle tray icon
const TRAY_ICON_DATA_URL =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA' +
  'Y0lEQVR42mNkYPj/n4EBCJgYGBgYmRgYGP4zMDAw/GdgYGD8' +
  'D2IAMSD5/xkYGBj+MzAwMDExMDD8Z2BgYPwPYoAE/zMwMDD+' +
  'BzFADP4zMDAwghgMDAwMjCBNDAwMDAwAAN3YEhEkjafaAAAA' +
  'AElFTkSuQmCC';

function createTray() {
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  tray = new Tray(icon);
  tray.setToolTip('NeuroTrack');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show NeuroTrack',
      click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } }
    },
    { type: 'separator' },
    {
      label: 'Toggle Focus Mode (Ctrl+Shift+F)',
      click: () => { if (mainWindow) mainWindow.webContents.send('toggle-focus'); }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { app.isQuitting = true; app.quit(); }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#020617',
      symbolColor: '#e2e8f0',
    },
    backgroundColor: '#020617',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function registerShortcuts() {
  // Ctrl+Shift+F: Toggle Focus Mode
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-focus');
    }
  });

  // Ctrl+Shift+N: Show/hide NeuroTrack
  globalShortcut.register('CommandOrControl+Shift+N', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// IPC: Show desktop notification from renderer
ipcMain.on('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show();
  }
});

app.whenReady().then(() => {
  app.setLoginItemSettings({ openAtLogin: false });
  createTray();
  createWindow();
  registerShortcuts();

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep alive in tray
  }
});

app.on('before-quit', () => { app.isQuitting = true; });

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
