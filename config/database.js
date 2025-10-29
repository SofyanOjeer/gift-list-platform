const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gift_list_platform',
  charset: 'utf8mb4',
  timezone: '+00:00'
};

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test de connexion
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connexion MySQL établie');
    connection.release();
  } catch (error) {
    console.error('❌ Erreur de connexion MySQL:', error.message);
    process.exit(1);
  }
}

testConnection();

module.exports = pool;