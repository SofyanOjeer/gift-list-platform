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

// ========== SOLUTION DE SECOURS POUR SUIVI ==========

document.addEventListener('click', function(e) {
    // ========== BOUTON "SUIVRE" ==========
    if (e.target.closest('.follow-btn') || 
        (e.target.closest('button') && e.target.closest('button').textContent.includes('Suivre'))) {
        
        const button = e.target.closest('button');
        console.log('🔍 Bouton Suivre détecté');
        
        // RÉCUPÉRER L'UUID DEPUIS LE LIEN "VOIR LA LISTE"
        const listUuid = findListUuidFromCard(button);
        
        if (!listUuid) {
            console.error('❌ Impossible de trouver l\'UUID de la liste');
            alert('Erreur: Impossible de trouver l\'identifiant de la liste');
            return;
        }

        console.log('🚀 FOLLOW - UUID trouvé:', listUuid);
        followList(listUuid, button);
    }
    
    // ========== BOUTON "NE PLUS SUIVRE" ==========
    if (e.target.closest('.unfollow-btn') || 
        (e.target.closest('button') && e.target.closest('button').textContent.includes('plus suivre'))) {
        
        const button = e.target.closest('button');
        console.log('🔍 Bouton Ne plus suivre détecté');
        
        // RÉCUPÉRER L'UUID DEPUIS LE LIEN "VOIR LA LISTE"
        const listUuid = findListUuidFromCard(button);
        
        if (!listUuid) {
            console.error('❌ Impossible de trouver l\'UUID de la liste');
            alert('Erreur: Impossible de trouver l\'identifiant de la liste');
            return;
        }

        // RÉCUPÉRER LE NOM DE LA LISTE
        const listName = findListNameFromCard(button);
        console.log('🚀 UNFOLLOW - UUID:', listUuid, 'Nom:', listName);
        
        unfollowList(listUuid, listName, button);
    }
});

// FONCTION POUR TROUVER L'UUID DEPUIS LA CARTE
function findListUuidFromCard(button) {
    // Méthode 1: Chercher le lien "Voir la liste" dans la même carte
    const card = button.closest('.card');
    if (card) {
        const link = card.querySelector('a[href*="/lists/"]');
        if (link) {
            const href = link.getAttribute('href');
            const uuid = href.split('/lists/')[1];
            console.log('🔍 UUID trouvé depuis lien:', uuid);
            return uuid;
        }
    }
    
    // Méthode 2: Chercher dans toute la page
    const allLinks = document.querySelectorAll('a[href*="/lists/"]');
    for (let link of allLinks) {
        const href = link.getAttribute('href');
        if (href && href.includes('/lists/')) {
            const uuid = href.split('/lists/')[1];
            // Vérifier que c'est un UUID valide
            if (isValidUuid(uuid)) {
                console.log('🔍 UUID trouvé depuis lien global:', uuid);
                return uuid;
            }
        }
    }
    
    // Méthode 3: Depuis l'URL actuelle (si on est sur list-detail)
    if (window.location.pathname.includes('/lists/')) {
        const uuid = window.location.pathname.split('/lists/')[1];
        if (isValidUuid(uuid)) {
            console.log('🔍 UUID trouvé depuis URL page:', uuid);
            return uuid;
        }
    }
    
    return null;
}

// FONCTION POUR TROUVER LE NOM DE LA LISTE
function findListNameFromCard(button) {
    const card = button.closest('.card');
    if (card) {
        const title = card.querySelector('.card-title');
        if (title) {
            return title.textContent.trim();
        }
    }
    return 'cette liste';
}

// VALIDATION UUID
function isValidUuid(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

// FONCTIONS DE SUIVI (inchangées)
function followList(listUuid, button) {
    console.log('🚀 FOLLOW - UUID:', listUuid);
    
    const url = `/lists/${listUuid}/follow`;
    console.log('🌐 URL follow:', url);
    
    // Afficher loading
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>...';
    button.disabled = true;
    
    fetch(url, { 
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => {
        console.log('📨 Follow - Statut:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('✅ Follow - Réponse:', data);
        if (data.success) {
            location.reload();
        } else {
            throw new Error(data.error);
        }
    })
    .catch(error => {
        console.error('❌ Follow - Erreur:', error);
        alert('Erreur: ' + error.message);
        button.innerHTML = originalText;
        button.disabled = false;
    });
}

function unfollowList(listUuid, listName, button) {
    console.log('🚀 UNFOLLOW - UUID:', listUuid, 'Nom:', listName);
    
    if (!confirm(`Voulez-vous vraiment arrêter de suivre "${listName}" ?`)) {
        return;
    }
    
    const url = `/lists/${listUuid}/unfollow`;
    console.log('🌐 URL unfollow:', url);
    
    // Afficher loading
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>...';
    button.disabled = true;
    
    fetch(url, { 
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => {
        console.log('📨 Unfollow - Statut:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('✅ Unfollow - Réponse:', data);
        if (data.success) {
            location.reload();
        } else {
            throw new Error(data.error);
        }
    })
    .catch(error => {
        console.error('❌ Unfollow - Erreur:', error);
        alert('Erreur: ' + error.message);
        button.innerHTML = originalText;
        button.disabled = false;
    });
}

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
    
    // VÉRIFICATION : Afficher la valeur actuelle pour debug
    console.log('🔍 Valeur du lien de partage:', shareLink.value);
    
    shareLink.select();
    shareLink.setSelectionRange(0, 99999); // Pour mobile
    
    navigator.clipboard.writeText(shareLink.value)
        .then(() => {
            // Animation de succès
            const copyBtn = document.querySelector('[onclick="copyShareLink()"]');
            const originalHtml = copyBtn.innerHTML;
            
            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
            copyBtn.classList.remove('btn-outline-secondary');
            copyBtn.classList.add('btn-success');
            
            setTimeout(() => {
                copyBtn.innerHTML = originalHtml;
                copyBtn.classList.remove('btn-success');
                copyBtn.classList.add('btn-outline-secondary');
            }, 2000);
            
        })
        .catch(err => {
            console.error('❌ Erreur copie moderne:', err);
            // Fallback pour anciens navigateurs
            try {
                document.execCommand('copy');
                alert('Lien copié dans le presse-papier !');
            } catch (fallbackErr) {
                console.error('❌ Erreur copie fallback:', fallbackErr);
                // Dernier recours : afficher le lien
                alert('Copiez ce lien : ' + shareLink.value);
            }
        });
}

// Fonction pour ouvrir le modal de partage
function shareList() {
    // Rafraîchir le lien au cas où
    const shareLink = document.getElementById('shareLink');
    const currentUuid = '{{list.uuid}}'; // Remplacé par Handlebars
    const baseUrl = '{{baseUrl}}'; // Remplacé par Handlebars
    
    const newUrl = `${baseUrl}/lists/${currentUuid}`;
    shareLink.value = newUrl;
    
    console.log('🔍 Lien de partage généré:', newUrl);
    
    // Ouvrir le modal
    const shareModal = new bootstrap.Modal(document.getElementById('shareModal'));
    shareModal.show();
}

    // Démarrer le rafraîchissement automatique seulement si on est sur une page avec des réservations
    if (document.querySelectorAll('.reserve-btn').length > 0) {
        startQuantityRefresh();
    }
});