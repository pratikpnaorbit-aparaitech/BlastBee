require('dotenv').config();
const DEFAULT_MONGODB_URI = "mongodb://mailblast:Aparaitech2129@ac-rl6rdwo-shard-00-00.kmi9oku.mongodb.net:27017,ac-rl6rdwo-shard-00-01.kmi9oku.mongodb.net:27017,ac-rl6rdwo-shard-00-02.kmi9oku.mongodb.net:27017/?ssl=true&replicaSet=atlas-3ebffw-shard-0&authSource=admin&appName=Cluster0";
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = DEFAULT_MONGODB_URI;
}

const app = require('../server');

module.exports = app;
