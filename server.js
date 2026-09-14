require('dotenv').config();
const DEFAULT_MONGODB_URI = "mongodb://mailblast:Aparaitech2129@ac-rl6rdwo-shard-00-00.kmi9oku.mongodb.net:27017,ac-rl6rdwo-shard-00-01.kmi9oku.mongodb.net:27017,ac-rl6rdwo-shard-00-02.kmi9oku.mongodb.net:27017/?ssl=true&replicaSet=atlas-3ebffw-shard-0&authSource=admin&appName=Cluster0";
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = DEFAULT_MONGODB_URI;
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./database/db');
const { seedDatabase } = require('./database/seed');
const { getPersistentMongoDb } = require('./database/mongo');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database & ensure seed data is loaded
try {
  getDb();
  seedDatabase();

  // Connect to MongoDB Atlas
  getPersistentMongoDb().catch(err => {
    console.warn('MongoDB Atlas auto-connect note:', err.message);
  });
} catch (err) {
  console.error('Database initialization error:', err);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Mount API Routes
// Route student reads and writes to MongoDB Atlas when configured, with SQLite fallback
app.use('/api/students', (req, res, next) => {
  const { getOptionalAuth } = require('./routes/auth');
  const user = getOptionalAuth(req);
  // Logged-in customers only access their isolated student talent pool
  if (user && user.role === 'customer') {
    return require('./routes/students')(req, res, next);
  }
  if (process.env.MONGODB_URI) {
    return require('./routes/mongoStudents')(req, res, next);
  }
  return require('./routes/students')(req, res, next);
});
app.use('/api/upload', require('./routes/upload'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/auth', require('./routes/auth').router);
app.use('/api/subscription', require('./routes/subscription'));
app.use('/api/extension', require('./routes/extension'));
app.use('/api/download', require('./routes/downloads'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Aparaitech Student Email Blast Web Application',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Dedicated Portal Routing
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/app*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// Landing Page Fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
if (require.main === module) {
  const os = require('os');
  const HOST = '0.0.0.0';

  app.listen(PORT, HOST, () => {
    // Find LAN IP
    const nets = os.networkInterfaces();
    const networkIps = [];
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          networkIps.push({ name, address: net.address });
        }
      }
    }

    console.log(`====================================================`);
    console.log(`🚀 Aparaitech Student Email Blast Server Running!`);
    console.log(`💻 Local URL:   http://localhost:3000`);
    networkIps.forEach(net => {
      console.log(`📱 Network URL (${net.name}): http://${net.address}:${PORT}`);
    });
    console.log(`🏢 Recruitment Portal: Aparaitech Software (aparaitech.org)`);
    console.log(`====================================================`);
  });
}

module.exports = app;
