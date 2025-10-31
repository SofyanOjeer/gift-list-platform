require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const exphbs = require('express-handlebars');
const path = require('path');
const User = require('./models/User');
const GiftList = require('./models/GiftList');
const GiftItem = require('./models/GiftItem');
const Reservation = require('./models/Reservation');
const NotificationService = require('./services/NotificationService');
const Notification = require('./models/Notification');

// Import de la connexion à la base de données
const db = require('./config/database');

const app = express();

// Configuration Passport
passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const user = await User.findByEmail(email);
    if (!user) {
      return done(null, false, { message: 'Email incorrect' });
    }

    const isMatch = await User.comparePassword(password, user.password);
    if (!isMatch) {
      return done(null, false, { message: 'Mot de passe incorrect' });
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Configuration Handlebars
app.engine('handlebars', exphbs.engine({
  defaultLayout: 'main',
  helpers: {
    eq: (a, b) => a === b,
    gt: (a, b) => a > b,
    subtract: (a, b) => a - b,
    formatPrice: (price) => {
      if (!price) return 'Non spécifié';
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
    },
formatDate: (date) => {
  if (!date) return 'Date non spécifiée';
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'Date invalide';
    
    // MÊME CORRECTION - pas de décalage manuel
    return dateObj.toLocaleDateString('fr-FR', {
      timeZone: 'Europe/Paris'
    });
  } catch (error) {
    return 'Date invalide';
  }
},
formatDateTime: (date) => {
  if (!date) return 'Date non spécifiée';
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'Date invalide';
    
    console.log('🔧 Serveur - Formatage date:', {
      originale: date,
      parsed: dateObj.toString(),
      heures: dateObj.getHours() + ':' + dateObj.getMinutes()
    });
    
    // SANS DÉCALAGE MANUEL
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} à ${hours}:${minutes}`;
  } catch (error) {
    return 'Date invalide';
  }
},
    priorityIcon: (priority) => {
      const icons = {
        high: '🔥',
        medium: '💚',
        low: '💙',
        note: '📌'
      };
      return icons[priority] || '📌';
    },
    getInitials: (str) => {
      if (!str) return '??';
      return str.substring(0, 2).toUpperCase();
    },
    formatPrice: (price) => {
      if (!price && price !== 0) return 'Non spécifié';
      
      // Convertir en nombre et arrondir à 2 décimales
      const number = typeof price === 'string' ? parseFloat(price.replace(',', '.')) : Number(price);
      
      if (isNaN(number)) return 'Non spécifié';
      
      // Arrondir à 2 décimales
      const rounded = Math.round(number * 100) / 100;
      
      // Formater en français avec 2 décimales
      return new Intl.NumberFormat('fr-FR', { 
        style: 'currency', 
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(rounded);
    },
  },
  partialsDir: [
    path.join(__dirname, 'views/partials')
  ]
}));

app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'gift-list-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.baseUrl = `${req.protocol}://${req.get('host')}`;
  next();
});

// Middleware pour injecter l'utilisateur dans les vues
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

// Routes
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/home');
  } else {
    res.redirect('/auth/login');
  }
});

// Page de connexion
app.get('/auth/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/home');
  }
  res.render('login', { 
    title: 'Connexion',
    error: req.query.error 
  });
});

// Inscription
app.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword, firstName, lastName } = req.body;
    
    // Validation
    if (password !== confirmPassword) {
      return res.redirect('/auth/login?error=' + encodeURIComponent('Les mots de passe ne correspondent pas'));
    }
    
    // Valider le format du username
    const usernameValidation = await User.validateUsername(username);
    if (!usernameValidation.valid) {
      return res.redirect('/auth/login?error=' + encodeURIComponent(usernameValidation.error));
    }
    
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.redirect('/auth/login?error=' + encodeURIComponent('Un utilisateur avec cet email existe déjà'));
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
    res.redirect('/auth/login?error=' + encodeURIComponent(error.message));
  }
});

app.post('/auth/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return res.redirect('/auth/login?error=Erreur serveur');
    }
    if (!user) {
      return res.redirect('/auth/login?error=' + encodeURIComponent(info.message));
    }
    req.logIn(user, (err) => {
      if (err) {
        return res.redirect('/auth/login?error=Erreur de connexion');
      }
      return res.redirect('/home');
    });
  })(req, res, next);
});

