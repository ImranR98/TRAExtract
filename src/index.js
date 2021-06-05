const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fork = require('child_process').fork
const extract = path.resolve(__dirname, './extract.js')

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit()
}

let mainWindow

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: path.join(app.getAppPath(), 'icon/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: true
    },
    autoHideMenuBar: true
  })

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'))
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

let extractionProcess = null

const runExtraction = (file, folder) => {
  return new Promise((resolve, reject) => {
    extractionProcess = fork(extract, [file, folder], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] }).on('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject()
    }).stdout?.on('data', (data) => {
      mainWindow.webContents.send('fromMain', { type: 'LOG', data: data.toString().slice(0, -1) })
    })
  })
}

process.on('exit', () => extractionProcess?.connected ? extractionProcess?.kill() : null)

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
ipcMain.on('toMain', async (event, message) => {
  switch (message.type) {
    case 'PICKINPUT':
      const filePick = await dialog.showOpenDialog({
        title: 'Pick the input file',
        filters: ['txt'],
        properties: ['openFile']
      })
      if (filePick.filePaths.length === 0) {
        dialog.showErrorBox('No file selected', 'Please pick a valid input file.')
        mainWindow.webContents.send('fromMain', { type: 'SETINPUT', data: '' })
        break
      }
      mainWindow.webContents.send('fromMain', { type: 'SETINPUT', data: filePick.filePaths[0] })
      break
    case 'PICKOUTPUT':
      const folderPick = await dialog.showOpenDialog({
        title: 'Pick the output folder',
        properties: ['openDirectory']
      })
      if (folderPick.filePaths.length === 0) {
        dialog.showErrorBox('No folder selected', 'Please pick a valid output folder.')
        mainWindow.webContents.send('fromMain', { type: 'SETOUTPUT', data: '' })
        break
      }
      mainWindow.webContents.send('fromMain', { type: 'SETOUTPUT', data: folderPick.filePaths[0] })
      break
    case 'START':
      mainWindow.webContents.send('fromMain', { type: 'DISABLE', data: null })
      const { file, folder } = message.data
      try {
        await runExtraction(file, folder)
      } catch (err) {
        dialog.showErrorBox('Something Went Wrong', 'Check logs.')
      }
      mainWindow.webContents.send('fromMain', { type: 'ENABLE', data: null })
      break
    case 'HELP':
      mainWindow.loadFile(path.join(__dirname, 'help.html'))
      break
    case 'HOME':
      mainWindow.loadFile(path.join(__dirname, 'index.html'))
      break
    case 'TRASCAN':
      shell.openExternal("https://github.com/ImranR98/TRAScan")
      break
    default:
      console.error('Unrecognized message.')
      console.error(message)
      break
  }
})

if (require('electron-squirrel-startup')) return