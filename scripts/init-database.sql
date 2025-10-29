const mysql = require('mysql2/promise');
require('dotenv').config();

async function initializeDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });

  console.log('Initialisation de la base de données...');

  // Créer la base de données
  await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'gift_list_platform'} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.execute(`USE ${process.env.DB_NAME || 'gift_list_platform'}`);

  // Table des utilisateurs
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      first_name VARCHAR(50),
      last_name VARCHAR(50),
      avatar VARCHAR(255),
      notifications BOOLEAN DEFAULT TRUE,
      theme VARCHAR(20) DEFAULT 'light',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Table des listes de cadeaux
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS gift_lists (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      creator_id INT NOT NULL,
      visibility ENUM('public', 'private', 'unlisted') DEFAULT 'private',
      show_prices BOOLEAN DEFAULT TRUE,
      allow_comments BOOLEAN DEFAULT TRUE,
      hide_reserved_items BOOLEAN DEFAULT FALSE,
      confirmation_delay INT DEFAULT 7,
      views INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Table de suivi des listes
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS list_followers (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      list_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (list_id) REFERENCES gift_lists(id) ON DELETE CASCADE,
      UNIQUE KEY unique_follow (user_id, list_id)
    )
  `);

  // Table des items
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS gift_items (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      url VARCHAR(500),
      price DECIMAL(10,2),
      image VARCHAR(500),
      quantity INT DEFAULT 1,
      reserved_quantity INT DEFAULT 0,
      priority ENUM('high', 'medium', 'low', 'note') DEFAULT 'medium',
      position INT DEFAULT 0,
      list_id INT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (list_id) REFERENCES gift_lists(id) ON DELETE CASCADE
    )
  `);

  // Table des réservations
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      item_id INT NOT NULL,
      list_id INT NOT NULL,
      reserved_by VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      status ENUM('pending', 'confirmed', 'cancelled') DEFAULT 'pending',
      confirmation_token VARCHAR(100),
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES gift_items(id) ON DELETE CASCADE,
      FOREIGN KEY (list_id) REFERENCES gift_lists(id) ON DELETE CASCADE
    )
  `);

  // Table des commentaires
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS comments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      content TEXT NOT NULL,
      author VARCHAR(100) DEFAULT 'Anonyme',
      list_id INT NOT NULL,
      item_id INT,
      is_anonymous BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (list_id) REFERENCES gift_lists(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES gift_items(id) ON DELETE SET NULL
    )
  `);

  console.log('✅ Base de données initialisée avec succès');
  await connection.end();
  process.exit(0);
}

initializeDatabase().catch(console.error);