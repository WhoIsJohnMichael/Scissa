// ==========================================================================
// Application State & Settings
// ==========================================================================
let appState = {
  ffmpegPath: '',
  defaultOutputDir: '',
  inputFile: null, // { filePath, fileName, dirPath, sizeBytes, sizeMB }
  videoMetadata: null, // { durationSeconds, durationStr, bitrateKbps, codec }
  selectedOutputDir: '',
  activeTab: 'size', // 'size' or 'time'
  targetSizeMB: 80,
  targetDurationMins: 5,
  isSplitting: false,
  advancedMode: localStorage.getItem('scissaAdvancedMode') === 'true',
  layoutMode: 'grid', // 'grid' or 'list'
  userSelectedLayout: false
};

// ==========================================================================
// DOM Element Selectors
// ==========================================================================
const elements = {
  // Badges & Banners
  ffmpegStatusBadge: document.getElementById('ffmpeg-status-badge'),
  ffmpegAlertBanner: document.getElementById('ffmpeg-alert-banner'),
  btnConfigureFfmpeg: document.getElementById('btn-configure-ffmpeg'),
  
  // Settings Modal
  btnSettingsToggle: document.getElementById('btn-settings-toggle'),
  settingsModal: document.getElementById('settings-modal'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  inputFfmpegPath: document.getElementById('input-ffmpeg-path'),
  btnBrowseFfmpeg: document.getElementById('btn-browse-ffmpeg'),
  btnSaveSettings: document.getElementById('btn-save-settings'),

  // Dropzone & Load Video
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  btnBrowseFile: document.getElementById('btn-browse-file'),
  
  // Video Details Card
  videoDetailsCard: document.getElementById('video-details-card'),
  videoFilename: document.getElementById('video-filename'),
  videoCodec: document.getElementById('video-codec'),
  videoSize: document.getElementById('video-size'),
  videoDuration: document.getElementById('video-duration'),
  videoBitrate: document.getElementById('video-bitrate'),
  videoSizePerMin: document.getElementById('video-size-per-min'),
  btnRemoveVideo: document.getElementById('btn-remove-video'),

  // Config Panels
  tabSplitSize: document.getElementById('tab-split-size'),
  tabSplitTime: document.getElementById('tab-split-time'),
  panelSizeConfig: document.getElementById('panel-size-config'),
  panelTimeConfig: document.getElementById('panel-time-config'),
  
  inputTargetSize: document.getElementById('input-target-size'),
  sliderTargetSize: document.getElementById('slider-target-size'),
  
  inputTargetDuration: document.getElementById('input-target-duration'),
  sliderTargetDuration: document.getElementById('slider-target-duration'),
  
  outputFolderPath: document.getElementById('output-folder-path'),
  btnBrowseFolder: document.getElementById('btn-browse-folder'),

  // Blueprint Preview & Calculations
  blueprintPlaceholder: document.getElementById('blueprint-placeholder'),
  videoBlueprintCard: document.getElementById('video-blueprint-card'),
  mathCalcBitrate: document.getElementById('math-calc-bitrate'),
  mathCalcInterval: document.getElementById('math-calc-interval'),
  estimatedSegmentsCount: document.getElementById('estimated-segments-count'),
  segmentMapGrid: document.getElementById('segment-map-grid'),
  btnLayoutGrid: document.getElementById('btn-layout-grid'),
  btnLayoutList: document.getElementById('btn-layout-list'),

  // Splitting Controls & Progress
  executionIdleState: document.getElementById('execution-idle-state'),
  executionActiveState: document.getElementById('execution-active-state'),
  btnStartSplit: document.getElementById('btn-start-split'),
  btnCancelSplit: document.getElementById('btn-cancel-split'),
  
  progressBarFill: document.getElementById('progress-bar-fill'),
  progressPercent: document.getElementById('progress-percent'),
  progressElapsedStr: document.getElementById('progress-elapsed-str'),
  progressTotalStr: document.getElementById('progress-total-str'),

  // Console Drawer
  consoleDrawer: document.getElementById('console-drawer'),
  consoleBody: document.querySelector('.console-body'),
  btnConsoleToggle: document.getElementById('btn-console-toggle'),
  btnClearConsole: document.getElementById('btn-clear-console'),
  consoleLogs: document.getElementById('console-logs')
};

// ==========================================================================
// Initialization & Settings Management
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadApplicationSettings();
  
  // Sync Advanced Mode UI on boot
  updateAdvancedModeUI();
  
  // Show Onboarding Wizard automatically if not completed
  const onboardingCompleted = localStorage.getItem('scissaOnboardingCompleted') === 'true';
  if (!onboardingCompleted) {
    document.getElementById('onboarding-modal').classList.remove('hidden');
  }
});

