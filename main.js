const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');

// Suppress GPU shader disk cache errors on Windows
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

let mainWindow;
let activeFFmpegProcess = null;

// Paths for persistent settings
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Helper to load settings
function getSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
  return { ffmpegPath: '' };
}

// Helper to save settings
function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save settings:', err);
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: "Scissa : Everyday video splitter",
    icon: path.join(__dirname, 'rss', 'image.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    backgroundColor: '#fff8f6'
  });

  mainWindow.setMenu(null); // Removes default techy File, Edit, Window menu bar
  mainWindow.loadFile('index.html');

  // Open developer tools (optional for debugging)
  // mainWindow.webContents.openDevTools();

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (activeFFmpegProcess) {
      activeFFmpegProcess.kill('SIGKILL');
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler: Settings management
ipcMain.handle('settings:load', () => {
  return getSettings();
});

ipcMain.handle('settings:save', (event, settings) => {
  return saveSettings(settings);
});

// IPC Handler: File Dialog (Select Input Video)
ipcMain.handle('dialog:select-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Video File',
    properties: ['openFile'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'm4v'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  try {
    const stats = fs.statSync(filePath);
    return {
      filePath,
      fileName: path.basename(filePath),
      dirPath: path.dirname(filePath),
      sizeBytes: stats.size,
      sizeMB: parseFloat((stats.size / (1024 * 1024)).toFixed(2))
    };
  } catch (err) {
    console.error('Failed to read file stats:', err);
    throw err;
  }
});

// IPC Handler: Folder Dialog (Select Output Folder)
ipcMain.handle('dialog:select-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Output Directory',
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// IPC Handler: Select FFmpeg Binary Path
ipcMain.handle('dialog:select-ffmpeg', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Locate ffmpeg.exe',
    properties: ['openFile'],
    filters: [
      { name: 'FFmpeg Executable (ffmpeg.exe)', extensions: ['exe'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// IPC Handler: Probe video metadata using ffmpeg -i
ipcMain.handle('video:probe', async (event, { ffmpegPath, filePath }) => {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      return reject(new Error('FFmpeg executable path is not configured.'));
    }
    if (!fs.existsSync(ffmpegPath)) {
      return reject(new Error(`FFmpeg executable not found at specified path: ${ffmpegPath}`));
    }
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`Video file not found at specified path: ${filePath}`));
    }

    // Run "ffmpeg -i filepath"
    // FFmpeg outputs metadata to stderr and exits with error code 1 when no output file is provided.
    execFile(ffmpegPath, ['-i', filePath], { maxBuffer: 1024 * 500 }, (error, stdout, stderr) => {
      const output = stderr || stdout;

      // Parse Duration
      const durationMatch = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1], 10);
        const minutes = parseInt(durationMatch[2], 10);
        const seconds = parseFloat(durationMatch[3]);
        const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;

        // Parse Bitrate
        const bitrateMatch = output.match(/bitrate:\s*(\d+)\s*kb\/s/);
        const bitrate = bitrateMatch ? parseInt(bitrateMatch[1], 10) : null;

        // Parse Video Format/Codec info
        let codec = 'Unknown';
        const codecMatch = output.match(/Video:\s*([a-zA-Z0-9_]+)/);
        if (codecMatch) codec = codecMatch[1];

        resolve({
          durationSeconds: totalSeconds,
          durationStr: `${durationMatch[1]}:${durationMatch[2]}:${Math.floor(seconds).toString().padStart(2, '0')}`,
          bitrateKbps: bitrate,
          codec: codec
        });
      } else {
        console.error('Raw FFmpeg output:', output);
        reject(new Error('Could not parse video duration from FFmpeg output. Is the file a valid video?'));
      }
    });
  });
});

// IPC Listener: Run FFmpeg Splitter Process
ipcMain.on('ffmpeg:split', (event, config) => {
  const { ffmpegPath, inputPath, outputDir, segmentTime, totalDuration } = config;

  if (activeFFmpegProcess) {
    event.reply('ffmpeg:error', 'Another FFmpeg task is already running.');
    return;
  }

  if (!fs.existsSync(outputDir)) {
    try {
      fs.mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      event.reply('ffmpeg:error', `Failed to create output directory: ${err.message}`);
      return;
    }
  }

  const fileBaseName = path.basename(inputPath, path.extname(inputPath));
  const fileExt = path.extname(inputPath);
  const outputPattern = path.join(outputDir, `${fileBaseName}_part%03d${fileExt}`);

  // FFmpeg Segment Command:
  // -i input -c copy -map 0 -f segment -segment_time 420 -reset_timestamps 1 output_part%03d.mp4
  const args = [
    '-y', // Overwrite output files without asking
    '-i', inputPath,
    '-c', 'copy',
    '-map', '0',
    '-f', 'segment',
    '-segment_time', String(segmentTime),
    '-reset_timestamps', '1',
    outputPattern
  ];

  mainWindow.webContents.send('ffmpeg:log', `Executing: "${ffmpegPath}" ${args.join(' ')}\n\n`);

  activeFFmpegProcess = spawn(ffmpegPath, args);

  // FFmpeg writes logging information to stderr
  activeFFmpegProcess.stderr.on('data', (data) => {
    const text = data.toString();
    mainWindow.webContents.send('ffmpeg:log', text);

    // Look for progress time: time=00:02:15.50
    const timeMatch = text.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = parseFloat(timeMatch[3]);
      const elapsed = (hours * 3600) + (minutes * 60) + seconds;

      const percent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

      mainWindow.webContents.send('ffmpeg:progress', {
        elapsed: parseFloat(elapsed.toFixed(1)),
        percent: parseFloat(percent.toFixed(1)),
        elapsedStr: `${timeMatch[1]}:${timeMatch[2]}:${Math.floor(seconds).toString().padStart(2, '0')}`
      });
    }
  });

  activeFFmpegProcess.stdout.on('data', (data) => {
    mainWindow.webContents.send('ffmpeg:log', data.toString());
  });

  activeFFmpegProcess.on('error', (err) => {
    activeFFmpegProcess = null;
    mainWindow.webContents.send('ffmpeg:error', `Process error: ${err.message}`);
  });

  activeFFmpegProcess.on('close', (code) => {
    activeFFmpegProcess = null;
    if (code === 0) {
      mainWindow.webContents.send('ffmpeg:done', {
        message: 'Video split successfully completed!',
        outputDir
      });
    } else {
      mainWindow.webContents.send('ffmpeg:done', {
        message: `FFmpeg finished with code ${code}. If you cancelled the split, some files may have been generated.`,
        code
      });
    }
  });
});

// IPC Listener: Kill active FFmpeg execution
ipcMain.on('ffmpeg:kill', (event) => {
  if (activeFFmpegProcess) {
    mainWindow.webContents.send('ffmpeg:log', '\n[System] Terminating active FFmpeg process...\n');
    activeFFmpegProcess.kill('SIGKILL');
    activeFFmpegProcess = null;
  }
});

// IPC Listener: Open secure external links in default browser
ipcMain.handle('link:open', async (event, url) => {
  if (url.startsWith('https://') || url.startsWith('http://')) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

// IPC Handler: Open folder in system file explorer
ipcMain.handle('folder:open', async (event, folderPath) => {
  if (folderPath && fs.existsSync(folderPath)) {
    await shell.openPath(folderPath);
    return true;
  }
  return false;
});
