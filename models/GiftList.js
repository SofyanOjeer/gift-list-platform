const db = require('../config/database');

class GiftList {
static async create(listData) {
  const { name, description, creatorId, visibility, showPrices, allowComments, hideReservedItems } = listData;
  
  const [result] = await db.execute(
    `INSERT INTO gift_lists (name, description, creator_id, visibility, show_prices, allow_comments, hide_reserved_items, confirmation_delay) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description, creatorId, visibility, showPrices, allowComments, hideReservedItems, 0] // ← Toujours 0
  );
  
  return result.insertId;
}

  static async findById(id) {
    try {
      const [rows] = await db.execute(
        `SELECT gl.*, u.username as creator_username
         FROM gift_lists gl
         INNER JOIN users u ON gl.creator_id = u.id
         WHERE gl.id = ?`,
        [id]
      );
      return rows[0];
    } catch (error) {
      console.error('Erreur findById:', error);
      throw error;
    }
  }

  static async findByUser(userId) {
    const [rows] = await db.execute(
      `SELECT gl.*, u.username as creator_username
       FROM gift_lists gl
       INNER JOIN users u ON gl.creator_id = u.id
       WHERE gl.creator_id = ?
       ORDER BY gl.updated_at DESC`,
      [userId]
    );
    return rows;
  }
static async findAccessibleLists(userId) {
  const [rows] = await db.execute(
    `SELECT gl.*, u.username as creator_username,
            EXISTS(SELECT 1 FROM list_followers lf WHERE lf.list_id = gl.id AND lf.user_id = ?) as user_follows
     FROM gift_lists gl
     JOIN users u ON gl.creator_id = u.id
     WHERE gl.visibility = 'public' 
        OR gl.creator_id = ?
        OR EXISTS(SELECT 1 FROM list_followers lf WHERE lf.list_id = gl.id AND lf.user_id = ?)
     ORDER BY gl.created_at DESC`,
    [userId, userId, userId]
  );
  return rows;
}

  static async incrementViews(listId) {
    await db.execute(
      'UPDATE gift_lists SET views = views + 1 WHERE id = ?',
      [listId]
    );
  }

  static async removeFollower(listId, userId) {
  const [result] = await db.execute(
    'DELETE FROM list_followers WHERE list_id = ? AND user_id = ?',
    [listId, userId]
  );
  return result.affectedRows > 0;
}

  static async update(listId, updateData) {
    const { name, description, visibility, showPrices, allowComments, hideReservedItems, confirmationDelay } = updateData;
    
    await db.execute(
      `UPDATE gift_lists 
       SET name = ?, description = ?, visibility = ?, show_prices = ?, 
           allow_comments = ?, hide_reserved_items = ?, confirmation_delay = ?
       WHERE id = ?`,
      [name, description, visibility, showPrices, allowComments, hideReservedItems, confirmationDelay, listId]
    );
  }

  static async delete(listId) {
    await db.execute('DELETE FROM gift_lists WHERE id = ?', [listId]);
  }

static async addFollower(listId, userId) {
  // Vérifier d'abord si la liste existe et si elle est publique
  const [lists] = await db.execute('SELECT visibility, creator_id FROM gift_lists WHERE id = ?', [listId]);
  if (lists.length === 0) {
    throw new Error('Liste non trouvée');
  }
  
  const list = lists[0];
  
  // Pour les listes privées, seul le créateur peut ajouter des followers via la route dédiée
  if (list.visibility === 'private') {
    throw new Error('Impossible de suivre une liste privée');
  }
  
  // Vérifier que l'utilisateur n'est pas le créateur
  if (list.creator_id === userId) {
    throw new Error('Vous ne pouvez pas suivre votre propre liste');
  }
  
  try {
    await db.execute(
      'INSERT IGNORE INTO list_followers (list_id, user_id) VALUES (?, ?)',
      [listId, userId]
    );
  } catch (error) {
    // Ignorer les erreurs de doublon (déjà follower)
    if (!error.message.includes('Duplicate entry')) {
      throw error;
    }
  }
}


static async addPrivateListMember(listId, userId, addedByUserId) {
  // Vérifier que l'ajouteur est le créateur
  const [lists] = await db.execute('SELECT creator_id, visibility FROM gift_lists WHERE id = ?', [listId]);
  if (lists.length === 0) {
    throw new Error('Liste non trouvée');
  }
  
  const list = lists[0];
  
  if (list.creator_id !== addedByUserId) {
    throw new Error('Seul le créateur peut ajouter des membres');
  }
  
  // Vérifier qu'on n'ajoute pas le créateur
  if (list.creator_id === userId) {
    throw new Error('Vous ne pouvez pas vous ajouter vous-même');
  }
  
  // Vérifier que l'utilisateur existe
  const [users] = await db.execute('SELECT id FROM users WHERE id = ?', [userId]);
  if (users.length === 0) {
    throw new Error('Utilisateur non trouvé');
  }
  
  // Ajouter le follower sans vérification de visibilité (car c'est le créateur qui ajoute)
  try {
    await db.execute(
      'INSERT IGNORE INTO list_followers (list_id, user_id) VALUES (?, ?)',
      [listId, userId]
    );
  } catch (error) {
    // Ignorer les erreurs de doublon (déjà follower)
    if (!error.message.includes('Duplicate entry')) {
      throw error;
    }
  }
}

  static async getFollowers(listId) {
  const [rows] = await db.execute(
    `SELECT u.id, u.username
     FROM list_followers lf
     INNER JOIN users u ON lf.user_id = u.id
     WHERE lf.list_id = ?`,
    [listId]
  );
  return rows;
}

static async findByUserPublic(userId) {
  const [rows] = await db.execute(
    `SELECT gl.*, u.username as creator_username
     FROM gift_lists gl
     INNER JOIN users u ON gl.creator_id = u.id
     WHERE gl.creator_id = ? AND gl.visibility = 'public'
     ORDER BY gl.updated_at DESC`,
    [userId]
  );
  return rows;
}

  static async getFollowerCount(listId) {
    const [rows] = await db.execute(
      'SELECT COUNT(*) as count FROM list_followers WHERE list_id = ?',
      [listId]
    );
    return rows[0].count;
  }
}

module.exports = GiftList;