async function loadApplicationSettings() {
  try {
    const settings = await window.api.loadSettings();
    if (settings) {
      if (settings.ffmpegPath) {
        appState.ffmpegPath = settings.ffmpegPath;
        elements.inputFfmpegPath.value = settings.ffmpegPath;
        
        // Update badge
        elements.ffmpegStatusBadge.className = 'badge badge-success';
        elements.ffmpegStatusBadge.innerHTML = '<span class="badge-dot"></span> FFmpeg: Configured';
        
        // Hide alert banner
        elements.ffmpegAlertBanner.classList.add('hidden');
      } else {
        // Prompt user
        elements.ffmpegStatusBadge.className = 'badge badge-warning';
        elements.ffmpegStatusBadge.innerHTML = '<span class="badge-dot"></span> FFmpeg: Not Configured';
        elements.ffmpegAlertBanner.classList.remove('hidden');
      }

      if (settings.defaultOutputDir) {
        appState.defaultOutputDir = settings.defaultOutputDir;
        document.getElementById('input-default-output-path').value = settings.defaultOutputDir;
      } else {
        appState.defaultOutputDir = '';
        document.getElementById('input-default-output-path').value = '';
      }
    }
  } catch (err) {
    writeLog(`[Error] Failed to load settings: ${err.message}\n`);
  }
}

async function saveApplicationSettings() {
  const newPath = elements.inputFfmpegPath.value.trim();
  const defaultOut = document.getElementById('input-default-output-path').value.trim();
  appState.ffmpegPath = newPath;
  appState.defaultOutputDir = defaultOut;
  
  const success = await window.api.saveSettings({ 
    ffmpegPath: newPath,
    defaultOutputDir: defaultOut
  });
  if (success) {
    elements.settingsModal.classList.add('hidden');
    await loadApplicationSettings();
    writeLog(`[Settings] Settings updated successfully\n`);
    
    // Re-probe video if already loaded
    if (appState.inputFile) {
      await handleVideoSelected(appState.inputFile.filePath);
    }
  } else {
    alert('Failed to save settings. Please verify permissions.');
  }
}