// Page d'accueil
app.get('/home', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const personalLists = await GiftList.findByUser(req.user.id);
    
    // Statistiques pour l'accueil
    const [followedLists] = await db.execute(
      'SELECT COUNT(*) as count FROM list_followers WHERE user_id = ?',
      [req.user.id]
    );
    
    const totalViews = personalLists.reduce((sum, list) => sum + list.views, 0);
    
    const homeStats = {
      totalLists: personalLists.length,
      followedLists: followedLists[0].count,
      totalViews: totalViews
    };
    
    res.render('home', {
      title: 'Tableau de Bord',
      personalLists,
      user: req.user,
      stats: homeStats
    });
  } catch (error) {
    console.error(error);
    res.render('error', { 
      title: 'Erreur',
      message: 'Erreur lors du chargement du tableau de bord' 
    });
  }
});

// Voir toutes les listes
app.get('/lists', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const lists = await GiftList.findAccessibleLists(req.user.id);
    
    res.render('lists', {
      title: 'Listes de Cadeaux',
      lists,
      user: req.user
    });
  } catch (error) {
    console.error(error);
    res.render('error', { 
      title: 'Erreur',
      message: 'Erreur lors du chargement des listes' 
    });
  }
});


// Page de profil utilisateur
app.get('/profile', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const user = await User.findById(req.user.id);
    
    // Liste des avatars et bannières prédéfinis
    const avatars = [
      'default-avatar.png',
      'avatar-1.png',
      'avatar-2.png', 
      'avatar-3.png',
      'avatar-4.png',
      'avatar-5.png',
      'avatar-6.png',
      'avatar-7.png',
      'avatar-8.png'
    ];
    
    const banners = [
      'default-banner.png',
      'banner-1.png',
      'banner-2.png'
    ];
    
     res.render('profile-edit', {
      title: 'Modifier mon profil',
      user: user,
      avatars: avatars,
      banners: banners
    });
  } catch (error) {
    console.error(error);
    res.render('error', {
      title: 'Erreur',
      message: 'Erreur lors du chargement du profil'
    });
  }
});

// Mettre à jour le profil
app.post('/profile/update', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const { firstName, lastName, bio, avatar, banner } = req.body;
    
    await User.updateProfile(req.user.id, {
      firstName: firstName || '',
      lastName: lastName || '',
      bio: bio || '',
      avatar: avatar || 'default-avatar.png',
      banner: banner || 'default-banner.png'
    });
    
    // Mettre à jour la session
    const updatedUser = await User.findById(req.user.id);
    req.login(updatedUser, (err) => {
      if (err) {
        console.error('Erreur mise à jour session:', err);
      }
      // REDIRIGER VERS LA PAGE D'ÉDITION (pas le profil public)
      res.redirect('/profile?success=Profil mis à jour avec succès');
    });
    
  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    res.redirect('/profile?error=' + encodeURIComponent('Erreur lors de la mise à jour du profil'));
  }
});

// Page de consultation du profil PUBLIC
app.get('/profile/:username', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const user = await User.findByUsername(req.params.username);
    if (!user) {
      return res.render('error', {
        title: 'Utilisateur non trouvé',
        message: 'Cet utilisateur n\'existe pas'
      });
    }

    const publicLists = await GiftList.findByUserPublic(user.id);
    
    res.render('user-profile', {
      title: `Profil de ${user.username}`,
      profileUser: user,
      publicLists,
      user: req.user,
      isOwnProfile: user.id === req.user.id
    });
  } catch (error) {
    console.error(error);
    res.render('error', {
      title: 'Erreur',
      message: 'Erreur lors du chargement du profil'
    });
  }
});

app.post('/lists/create', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const { name, description, visibility, showPrices, allowComments, hideReservedItems } = req.body;
    
    // Validation
    if (!name || name.trim() === '') {
      return res.render('list-create', {
        title: 'Créer une liste',
        user: req.user,
        error: 'Le nom de la liste est requis'
      });
    }

    const listData = {
      name: name.trim(),
      description: description ? description.trim() : '',
      creatorId: req.user.id,
      visibility: visibility || 'private',
      showPrices: showPrices === 'on',
      allowComments: allowComments === 'on',
      hideReservedItems: hideReservedItems === 'on'
      // Retirer complètement confirmationDelay
    };

    const listId = await GiftList.create(listData);
    
    console.log('✅ Liste créée:', listData.name, 'ID:', listId);
    res.redirect(`/lists/${listId}`);
    
  } catch (error) {
    console.error('❌ Erreur création liste:', error);
    res.render('list-create', {
      title: 'Créer une liste',
      user: req.user,
      error: 'Erreur lors de la création: ' + error.message
    });
  }
});


