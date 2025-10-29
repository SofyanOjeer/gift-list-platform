const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const GiftList = require('../models/GiftList');
const GiftItem = require('../models/GiftItem');
const Reservation = require('../models/Reservation');

// Statistiques générales
router.get('/', ensureAuth, async (req, res) => {
  try {
    const userLists = await GiftList.findByUser(req.user.id);
    const listIds = userLists.map(list => list.id);

    let totalItems = 0;
    let reservedItems = 0;
    let totalValue = 0;
    let reservedValue = 0;

    // Calculer les statistiques pour chaque liste
    for (const list of userLists) {
      const items = await GiftItem.findByList(list.id);
      totalItems += items.length;
      
      const reserved = items.filter(item => item.reserved_quantity > 0);
      reservedItems += reserved.length;
      
      totalValue += items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      reservedValue += items.reduce((sum, item) => sum + (item.price * item.reserved_quantity), 0);
    }

    const reservationRate = totalItems > 0 ? (reservedItems / totalItems) * 100 : 0;
    const totalViews = userLists.reduce((sum, list) => sum + list.views, 0);

    // Listes les plus populaires
    const popularLists = userLists
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    res.render('stats', {
      user: req.user,
      stats: {
        totalLists: userLists.length,
        totalViews,
        totalItems,
        reservedItems,
        reservationRate: Math.round(reservationRate),
        totalValue,
        reservedValue,
        popularLists
      }
    });
  } catch (error) {
    console.error(error);
    res.render('error', { message: 'Erreur lors du chargement des statistiques' });
  }
});

// Statistiques par liste
router.get('/list/:id', ensureAuth, async (req, res) => {
  try {
    const list = await GiftList.findById(req.params.id);
    
    if (!list || list.creator_id !== req.user.id) {
      return res.status(403).render('error', { message: 'Accès non autorisé' });
    }

    const items = await GiftItem.findByList(list.id);
    const followers = await GiftList.getFollowers(list.id);
    
    const reservedItems = items.filter(item => item.reserved_quantity > 0);
    const reservationRate = items.length > 0 ? (reservedItems.length / items.length) * 100 : 0;
    
    const totalValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const reservedValue = items.reduce((sum, item) => sum + (item.price * item.reserved_quantity), 0);

    // Articles les plus populaires
    const popularItems = items
      .sort((a, b) => b.reserved_quantity - a.reserved_quantity)
      .slice(0, 5);

    res.render('stats-list', {
      user: req.user,
      list,
      stats: {
        views: list.views,
        followers: followers.length,
        totalItems: items.length,
        reservedItems: reservedItems.length,
        reservationRate: Math.round(reservationRate),
        totalValue,
        reservedValue,
        popularItems
      }
    });
  } catch (error) {
    console.error(error);
    res.render('error', { message: 'Erreur lors du chargement des statistiques' });
  }
});

module.exports = router;