// ==========================================================================
// Event Listeners Routing Setup
// ==========================================================================
function setupEventListeners() {
  // Settings Modal toggling
  elements.btnSettingsToggle.addEventListener('click', () => {
    elements.settingsModal.classList.remove('hidden');
  });
  elements.btnCloseSettings.addEventListener('click', () => {
    elements.settingsModal.classList.add('hidden');
  });
  elements.btnConfigureFfmpeg.addEventListener('click', () => {
    elements.settingsModal.classList.remove('hidden');
  });
  elements.btnBrowseFfmpeg.addEventListener('click', async () => {
    const filePath = await window.api.selectFFmpeg();
    if (filePath) {
      elements.inputFfmpegPath.value = filePath;
    }
  });
  document.getElementById('btn-browse-default-output').addEventListener('click', async () => {
    const dir = await window.api.selectFolder();
    if (dir) {
      document.getElementById('input-default-output-path').value = dir;
    }
  });
  elements.btnSaveSettings.addEventListener('click', saveApplicationSettings);

  // File loading events
  elements.btnBrowseFile.addEventListener('click', async () => {
    try {
      const fileData = await window.api.selectFile();
      if (fileData) {
        appState.inputFile = fileData;
        await handleVideoSelected(fileData.filePath);
      }
    } catch (err) {
      alert(`Error loading file: ${err.message}`);
    }
  });

  elements.btnRemoveVideo.addEventListener('click', () => {
    resetVideoSource();
  });

  // HTML5 Drag and drop events
  elements.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropzone.classList.add('dragover');
  });
  elements.dropzone.addEventListener('dragleave', () => {
    elements.dropzone.classList.remove('dragover');
  });
  elements.dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    elements.dropzone.classList.remove('dragover');
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const filePath = file.path; // Absolute path exposed in Electron
      
      // Basic check if it is a video (by extension or mime)
      if (filePath) {
        writeLog(`[Dropzone] File dropped: ${filePath}\n`);
        
        // Simulating the file select structure
        appState.inputFile = {
          filePath,
          fileName: file.name,
          dirPath: filePath.substring(0, filePath.lastIndexOf('\\')),
          sizeBytes: file.size,
          sizeMB: parseFloat((file.size / (1024 * 1024)).toFixed(2))
        };
        
        await handleVideoSelected(filePath);
      }
    }
  });

  // Config sliders and number boxes sync
  // Size Sliders
  elements.sliderTargetSize.addEventListener('input', () => {
    elements.inputTargetSize.value = elements.sliderTargetSize.value;
    appState.targetSizeMB = parseInt(elements.sliderTargetSize.value, 10);
    recalculateBlueprint();
  });
  elements.inputTargetSize.addEventListener('input', () => {
    let val = parseInt(elements.inputTargetSize.value, 10) || 10;
    val = Math.max(1, Math.min(10000, val));
    elements.sliderTargetSize.value = val;
    appState.targetSizeMB = val;
    recalculateBlueprint();
  });

  // Duration Sliders
  elements.sliderTargetDuration.addEventListener('input', () => {
    elements.inputTargetDuration.value = elements.sliderTargetDuration.value;
    appState.targetDurationMins = parseInt(elements.sliderTargetDuration.value, 10);
    recalculateBlueprint();
  });
  elements.inputTargetDuration.addEventListener('input', () => {
    let val = parseInt(elements.inputTargetDuration.value, 10) || 1;
    val = Math.max(1, Math.min(600, val));
    elements.sliderTargetDuration.value = val;
    appState.targetDurationMins = val;
    recalculateBlueprint();
  });

  // Tabs toggle
  elements.tabSplitSize.addEventListener('click', () => {
    elements.tabSplitSize.classList.add('active');
    elements.tabSplitTime.classList.remove('active');
    elements.panelSizeConfig.classList.remove('hidden');
    elements.panelTimeConfig.classList.add('hidden');
    appState.activeTab = 'size';
    recalculateBlueprint();
  });
  
  elements.tabSplitTime.addEventListener('click', () => {
    elements.tabSplitTime.classList.add('active');
    elements.tabSplitSize.classList.remove('active');
    elements.panelTimeConfig.classList.remove('hidden');
    elements.panelSizeConfig.classList.add('hidden');
    appState.activeTab = 'time';
    recalculateBlueprint();
  });

  // Output folder dialog browser
  elements.btnBrowseFolder.addEventListener('click', async () => {
    const dir = await window.api.selectFolder();
    if (dir) {
      appState.selectedOutputDir = dir;
      elements.outputFolderPath.value = dir;
      elements.outputFolderPath.title = dir;
      writeLog(`[Output] Output folder changed to: ${dir}\n`);
    }
  });

  // Output folder manual typing listener
  elements.outputFolderPath.addEventListener('input', () => {
    appState.selectedOutputDir = elements.outputFolderPath.value.trim();
  });

  // Splitting execution controls
  elements.btnStartSplit.addEventListener('click', startSplitProcess);
  elements.btnCancelSplit.addEventListener('click', cancelSplitProcess);

  // Console Toggler
  elements.btnConsoleToggle.addEventListener('click', () => {
    elements.consoleDrawer.classList.toggle('expanded');
    elements.consoleDrawer.classList.toggle('collapsed');
  });

  elements.btnClearConsole.addEventListener('click', () => {
    elements.consoleLogs.textContent = 'Console logs cleared...\n';
  });

  // Electron IPC Listeners
  window.api.onLog((text) => {
    writeLog(text);
  });

  window.api.onProgress((prog) => {
    updateProgressUI(prog);
  });

  window.api.onDone((result) => {
    handleSplitDone(result);
  });

  window.api.onError((errStr) => {
    handleSplitError(errStr);
  });

  // Onboarding Wizard Event Listeners
  const onboardingModal = document.getElementById('onboarding-modal');
  const step1 = document.getElementById('onboarding-step-1');
  const step2 = document.getElementById('onboarding-step-2');
  const step3 = document.getElementById('onboarding-step-3');

  document.getElementById('btn-onboarding-next-1').addEventListener('click', () => {
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    const onboardingFfmpegInput = document.getElementById('input-onboarding-ffmpeg-path');
    onboardingFfmpegInput.value = appState.ffmpegPath || '';
    updateOnboardingFfmpegStatus(appState.ffmpegPath);
  });

  document.getElementById('btn-onboarding-back-2').addEventListener('click', () => {
    step2.classList.add('hidden');
    step1.classList.remove('hidden');
  });

  document.getElementById('btn-onboarding-next-2').addEventListener('click', () => {
    if (!appState.ffmpegPath) {
      alert('Please configure your local ffmpeg.exe path to proceed.');
      return;
    }
    step2.classList.add('hidden');
    step3.classList.remove('hidden');
  });

  document.getElementById('btn-onboarding-back-3').addEventListener('click', () => {
    step3.classList.add('hidden');
    step2.classList.remove('hidden');
  });

  document.getElementById('btn-onboarding-finish').addEventListener('click', () => {
    localStorage.setItem('scissaOnboardingCompleted', 'true');
    onboardingModal.classList.add('hidden');
  });

  document.getElementById('btn-onboarding-browse-ffmpeg').addEventListener('click', async () => {
    const filePath = await window.api.selectFFmpeg();
    if (filePath) {
      document.getElementById('input-onboarding-ffmpeg-path').value = filePath;
      elements.inputFfmpegPath.value = filePath;
      
      appState.ffmpegPath = filePath;
      const success = await window.api.saveSettings({ ffmpegPath: filePath });
      if (success) {
        await loadApplicationSettings();
        updateOnboardingFfmpegStatus(filePath);
      }
    }
  });

  document.getElementById('btn-replay-onboarding').addEventListener('click', () => {
    elements.settingsModal.classList.add('hidden');
    
    step2.classList.add('hidden');
    step3.classList.add('hidden');
    step1.classList.remove('hidden');
    
    onboardingModal.classList.remove('hidden');
  });

  // Advanced Mode Toggle Listener
  const toggleAdvancedMode = document.getElementById('toggle-advanced-mode');
  if (toggleAdvancedMode) {
    toggleAdvancedMode.addEventListener('change', (e) => {
      appState.advancedMode = e.target.checked;
      localStorage.setItem('scissaAdvancedMode', String(e.target.checked));
      updateAdvancedModeUI();
    });
  }

  // Privacy Policy Modal Listeners
  const privacyModal = document.getElementById('privacy-modal');
  document.getElementById('btn-privacy-toggle').addEventListener('click', () => {
    elements.settingsModal.classList.add('hidden'); // Close settings
    privacyModal.classList.remove('hidden'); // Open privacy modal
  });
  document.getElementById('btn-close-privacy').addEventListener('click', () => {
    privacyModal.classList.add('hidden');
  });
  document.getElementById('btn-agree-privacy').addEventListener('click', () => {
    privacyModal.classList.add('hidden');
  });

  // Donation Button Listeners
  document.getElementById('btn-donate').addEventListener('click', () => {
    window.api.openLink('https://ko-fi.com/atlastdev'); // Atlastdev Ko-fi donation link
  });
  
  // Header Heart Donation Button
  document.getElementById('btn-donate-header').addEventListener('click', () => {
    window.api.openLink('https://ko-fi.com/atlastdev');
  });

  // Layout Toggle Listeners
  elements.btnLayoutGrid.addEventListener('click', () => {
    appState.layoutMode = 'grid';
    appState.userSelectedLayout = true;
    updateLayoutUI();
  });
  elements.btnLayoutList.addEventListener('click', () => {
    appState.layoutMode = 'list';
    appState.userSelectedLayout = true;
    updateLayoutUI();
  });
}

