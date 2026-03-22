const { ipcRenderer } = require('electron');

// State
let selectedFolders = [];
let scanResults = [];
let scanStartTime = null;
let scanInterval = null;

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  console.log('LARO Desktop Agent initialized');
});

/**
 * Add folder to scan list
 */
async function addFolder() {
  const folders = await ipcRenderer.invoke('select-folders');
  
  if (folders && folders.length > 0) {
    selectedFolders.push(...folders);
    updateFolderList();
  }
}

/**
 * Use default scan locations
 */
async function useDefaults() {
  const defaults = await ipcRenderer.invoke('get-default-locations');
  selectedFolders = defaults;
  updateFolderList();
}

/**
 * Update folder list UI
 */
function updateFolderList() {
  const list = document.getElementById('folder-list');
  list.innerHTML = '';

  selectedFolders.forEach((folder, index) => {
    const li = document.createElement('li');
    li.className = 'folder-item';
    li.innerHTML = `
      <span class="folder-path">${folder}</span>
      <button class="remove-btn" onclick="removeFolder(${index})">Remove</button>
    `;
    list.appendChild(li);
  });

  // Enable start button if folders selected
  document.getElementById('start-scan-btn').disabled = selectedFolders.length === 0;
}

/**
 * Remove folder from scan list
 */
function removeFolder(index) {
  selectedFolders.splice(index, 1);
  updateFolderList();
}

/**
 * Start scanning
 */
async function startScan() {
  // Switch to scanning screen
  showScreen('screen-scanning');

  // Reset stats
  scanStartTime = Date.now();
  let filesScanned = 0;
  let relevantFound = 0;

  // Start timer
  scanInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - scanStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById('scan-time').textContent = 
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, 1000);

  // Listen for progress updates
  ipcRenderer.on('scan-progress', (event, data) => {
    filesScanned++;
    relevantFound = data.scanned;

    document.getElementById('files-scanned').textContent = filesScanned.toLocaleString();
    document.getElementById('relevant-found').textContent = relevantFound.toLocaleString();
    document.getElementById('current-file').textContent = data.currentFile;

    // Update progress bar (estimate)
    const progress = Math.min((filesScanned / 1000) * 100, 95);
    document.getElementById('scan-progress-fill').style.width = `${progress}%`;
  });

  // Case context (this would come from LARO web app)
  const caseContext = {
    opponentName: 'ABC BV',
    clientName: 'John Doe',
    relevantPeople: ['Jan de Vries', 'Manager'],
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
  };

  // Start scan
  const result = await ipcRenderer.invoke('scan-directories', {
    paths: selectedFolders,
    excludePatterns: [],
    maxDepth: 10,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    caseContext,
  });

  // Stop timer
  clearInterval(scanInterval);

  // Complete progress bar
  document.getElementById('scan-progress-fill').style.width = '100%';

  if (result.success) {
    scanResults = result.files;
    showResults();
  } else {
    alert(`Scan error: ${result.error}`);
    showScreen('screen-folders');
  }
}

/**
 * Stop scanning
 */
function stopScan() {
  clearInterval(scanInterval);
  showScreen('screen-folders');
}

/**
 * Show scan results
 */
function showResults() {
  showScreen('screen-results');

  document.getElementById('total-relevant').textContent = scanResults.length.toLocaleString();

  const resultsList = document.getElementById('results-list');
  resultsList.innerHTML = '';

  scanResults.forEach(file => {
    const div = document.createElement('div');
    div.className = 'file-item';

    // Determine relevance badge
    let badgeClass = 'relevance-low';
    let badgeText = 'Low';
    if (file.relevanceScore >= 70) {
      badgeClass = 'relevance-high';
      badgeText = 'High';
    } else if (file.relevanceScore >= 50) {
      badgeClass = 'relevance-medium';
      badgeText = 'Medium';
    }

    div.innerHTML = `
      <div class="file-name">
        ${file.name}
        <span class="relevance-badge ${badgeClass}">${badgeText} (${file.relevanceScore})</span>
      </div>
      <div class="file-meta">
        <span>📁 ${file.path}</span>
        <span>📏 ${formatFileSize(file.size)}</span>
        <span>📅 ${new Date(file.modified).toLocaleDateString()}</span>
      </div>
    `;

    resultsList.appendChild(div);
  });
}

/**
 * Upload files to LARO
 */
async function uploadFiles() {
  showScreen('screen-uploading');

  document.getElementById('total-files').textContent = scanResults.length;
  document.getElementById('files-uploaded').textContent = '0';

  // Listen for upload progress
  ipcRenderer.on('upload-progress', (event, data) => {
    document.getElementById('files-uploaded').textContent = data.current;
    document.getElementById('current-upload-file').textContent = `Uploading: ${data.file}`;

    const progress = (data.current / data.total) * 100;
    document.getElementById('upload-progress-fill').style.width = `${progress}%`;
  });

  // Start upload
  const result = await ipcRenderer.invoke('upload-files', scanResults);

  if (result.success) {
    showComplete(result.uploaded);
  } else {
    alert('Upload failed');
    showScreen('screen-results');
  }
}

/**
 * Show upload complete screen
 */
function showComplete(count) {
  showScreen('screen-complete');
  document.getElementById('uploaded-count').textContent = count.toLocaleString();
}

/**
 * Start new scan
 */
function newScan() {
  selectedFolders = [];
  scanResults = [];
  showScreen('screen-folders');
  updateFolderList();
}

/**
 * Close app
 */
function closeApp() {
  window.close();
}

/**
 * Show specific screen
 */
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

