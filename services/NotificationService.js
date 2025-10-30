const db = require('../config/database'); // AJOUTER CETTE LIGNE
const Notification = require('../models/Notification');

class NotificationService {
    // Notifier les followers quand un nouvel item est ajouté
    static async notifyNewItem(item, list) {
        try {
            // Récupérer tous les followers de la liste
            const [followers] = await db.execute(
                'SELECT user_id FROM list_followers WHERE list_id = ?',
                [list.id]
            );

            for (const follower of followers) {
                // Vérifier les préférences de l'utilisateur
                const prefs = await Notification.getPreferences(follower.user_id);
                
                if (prefs.push_new_items) {
                    await Notification.create({
                        userId: follower.user_id,
                        type: 'new_item',
                        title: 'Nouvel article ajouté',
                        message: `Un nouvel article "${item.name}" a été ajouté à la liste "${list.name}"`,
                        data: {
                            listId: list.id,
                            itemId: item.id,
                            listName: list.name,
                            itemName: item.name,
                            creatorName: list.creator_username
                        }
                    });
                }
            }
            
            console.log(`📢 Notifications envoyées à ${followers.length} followers`);
        } catch (error) {
            console.error('Erreur notification nouvel item:', error);
        }
    }

    // Notifier le créateur quand une réservation est faite
    static async notifyReservation(reservation, item, list) {
        try {
            const prefs = await Notification.getPreferences(list.creator_id);
            
            if (prefs.push_reservations) {
                const reservedByName = reservation.is_anonymous ? 'Quelqu\'un' : reservation.reserved_by_name;
                
                await Notification.create({
                    userId: list.creator_id,
                    type: 'reservation',
                    title: 'Nouvelle réservation',
                    message: `${reservedByName} a réservé "${item.name}" sur votre liste "${list.name}"`,
                    data: {
                        listId: list.id,
                        itemId: item.id,
                        reservationId: reservation.id,
                        reservedByName: reservedByName
                    }
                });
            }
        } catch (error) {
            console.error('Erreur notification réservation:', error);
        }
    }

    // Notifier le créateur quand un commentaire est ajouté
    static async notifyNewComment(comment, list) {
        try {
            const prefs = await Notification.getPreferences(list.creator_id);
            
            if (prefs.push_comments && comment.author !== list.creator_username) {
                await Notification.create({
                    userId: list.creator_id,
                    type: 'comment',
                    title: 'Nouveau commentaire',
                    message: `${comment.author} a commenté sur votre liste "${list.name}"`,
                    data: {
                        listId: list.id,
                        commentId: comment.id,
                        author: comment.author
                    }
                });
            }
        } catch (error) {
            console.error('Erreur notification commentaire:', error);
        }
    }

    // Notifier quand quelqu'un suit une liste
    static async notifyNewFollower(followerUserId, list) {
        try {
            const prefs = await Notification.getPreferences(list.creator_id);
            
            if (prefs.push_new_items) { // Utiliser la même préférence pour les followers
                const User = require('../models/User'); // AJOUTER CET IMPORT
                const follower = await User.findById(followerUserId);
                
                await Notification.create({
                    userId: list.creator_id,
                    type: 'follow',
                    title: 'Nouveau follower',
                    message: `${follower.username} suit maintenant votre liste "${list.name}"`,
                    data: {
                        listId: list.id,
                        followerId: followerUserId,
                        followerName: follower.username
                    }
                });
            }
        } catch (error) {
            console.error('Erreur notification follower:', error);
        }
    }
}

module.exports = NotificationService;