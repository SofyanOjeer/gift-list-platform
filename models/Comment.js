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

  static async findByList(listId) {
    const [rows] = await db.execute(
      `SELECT c.*, gi.name as item_name
       FROM comments c
       LEFT JOIN gift_items gi ON c.item_id = gi.id
       WHERE c.list_id = ?
       ORDER BY c.created_at DESC`,
      [listId]
    );
    return rows;
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