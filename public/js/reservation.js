// SIMPLE - juste pour ouvrir le modal et gérer la réservation
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 Initialisation système réservation modal');
    
    // === 1. OUVERTURE DU MODAL ===
    document.addEventListener('click', function(e) {
        if (e.target.closest('.reserve-btn')) {
            console.log('✅ Bouton Réserver cliqué - ouverture modal');
            const button = e.target.closest('.reserve-btn');
            openReservationModal(button);
        }
    });
    
    // === 2. CONFIRMATION DE RÉSERVATION ===
    const confirmBtn = document.getElementById('confirmReservation');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmReservation);
    }
});

// Fonction pour ouvrir le modal
function openReservationModal(button) {
    // Récupérer les données du bouton
    const itemId = button.getAttribute('data-item-id');
    const itemName = button.getAttribute('data-item-name');
    const maxQuantity = parseInt(button.getAttribute('data-max-quantity'));
    const userEmail = button.getAttribute('data-user-email');
    
    console.log('📦 Données pour réservation:', { itemId, itemName, maxQuantity, userEmail });
    
    // Remplir le modal avec les données
    document.getElementById('reservationItemId').value = itemId;
    document.getElementById('reservationItemName').value = itemName;
    document.getElementById('reservationMaxQuantity').value = maxQuantity;
    document.getElementById('reservationItemDisplay').value = itemName;
    document.getElementById('reservationQuantity').value = 1;
    document.getElementById('reservationQuantity').max = maxQuantity;
    document.getElementById('availableQuantity').textContent = maxQuantity;
    document.getElementById('reservationEmail').value = userEmail;
    document.getElementById('reservationMessage').value = '';
    
    // Réinitialiser les options
    document.getElementById('anonymousReservation').checked = true;
    
    // Ouvrir le modal
    const modal = new bootstrap.Modal(document.getElementById('reservationModal'));
    modal.show();
}

// Fonction pour confirmer la réservation
function confirmReservation() {
    const form = document.getElementById('reservationForm');
    
    // Validation basique
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = new FormData(form);
    const itemId = document.getElementById('reservationItemId').value;
    const quantity = parseInt(formData.get('quantity'));
    const email = formData.get('email');
    const isAnonymous = formData.get('isAnonymous') === 'true';
    const message = formData.get('message') || '';
    
    console.log('🔄 Confirmation réservation:', { itemId, quantity, email, isAnonymous, message });
    
    // Afficher loading
    const confirmBtn = document.getElementById('confirmReservation');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Réservation...';
    confirmBtn.disabled = true;
    
    // Envoyer la requête
    fetch(`/items/${itemId}/reserve`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
            quantity: quantity,
            email: email,
            isAnonymous: isAnonymous,
            message: message
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('✅ Réponse réservation:', data);
        
        if (data.success) {
            // SUCCÈS - Fermer le modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('reservationModal'));
            modal.hide();
            
            // Afficher message
            alert('🎉 ' + data.message);
            
            // Recharger la page pour voir les changements
            setTimeout(() => {
                location.reload();
            }, 1000);
            
        } else {
            throw new Error(data.error);
        }
    })
    .catch(error => {
        console.error('❌ Erreur réservation:', error);
        alert('❌ Erreur: ' + error.message);
        
        // Restaurer le bouton
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
    });
}