// Créer une liste - Formulaire
app.get('/lists/create', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  console.log('✅ GET /lists/create - Affichage du formulaire');
  res.render('list-create', {
    title: 'Créer une liste',
    user: req.user
  });
});

app.get('/lists/:id', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const list = await GiftList.findById(req.params.id);
    if (!list) {
      return res.render('error', { 
        title: 'Non trouvé',
        message: 'Liste non trouvée' 
      });
    }

    // Vérifier si l'utilisateur suit cette liste
    const [followers] = await db.execute(
      'SELECT 1 FROM list_followers WHERE list_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    const userFollowsList = followers.length > 0;

    // Vérifier les permissions d'accès
    let canAccess = false;
    
    if (list.creator_id === req.user.id) {
      canAccess = true;
    } else if (list.visibility === 'public') {
      canAccess = true;
    } else if (list.visibility === 'private') {
      // Pour les listes privées, SEULEMENT si l'utilisateur a été ajouté par le créateur
      canAccess = userFollowsList;
    }

    if (!canAccess) {
      return res.render('list-access-request', {
        title: 'Accès à la liste',
        list,
        user: req.user
      });
    }

    const items = await GiftItem.findByList(req.params.id);
    
    // MODIFICATION : Le créateur ne voit PAS les réservations
    let reservations = [];
    // Seulement les non-créateurs voient les réservations
    if (list.creator_id !== req.user.id) {
      // Pour les autres utilisateurs, on peut afficher un résumé anonyme si nécessaire
      // Mais pour l'instant, on laisse vide
    }
    
    // Incrémenter les vues
    await GiftList.incrementViews(req.params.id);
    
    res.render('list-detail', {
      title: list.name,
      list,
      items,
      reservations,
      user: req.user,
      isOwner: list.creator_id === req.user.id,
      userFollowsList: userFollowsList
    });
  } catch (error) {
    console.error(error);
    res.render('error', { 
      title: 'Erreur',
      message: 'Erreur lors du chargement de la liste' 
    });
  }
});

// Statistiques
app.get('/stats', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const userLists = await GiftList.findByUser(req.user.id);
    const listIds = userLists.map(list => list.id);

    let totalItems = 0;
    let reservedItems = 0;
    let totalValue = 0;
    let reservedValue = 0;

    for (const list of userLists) {
      const items = await GiftItem.findByList(list.id);
      totalItems += items.length;
      reservedItems += items.filter(item => item.reserved_quantity > 0).length;
      totalValue += items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      reservedValue += items.reduce((sum, item) => sum + (item.price * item.reserved_quantity), 0);
    }

    // CORRECTION : Calculer le nombre de listes suivies
    const [followedLists] = await db.execute(
      'SELECT COUNT(*) as count FROM list_followers WHERE user_id = ?',
      [req.user.id]
    );
    const followedListsCount = followedLists[0].count;

    const reservationRate = totalItems > 0 ? (reservedItems / totalItems) * 100 : 0;
    const totalViews = userLists.reduce((sum, list) => sum + list.views, 0);

    res.render('stats', {
      title: 'Statistiques',
      user: req.user,
      stats: {
        totalLists: userLists.length,
        followedLists: followedListsCount, // ← CORRIGÉ
        totalViews,
        totalItems,
        reservedItems,
        reservationRate: Math.round(reservationRate),
        totalValue,
        reservedValue
      }
    });
  } catch (error) {
    console.error(error);
    res.render('error', { 
      title: 'Erreur',
      message: 'Erreur lors du chargement des statistiques' 
    });
  }
});
// Déconnexion
app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/auth/login');
  });
});

