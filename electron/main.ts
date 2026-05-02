import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { writeFile } from 'fs/promises';
import path from 'path';

// 用环境变量区分开发模式：npm run electron:dev 会传 VITE_DEV=1
const isDev = process.env.VITE_DEV === '1';

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    title: 'MARD 拼豆设计 · 52×52',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    if (isDev) {
      await win.loadURL('http://localhost:5173');
    } else {
      await win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  } catch (err) {
    // dev server 未启动时回退到已构建文件
    console.error('loadURL failed, falling back to dist:', err);
    await win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

ipcMain.handle('save-png', async (_e, dataUrl: string, defaultName: string) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '保存图纸',
    defaultPath: defaultName,
    filters: [{ name: 'PNG 图片', extensions: ['png'] }],
  });
  if (canceled || !filePath) return { ok: false };
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  await writeFile(filePath, Buffer.from(base64, 'base64'));
  return { ok: true, filePath };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
