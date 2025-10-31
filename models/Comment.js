const db = require('../config/database');

class Comment {
  static async create(commentData) {
    const { content, author, listId, itemId, isAnonymous } = commentData;
    
    const [result] = await db.execute(
      `INSERT INTO comments 
       (content, author, list_id, item_id, is_anonymous) 
       VALUES (?, ?, ?, ?, ?)`,
      [content, author, listId, itemId, isAnonymous]
    );
    
    return result.insertId;
  }

// models/Comment.js
static async findByList(listId) {
  console.log('🔍 Comment.findByList appelé avec listId:', listId);
  
  if (!listId) {
    console.error('❌ listId invalide pour Comment.findByList');
    return [];
  }

  try {
    const [rows] = await db.execute(
      `SELECT c.*, 
              COALESCE(NULLIF(gi.name, ''), 'Article général') as item_name
       FROM comments c
       LEFT JOIN gift_items gi ON c.item_id = gi.id
       WHERE c.list_id = ?
       ORDER BY c.created_at DESC`,
      [listId]
    );
    
    console.log('✅ Commentaires trouvés:', rows.length);
    
    // Debug des premiers commentaires
    if (rows.length > 0) {
      console.log('📝 Premier commentaire:', {
        id: rows[0].id,
        content: rows[0].content.substring(0, 50) + '...',
        author: rows[0].author,
        item_name: rows[0].item_name
      });
    }
    
    return rows;
    
  } catch (error) {
    console.error('❌ Erreur Comment.findByList:', error);
    console.error('❌ SQL Error details:', error.sqlMessage);
    
    // Fallback: requête simple sans JOIN
    try {
      console.log('🔄 Tentative avec requête simple...');
      const [simpleRows] = await db.execute(
        'SELECT * FROM comments WHERE list_id = ? ORDER BY created_at DESC',
        [listId]
      );
      console.log('✅ Commentaires trouvés (requête simple):', simpleRows.length);
      
      // Ajouter item_name manuellement
      return simpleRows.map(comment => ({
        ...comment,
        item_name: comment.item_id ? 'Article spécifique' : 'Article général'
      }));
      
    } catch (fallbackError) {
      console.error('❌ Erreur même avec requête simple:', fallbackError);
      return [];
    }
  }
}

  static async findByItem(itemId) {
    const [rows] = await db.execute(
      'SELECT * FROM comments WHERE item_id = ? ORDER BY created_at DESC',
      [itemId]
    );
    return rows;
  }

  static async delete(commentId) {
    await db.execute('DELETE FROM comments WHERE id = ?', [commentId]);
  }
}

module.exports = Comment;