// Route pour ajouter un item
app.post('/items/:listId', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const list = await GiftList.findById(req.params.listId);
    
    if (!list || list.creator_id !== req.user.id) {
      return res.status(403).render('error', {
        title: 'Erreur',
        message: 'Non autorisé'
      });
    }

    const { name, description, url, price, image, quantity, priority } = req.body;
    
    // CORRECTION : Nettoyer et arrondir le prix saisi
    const cleanedPrice = cleanPriceInput(price);
    
    const itemId = await GiftItem.create({
      name,
      description,
      url,
      price: cleanedPrice, // ← Prix déjà arrondi
      image,
      quantity: parseInt(quantity) || 1,
      priority: priority || 'medium',
      listId: req.params.listId
    });

    const item = await GiftItem.findById(itemId);
    await NotificationService.notifyNewItem(item, list);

    res.redirect(`/lists/${req.params.listId}`);
  } catch (error) {
    console.error(error);
    res.render('error', {
      title: 'Erreur',
      message: 'Erreur lors de l\'ajout de l\'article'
    });
  }
});


// Route pour ajouter un membre à une liste privée
app.post('/lists/:id/add-member', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const list = await GiftList.findById(req.params.id);
    
    // Vérifier que l'utilisateur est le créateur
    if (!list || list.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const { usernameOrEmail } = req.body;
    
    // Trouver l'utilisateur
    const user = await User.findByUsernameOrEmail(usernameOrEmail);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier qu'on ne s'ajoute pas soi-même
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous ajouter vous-même' });
    }

    // UTILISER LA NOUVELLE MÉTHODE pour ajouter aux listes privées
    await GiftList.addPrivateListMember(req.params.id, user.id, req.user.id);
    
    res.json({ 
      success: true, 
      message: `${user.username} a été ajouté à la liste`,
      user: { id: user.id, username: user.username }
    });
    
  } catch (error) {
    console.error('Erreur ajout membre:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout du membre' });
  }
});

// Route pour retirer un membre d'une liste
app.post('/lists/:id/remove-member/:userId', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const list = await GiftList.findById(req.params.id);
    
    // Vérifier que l'utilisateur est le créateur
    if (!list || list.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    await GiftList.removeFollower(req.params.id, req.params.userId);
    
    res.json({ success: true, message: 'Membre retiré de la liste' });
    
  } catch (error) {
    console.error('Erreur retrait membre:', error);
    res.status(500).json({ error: 'Erreur lors du retrait du membre' });
  }
});

// Route pour voir les membres d'une liste
app.get('/lists/:id/members', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const list = await GiftList.findById(req.params.id);
    
    // Vérifier que l'utilisateur est le créateur
    if (!list || list.creator_id !== req.user.id) {
      return res.status(403).render('error', {
        title: 'Erreur',
        message: 'Non autorisé'
      });
    }

    const followers = await GiftList.getFollowers(req.params.id);
    
    res.render('list-members', {
      title: `Membres - ${list.name}`,
      list,
      followers,
      user: req.user
    });
    
  } catch (error) {
    console.error(error);
    res.render('error', {
      title: 'Erreur',
      message: 'Erreur lors du chargement des membres'
    });
  }
});

// Route pour suivre une liste (UNIQUEMENT pour les listes publiques)
app.post('/lists/:id/follow', async (req, res) => {
  if (!req.isAuthenticated()) {
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    return res.redirect('/auth/login');
  }
  
  try {
    const list = await GiftList.findById(req.params.id);
    
    if (!list) {
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(404).json({ error: 'Liste non trouvée' });
      }
      return res.render('error', {
        title: 'Erreur',
        message: 'Liste non trouvée'
      });
    }

    // Vérifier que la liste est publique
    if (list.visibility !== 'public') {
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(403).json({ error: 'Vous ne pouvez pas suivre une liste privée' });
      }
      return res.render('error', {
        title: 'Accès refusé',
        message: 'Vous ne pouvez pas suivre une liste privée. Demandez au créateur de vous ajouter.'
      });
    }

    // Vérifier que l'utilisateur n'est pas le créateur
    if (list.creator_id === req.user.id) {
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(400).json({ error: 'Vous ne pouvez pas suivre votre propre liste' });
      }
      return res.redirect(`/lists/${list.id}`);
    }

    await GiftList.addFollower(req.params.id, req.user.id);
    
    // AJOUT: Notifier le créateur
    await NotificationService.notifyNewFollower(req.user.id, list);
    
    // Réponse selon le type de requête
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      res.json({ 
        success: true, 
        message: 'Vous suivez maintenant cette liste' 
      });
    } else {
      res.redirect(`/lists/${req.params.id}`);
    }
    
  } catch (error) {
    console.error('Erreur follow liste:', error);
    
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      res.status(500).json({ error: 'Erreur lors du suivi de la liste' });
    } else {
      res.redirect('back');
    }
  }
});

