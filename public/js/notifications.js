class NotificationManager {
    constructor() {
        this.unreadCount = 0;
        this.isOpen = false;
        this.init();
    }

    init() {
        this.loadNotifications();
        this.setupEventListeners();
        this.startPolling();
    }

async loadNotifications() {
    try {
        const response = await fetch('/api/notifications?limit=5');
        const data = await response.json();

        if (data.success) {
            this.unreadCount = data.unreadCount;
            this.updateBadge();
            this.renderNotifications(data.notifications);
        }
    } catch (error) {
        console.error('Erreur chargement notifications:', error);
    }
}

    updateBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'block';
                
                // Animation du badge
                badge.classList.add('pulse-animation');
                setTimeout(() => badge.classList.remove('pulse-animation'), 1000);
            } else {
                badge.style.display = 'none';
            }
        }
    }

    renderNotifications(notifications) {
        const container = document.getElementById('notificationsList');
        if (!container) return;

        if (notifications.length === 0) {
            container.innerHTML = `
                <div class="text-center py-3">
                    <i class="fas fa-bell-slash fa-2x text-muted mb-2"></i>
                    <p class="text-muted mb-0">Aucune notification</p>
                </div>
            `;
            return;
        }

        container.innerHTML = notifications.map(notif => `
            <li class="notification-item ${!notif.is_read ? 'unread' : ''}" data-id="${notif.id}">
                <div class="d-flex align-items-start p-2">
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start">
                            <h6 class="mb-1">${this.getNotificationIcon(notif.type)} ${notif.title}</h6>
                            <small class="text-muted">${this.formatTime(notif.created_at)}</small>
                        </div>
                        <p class="mb-1 small">${notif.message}</p>
                        ${notif.data ? this.renderNotificationActions(notif) : ''}
                    </div>
                    ${!notif.is_read ? 
                        '<button class="btn btn-sm btn-outline-primary ms-2 mark-as-read" title="Marquer comme lu">✓</button>' : 
                        '<button class="btn btn-sm btn-outline-danger ms-2 delete-notification" title="Supprimer">×</button>'
                    }
                </div>
            </li>
        `).join('');

        this.setupNotificationEvents();
    }

    getNotificationIcon(type) {
        const icons = {
            'new_item': '🎁',
            'reservation': '✅',
            'comment': '💬',
            'follow': '👤',
            'system': '🔔'
        };
        return icons[type] || '🔔';
    }

    renderNotificationActions(notification) {
        const data = notification.data;
        if (!data) return '';

        let actions = '';
        
        if (data.listId) {
            actions += `<a href="/lists/${data.listId}" class="btn btn-sm btn-outline-primary me-1">Voir la liste</a>`;
        }
        
        if (data.itemId) {
            actions += `<a href="/lists/${data.listId}#item-${data.itemId}" class="btn btn-sm btn-outline-secondary">Voir l'article</a>`;
        }

        return actions ? `<div class="mt-2">${actions}</div>` : '';
    }

    formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24) return `Il y a ${diffHours} h`;
        if (diffDays < 7) return `Il y a ${diffDays} j`;
        
        return date.toLocaleDateString('fr-FR');
    }

    setupEventListeners() {
        // Marquer tout comme lu
        document.getElementById('markAllAsRead')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await this.markAllAsRead();
        });

        // Rafraîchir quand le dropdown s'ouvre
        document.getElementById('notificationsDropdown')?.addEventListener('show.bs.dropdown', () => {
            this.isOpen = true;
            this.loadNotifications();
        });

        document.getElementById('notificationsDropdown')?.addEventListener('hide.bs.dropdown', () => {
            this.isOpen = false;
        });
    }

    setupNotificationEvents() {
        // Marquer comme lu
        document.querySelectorAll('.mark-as-read').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const item = e.target.closest('.notification-item');
                await this.markAsRead(item.dataset.id);
            });
        });

        // Supprimer notification
        document.querySelectorAll('.delete-notification').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const item = e.target.closest('.notification-item');
                await this.deleteNotification(item.dataset.id);
            });
        });

        // Clic sur une notification
        document.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                if (!e.target.closest('button')) {
                    await this.markAsRead(item.dataset.id);
                }
            });
        });
    }

    async markAsRead(notificationId) {
        try {
            const response = await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                this.updateBadge();
                
                const item = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
                if (item) {
                    item.classList.remove('unread');
                    item.querySelector('.mark-as-read')?.remove();
                    item.querySelector('.d-flex').innerHTML += 
                        '<button class="btn btn-sm btn-outline-danger ms-2 delete-notification" title="Supprimer">×</button>';
                    
                    this.setupNotificationEvents();
                }
            }
        } catch (error) {
            console.error('Erreur marquer comme lu:', error);
        }
    }

    async markAllAsRead() {
        try {
            const response = await fetch('/api/notifications/read-all', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.unreadCount = 0;
                this.updateBadge();
                this.loadNotifications(); // Recharger pour mettre à jour l'affichage
            }
        } catch (error) {
            console.error('Erreur marquer tout comme lu:', error);
        }
    }

    async deleteNotification(notificationId) {
        try {
            const response = await fetch(`/api/notifications/${notificationId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                const item = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
                if (item) {
                    item.remove();
                    
                    // Recharger si plus de notifications
                    if (document.querySelectorAll('.notification-item').length === 0) {
                        this.loadNotifications();
                    }
                }
            }
        } catch (error) {
            console.error('Erreur suppression notification:', error);
        }
    }

    startPolling() {
        // Vérifier les nouvelles notifications toutes les 30 secondes
        setInterval(() => {
            if (!this.isOpen) {
                this.loadNotifications();
            }
        }, 30000);
    }
}

// Initialiser quand la page est chargée
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('notificationsDropdown')) {
        window.notificationManager = new NotificationManager();
    }
});