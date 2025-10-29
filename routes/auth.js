const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');

// Page de connexion
router.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.render('login', { error: req.query.error });
});

// Connexion
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect('/auth/login?error=' + encodeURIComponent(info.message));
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.redirect('/');
    });
  })(req, res, next);
});

// Inscription
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword, firstName, lastName } = req.body;
    
    // Validation
    if (password !== confirmPassword) {
      return res.redirect('/auth/login?error=' + encodeURIComponent('Les mots de passe ne correspondent pas'));
    }
    
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.redirect('/auth/login?error=' + encodeURIComponent('Un utilisateur avec cet email existe déjà'));
    }
    
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.redirect('/auth/login?error=' + encodeURIComponent('Ce nom d\'utilisateur est déjà pris'));
    }
    
    const userId = await User.create({
      username,
      email,
      password,
      firstName,
      lastName
    });
    
    // Connecter automatiquement l'utilisateur
    const user = await User.findById(userId);
    req.logIn(user, (err) => {
      if (err) {
        return res.redirect('/auth/login?error=' + encodeURIComponent('Erreur de connexion'));
      }
      return res.redirect('/');
    });
    
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.redirect('/auth/login?error=' + encodeURIComponent('Erreur lors de l\'inscription'));
  }
});

// Déconnexion
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect('/');
  });
});

module.exports = router;