import { ThemeManager, themePreset } from '~/theme'
import { BrowserWindow, ipcMain } from 'electron'

export function setupThemeIPC(mainWindow: BrowserWindow): void {
  ipcMain.handle('save-theme', async (_, cssContent: string) => {
    const themeManager = await ThemeManager.getInstance()
    await themeManager.saveTheme(cssContent)
  })

  ipcMain.handle('load-theme', async () => {
    const themeManager = await ThemeManager.getInstance()
    return await themeManager.loadTheme()
  })

  ipcMain.handle('theme-preset', async (_, preset: string) => {
    return await themePreset(preset)
  })

  mainWindow.webContents.send('themeIPCReady')
}
