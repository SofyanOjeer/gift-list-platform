const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class GiftItem {
  static async create(itemData) {
    const { name, description, url, price, image, quantity, priority, listId } = itemData;
    
    // Get current max position
    const [positionRows] = await db.execute(
      'SELECT COALESCE(MAX(position), 0) as max_position FROM gift_items WHERE list_id = ?',
      [listId]
    );
    
    const position = positionRows[0].max_position + 1;

    const uuid = uuidv4();
    
    const [result] = await db.execute(
      `INSERT INTO gift_items 
       (uuid, name, description, url, price, image, quantity, priority, position, list_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, name, description, url, price, image, quantity, priority, position, listId]
    );

    
    
    return result.insertId;
  }

    static async findByToken(uuid) {
    const [rows] = await db.execute(
      'SELECT * FROM gift_items WHERE uuid = ?',
      [uuid]
    );
    return rows[0];
  }

// models/GiftItem.js
static async findByList(listId) {
  console.log('🔍 GiftItem.findByList appelé avec listId:', listId);
  
  if (!listId) {
    console.error('❌ listId invalide');
    return [];
  }

  try {
    const [rows] = await db.execute(
      `SELECT gi.*, 
              r.reserved_by as reserved_by_email,
              r.quantity as reserved_quantity,
              r.is_anonymous as reservation_anonymous,
              r.status as reservation_status
       FROM gift_items gi
       LEFT JOIN reservations r ON gi.id = r.item_id AND r.status = 'confirmed'
       WHERE gi.list_id = ?
       ORDER BY gi.created_at DESC`,
      [listId]
    );
    
    console.log('✅ Items trouvés:', rows.length);
    return rows;
    
  } catch (error) {
    console.error('❌ Erreur GiftItem.findByList:', error);
    return [];
  }
}
  static async findById(id) {
    const [rows] = await db.execute(
      'SELECT * FROM gift_items WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  static async update(itemId, updateData) {
    const { name, description, url, price, image, quantity, priority } = updateData;
    
    await db.execute(
      `UPDATE gift_items 
       SET name = ?, description = ?, url = ?, price = ?, image = ?, quantity = ?, priority = ?
       WHERE id = ?`,
      [name, description, url, price, image, quantity, priority, itemId]
    );
  }

  static async updatePosition(itemId, newPosition) {
    await db.execute(
      'UPDATE gift_items SET position = ? WHERE id = ?',
      [newPosition, itemId]
    );
  }

  static async reserve(itemId, quantity) {
    await db.execute(
      'UPDATE gift_items SET reserved_quantity = reserved_quantity + ? WHERE id = ?',
      [quantity, itemId]
    );
  }

  static async cancelReservation(itemId, quantity) {
    await db.execute(
      'UPDATE gift_items SET reserved_quantity = reserved_quantity - ? WHERE id = ?',
      [quantity, itemId]
    );
  }

  static async delete(itemId) {
    await db.execute(
      'UPDATE gift_items SET is_active = FALSE WHERE id = ?',
      [itemId]
    );
  }

  static async getAvailableQuantity(itemId) {
    const [rows] = await db.execute(
      'SELECT quantity, reserved_quantity, (quantity - reserved_quantity) as available FROM gift_items WHERE id = ?',
      [itemId]
    );
    return rows[0];
  }

static async updateReservedQuantity(itemId) {
    const reservedQuantity = await Reservation.getReservedQuantity(itemId);
    await db.execute(
      'UPDATE gift_items SET reserved_quantity = ? WHERE id = ?',
      [reservedQuantity, itemId]
    );
    return reservedQuantity;
  }

  static async getAvailableQuantity(itemId) {
    const [rows] = await db.execute(
      'SELECT quantity, reserved_quantity, (quantity - reserved_quantity) as available FROM gift_items WHERE id = ?',
      [itemId]
    );
    return rows[0];
  }

  static async getReservedQuantity(itemId) {
  const [rows] = await db.execute(
    `SELECT COALESCE(SUM(quantity), 0) as total_reserved
     FROM reservations 
     WHERE item_id = ? AND status = 'confirmed'`,
    [itemId]
  );
  return rows[0].total_reserved;
}

static async updateReservedQuantity(itemId) {
  const reservedQuantity = await this.getReservedQuantity(itemId);
  await db.execute(
    'UPDATE gift_items SET reserved_quantity = ? WHERE id = ?',
    [reservedQuantity, itemId]
  );
  return reservedQuantity;
}

}

module.exports = GiftItem;