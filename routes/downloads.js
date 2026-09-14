const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const laptopExePath = path.join(__dirname, '..', 'public', 'downloads', 'BlastBee-Laptop-Setup.exe');
const fallbackZipPath = path.join(__dirname, '..', 'public', 'downloads', 'BlastBee-Laptop-App.zip');

// GET /api/download/app or /api/download/laptop-app - Download BlastBee Laptop Application (.exe installer)
const handleAppDownload = (req, res) => {
  if (fs.existsSync(laptopExePath)) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="BlastBee-Laptop-Setup.exe"');
    res.download(laptopExePath, 'BlastBee-Laptop-Setup.exe', (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ success: false, message: 'Could not download BlastBee Laptop Application' });
      }
    });
  } else if (fs.existsSync(fallbackZipPath)) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="BlastBee-Laptop-Setup.exe"');
    res.download(fallbackZipPath, 'BlastBee-Laptop-Setup.exe', (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ success: false, message: 'Could not download BlastBee Laptop Application' });
      }
    });
  } else {
    res.status(404).json({ success: false, message: 'BlastBee Laptop Application setup file not found.' });
  }
};

router.get('/laptop-app', handleAppDownload);
router.get('/app', handleAppDownload);

// GET /api/download/info - Metadata about desktop application
router.get('/info', (req, res) => {
  let fileSizeMb = '13.3 MB';
  try {
    const target = fs.existsSync(laptopExePath) ? laptopExePath : fallbackZipPath;
    if (fs.existsSync(target)) {
      const stats = fs.statSync(target);
      fileSizeMb = `${(stats.size / (1024 * 1024)).toFixed(1)} MB`;
    }
  } catch (e) {}

  res.json({
    success: true,
    name: 'BlastBee Laptop Desktop Application',
    version: '2.4.0',
    platform: 'Windows 10 / Windows 11 (64-bit)',
    fileSize: fileSizeMb,
    filename: 'BlastBee-Laptop-Setup.exe',
    downloadUrl: '/api/download/app',
    directUrl: '/downloads/BlastBee-Laptop-Setup.exe',
    features: [
      'Standalone Frameless Desktop App Window (No browser URL bar needed)',
      '1-Click Windows Desktop Shortcut (BlastBee Email Engine)',
      'Fast Multi-SMTP Engine & Round-Robin Rotation',
      'Zero Cloud Latency & Instant CSV / Excel Import',
      'Complete SuperAdmin Console & Customer Workspace included'
    ]
  });
});

module.exports = router;
