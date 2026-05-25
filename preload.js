const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Config & Settings
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // File & Folder Pickers
  selectFile: () => ipcRenderer.invoke('dialog:select-file'),
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  selectFFmpeg: () => ipcRenderer.invoke('dialog:select-ffmpeg'),

  // Video Inspection
  probeVideo: (ffmpegPath, filePath) => ipcRenderer.invoke('video:probe', { ffmpegPath, filePath }),

  // FFmpeg Runner
  runSplit: (config) => ipcRenderer.send('ffmpeg:split', config),
  killSplit: () => ipcRenderer.send('ffmpeg:kill'),

  // Event Listeners for Runner Progress
  onLog: (callback) => ipcRenderer.on('ffmpeg:log', (event, data) => callback(data)),
  onProgress: (callback) => ipcRenderer.on('ffmpeg:progress', (event, data) => callback(data)),
  onDone: (callback) => ipcRenderer.on('ffmpeg:done', (event, data) => callback(data)),
  onError: (callback) => ipcRenderer.on('ffmpeg:error', (event, data) => callback(data)),

  // Open secure external links
  openLink: (url) => ipcRenderer.invoke('link:open', url),
  
  // Open folder in system file explorer
  openFolder: (folderPath) => ipcRenderer.invoke('folder:open', folderPath),

  // Cleanup listeners
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('ffmpeg:log');
    ipcRenderer.removeAllListeners('ffmpeg:progress');
    ipcRenderer.removeAllListeners('ffmpeg:done');
    ipcRenderer.removeAllListeners('ffmpeg:error');
  }
});