// ==========================================================================
// Video Load & Probing Functions
// ==========================================================================
async function handleVideoSelected(filePath) {
  if (!appState.ffmpegPath) {
    elements.settingsModal.classList.remove('hidden');
    alert('Please configure your local ffmpeg.exe path first.');
    resetVideoSource();
    return;
  }

  // Display Loading details
  writeLog(`[Prober] Reading video metadata for: ${filePath}...\n`);
  
  try {
    const metadata = await window.api.probeVideo(appState.ffmpegPath, filePath);
    appState.videoMetadata = metadata;

    // Set Default Output Folder
    const baseName = appState.inputFile.fileName.substring(0, appState.inputFile.fileName.lastIndexOf('.'));
    if (appState.defaultOutputDir) {
      appState.selectedOutputDir = `${appState.defaultOutputDir}\\${baseName}_segments`;
    } else {
      appState.selectedOutputDir = `${appState.inputFile.dirPath}\\${baseName}_segments`;
    }
    
    // Update Video Details Card UI
    elements.videoFilename.textContent = appState.inputFile.fileName;
    elements.videoCodec.textContent = metadata.codec;
    elements.videoSize.textContent = `${appState.inputFile.sizeMB.toFixed(2)} MB`;
    elements.videoDuration.textContent = metadata.durationStr;
    elements.videoBitrate.textContent = metadata.bitrateKbps ? `${metadata.bitrateKbps} kbps` : 'Unknown';
    
    // Size Per Minute Calculation
    const durationMins = metadata.durationSeconds / 60;
    const mbPerMin = appState.inputFile.sizeMB / durationMins;
    elements.videoSizePerMin.textContent = `${mbPerMin.toFixed(2)} MB/min`;

    // Swap UI dropzone with Video details card
    elements.dropzone.classList.add('hidden');
    elements.videoDetailsCard.classList.remove('hidden');
    
    // Enable inputs
    elements.btnBrowseFolder.removeAttribute('disabled');
    elements.outputFolderPath.value = appState.selectedOutputDir;
    elements.outputFolderPath.title = appState.selectedOutputDir;
    
    // Swap blueprint panel
    elements.blueprintPlaceholder.classList.add('hidden');
    elements.videoBlueprintCard.classList.remove('hidden');

    recalculateBlueprint();
    writeLog(`[Prober] Metadata parsed successfully. Duration: ${metadata.durationStr} (${metadata.durationSeconds.toFixed(1)}s), Codec: ${metadata.codec}\n`);

  } catch (err) {
    writeLog(`[Error] Prober error: ${err.message}\n`);
    alert(`Could not probe video file: ${err.message}`);
    resetVideoSource();
  }
}

