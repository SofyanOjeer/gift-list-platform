class NotificationsPage {
    constructor() {
        this.currentPage = 1;
        this.hasMore = true;
        this.isLoading = false;
        this.init();
    }

    async init() {
        await this.loadPreferences();
        await this.loadNotifications();
        this.setupEventListeners();
        this.setupInfiniteScroll();
    }

    async loadPreferences() {
        try {
            const response = await fetch('/api/notification-preferences');
            const data = await response.json();
            
            if (data.success) {
                // Remplir le formulaire
                Object.keys(data.preferences).forEach(key => {
                    const input = document.querySelector(`[name="${key}"]`);
                    if (input) {
                        input.checked = data.preferences[key];
                    }
                });
            }
        } catch (error) {
            console.error('Erreur chargement préférences:', error);
        }
    }

async loadNotifications(append = false) {
    if (this.isLoading) return;
    
    this.isLoading = true;
    
    try {
        const response = await fetch(`/api/notifications?page=${this.currentPage}&limit=20`);
        const data = await response.json();
        
        if (data.success) {
            this.hasMore = data.hasMore;
            this.renderNotifications(data.notifications, append);
        }
    } catch (error) {
        console.error('Erreur chargement notifications:', error);
    } finally {
        this.isLoading = false;
    }
}

    renderNotifications(notifications, append = false) {
        const container = document.getElementById('notificationsContainer');
        
        if (!append) {
            container.innerHTML = '';
        }

        if (notifications.length === 0 && !append) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-bell-slash fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">Aucune notification</h5>
                    <p class="text-muted">Vous serez notifié quand il y aura de l'activité sur vos listes.</p>
                </div>
            `;
            return;
        }

        const notificationsHTML = notifications.map(notif => `
            <div class="notification-card p-3 border-bottom ${!notif.is_read ? 'unread' : ''}" data-id="${notif.id}">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <span class="fs-5 me-2">${this.getNotificationIcon(notif.type)}</span>
                            <h6 class="mb-0">${notif.title}</h6>
                            <small class="text-muted ms-2">${this.formatTime(notif.created_at)}</small>
                        </div>
                        <p class="mb-2">${notif.message}</p>
                        ${notif.data ? this.renderNotificationActions(notif) : ''}
                    </div>
                    <div class="notification-actions ms-3">
                        ${!notif.is_read ? 
                            `<button class="btn btn-sm btn-outline-primary mark-as-read" title="Marquer comme lu">
                                <i class="fas fa-check"></i>
                            </button>` : ''
                        }
                        <button class="btn btn-sm btn-outline-danger delete-notification" title="Supprimer">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        if (append) {
            container.innerHTML += notificationsHTML;
        } else {
            container.innerHTML = notificationsHTML;
        }

        this.setupNotificationEvents();
    }

    // ... (reprendre les méthodes getNotificationIcon, renderNotificationActions, formatTime du précédent JS)

    setupEventListeners() {
        // Formulaire préférences
        document.getElementById('preferencesForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.savePreferences();
        });

        // Marquer tout comme lu
        document.getElementById('markAllAsReadPage')?.addEventListener('click', async () => {
            await this.markAllAsRead();
        });

        // Supprimer tout lu
        document.getElementById('deleteAllRead')?.addEventListener('click', async () => {
            await this.deleteAllRead();
        });
    }

    setupInfiniteScroll() {
        window.addEventListener('scroll', () => {
            if (this.isLoading || !this.hasMore) return;
            
            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
            
            if (scrollTop + clientHeight >= scrollHeight - 100) {
                this.currentPage++;
                this.loadNotifications(true);
            }
        });
    }

    async savePreferences() {
        const formData = new FormData(document.getElementById('preferencesForm'));
        const preferences = Object.fromEntries(formData);
        
        // Convertir les checkbox en boolean
        Object.keys(preferences).forEach(key => {
            preferences[key] = preferences[key] === 'on';
        });

        try {
            const response = await fetch('/api/notification-preferences', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(preferences)
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showAlert('Préférences enregistrées avec succès!', 'success');
            }
        } catch (error) {
            console.error('Erreur sauvegarde préférences:', error);
            this.showAlert('Erreur lors de la sauvegarde', 'error');
        }
    }

    async markAllAsRead() {
        try {
            const response = await fetch('/api/notifications/read-all', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showAlert(`${data.count} notifications marquées comme lues`, 'success');
                this.loadNotifications(); // Recharger
            }
        } catch (error) {
            console.error('Erreur marquer tout comme lu:', error);
            this.showAlert('Erreur lors de l\'opération', 'error');
        }
    }

    async deleteAllRead() {
        if (!confirm('Supprimer toutes les notifications lues ?')) return;
        
        try {
            // Implémentation de la suppression en masse
            const notifications = document.querySelectorAll('.notification-card:not(.unread)');
            let deletedCount = 0;
            
            for (const notif of notifications) {
                const response = await fetch(`/api/notifications/${notif.dataset.id}`, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                if (data.success) {
                    deletedCount++;
                }
            }
            
            this.showAlert(`${deletedCount} notifications supprimées`, 'success');
            this.loadNotifications(); // Recharger
        } catch (error) {
            console.error('Erreur suppression notifications:', error);
            this.showAlert('Erreur lors de la suppression', 'error');
        }
    }

    showAlert(message, type) {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alert.style.cssText = 'top: 20px; right: 20px; z-index: 1060; min-width: 300px;';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 5000);
    }
}

// Initialiser la page
document.addEventListener('DOMContentLoaded', () => {
    new NotificationsPage();
});