// Statistiques par liste spécifique
app.get('/stats/list/:id', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const list = await GiftList.findById(req.params.id);
    
    if (!list || list.creator_id !== req.user.id) {
      return res.status(403).render('error', { 
        title: 'Erreur',
        message: 'Accès non autorisé - Vous devez être le créateur de la liste' 
      });
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
      title: `Stats - ${list.name}`,
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
    res.render('error', { 
      title: 'Erreur',
      message: 'Erreur lors du chargement des statistiques' 
    });
  }
});


// Profil utilisateur - voir les listes publiques d'un utilisateur
app.get('/profile/:username', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const user = await User.findByUsername(req.params.username);
    if (!user) {
      return res.render('error', {
        title: 'Utilisateur non trouvé',
        message: 'Cet utilisateur n\'existe pas'
      });
    }

    const publicLists = await GiftList.findByUserPublic(user.id);
    
    res.render('user-profile', {
      title: `Profil de ${user.username}`,
      profileUser: user,
      publicLists,
      user: req.user,
      isOwnProfile: user.id === req.user.id
    });
  } catch (error) {
    console.error(error);
    res.render('error', {
      title: 'Erreur',
      message: 'Erreur lors du chargement du profil'
    });
  }
});


// Page de recherche
app.get('/search', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  res.render('search', {
    title: 'Rechercher des profils',
    user: req.user,
    query: '',
    results: []
  });
});

// Recherche de profils
app.get('/search/profile', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const query = req.query.q;
    let results = [];

    if (query) {
      // Recherche par username ou email
      const [rows] = await db.execute(
        `SELECT id, username, email, first_name, last_name 
         FROM users 
         WHERE (username LIKE ? OR email LIKE ?) AND id != ?
         LIMIT 10`,
        [`%${query}%`, `%${query}%`, req.user.id]
      );
      results = rows;
    }

    res.render('search', {
      title: `Recherche - ${query || 'Profils'}`,
      user: req.user,
      query: query || '',
      results
    });
  } catch (error) {
    console.error(error);
    res.render('error', {
      title: 'Erreur',
      message: 'Erreur lors de la recherche'
    });
  }
});

// Arrêter de suivre une liste
app.post('/lists/:id/unfollow', async (req, res) => {
  if (!req.isAuthenticated()) {
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    return res.redirect('/auth/login');
  }
  
  try {
    const success = await GiftList.removeFollower(req.params.id, req.user.id);
    
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.xhr) {
      // Requête AJAX - retourner JSON
      res.json({ success: true });
    } else {
      // Requête normale - redirection
      res.redirect('/lists');
    }
  } catch (error) {
    console.error(error);
    
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.xhr) {
      res.status(500).json({ error: 'Erreur serveur' });
    } else {
      res.redirect('/lists');
    }
  }
});