function resetVideoSource() {
  appState.inputFile = null;
  appState.videoMetadata = null;
  appState.selectedOutputDir = '';
  
  // Revert UI cards
  elements.dropzone.classList.remove('hidden');
  elements.videoDetailsCard.classList.add('hidden');
  
  elements.btnBrowseFolder.setAttribute('disabled', 'true');
  elements.outputFolderPath.value = '';
  elements.outputFolderPath.title = '';
  
  elements.blueprintPlaceholder.classList.remove('hidden');
  elements.videoBlueprintCard.classList.add('hidden');
}

// ==========================================================================
// Mathematics Calculation & Blueprint Mapping
// ==========================================================================
function recalculateBlueprint() {
  if (!appState.inputFile || !appState.videoMetadata) return;

  const totalSizeMB = appState.inputFile.sizeMB;
  const totalDurationSec = appState.videoMetadata.durationSeconds;
  
  // Average size rate: MB/sec
  const mbPerSec = totalSizeMB / totalDurationSec;
  const mbPerMin = mbPerSec * 60;
  
  elements.mathCalcBitrate.innerHTML = `${totalSizeMB.toFixed(1)} MB / ${(totalDurationSec/60).toFixed(1)} mins = <strong>${mbPerMin.toFixed(2)} MB/min</strong>`;

  let segmentTimeSec = 0;
  let segmentSizeMB = 0;

  if (appState.activeTab === 'size') {
    // Math logic: Target Size / Bitrate = Target Duration
    segmentSizeMB = appState.targetSizeMB;
    segmentTimeSec = segmentSizeMB / mbPerSec;
    
    // Prevent duration overflowing total video length
    if (segmentTimeSec > totalDurationSec) {
      segmentTimeSec = totalDurationSec;
    }
    
    const minutesStr = (segmentTimeSec / 60).toFixed(1);
    elements.mathCalcInterval.innerHTML = `${segmentSizeMB} MB / ${mbPerMin.toFixed(2)} MB/min ≈ <strong>${minutesStr} minutes (${Math.round(segmentTimeSec)}s)</strong>`;
  } else {
    // Math logic: Target Duration * Bitrate = Target Size
    segmentTimeSec = appState.targetDurationMins * 60;
    
    if (segmentTimeSec > totalDurationSec) {
      segmentTimeSec = totalDurationSec;
    }
    
    segmentSizeMB = segmentTimeSec * mbPerSec;
    const minutesStr = (segmentTimeSec / 60).toFixed(1);
    elements.mathCalcInterval.innerHTML = `${minutesStr} mins × ${mbPerMin.toFixed(2)} MB/min ≈ <strong>${segmentSizeMB.toFixed(1)} MB (${Math.round(segmentTimeSec)}s)</strong>`;
  }

  // Segment generation preview blueprint
  generateSegmentCards(totalDurationSec, segmentTimeSec, segmentSizeMB);
}

