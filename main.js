const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fg = require('fast-glob');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: 'LARO Desktop Agent - Evidence Scanner',
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

/**
 * Select folders to scan
 */
ipcMain.handle('select-folders', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections'],
  });

  return result.filePaths;
});

/**
 * Get default scan locations
 */
ipcMain.handle('get-default-locations', () => {
  const homeDir = app.getPath('home');
  const defaultLocations = [
    path.join(homeDir, 'Documents'),
    path.join(homeDir, 'Downloads'),
    path.join(homeDir, 'Desktop'),
  ];

  // Filter to only existing directories
  return defaultLocations.filter(dir => fs.existsSync(dir));
});

/**
 * Scan directories for files
 */
ipcMain.handle('scan-directories', async (event, options) => {
  const { paths, excludePatterns, maxDepth, maxFileSize, caseContext } = options;

  try {
    const allFiles = [];

    for (const scanPath of paths) {
      // File patterns to search for
      const patterns = [
        '**/*.pdf',
        '**/*.docx',
        '**/*.doc',
        '**/*.txt',
        '**/*.jpg',
        '**/*.jpeg',
        '**/*.png',
        '**/*.eml',
        '**/*.msg',
        '**/*.zip',
      ];

      // Default exclusions
      const defaultExclusions = [
        '**/node_modules/**',
        '**/.git/**',
        '**/Library/**',
        '**/AppData/**',
        '**/.npm/**',
        '**/.cache/**',
        '**/temp/**',
        '**/tmp/**',
      ];

      const allExclusions = [...defaultExclusions, ...(excludePatterns || [])];

      // Scan for files
      const files = await fg(patterns, {
        cwd: scanPath,
        ignore: allExclusions,
        deep: maxDepth || 10,
        absolute: true,
        stats: true,
        onlyFiles: true,
      });

      // Process each file
      for (const file of files) {
        const stats = fs.statSync(file);

        // Skip files that are too large
        if (maxFileSize && stats.size > maxFileSize) {
          continue;
        }

        // Extract content and score relevance
        const fileData = {
          path: file,
          name: path.basename(file),
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          extension: path.extname(file),
        };

        // Extract content based on file type
        let content = '';
        try {
          content = await extractContent(file, fileData.extension);
        } catch (error) {
          console.error(`Error extracting content from ${file}:`, error);
          content = '';
        }

        // Score relevance
        const relevanceScore = scoreRelevance(content, fileData, caseContext);

        // Only include files with relevance score > 30
        if (relevanceScore > 30) {
          allFiles.push({
            ...fileData,
            content: content.substring(0, 500), // First 500 chars for preview
            relevanceScore,
          });
        }

        // Send progress update
        event.sender.send('scan-progress', {
          scanned: allFiles.length,
          currentFile: file,
        });
      }
    }

    // Sort by relevance score (highest first)
    allFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      success: true,
      files: allFiles,
      totalScanned: allFiles.length,
    };
  } catch (error) {
    console.error('Scan error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Extract content from file based on type
 */
async function extractContent(filePath, extension) {
  const ext = extension.toLowerCase();

  try {
    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      return data.text;
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } else if (ext === '.txt') {
      return fs.readFileSync(filePath, 'utf-8');
    } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      // For images, we would use OCR (Tesseract.js)
      // For now, return filename as content
      return path.basename(filePath);
    } else {
      return '';
    }
  } catch (error) {
    console.error(`Error extracting ${filePath}:`, error);
    return '';
  }
}

/**
 * Score file relevance based on content and metadata
 */
function scoreRelevance(content, metadata, context) {
  if (!context) return 50; // Default score if no context

  let score = 0;
  const contentLower = content.toLowerCase();

  // Entity matching (40 points)
  if (context.opponentName && contentLower.includes(context.opponentName.toLowerCase())) {
    score += 20;
  }
  if (context.clientName && contentLower.includes(context.clientName.toLowerCase())) {
    score += 10;
  }
  if (context.relevantPeople) {
    context.relevantPeople.forEach(person => {
      if (contentLower.includes(person.toLowerCase())) {
        score += 5;
      }
    });
  }

  // Keyword scoring (30 points)
  const legalKeywords = [
    'contract',
    'termination',
    'employment',
    'salary',
    'dismissal',
    'ontslag',
    'arbeidsovereenkomst',
  ];
  legalKeywords.forEach(keyword => {
    if (contentLower.includes(keyword)) {
      score += 3;
    }
  });

  // File type weight (15 points)
  const ext = metadata.extension.toLowerCase();
  if (['.pdf', '.docx', '.doc'].includes(ext)) {
    score += 15;
  } else if (['.eml', '.msg', '.txt'].includes(ext)) {
    score += 10;
  } else {
    score += 5;
  }

  // Date relevance (10 points)
  if (context.startDate && context.endDate) {
    const fileDate = new Date(metadata.modified);
    const startDate = new Date(context.startDate);
    const endDate = new Date(context.endDate);

    if (fileDate >= startDate && fileDate <= endDate) {
      score += 10;
    } else {
      // Check if within 1 month before/after
      const oneMonthBefore = new Date(startDate);
      oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1);
      const oneMonthAfter = new Date(endDate);
      oneMonthAfter.setMonth(oneMonthAfter.getMonth() + 1);

      if (fileDate >= oneMonthBefore && fileDate <= oneMonthAfter) {
        score += 5;
      }
    }
  }

  return Math.min(score, 100);
}

/**
 * Upload files to LARO cloud
 */
ipcMain.handle('upload-files', async (event, files) => {
  // This would upload files to LARO backend
  // For now, just simulate upload
  for (let i = 0; i < files.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate upload delay

    event.sender.send('upload-progress', {
      current: i + 1,
      total: files.length,
      file: files[i].name,
    });
  }

  return {
    success: true,
    uploaded: files.length,
  };
});

