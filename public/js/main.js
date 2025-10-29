// Gestion des réservations et interactions
document.addEventListener('DOMContentLoaded', function() {
    // ========== INITIALISATION DES MODALS ==========
    
    let reservationModal = null;
    const reservationModalElement = document.getElementById('reservationModal');
    if (reservationModalElement) {
        reservationModal = new bootstrap.Modal(reservationModalElement);
    }
    
    let currentReservationItem = null;

    // ========== GESTION DES RÉSERVATIONS ==========
    
    // Ouvrir le modal de réservation
    const reserveButtons = document.querySelectorAll('.reserve-btn');
    reserveButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Vérifier que le modal existe
            if (!reservationModal) {
                console.error('Modal de réservation non trouvé');
                return;
            }
            
            const itemId = this.dataset.itemId;
            const itemName = this.dataset.itemName;
            const maxQuantity = parseInt(this.dataset.maxQuantity);
            
            // Remplir le modal
            document.getElementById('reservationItemId').value = itemId;
            document.getElementById('reservationItemName').value = itemName;
            document.getElementById('reservationItemDisplay').value = itemName;
            document.getElementById('reservationMaxQuantity').value = maxQuantity;
            document.getElementById('reservationQuantity').max = maxQuantity;
            document.getElementById('reservationQuantity').value = 1;
            document.getElementById('availableQuantity').textContent = maxQuantity;
            
            // Pré-remplir l'email avec l'email de l'utilisateur connecté si disponible
            const userEmail = this.dataset.userEmail;
            if (userEmail) {
                document.getElementById('reservationEmail').value = userEmail;
            }
            
            currentReservationItem = { itemId, itemName, maxQuantity };
            reservationModal.show();
        });
    });

    // Confirmer la réservation
    const confirmReservationBtn = document.getElementById('confirmReservation');
    if (confirmReservationBtn) {
        confirmReservationBtn.addEventListener('click', function() {
            const form = document.getElementById('reservationForm');
            if (!form) {
                alert('Formulaire de réservation non trouvé');
                return;
            }
            
            const formData = new FormData(form);
            
            const reservationData = {
                itemId: formData.get('itemId'),
                quantity: parseInt(formData.get('quantity')),
                email: formData.get('email'),
                isAnonymous: formData.get('isAnonymous'),
                message: formData.get('message')
            };
            
            // Validation
            if (!reservationData.email || !reservationData.email.includes('@')) {
                alert('Veuillez entrer un email valide');
                return;
            }
            
            if (reservationData.quantity < 1 || reservationData.quantity > currentReservationItem.maxQuantity) {
                alert('Quantité invalide');
                return;
            }
            
            // Afficher un indicateur de chargement
            const originalText = this.innerHTML;
            this.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Réservation...';
            this.disabled = true;
            
            // Envoyer la réservation
            fetch(`/items/${reservationData.itemId}/reserve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(reservationData)
            })
            .then(response => {
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Réponse non-JSON reçue');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    if (reservationModal) {
                        reservationModal.hide();
                    }
                    
                    // Mettre à jour l'interface utilisateur
                    if (data.newReservedQuantity !== undefined) {
                        updateItemDisplay(reservationData.itemId, data.newReservedQuantity);
                    }
                    
                    alert(data.message);
                } else {
                    throw new Error(data.error);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Erreur lors de la réservation: ' + error.message);
                this.innerHTML = originalText;
                this.disabled = false;
            });
        });
    }

    // Fonction pour mettre à jour l'affichage d'un item
    function updateItemDisplay(itemId, newReservedQuantity) {
        // Ne mettre à jour que pour les non-créateurs
        const isOwner = document.querySelector('[data-is-owner="true"]') !== null;
        if (isOwner) {
            return; // Le créateur ne voit pas les quantités réservées
        }
        
        // Trouver tous les éléments qui affichent cet item
        document.querySelectorAll(`[data-item-id="${itemId}"]`).forEach(button => {
            const card = button.closest('.card');
            const quantityDisplay = card.querySelector('.quantity-display');
            const reserveButton = card.querySelector('.reserve-btn');
            
            if (!reserveButton) return;
            
            const maxQuantity = parseInt(reserveButton.dataset.maxQuantity);
            const totalQuantity = parseInt(reserveButton.dataset.totalQuantity) || (maxQuantity + newReservedQuantity);
            
            if (quantityDisplay) {
                // Mettre à jour l'affichage de la quantité
                quantityDisplay.textContent = `${newReservedQuantity}/${totalQuantity} réservé(s)`;
            }
            
            // Mettre à jour la quantité maximale pour les réservations futures
            const newAvailable = totalQuantity - newReservedQuantity;
            reserveButton.dataset.maxQuantity = newAvailable;
            
            // Mettre à jour le badge "Complet" si nécessaire
            const completeBadge = card.querySelector('.badge.bg-secondary');
            if (newAvailable <= 0) {
                reserveButton.style.display = 'none';
                if (!completeBadge) {
                    const badge = document.createElement('span');
                    badge.className = 'badge bg-secondary';
                    badge.textContent = 'Complet';
                    reserveButton.parentNode.appendChild(badge);
                }
            } else {
                if (completeBadge) {
                    completeBadge.remove();
                }
                reserveButton.style.display = 'inline-block';
            }
        });
    }

    // Gestion du changement de quantité dans le modal
    const reservationQuantityInput = document.getElementById('reservationQuantity');
    if (reservationQuantityInput) {
        reservationQuantityInput.addEventListener('change', function() {
            const maxQuantity = parseInt(document.getElementById('reservationMaxQuantity').value);
            const quantity = parseInt(this.value);
            
            if (quantity > maxQuantity) {
                this.value = maxQuantity;
                alert(`Quantité maximale: ${maxQuantity}`);
            }
        });
    }

    // ========== GESTION DU SUIVI DES LISTES ==========

    // Suivre une liste
    const followButtons = document.querySelectorAll('.follow-btn');
    followButtons.forEach(button => {
        button.addEventListener('click', function() {
            const listId = this.dataset.listId;
            
            fetch(`/lists/${listId}/follow`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => {
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Réponse non-JSON reçue');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    this.innerHTML = '<i class="fas fa-check me-1"></i>Suivi';
                    this.classList.remove('btn-outline-primary');
                    this.classList.add('btn-success');
                    this.disabled = true;
                    
                    // Recharger la page après un court délai
                    setTimeout(() => {
                        location.reload();
                    }, 1000);
                } else {
                    throw new Error(data.error || 'Erreur inconnue');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Erreur lors du suivi de la liste: ' + error.message);
            });
        });
    });

    // Arrêter de suivre une liste
    const unfollowButtons = document.querySelectorAll('.unfollow-btn');
    unfollowButtons.forEach(button => {
        button.addEventListener('click', function() {
            const listId = this.dataset.listId;
            const listName = this.dataset.listName;
            
            if (!confirm(`Voulez-vous vraiment arrêter de suivre la liste "${listName}" ?`)) {
                return;
            }
            
            // Afficher un indicateur de chargement
            const originalText = this.innerHTML;
            this.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>...';
            this.disabled = true;
            
            fetch(`/lists/${listId}/unfollow`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => {
                // Vérifier d'abord le type de contenu
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Réponse non-JSON reçue');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Supprimer la carte de la liste
                    const listCard = this.closest('.col-md-6, .col-lg-4, .card');
                    if (listCard) {
                        listCard.style.opacity = '0.5';
                        listCard.style.transform = 'scale(0.95)';
                        
                        setTimeout(() => {
                            listCard.remove();
                            
                            // Vérifier s'il reste des listes
                            const remainingLists = document.querySelectorAll('.col-md-6, .col-lg-4');
                            if (remainingLists.length === 0) {
                                location.reload();
                            }
                        }, 500);
                    } else {
                        // Recharger la page si on est sur la page de détail
                        location.reload();
                    }
                } else {
                    throw new Error(data.error || 'Erreur inconnue');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Erreur lors de l\'arrêt du suivi: ' + error.message);
                this.innerHTML = originalText;
                this.disabled = false;
            });
        });
    });

    // ========== RAFRAÎCHISSEMENT AUTOMATIQUE DES QUANTITÉS ==========

    // Fonction pour rafraîchir les quantités d'un item spécifique
    function updateItemQuantity(itemId, reservedQuantity, totalQuantity) {
        // Ne mettre à jour que pour les non-créateurs
        const isOwner = document.querySelector('[data-is-owner="true"]') !== null;
        if (isOwner) {
            return;
        }
        
        document.querySelectorAll(`[data-item-id="${itemId}"]`).forEach(button => {
            const card = button.closest('.card');
            const quantityDisplay = card.querySelector('.quantity-display');
            const reserveButton = card.querySelector('.reserve-btn');
            
            if (quantityDisplay) {
                quantityDisplay.textContent = `${reservedQuantity}/${totalQuantity} réservé(s)`;
            }
            
            if (reserveButton) {
                const newAvailable = totalQuantity - reservedQuantity;
                reserveButton.dataset.maxQuantity = newAvailable;
                reserveButton.dataset.totalQuantity = totalQuantity;
                
                // Mettre à jour le badge "Complet"
                const completeBadge = card.querySelector('.badge.bg-secondary');
                if (newAvailable <= 0) {
                    reserveButton.style.display = 'none';
                    if (!completeBadge) {
                        const badge = document.createElement('span');
                        badge.className = 'badge bg-secondary';
                        badge.textContent = 'Complet';
                        reserveButton.parentNode.appendChild(badge);
                    }
                } else {
                    if (completeBadge) {
                        completeBadge.remove();
                    }
                    reserveButton.style.display = 'inline-block';
                }
            }
        });
    }

    // Rafraîchissement automatique des quantités (toutes les 30 secondes)
    function startQuantityRefresh() {
        setInterval(() => {
            document.querySelectorAll('.reserve-btn').forEach(button => {
                const itemId = button.dataset.itemId;
                
                fetch(`/items/${itemId}/quantity`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            updateItemQuantity(itemId, data.reserved_quantity, data.quantity);
                        }
                    })
                    .catch(error => console.error('Error refreshing quantity:', error));
            });
        }, 30000); // 30 secondes
    }

    // Fonction pour copier le lien de partage
function copyShareLink() {
    const shareLink = document.getElementById('shareLink');
    shareLink.select();
    shareLink.setSelectionRange(0, 99999); // Pour mobile
    
    navigator.clipboard.writeText(shareLink.value)
        .then(() => {
            alert('Lien copié dans le presse-papier !');
        })
        .catch(err => {
            console.error('Erreur copie:', err);
            // Fallback pour anciens navigateurs
            document.execCommand('copy');
            alert('Lien copié !');
        });
}

    // Démarrer le rafraîchissement automatique seulement si on est sur une page avec des réservations
    if (document.querySelectorAll('.reserve-btn').length > 0) {
        startQuantityRefresh();
    }
});