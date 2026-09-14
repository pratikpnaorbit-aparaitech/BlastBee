const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const zipPath = path.join(__dirname, '..', 'public', 'downloads', 'blastbee-chrome-extension.zip');

// GET /api/extension/download - 1-Click download of Chrome Extension Package (.zip)
router.get('/download', (req, res) => {
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, 'blastbee-chrome-extension.zip', (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ success: false, message: 'Could not download extension package' });
      }
    });
  } else {
    res.status(404).json({ success: false, message: 'Extension zip package not found. Please re-generate.' });
  }
});

module.exports = router;
