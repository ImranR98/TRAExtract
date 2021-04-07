const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');

const { extract } = require('./extract')

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

let mainWindow

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: true
    },
    autoHideMenuBar: true
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

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
        break;
      }
      mainWindow.webContents.send('fromMain', { type: 'SETINPUT', data: filePick.filePaths[0] })
      break;
    case 'PICKOUTPUT':
      const folderPick = await dialog.showOpenDialog({
        title: 'Pick the output folder',
        properties: ['openDirectory']
      })
      if (folderPick.filePaths.length === 0) {
        dialog.showErrorBox('No folder selected', 'Please pick a valid output folder.')
        mainWindow.webContents.send('fromMain', { type: 'SETOUTPUT', data: '' })
        break;
      }
      mainWindow.webContents.send('fromMain', { type: 'SETOUTPUT', data: folderPick.filePaths[0] })
      break;
    case 'START':
      mainWindow.webContents.send('fromMain', { type: 'DISABLE', data: null })
      mainWindow.webContents.send('fromMain', { type: 'LOG', data: 'Please wait, this may take a while...' })
      const { file, folder } = message.data
      try {
        const logs = await extract(file, folder)
        mainWindow.webContents.send('fromMain', { type: 'LOG', data: logs })
      } catch (err) {
        let title = 'Something Went Wrong'
        if (typeof err.url === 'string') title = err.url

        let error = ''
        if (typeof err === 'string') error = err
        else if (typeof err.toString === 'function') error = err.toString()
        else if (typeof err.error === 'string') error = err.error
        else error = JSON.stringify(err)
        dialog.showErrorBox(title, error)
      }
      mainWindow.webContents.send('fromMain', { type: 'ENABLE', data: null })
      break;
    case 'HELP':
      mainWindow.loadFile(path.join(__dirname, 'help.html'));
      break;
    case 'HOME':
      mainWindow.loadFile(path.join(__dirname, 'index.html'));
      break;
    case 'TRASCAN':
      shell.openExternal("https://github.com/ImranR98/TRAScan")
      break;
    default:
      console.error('Unrecognized message.')
      console.error(message)
      break;
  }
})