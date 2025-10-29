const db = require('../config/database');

class GiftItem {
  static async create(itemData) {
    const { name, description, url, price, image, quantity, priority, listId } = itemData;
    
    // Get current max position
    const [positionRows] = await db.execute(
      'SELECT COALESCE(MAX(position), 0) as max_position FROM gift_items WHERE list_id = ?',
      [listId]
    );
    
    const position = positionRows[0].max_position + 1;
    
    const [result] = await db.execute(
      `INSERT INTO gift_items 
       (name, description, url, price, image, quantity, priority, position, list_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, url, price, image, quantity, priority, position, listId]
    );
    
    return result.insertId;
  }

  static async findByList(listId) {
    const [rows] = await db.execute(
      'SELECT * FROM gift_items WHERE list_id = ? AND is_active = TRUE ORDER BY position ASC',
      [listId]
    );
    return rows;
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