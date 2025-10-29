const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const GiftList = require('../models/GiftList');

// Page d'accueil
router.get('/', ensureAuth, async (req, res) => {
  try {
    const personalLists = await GiftList.findByUser(req.user.id);
    const followedLists = await User.getFollowedLists(req.user.id);

    res.render('home', {
      user: req.user,
      personalLists,
      followedLists
    });
  } catch (error) {
    console.error(error);
    res.render('error', { message: 'Erreur lors du chargement de la page d\'accueil' });
  }
});

module.exports = router;