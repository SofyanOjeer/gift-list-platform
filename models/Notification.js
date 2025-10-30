const db = require('../config/database');

class Notification {

    static async create(notificationData) {
    const { userId, type, title, message, data = null } = notificationData;
    
    // CORRECTION : Toujours stringifier les données
    const dataString = data ? JSON.stringify(data) : null;
    
    const [result] = await db.execute(
        `INSERT INTO notifications (user_id, type, title, message, data) 
         VALUES (?, ?, ?, ?, ?)`,
        [userId, type, title, message, dataString]  // ← Utiliser dataString
    );
    
    return result.insertId;
}


static async findByUser(userId, limit = 20, offset = 0) {
    const userIdNum = parseInt(userId);
    const limitNum = Math.max(1, Math.min(parseInt(limit) || 20, 100));
    const offsetNum = Math.max(0, parseInt(offset) || 0);
    
    if (isNaN(userIdNum)) {
        throw new Error('ID utilisateur invalide');
    }
    
    // REQUÊTE AVEC CONCATÉNATION POUR LIMIT/OFFSET
    const query = `
        SELECT * FROM notifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ${limitNum} OFFSET ${offsetNum}
    `;
    
    const [rows] = await db.execute(query, [userIdNum]);
    
    // CORRECTION : Gérer les données déjà parsées ou stringifiées
    return rows.map(row => {
        let data = null;
        
        try {
            if (row.data) {
                // Si c'est déjà un objet, le retourner directement
                if (typeof row.data === 'object') {
                    data = row.data;
                } 
                // Si c'est une string, essayer de la parser
                else if (typeof row.data === 'string') {
                    data = JSON.parse(row.data);
                }
            }
        } catch (error) {
            console.error('❌ Erreur parsing data notification:', error, 'Data:', row.data);
            data = { error: 'Données corrompues' };
        }
        
        return {
            ...row,
            data: data
        };
    });
}

    // Marquer une notification comme lue
    static async markAsRead(notificationId, userId) {
        const [result] = await db.execute(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [notificationId, userId]
        );
        
        return result.affectedRows > 0;
    }

    // Marquer toutes les notifications comme lues
    static async markAllAsRead(userId) {
        const [result] = await db.execute(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );
        
        return result.affectedRows;
    }

    // Compter les notifications non lues
    static async getUnreadCount(userId) {
        const [rows] = await db.execute(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );
        
        return rows[0].count;
    }

    // Supprimer une notification
    static async delete(notificationId, userId) {
        const [result] = await db.execute(
            'DELETE FROM notifications WHERE id = ? AND user_id = ?',
            [notificationId, userId]
        );
        
        return result.affectedRows > 0;
    }

    // Gérer les préférences
    static async getPreferences(userId) {
        const [rows] = await db.execute(
            'SELECT * FROM notification_preferences WHERE user_id = ?',
            [userId]
        );
        
        if (rows.length === 0) {
            // Créer des préférences par défaut
            await db.execute(
                `INSERT INTO notification_preferences 
                 (user_id, email_new_items, email_reservations, email_comments, push_new_items, push_reservations, push_comments) 
                 VALUES (?, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)`,
                [userId]
            );
            
            return {
                email_new_items: true,
                email_reservations: true,
                email_comments: true,
                push_new_items: true,
                push_reservations: true,
                push_comments: true
            };
        }
        
        return rows[0];
    }

    static async updatePreferences(userId, preferences) {
        const [result] = await db.execute(
            `INSERT INTO notification_preferences 
             (user_id, email_new_items, email_reservations, email_comments, push_new_items, push_reservations, push_comments) 
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             email_new_items = ?, email_reservations = ?, email_comments = ?,
             push_new_items = ?, push_reservations = ?, push_comments = ?`,
            [
                userId,
                preferences.email_new_items,
                preferences.email_reservations,
                preferences.email_comments,
                preferences.push_new_items,
                preferences.push_reservations,
                preferences.push_comments,
                preferences.email_new_items,
                preferences.email_reservations,
                preferences.email_comments,
                preferences.push_new_items,
                preferences.push_reservations,
                preferences.push_comments
            ]
        );
        
        return result.affectedRows > 0;
    }
}

module.exports = Notification;