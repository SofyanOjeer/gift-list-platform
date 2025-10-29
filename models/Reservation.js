const db = require('../config/database');
const crypto = require('crypto');

class Reservation {
  static async create(reservationData) {
    const { itemId, listId, reservedBy, reservedByName, quantity, expiresAt, isAnonymous } = reservationData;
    const confirmationToken = crypto.randomBytes(32).toString('hex');
    
    const [result] = await db.execute(
      `INSERT INTO reservations 
       (item_id, list_id, reserved_by, reserved_by_name, quantity, expires_at, confirmation_token, is_anonymous) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, listId, reservedBy, reservedByName, quantity, expiresAt, confirmationToken, isAnonymous]
    );
    
    return { id: result.insertId, confirmationToken };
  }

  static async findByToken(token) {
    const [rows] = await db.execute(
      'SELECT * FROM reservations WHERE confirmation_token = ? AND status = "pending"',
      [token]
    );
    return rows[0];
  }

  static async confirm(reservationId) {
    await db.execute(
      'UPDATE reservations SET status = "confirmed" WHERE id = ?',
      [reservationId]
    );
  }

  static async cancel(reservationId) {
    const reservation = await this.findById(reservationId);
    await db.execute(
      'UPDATE reservations SET status = "cancelled" WHERE id = ?',
      [reservationId]
    );
    return reservation;
  }

  static async findById(id) {
    const [rows] = await db.execute(
      'SELECT * FROM reservations WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  static async findByList(listId) {
    const [rows] = await db.execute(
      `SELECT r.*, gi.name as item_name
       FROM reservations r
       INNER JOIN gift_items gi ON r.item_id = gi.id
       WHERE r.list_id = ? AND r.status = 'confirmed'
       ORDER BY r.created_at DESC`,
      [listId]
    );
    return rows;
  }

  static async findByItem(itemId) {
    const [rows] = await db.execute(
      `SELECT r.*, u.username
       FROM reservations r
       LEFT JOIN users u ON r.reserved_by = u.email
       WHERE r.item_id = ? AND r.status = 'confirmed'
       ORDER BY r.created_at DESC`,
      [itemId]
    );
    return rows;
  }

  static async cleanupExpired() {
    await db.execute(
      'DELETE FROM reservations WHERE expires_at < NOW() AND status = "pending"'
    );
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
}

module.exports = Reservation;