app.post('/items/:id/reserve', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  try {
    const { quantity, email, isAnonymous, message } = req.body;
    const itemId = req.params.id;
    
    // Récupérer l'item et la liste
    const item = await GiftItem.findById(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    
    const list = await GiftList.findById(item.list_id);
    
    // Vérifier la disponibilité avec les réservations confirmées
    const currentReserved = await GiftItem.getReservedQuantity(itemId);
    const available = item.quantity - currentReserved;
    const qty = parseInt(quantity) || 1;
    
    if (qty > available) {
      return res.status(400).json({ error: 'Quantité non disponible' });
    }
    
    // LOGIQUE SIMPLIFIÉE : Confirmation immédiate
    let reservedByName = null;
    let finalIsAnonymous = true;
    
    if (isAnonymous === 'false') {
      reservedByName = req.user.username;
      finalIsAnonymous = false;
    }
    
    // Créer la réservation CONFIRMÉE directement
    const reservation = await Reservation.create({
      itemId: item.id,
      listId: item.list_id,
      reservedBy: email,
      reservedByName: reservedByName,
      quantity: qty,
      expiresAt: new Date(), // ← Expiration immédiate
      isAnonymous: finalIsAnonymous,
      confirmed: true // ← Confirmation immédiate
    });
    
    // Mettre à jour IMMÉDIATEMENT la quantité réservée
    await GiftItem.updateReservedQuantity(itemId);
    
    // Ajouter un commentaire si message
    if (message && message.trim() !== '') {
      const authorName = finalIsAnonymous ? 'Anonyme' : req.user.username;
      await db.execute(
        `INSERT INTO comments (content, author, list_id, item_id, is_anonymous) 
         VALUES (?, ?, ?, ?, ?)`,
        [message.trim(), authorName, list.id, itemId, finalIsAnonymous]
      );
    }
    
    console.log(`✅ Réservation confirmée immédiatement pour: ${email}`);
    
    // Message de confirmation
    const confirmationMessage = finalIsAnonymous 
      ? 'Réservation effectuée avec succès ! Le créateur ne saura pas que c\'est vous. 🎁'
      : 'Réservation effectuée avec succès ! Le créateur a été averti.';
    
    res.json({ 
      success: true, 
      message: confirmationMessage,
      reservationId: reservation.id,
      newReservedQuantity: await GiftItem.getReservedQuantity(itemId),
      isAnonymous: finalIsAnonymous
    });
    
  } catch (error) {
    console.error('Erreur réservation:', error);
    res.status(500).json({ error: 'Erreur lors de la réservation' });
  }
});

// Route pour confirmer une réservation (via email)
app.get('/reservations/confirm/:token', async (req, res) => {
  try {
    const reservation = await Reservation.findByToken(req.params.token);
    
    if (!reservation) {
      return res.render('error', {
        title: 'Lien invalide',
        message: 'Ce lien de confirmation est invalide ou a expiré.'
      });
    }
    
    // Confirmer la réservation
    await Reservation.confirm(reservation.id);
    await GiftItem.updateReservedQuantity(reservation.item_id);
    
    res.render('reservation-confirmed', {
      title: 'Réservation Confirmée',
      reservation,
      user: req.user
    });
    
  } catch (error) {
    console.error(error);
    res.render('error', {
      title: 'Erreur',
      message: 'Erreur lors de la confirmation de la réservation'
    });
  }
});

// Route pour obtenir les réservations d'une liste (pour le créateur)
app.get('/lists/:id/reservations', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  try {
    const list = await GiftList.findById(req.params.id);
    
    if (!list || list.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    // Récupérer les réservations seulement pour le créateur
let reservations = [];
if (list.creator_id === req.user.id) {
  reservations = await Reservation.findByList(req.params.id);
}
    
    res.json({ success: true, reservations });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour obtenir les quantités mises à jour d'un item
app.get('/items/:id/quantity', async (req, res) => {
  try {
    const item = await GiftItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    
    // Calculer la quantité disponible réelle
    const currentReserved = await GiftItem.getReservedQuantity(req.params.id);
    const available = item.quantity - currentReserved;
    
    res.json({
      success: true,
      quantity: item.quantity,
      reserved_quantity: currentReserved,
      available: available
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


const ScraperService = require('./services/scraperService');

app.post('/api/extract-product-info', async (req, res) => {
    try {
        const { url } = req.body;
        
        console.log('🎯 Extraction demandée pour URL:', url);
        
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                error: 'URL requise' 
            });
        }

        const productInfo = await ScraperService.extractProductInfo(url);
        
        console.log('📊 Données extraites:', {
            title: productInfo.title,
            price: productInfo.price,
            priceType: typeof productInfo.price,
            hasPrice: !!productInfo.price
        });
        
        res.json(productInfo);
        
    } catch (error) {
        console.error('💥 Erreur extraction produit:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de l\'extraction des informations' 
        });
    }
});

// Route pour supprimer une liste
app.delete('/lists/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(401).json({ error: 'Non authentifié' });
        }
        return res.redirect('/auth/login');
    }
    
    try {
        const list = await GiftList.findById(req.params.id);
        
        if (!list) {
            if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(404).json({ error: 'Liste non trouvée' });
            }
            return res.render('error', {
                title: 'Erreur',
                message: 'Liste non trouvée'
            });
        }

        // Vérifier que l'utilisateur est le créateur
        if (list.creator_id !== req.user.id) {
            if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(403).json({ error: 'Non autorisé' });
            }
            return res.render('error', {
                title: 'Erreur',
                message: 'Vous n\'êtes pas autorisé à supprimer cette liste'
            });
        }

        await GiftList.delete(req.params.id, req.user.id);

        // Réponse selon le type de requête
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            res.json({ 
                success: true, 
                message: 'Liste supprimée avec succès' 
            });
        } else {
            res.redirect('/home');
        }

    } catch (error) {
        console.error('Erreur suppression liste:', error);
        
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            res.status(500).json({ error: 'Erreur lors de la suppression de la liste' });
        } else {
            res.render('error', {
                title: 'Erreur',
                message: 'Erreur lors de la suppression de la liste'
            });
        }
    }
});

