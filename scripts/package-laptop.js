const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const stagingDir = path.join(rootDir, 'temp-laptop-bundle');
const outputZip = path.join(rootDir, 'public', 'downloads', 'BlastBee-Laptop-App.zip');

console.log('📦 Starting BlastBee Laptop Application Packaging...');

// 1. Clean previous staging directory if exists
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

// 2. Helper to copy directories recursively
function copyDirRecursive(src, dest, filterFn) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (filterFn && !filterFn(srcPath, entry.name)) continue;

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, filterFn);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 3. Copy essential project folders
console.log('Copying application files...');
fs.copyFileSync(path.join(rootDir, 'server.js'), path.join(stagingDir, 'server.js'));
fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(stagingDir, 'package.json'));
if (fs.existsSync(path.join(rootDir, '.env.example'))) {
  fs.copyFileSync(path.join(rootDir, '.env.example'), path.join(stagingDir, '.env.example'));
  fs.copyFileSync(path.join(rootDir, '.env.example'), path.join(stagingDir, '.env'));
}

copyDirRecursive(path.join(rootDir, 'routes'), path.join(stagingDir, 'routes'));
copyDirRecursive(path.join(rootDir, 'services'), path.join(stagingDir, 'services'));
copyDirRecursive(path.join(rootDir, 'database'), path.join(stagingDir, 'database'), (filePath, name) => {
  return !name.endsWith('.db-shm') && !name.endsWith('.db-wal');
});

// Copy public directory but exclude public/downloads/BlastBee-Laptop-App.zip
copyDirRecursive(path.join(rootDir, 'public'), path.join(stagingDir, 'public'), (filePath, name) => {
  return name !== 'BlastBee-Laptop-App.zip';
});

// 4. Create Windows Desktop Launcher & Setup Scripts
console.log('Creating Windows launcher scripts...');

// BlastBee.bat
const blastBeeBat = `@echo off
title BlastBee Desktop - Launching...
cd /d "%~dp0"
echo ====================================================
echo   🐝 BlastBee - Windows Laptop Desktop Application
echo   Developed by Aparaitech Software (aparaitech.org)
echo ====================================================
echo.
echo Starting local BlastBee engine...

:: Open standalone frameless App window via Microsoft Edge or Google Chrome
where msedge >nul 2>nul
if %errorlevel% equ 0 (
    start "" msedge --app=http://localhost:3000
) else (
    where chrome >nul 2>nul
    if %errorlevel% equ 0 (
        start "" chrome --app=http://localhost:3000
    ) else (
        start "" http://localhost:3000
    )
)

call start.bat
`;
fs.writeFileSync(path.join(stagingDir, 'BlastBee.bat'), blastBeeBat, 'utf8');

// Launch-BlastBee.vbs (Silent background launcher)
const launchVbs = `Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "cmd /c BlastBee.bat", 0, False
`;
fs.writeFileSync(path.join(stagingDir, 'Launch-BlastBee.vbs'), launchVbs, 'utf8');

// Create-Desktop-Shortcut.bat
const createShortcutBat = `@echo off
title Create BlastBee Desktop Shortcut
cd /d "%~dp0"
echo ====================================================
echo   Creating BlastBee Desktop Shortcut on your Laptop...
echo ====================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $desktop = [Environment]::GetFolderPath('Desktop'); $s = $ws.CreateShortcut([System.IO.Path]::Combine($desktop, 'BlastBee Email Engine.lnk')); $s.TargetPath = (Join-Path (Get-Location) 'BlastBee.bat'); $s.WorkingDirectory = (Get-Location).Path; $s.Description = 'BlastBee Email Outreach Engine for Windows Laptop'; $s.IconLocation = (Join-Path (Get-Location) 'public\\assets\\logo.svg'); $s.Save(); Write-Host '✅ Desktop Shortcut successfully created on your Windows Desktop!'"
echo.
echo [DONE] You can now launch BlastBee from your Desktop anytime!
echo.
pause
`;
fs.writeFileSync(path.join(stagingDir, 'Create-Desktop-Shortcut.bat'), createShortcutBat, 'utf8');

// start.bat
const startBat = fs.readFileSync(path.join(rootDir, 'start.bat'), 'utf8');
fs.writeFileSync(path.join(stagingDir, 'start.bat'), startBat, 'utf8');

// README_LAPTOP_SETUP.txt
const readmeTxt = `============================================================
  🐝 BlastBee Email Outreach Engine - Windows Laptop App
  Developed by Aparaitech Software (https://aparaitech.org)
============================================================

Thank you for downloading the BlastBee Laptop Desktop Application!

QUICK 2-STEP SETUP:
------------------------------------------------------------
Step 1: Extract this ZIP file into any folder on your laptop
        (e.g., C:\\BlastBee or Documents\\BlastBee).

Step 2: Double-click "Create-Desktop-Shortcut.bat"
        - This puts the "BlastBee Email Engine" shortcut 
          directly on your Windows Desktop.

Step 3: Double-click "BlastBee.bat" or the Desktop Shortcut!
        - BlastBee will launch in a clean, standalone 
          Desktop Application window on your laptop.

DEFAULT LOGIN CREDENTIALS:
------------------------------------------------------------
• SuperAdmin Portal:
  URL: http://localhost:3000/admin
  Email: admin@aparaitech.org
  Password: admin123

• Customer Workspace:
  URL: http://localhost:3000/app
  Email: customer@example.com
  Password: customer123

SYSTEM REQUIREMENTS:
------------------------------------------------------------
• Windows 10 or Windows 11 (64-bit)
• Node.js LTS (https://nodejs.org)
• Internet connection for sending SMTP outreach campaigns

NEED HELP OR APPOINTMENT?
------------------------------------------------------------
WhatsApp Support: +91 9158852129
Email: support@aparaitech.org
Official Portal: https://aparaitech.org
============================================================
`;
fs.writeFileSync(path.join(stagingDir, 'README_LAPTOP_SETUP.txt'), readmeTxt, 'utf8');

// 5. Compress staging directory into public/downloads/BlastBee-Laptop-App.zip
console.log('Compressing into BlastBee-Laptop-App.zip...');
const downloadsDir = path.join(rootDir, 'public', 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

try {
  // Use PowerShell Compress-Archive
  execSync(`powershell -Command "Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${outputZip}' -Force"`, { stdio: 'inherit' });
  const stats = fs.statSync(outputZip);
  console.log(`🎉 BlastBee Laptop Package created successfully! File size: ${(stats.size / 1024).toFixed(1)} KB`);
} catch (err) {
  console.error('Error compressing zip archive:', err.message);
} finally {
  // Cleanup staging directory
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
