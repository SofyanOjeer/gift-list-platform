const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class GiftList {
  static async create(listData) {
    const {
      name,
      description,
      creatorId,
      visibility = 'private',
      showPrices = false,
      allowComments = false,
      hideReservedItems = false,
    } = listData;

    // Générer un UUID pour la nouvelle liste
    const uuid = uuidv4();

    const [result] = await db.execute(
      `INSERT INTO gift_lists 
       (name, description, creator_id, visibility, show_prices, allow_comments, hide_reserved_items, confirmation_delay, uuid) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, creatorId, visibility, showPrices, allowComments, hideReservedItems, 0, uuid]
    );

    // Retourner l'UUID au lieu de l'ID numérique
    return uuid;
  }

static async findAccessibleLists(userId) {
  const [rows] = await db.execute(
    `SELECT gl.*, u.username as creator_username,
            EXISTS(SELECT 1 FROM list_followers lf WHERE lf.list_id = gl.id AND lf.user_id = ?) as user_follows
     FROM gift_lists gl
     JOIN users u ON gl.creator_id = u.id
     WHERE gl.creator_id = ?  -- SEULEMENT les listes de l'utilisateur
        OR EXISTS(SELECT 1 FROM list_followers lf WHERE lf.list_id = gl.id AND lf.user_id = ?)  -- + celles qu'il suit
     ORDER BY gl.created_at DESC`,
    [userId, userId, userId]
  );
  return rows;
}

static async findByToken(token) {
  console.log('🔍 findByToken appelé avec:', token);
  
  if (!token) {
    console.error('❌ Token invalide');
    return null;
  }

  try {
    // Vérifier si c'est un UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(token)) {
      console.log('🔍 Token est un UUID, recherche par uuid');
      const [rows] = await db.execute(
        `SELECT gl.*, u.username as creator_username
         FROM gift_lists gl
         INNER JOIN users u ON gl.creator_id = u.id
         WHERE gl.uuid = ?`,
        [token]
      );
      
      if (rows.length > 0) {
        console.log('✅ Liste trouvée par UUID:', rows[0].name);
        return rows[0];
      }
    } else {
      // Si ce n'est pas un UUID, essayer avec l'ID numérique
      console.log('🔍 Token est numérique, recherche par ID');
      const [rows] = await db.execute(
        `SELECT gl.*, u.username as creator_username
         FROM gift_lists gl
         INNER JOIN users u ON gl.creator_id = u.id
         WHERE gl.id = ?`,
        [token]
      );
      
      if (rows.length > 0) {
        console.log('✅ Liste trouvée par ID numérique:', rows[0].name);
        
        // Si la liste a un UUID, rediriger vers l'URL avec UUID
        if (rows[0].uuid) {
          console.log('🔄 Liste a un UUID, possibilité de redirection');
        }
        
        return rows[0];
      }
    }
    
    console.log('❌ Aucune liste trouvée avec token:', token);
    return null;
    
  } catch (error) {
    console.error('❌ Erreur findByToken:', error);
    return null;
  }
}
static async findById(id) {
  // Validation du paramètre
  if (id === undefined || id === null) {
    console.error('❌ GiftList.findById: ID est undefined ou null');
    return null;
  }

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

  // Mettre à jour les autres méthodes pour utiliser l'UUID quand nécessaire
  static async incrementViews(listToken) {
    await db.execute(
      'UPDATE gift_lists SET views = views + 1 WHERE uuid = ?',
      [listToken]
    );
  }

// models/GiftList.js
static async removeFollower(listId, userId) {
  console.log('🔍 removeFollower appelé avec listId:', listId, 'userId:', userId);
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  // Si c'est un UUID, trouver l'ID numérique
  if (uuidRegex.test(listId)) {
    console.log('🔍 listId est un UUID, recherche de l\'ID numérique');
    const list = await this.findByToken(listId);
    if (!list) {
      throw new Error('Liste non trouvée avec cet UUID');
    }
    listId = list.id;
  }
  
  const [result] = await db.execute(
    'DELETE FROM list_followers WHERE list_id = ? AND user_id = ?',
    [listId, userId]
  );
  
  console.log('✅ Follower supprimé, affected rows:', result.affectedRows);
  return result.affectedRows > 0;
}

// models/GiftList.js
static async addFollower(listId, userId) {
  console.log('🔍 addFollower appelé avec listId:', listId, 'userId:', userId);
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  let list;
  
  if (uuidRegex.test(listId)) {
    // Si c'est un UUID, trouver l'ID numérique
    list = await this.findByToken(listId);
    if (!list) {
      throw new Error('Liste non trouvée avec cet UUID');
    }
    listId = list.id;
  } else {
    // Si c'est un ID numérique, chercher directement
    const [lists] = await db.execute(
      'SELECT id, creator_id FROM gift_lists WHERE id = ?', 
      [listId]
    );
    
    if (lists.length === 0) {
      throw new Error('Liste non trouvée avec cet ID');
    }
    list = lists[0];
  }
  
  
  try {
    await db.execute(
      'INSERT IGNORE INTO list_followers (list_id, user_id) VALUES (?, ?)',
      [listId, userId]
    );
    console.log('✅ Follower/accès ajouté avec succès');
  } catch (error) {
    if (!error.message.includes('Duplicate entry')) {
      throw error;
    }
    console.log('ℹ️ Utilisateur a déjà accès à cette liste');
  }
}

// Dans models/GiftList.js - Ajoutez cette méthode
static async delete(listId, userId) {
    // Vérifier que l'utilisateur est le créateur de la liste
    const list = await this.findById(listId);
    if (!list || list.creator_id !== userId) {
        throw new Error('Non autorisé ou liste non trouvée');
    }

    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        // 1. Supprimer les réservations liées aux items de la liste
        await connection.execute(
            `DELETE r FROM reservations r 
             INNER JOIN gift_items i ON r.item_id = i.id 
             WHERE i.list_id = ?`,
            [listId]
        );

        // 2. Supprimer les commentaires de la liste
        await connection.execute(
            'DELETE FROM comments WHERE list_id = ?',
            [listId]
        );

        // 3. Supprimer les followers de la liste
        await connection.execute(
            'DELETE FROM list_followers WHERE list_id = ?',
            [listId]
        );

        // 4. Supprimer les items de la liste
        await connection.execute(
            'DELETE FROM gift_items WHERE list_id = ?',
            [listId]
        );

        // 5. Supprimer la liste elle-même
        await connection.execute(
            'DELETE FROM gift_lists WHERE id = ?',
            [listId]
        );

        await connection.commit();
        return true;

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
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


 // Ajouter une méthode pour trouver par ancien ID numérique (si migration)
  static async findByLegacyId(legacyId) {
    const [rows] = await db.execute(
      `SELECT gl.*, u.username as creator_username
       FROM gift_lists gl
       INNER JOIN users u ON gl.creator_id = u.id
       WHERE gl.legacy_id = ?`, // Vous devrez ajouter cette colonne
      [legacyId]
    );
    return rows[0];
  }
}

module.exports = GiftList;