function generateSegmentCards(totalDurationSec, segmentTimeSec, segmentSizeMB) {
  elements.segmentMapGrid.innerHTML = '';
  
  if (segmentTimeSec <= 0) return;

  const numSegments = Math.ceil(totalDurationSec / segmentTimeSec);
  elements.estimatedSegmentsCount.textContent = `${numSegments} Segment${numSegments > 1 ? 's' : ''}`;

  // Auto-switch to list layout if there are more than 6 segments
  // and the user hasn't explicitly clicked a layout preference yet.
  if (!appState.userSelectedLayout) {
    if (numSegments > 6) {
      appState.layoutMode = 'list';
    } else {
      appState.layoutMode = 'grid';
    }
  }
  updateLayoutUI();
  
  for (let i = 0; i < numSegments; i++) {
    const startTimeSec = i * segmentTimeSec;
    let durationSec = segmentTimeSec;
    let isRemainder = false;

    // Last segment might be a shorter remainder
    if (startTimeSec + durationSec > totalDurationSec) {
      durationSec = totalDurationSec - startTimeSec;
      isRemainder = true;
    }

    const estSizeMB = durationSec * (appState.inputFile.sizeMB / totalDurationSec);

    // Formatted times
    const startStr = formatSecondsToTime(startTimeSec);
    const endStr = formatSecondsToTime(startTimeSec + durationSec);
    
    const segmentCard = document.createElement('div');
    segmentCard.className = `segment-blueprint-card ${isRemainder ? 'remainder' : ''}`;
    
    segmentCard.innerHTML = `
      <div class="segment-num-row">
        <span class="segment-num">Segment ${i + 1}</span>
        <span class="segment-pill">${isRemainder ? 'Last Part' : 'Full Segment'}</span>
      </div>
      <div class="segment-sz">~${estSizeMB.toFixed(0)} MB</div>
      <div class="segment-dur">${Math.round(durationSec / 60)} mins</div>
      <div class="segment-timeframe">${startStr} &rarr; ${endStr}</div>
    `;
    
    elements.segmentMapGrid.appendChild(segmentCard);
  }

  // Attach segmentTimeSec to the state to be used during the execution trigger
  appState.finalSegmentTimeSec = Math.round(segmentTimeSec);
}