// Supprimer un article
app.delete('/items/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Non authentifié' });
    }
    
    try {
        const item = await GiftItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Article non trouvé' });
        }
        
        const list = await GiftList.findById(item.list_id);
        if (!list || list.creator_id !== req.user.id) {
            return res.status(403).json({ error: 'Non autorisé' });
        }
        
        await GiftItem.delete(req.params.id);
        res.json({ success: true });
        
    } catch (error) {
        console.error('Erreur suppression article:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});


// Fonction pour arrondir et nettoyer les prix - VERSION SIMPLIFIÉE
function cleanPriceInput(input) {
    console.log('🔧 Nettoyage prix - Input reçu:', input, 'Type:', typeof input);
    
    // Si vide, retourner null
    if (!input && input !== 0 && input !== '0') {
        console.log('❌ Prix vide, retourne null');
        return null;
    }
    
    try {
        let number;
        
        // Si c'est déjà un nombre
        if (typeof input === 'number') {
            number = input;
        } 
        // Si c'est une chaîne
        else if (typeof input === 'string') {
            // Nettoyer la chaîne - garder chiffres, virgules et points
            let cleaned = input.replace(/[^\d,.]/g, '');
            console.log('🧹 Prix nettoyé:', cleaned);
            
            // Remplacer la virgule par un point pour le parsing
            cleaned = cleaned.replace(',', '.');
            console.log('🔄 Virgule remplacée:', cleaned);
            
            number = parseFloat(cleaned);
        }
        // Autres types
        else {
            number = parseFloat(input);
        }
        
        console.log('🔢 Prix après conversion:', number);
        
        // Vérifier si c'est un nombre valide
        if (isNaN(number)) {
            console.log('❌ Prix invalide (NaN), retourne null');
            return null;
        }
        
        if (number < 0) {
            console.log('❌ Prix négatif, retourne null');
            return null;
        }
        
        // Arrondir à 2 décimales
        const rounded = Math.round(number * 100) / 100;
        console.log('✅ Prix final arrondi:', rounded);
        return rounded;
        
    } catch (error) {
        console.error('💥 Erreur nettoyage prix:', error);
        return null;
    }
}


// Routes pour les notifications
app.get('/notifications', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const notifications = await Notification.findByUser(req.user.id, 50);
    const unreadCount = await Notification.getUnreadCount(req.user.id);
    
    res.render('notifications', {
      title: 'Mes notifications',
      user: req.user,
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error(error);
    res.render('error', {
      title: 'Erreur',
      message: 'Erreur lors du chargement des notifications'
    });
  }
});

// API pour récupérer les notifications (AJAX)
app.get('/api/notifications', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  try {
    const notifications = await Notification.findByUser(req.user.id, 10);
    const unreadCount = await Notification.getUnreadCount(req.user.id);
    
    res.json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// API pour marquer une notification comme lue
app.post('/api/notifications/:id/read', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  try {
    const success = await Notification.markAsRead(req.params.id, req.user.id);
    const unreadCount = await Notification.getUnreadCount(req.user.id);
    
    res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// API pour marquer toutes les notifications comme lues
app.post('/api/notifications/read-all', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  try {
    const affectedRows = await Notification.markAllAsRead(req.user.id);
    const unreadCount = await Notification.getUnreadCount(req.user.id);
    
    res.json({
      success: true,
      affectedRows,
      unreadCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎉 Serveur démarré sur http://localhost:${PORT}`);
});