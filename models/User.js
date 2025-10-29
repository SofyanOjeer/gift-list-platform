const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const { username, email, password, firstName, lastName } = userData;
    
    // Validation du format username
    if (!username.startsWith('@')) {
      throw new Error('Le nom d\'utilisateur doit commencer par @');
    }
    
    // Validation de la longueur
    if (username.length < 2 || username.length > 50) {
      throw new Error('Le nom d\'utilisateur doit contenir entre 2 et 50 caractères');
    }
    
    // Vérifier les caractères autorisés
    const usernameRegex = /^@[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      throw new Error('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores');
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const [result] = await db.execute(
      `INSERT INTO users (username, email, password, first_name, last_name) 
       VALUES (?, ?, ?, ?, ?)`,
      [username, email, hashedPassword, firstName, lastName]
    );
    
    return result.insertId;
  }

  static async findByEmail(email) {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return rows[0];
  }

  static async findById(id) {
    const [rows] = await db.execute(
      'SELECT id, username, email, first_name, last_name, avatar, notifications, theme, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  static async findByUsername(username) {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    return rows[0];
  }

static async comparePassword(candidatePassword, hashedPassword) {
    try {
      console.log('🔐 Comparaison mot de passe:');
      console.log('   Mot de passe fourni:', candidatePassword);
      console.log('   Hash stocké:', hashedPassword ? 'présent' : 'absent');
      
      // Vérifier si le hash commence par le format bcrypt
      if (hashedPassword && hashedPassword.startsWith('$2a$') || hashedPassword.startsWith('$2b$')) {
        const isMatch = await bcrypt.compare(candidatePassword, hashedPassword);
        console.log('   Résultat bcrypt:', isMatch);
        return isMatch;
      } else {
        // Fallback pour les mots de passe en clair (à supprimer après test)
        console.log('   Hash non reconnu, comparaison directe');
        return candidatePassword === hashedPassword;
      }
    } catch (error) {
      console.error('❌ Erreur comparaison mot de passe:', error);
      return false;
    }
  }


  static async updateProfile(userId, profileData) {
    const { firstName, lastName, avatar, notifications, theme } = profileData;
    
    await db.execute(
      `UPDATE users 
       SET first_name = ?, last_name = ?, avatar = ?, notifications = ?, theme = ?
       WHERE id = ?`,
      [firstName, lastName, avatar, notifications, theme, userId]
    );
  }

  static async getFollowedLists(userId) {
    const [rows] = await db.execute(
      `SELECT gl.*, u.username as creator_username
       FROM gift_lists gl
       INNER JOIN list_followers lf ON gl.id = lf.list_id
       INNER JOIN users u ON gl.creator_id = u.id
       WHERE lf.user_id = ?
       ORDER BY gl.updated_at DESC`,
      [userId]
    );
    return rows;
  }

  static async findByUsernameOrEmail(identifier) {
  const [rows] = await db.execute(
    'SELECT * FROM users WHERE username = ? OR email = ?',
    [identifier, identifier]
  );
  return rows[0];
}

static async updateProfile(userId, profileData) {
  const { firstName, lastName, bio, avatar, banner } = profileData;
  
  const [result] = await db.execute(
    `UPDATE users 
     SET first_name = ?, last_name = ?, bio = ?, avatar = ?, banner = ?
     WHERE id = ?`,
    [firstName, lastName, bio, avatar, banner, userId]
  );
  
  return result.affectedRows > 0;
}

static async findById(userId) {
  const [rows] = await db.execute(
    'SELECT id, username, email, first_name, last_name, avatar, banner, bio, created_at FROM users WHERE id = ?',
    [userId]
  );
  return rows[0];
}

static async findByUsername(username) {
  const [rows] = await db.execute(
    'SELECT id, username, email, first_name, last_name, avatar, banner, bio, created_at FROM users WHERE username = ?',
    [username]
  );
  return rows[0];
}

   static async validateUsername(username) {
    if (!username.startsWith('@')) {
      return { valid: false, error: 'Le nom d\'utilisateur doit commencer par @' };
    }
    
    if (username.length < 2 || username.length > 50) {
      return { valid: false, error: 'Le nom d\'utilisateur doit contenir entre 2 et 50 caractères' };
    }
    
    const usernameRegex = /^@[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      return { valid: false, error: 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores' };
    }
    
    // Vérifier si le username existe déjà
    const existingUser = await this.findByUsername(username);
    if (existingUser) {
      return { valid: false, error: 'Ce nom d\'utilisateur est déjà pris' };
    }
    
    return { valid: true };
  }
}




module.exports = User;