function formatSecondsToTime(secondsTotal) {
  const hours = Math.floor(secondsTotal / 3600);
  const minutes = Math.floor((secondsTotal % 3600) / 60);
  const seconds = Math.floor(secondsTotal % 60);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ==========================================================================
// Splitting Execution Engine Interface
// ==========================================================================
function startSplitProcess() {
  if (appState.isSplitting) return;
  if (!appState.inputFile || !appState.videoMetadata) {
    alert('Please select a video file first.');
    return;
  }
  if (!appState.ffmpegPath) {
    alert('Please configure ffmpeg.exe path first.');
    return;
  }

  // Lock UI and toggle states
  appState.isSplitting = true;
  elements.executionIdleState.classList.add('hidden');
  elements.executionActiveState.classList.remove('hidden');
  
  // Reset Progress elements
  elements.progressBarFill.style.width = '0%';
  elements.progressPercent.textContent = '0.0%';
  elements.progressElapsedStr.textContent = '00:00:00';
  elements.progressTotalStr.textContent = appState.videoMetadata.durationStr;
  
  // Expand logs Drawer for visibility
  elements.consoleDrawer.classList.remove('collapsed');
  elements.consoleDrawer.classList.add('expanded');
  
  writeLog(`[Core] Initiating video splitting process...\n`);
  writeLog(`[Core] Target Segment Duration: ${appState.finalSegmentTimeSec} seconds\n`);
  writeLog(`[Core] Output Directory: ${appState.selectedOutputDir}\n`);

  // Request native thread execution
  window.api.runSplit({
    ffmpegPath: appState.ffmpegPath,
    inputPath: appState.inputFile.filePath,
    outputDir: appState.selectedOutputDir,
    segmentTime: appState.finalSegmentTimeSec,
    totalDuration: appState.videoMetadata.durationSeconds
  });
}

function cancelSplitProcess() {
  if (!appState.isSplitting) return;
  writeLog(`[Core] User requested process cancellation...\n`);
  window.api.killSplit();
}

function updateProgressUI(progress) {
  // progress = { elapsed: sec, percent: float, elapsedStr: HH:MM:SS }
  elements.progressBarFill.style.width = `${progress.percent}%`;
  elements.progressPercent.textContent = `${progress.percent.toFixed(1)}%`;
  elements.progressElapsedStr.textContent = progress.elapsedStr;
}

function handleSplitDone(result) {
  // Force progress bar to 100% visually
  elements.progressBarFill.style.width = '100%';
  elements.progressPercent.textContent = '100.0%';
  
  // Small delay so users see the 100% fill before switching state
  setTimeout(() => {
    appState.isSplitting = false;
    elements.executionActiveState.classList.add('hidden');
    elements.executionIdleState.classList.remove('hidden');

    writeLog(`\n[Core] Done! ${result.message}\n`);
    
    if (result.outputDir) {
      writeLog(`[Core] Output location: ${result.outputDir}\n`);
      showSuccessModal(result.outputDir, result.message);
    }
  }, 600);
}

function showSuccessModal(outputDir, message) {
  const modal = document.getElementById('success-modal');
  const outputFolderSpan = document.getElementById('success-output-folder');
  const messageEl = document.getElementById('success-message');
  
  // Set content
  outputFolderSpan.textContent = outputDir;
  outputFolderSpan.title = outputDir;
  messageEl.textContent = message || 'Your video has been split successfully.';
  
  // Re-trigger the SVG animations by cloning and replacing the SVG
  const svgContainer = modal.querySelector('.success-checkmark-ring');
  const oldSvg = svgContainer.querySelector('.success-checkmark-svg');
  const newSvg = oldSvg.cloneNode(true);
  svgContainer.replaceChild(newSvg, oldSvg);
  
  // Show modal
  modal.classList.remove('hidden');
  
  // Wire up buttons (use one-time listeners to avoid stacking)
  const openBtn = document.getElementById('btn-success-open-folder');
  const closeBtn = document.getElementById('btn-success-close');
  
  const handleOpen = () => {
    window.api.openFolder(outputDir);
    modal.classList.add('hidden');
    openBtn.removeEventListener('click', handleOpen);
    closeBtn.removeEventListener('click', handleClose);
  };
  
  const handleClose = () => {
    modal.classList.add('hidden');
    openBtn.removeEventListener('click', handleOpen);
    closeBtn.removeEventListener('click', handleClose);
  };
  
  openBtn.addEventListener('click', handleOpen);
  closeBtn.addEventListener('click', handleClose);
}

function handleSplitError(errStr) {
  appState.isSplitting = false;
  elements.executionActiveState.classList.add('hidden');
  elements.executionIdleState.classList.remove('hidden');

  writeLog(`\n[Error] ${errStr}\n`);
  alert(`Splitting Error:\n${errStr}`);
}

// ==========================================================================
// Log Writer Terminal Helper
// ==========================================================================
function writeLog(text) {
  elements.consoleLogs.textContent += text;
  // Automatically scroll console body to bottom
  const body = elements.consoleBody;
  if (body) {
    body.scrollTop = body.scrollHeight;
  }
}

function updateOnboardingFfmpegStatus(path) {
  const statusText = document.getElementById('onboarding-ffmpeg-status-text');
  if (path) {
    statusText.className = 'field-desc mt-2 text-success';
    statusText.innerHTML = '<strong>FFmpeg is configured and active!</strong>';
  } else {
    statusText.className = 'field-desc mt-2 text-danger';
    statusText.innerHTML = '<strong>FFmpeg path is required to continue.</strong>';
  }
}

function updateAdvancedModeUI() {
  const isAdvanced = appState.advancedMode;
  
  // Sync toggle checkbox state
  const toggleCheckbox = document.getElementById('toggle-advanced-mode');
  if (toggleCheckbox) {
    toggleCheckbox.checked = isAdvanced;
  }
  
  // Toggle advanced-only elements (fades them in/out cleanly)
  const advancedElements = document.querySelectorAll('.advanced-only');
  advancedElements.forEach(el => {
    if (isAdvanced) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
  
  // Toggle console drawer
  const consoleDrawer = document.getElementById('console-drawer');
  if (consoleDrawer) {
    if (isAdvanced) {
      consoleDrawer.classList.remove('hidden');
    } else {
      consoleDrawer.classList.add('hidden');
    }
  }
}

function updateLayoutUI() {
  if (appState.layoutMode === 'list') {
    elements.segmentMapGrid.classList.add('list-view');
    elements.btnLayoutList.classList.add('active');
    elements.btnLayoutGrid.classList.remove('active');
  } else {
    elements.segmentMapGrid.classList.remove('list-view');
    elements.btnLayoutGrid.classList.add('active');
    elements.btnLayoutList.classList.remove('active');
  }
}
