const path = require("path")
const os = require("os")
const { app, BrowserWindow, Menu, globalShortcut, ipcMain, shell } = require("electron")
const imagemin = require("imagemin")
const imageminMozjpeg = require("imagemin-mozjpeg")
const imageminPngquant = require("imagemin-pngquant")
const slash = require("slash")
const log = require("electron-log")
const { autoUpdater } = require("electron-updater")

// Set env
process.env.NODE_ENV = "development"
const isDev = process.env.NODE_ENV !== "production" ? true : false

// Check platform
const isMac = process.platform === "darwin" ? true : false

let mainWindow
let aboutWindow

function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: "ImageShrink",
    width: isDev ? 800 : 500,
    height: 600,
    icon: `${__dirname}/assets/icons/Icon_16x16.png`,
    resizable: isDev ? true : false,
    backgroundColor: "white",
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
  })

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  // mainWindow.loadURL(`file://${__dirname}/app/index.html`)
  mainWindow.loadFile(`${__dirname}/app/index.html`)

  mainWindow.once("ready-to-show", () => {
    autoUpdater.checkForUpdatesAndNotify()
  })
}

function createAboutWindow() {
  aboutWindow = new BrowserWindow({
    title: "About ImageShrink",
    width: 300,
    height: 300,
    icon: `${__dirname}/assets/icons/Icon_16x16.png`,
    resizable: false,
    backgroundColor: "white",
    titleBarStyle: "hidden",
  })

  // mainWindow.loadURL(`file://${__dirname}/app/index.html`)
  aboutWindow.loadFile(`${__dirname}/app/about.html`)
}

app.on("ready", () => {
  createMainWindow()

  const mainMenu = Menu.buildFromTemplate(menu)
  Menu.setApplicationMenu(mainMenu)

  // globalShortcut.register("CmdOrCtrl+R", () => mainWindow.reload())
  // globalShortcut.register(isMac ? "Command+Alt+I" : "Ctrl+Shift+I", () => mainWindow.toggleDevTools())

  mainWindow.on("ready", () => (mainWindow = null))
})

// Menu
const menu = [
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            {
              label: "About",
              click: createAboutWindow,
            },
          ],
        },
      ]
    : []),
  { role: "fileMenu" },
  ...(!isMac
    ? [
        {
          label: "Help",
          submenu: [
            {
              label: "About",
              click: createAboutWindow,
            },
          ],
        },
      ]
    : []),
  ...(isDev
    ? [
        {
          label: "Developer",
          submenu: [{ role: "reload" }, { role: "forcereload" }, { type: "separator" }, { role: "toggleDevTools" }],
        },
      ]
    : []),
]

//Listen for events from mainWindow
ipcMain.on("image:minimize", (e, options) => {
  options.dest = path.join(os.homedir(), "imageshrink")
  shrinkImage(options)
})

async function shrinkImage({ dest, imgPath, quality }) {
  try {
    const pngQuality = quality / 100
    const files = await imagemin([slash(imgPath)], {
      destination: dest,
      plugins: [
        imageminMozjpeg({ quality }),
        imageminPngquant({
          quality: [pngQuality, pngQuality],
        }),
      ],
    })
    log.info(files)
    shell.openPath(dest)
    mainWindow.webContents.send("image:done")
  } catch (err) {
    console.log(err)
    log.error(err)
  }
}

// Get App Version
ipcMain.on("app_version", (event) => {
  event.sender.send("app_version", { version: app.getVersion() })
})

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (!isMac) {
    app.quit()
  }
})

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow()
  }
})

//Check for updates
autoUpdater.on("update-available", () => {
  mainWindow.webContents.send("update_available")
})

autoUpdater.on("update-downloaded", () => {
  mainWindow.webContents.send("update_downloaded")
})

ipcMain.on("restart_app", () => {
  autoUpdater.quitAndInstall()
})
