const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const GiftItem = require('../models/GiftItem');
const GiftList = require('../models/GiftList');
const Reservation = require('../models/Reservation');

// Ajouter un item
router.post('/:listId', ensureAuth, async (req, res) => {
  try {
    const list = await GiftList.findById(req.params.listId);
    
    if (!list || list.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const { name, description, url, price, image, quantity, priority } = req.body;
    
    const itemId = await GiftItem.create({
      name,
      description,
      url,
      price: price ? parseFloat(price) : null,
      image,
      quantity: parseInt(quantity) || 1,
      priority: priority || 'medium',
      listId: req.params.listId
    });

    res.redirect(`/lists/${req.params.listId}`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Réserver un item
router.post('/:id/reserve', ensureAuth, async (req, res) => {
  try {
    const item = await GiftItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item non trouvé' });
    }

    const list = await GiftList.findById(item.list_id);
    const { email, quantity } = req.body;
    const qty = parseInt(quantity) || 1;

    // Vérifier la disponibilité
    const availability = await GiftItem.getAvailableQuantity(item.id);
    if (qty > availability.available) {
      return res.status(400).json({ error: 'Quantité non disponible' });
    }

    // Calculer la date d'expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + list.confirmation_delay);

    const reservation = await Reservation.create({
      itemId: item.id,
      listId: item.list_id,
      reservedBy: email,
      quantity: qty,
      expiresAt: expiresAt
    });

    // Mettre à jour la quantité réservée
    await GiftItem.reserve(item.id, qty);

    // TODO: Envoyer email de confirmation avec le token

    res.json({ 
      success: true, 
      message: 'Réservation effectuée ! Un email de confirmation a été envoyé.' 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un item
router.post('/:id/delete', ensureAuth, async (req, res) => {
  try {
    const item = await GiftItem.findById(req.params.id);
    if (!item) {
      return res.status(404).redirect('back');
    }

    const list = await GiftList.findById(item.list_id);
    if (list.creator_id !== req.user.id) {
      return res.status(403).redirect('back');
    }

    await GiftItem.delete(item.id);
    res.redirect(`/lists/${list.id}`);
  } catch (error) {
    console.error(error);
    res.redirect('back');
  }
});

// Mettre à jour la position
router.post('/:id/position', ensureAuth, async (req, res) => {
  try {
    const { position } = req.body;
    await GiftItem.updatePosition(req.params.id, parseInt(position));
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;