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
const Comment = require('./models/Comment');


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


        formatRelativeDate: (date) => {
      if (!date) return 'Date inconnue';
      
      try {
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) return 'Date invalide';
        
        const now = new Date();
        const diffMs = now - dateObj;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        const diffWeeks = Math.floor(diffDays / 7);
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        if (diffSecs < 60) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24) return `Il y a ${diffHours} h`;
        if (diffDays === 1) return 'Hier';
        if (diffDays < 7) return `Il y a ${diffDays} j`;
        if (diffWeeks < 4) return `Il y a ${diffWeeks} sem`;
        if (diffMonths < 12) return `Il y a ${diffMonths} mois`;
        return `Il y a ${diffYears} an${diffYears > 1 ? 's' : ''}`;
      } catch (error) {
        return 'Date invalide';
      }
    },
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
/*Local version
app.use(session({
  secret: process.env.SESSION_SECRET || 'gift-list-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));
*/

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new MySQLStore({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
}));

app.use(passport.initialize());
app.use(passport.session());

/*Local version
app.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.baseUrl = `${req.protocol}://${req.get('host')}`;
  next();
});
*/

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://sofyanojeer.fr');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});


// Servir les fichiers statiques
app.use('/gavalist', express.static(path.join(__dirname, 'public')));
app.use('/gavalist/assets', express.static(path.join(__dirname, 'public')));

// Routes - toutes préfixées par /gavalist
app.use('/gavalist', routes);

// Gestion des erreurs en production
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Une erreur est survenue' 
      : err.message
  });
});


// Middleware de vérification d'authentification pour les routes protégées
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated() && req.user) {
    return next();
  }
  res.redirect('/auth/login');
};

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

    const listToken = await GiftList.create(listData);

    console.log('✅ Liste créée:', listData.name, 'Token:', listToken);
    res.redirect(`/lists/${listToken}`);

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


// Dans server.js - route POST /lists/:id/comments
app.post('/lists/:id/comments', async (req, res) => {
  console.log('💬 Route POST /comments appelée');
  console.log('🔍 req.params:', req.params);
  console.log('🔍 req.body:', req.body);
  console.log('🔍 req.user:', req.user);
  
  if (!req.isAuthenticated() || !req.user) {
    console.log('❌ Utilisateur non authentifié');
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  try {
    // ICI EST LE PROBLÈME - vous utilisez peut-être req.params.id qui est l'UUID
    console.log('🔍 Paramètre id reçu:', req.params.id);
    
    // Utiliser findByToken au lieu de findById si c'est un UUID
    let list;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(req.params.id)) {
      console.log('🔍 Paramètre est un UUID, utilisation de findByToken');
      list = await GiftList.findByToken(req.params.id);
    } else {
      console.log('🔍 Paramètre est un ID numérique, utilisation de findById');
      list = await GiftList.findById(req.params.id);
    }
    
    console.log('🔍 Liste trouvée:', list ? list.name : 'null');
    
    if (!list) {
      console.log('❌ Liste non trouvée');
      return res.status(404).json({ error: 'Liste non trouvée' });
    }

    // Vérifier les permissions
    if (!list.allow_comments && list.creator_id !== req.user.id) {
      console.log('❌ Commentaires désactivés pour cette liste');
      return res.status(403).json({ error: 'Les commentaires sont désactivés pour cette liste' });
    }

    const { content, isAnonymous, itemId } = req.body;
    
    console.log('📨 Données commentaire:', { content, isAnonymous, itemId });
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Le commentaire ne peut pas être vide' });
    }

    if (content.length > 500) {
      return res.status(400).json({ error: 'Le commentaire ne peut pas dépasser 500 caractères' });
    }

    const commentData = {
      content: content.trim(),
      author: req.user.username,
      listId: list.id, // ← Utiliser list.id (numérique) pour la base de données
      itemId: itemId || null,
      isAnonymous: isAnonymous === true || isAnonymous === 'true'
    };

    console.log('💾 Données commentaire finales:', commentData);

    const commentId = await Comment.create(commentData);
    
    console.log('✅ Commentaire créé avec ID:', commentId);
    
    // Répondre avec les données du commentaire
    res.json({ 
      success: true, 
      message: 'Commentaire ajouté avec succès',
      comment: {
        id: commentId,
        content: commentData.content,
        author: commentData.isAnonymous ? 'Anonyme' : commentData.author,
        is_anonymous: commentData.isAnonymous,
        created_at: new Date().toISOString(),
        item_name: null
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur ajout commentaire:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout du commentaire: ' + error.message });
  }
});

// Cette route DOIT exister
app.delete('/comments/:id', async (req, res) => {
  console.log('🗑️ Route DELETE /comments/:id appelée');
  console.log('🔍 Paramètre id:', req.params.id);
  
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  try {
    const commentId = req.params.id;
    
    // Vérifier que l'ID est valide
    if (!commentId || isNaN(commentId)) {
      return res.status(400).json({ error: 'ID de commentaire invalide' });
    }

    // Récupérer le commentaire avec la liste
    const [comments] = await db.execute(
      `SELECT c.*, l.creator_id, l.uuid as list_uuid 
       FROM comments c 
       JOIN gift_lists l ON c.list_id = l.id 
       WHERE c.id = ?`,
      [commentId]
    );
    
    if (comments.length === 0) {
      return res.status(404).json({ error: 'Commentaire non trouvé' });
    }

    const comment = comments[0];
    
    // Vérifier les permissions
    if (comment.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    // Supprimer le commentaire
    await db.execute('DELETE FROM comments WHERE id = ?', [commentId]);
    
    console.log('✅ Commentaire supprimé:', commentId);
    
    res.json({ 
      success: true, 
      message: 'Commentaire supprimé'
    });
    
  } catch (error) {
    console.error('❌ Erreur suppression commentaire:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// Dans server.js - route GET /lists/:token
app.get('/lists/:token', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const list = await GiftList.findByToken(req.params.token);
    if (!list) {
      return res.render('error', { 
        title: 'Non trouvé',
        message: 'Liste non trouvée' 
      });
    }

    // ✅ CORRECTION : Vérifier les permissions d'accès
    let canAccess = false;
    
    if (list.creator_id === req.user.id) {
      // Le créateur a toujours accès
      canAccess = true;
      console.log('✅ Accès autorisé - Créateur de la liste');
    } else if (list.visibility === 'public') {
      // Listes publiques : tout le monde a accès
      canAccess = true;
      console.log('✅ Accès autorisé - Liste publique');
    } else if (list.visibility === 'private') {
      // Listes privées : vérifier si l'utilisateur est membre
      const [access] = await db.execute(
        'SELECT 1 FROM list_followers WHERE list_id = ? AND user_id = ?',
        [list.id, req.user.id]
      );
      
      if (access.length > 0) {
        canAccess = true;
        console.log('✅ Accès autorisé - Membre de la liste privée');
      } else {
        canAccess = false;
        console.log('❌ Accès refusé - Pas membre de la liste privée');
      }
    }

    if (!canAccess) {
      return res.render('list-access-request', {
        title: 'Accès à la liste',
        list,
        user: req.user,
        error: 'Cette liste est privée. Demandez au créateur de vous ajouter.'
      });
    }

    
// Dans server.js - remplacer cette partie
// Charger les items
let items = [];
try {
  items = await GiftItem.findByList(list.id); // Utilise la méthode corrigée
  console.log('✅ Items chargés avec réservations:', items.length);
} catch (itemError) {
  console.error('❌ Erreur chargement items:', itemError);
  // Fallback
  const [fallbackItems] = await db.execute(
    'SELECT * FROM gift_items WHERE list_id = ? ORDER BY created_at DESC',
    [list.id]
  );
  items = fallbackItems.map(item => ({ ...item, reserved_quantity: 0 }));
  console.log('✅ Items chargés (fallback):', items.length);
}
    
    // Charger les commentaires
    let comments = [];
    try {
      comments = await Comment.findByList(list.id);
      console.log('✅ Commentaires chargés:', comments.length);
    } catch (commentError) {
      console.error('❌ Erreur chargement commentaires:', commentError);
      // Fallback: commentaires basiques
      const [fallbackComments] = await db.execute(
        'SELECT * FROM comments WHERE list_id = ? ORDER BY created_at DESC',
        [list.id]
      );
      comments = fallbackComments;
      console.log('✅ Commentaires chargés (fallback):', comments.length);
    }
    
    // Vérifier si l'utilisateur suit cette liste (pour l'affichage des boutons)
    const [followers] = await db.execute(
      'SELECT 1 FROM list_followers WHERE list_id = ? AND user_id = ?',
      [list.id, req.user.id]
    );
    const userFollowsList = followers.length > 0;
    
    // Incrémenter les vues seulement si accès autorisé
    await GiftList.incrementViews(list.id);
    
    res.render('list-detail', {
      title: list.name,
      list,
      items,
      comments,
      user: req.user,
      isOwner: list.creator_id === req.user.id,
      userFollowsList: userFollowsList,
      allowComments: list.allow_comments
    });
    
  } catch (error) {
    console.error('❌ Erreur route /lists/:token:', error);
    res.render('error', { 
      title: 'Erreur',
      message: 'Erreur lors du chargement de la liste' 
    });
  }
});

// 1. Route stats
app.get('/stats', async (req, res) => {
  console.log('📊 Route /stats appelée'); // ← Ajouter ce log
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

    const [followedLists] = await db.execute(
      'SELECT COUNT(*) as count FROM list_followers WHERE user_id = ?',
      [req.user.id]
    );
    const followedListsCount = followedLists[0].count;

    const reservationRate = totalItems > 0 ? (reservedItems / totalItems) * 100 : 0;
    const totalViews = userLists.reduce((sum, list) => sum + list.views, 0);

    console.log('📊 Données stats calculées'); // ← Log de confirmation
    
    res.render('stats', {
      title: 'Statistiques',
      user: req.user,
      stats: {
        totalLists: userLists.length,
        followedLists: followedListsCount,
        totalViews,
        totalItems,
        reservedItems,
        reservationRate: Math.round(reservationRate),
        totalValue,
        reservedValue
      }
    });
  } catch (error) {
    console.error('❌ Erreur route /stats:', error);
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
app.post('/lists/:token/add-member', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const token = req.params.token;
    console.log('🔍 Ajout membre à liste token:', token);
    
    // ✅ CORRIGÉ : Utiliser findByToken au lieu de findById
    const list = await GiftList.findByToken(token);
    
    // Vérifier que l'utilisateur est le créateur
    if (!list || list.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const { usernameOrEmail } = req.body;
    console.log('🔍 Recherche utilisateur:', usernameOrEmail);
    
    // Trouver l'utilisateur
    const user = await User.findByUsernameOrEmail(usernameOrEmail);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier qu'on ne s'ajoute pas soi-même
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous ajouter vous-même' });
    }

    // Vérifier si l'utilisateur est déjà membre
    const [existing] = await db.execute(
      'SELECT 1 FROM list_followers WHERE list_id = ? AND user_id = ?',
      [list.id, user.id]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Cet utilisateur est déjà membre de la liste' });
    }

    // Ajouter le membre
    await db.execute(
      'INSERT INTO list_followers (list_id, user_id) VALUES (?, ?)',
      [list.id, user.id]
    );
    
    console.log('✅ Membre ajouté:', user.username, 'à la liste:', list.name);
    
    res.json({ 
      success: true, 
      message: `${user.username} a été ajouté à la liste`,
      user: { id: user.id, username: user.username }
    });
    
  } catch (error) {
    console.error('❌ Erreur ajout membre:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout du membre' });
  }
});

// Route pour retirer un membre d'une liste
app.post('/lists/:token/remove-member/:userId', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const token = req.params.token;
    const userId = req.params.userId;
    
    console.log('🔍 Retrait membre - Liste token:', token, 'User ID:', userId);
    
    // ✅ CORRIGÉ : Utiliser findByToken
    const list = await GiftList.findByToken(token);
    
    // Vérifier que l'utilisateur est le créateur
    if (!list || list.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    await GiftList.removeFollower(list.id, userId);
    
    res.json({ success: true, message: 'Membre retiré de la liste' });
    
  } catch (error) {
    console.error('❌ Erreur retrait membre:', error);
    res.status(500).json({ error: 'Erreur lors du retrait du membre' });
  }
});

// Route pour voir les membres d'une liste
app.get('/lists/:token/members', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const token = req.params.token;
    console.log('🔍 Voir membres liste token:', token);
    
    // ✅ CORRIGÉ : Utiliser findByToken
    const list = await GiftList.findByToken(token);
    
    // Vérifier que l'utilisateur est le créateur
    if (!list || list.creator_id !== req.user.id) {
      return res.status(403).render('error', {
        title: 'Erreur',
        message: 'Non autorisé - Vous devez être le créateur de la liste'
      });
    }

    const followers = await GiftList.getFollowers(list.id);
    console.log('🔍 Membres trouvés:', followers.length);
    
    res.render('list-members', {
      title: `Membres - ${list.name}`,
      list,
      followers,
      user: req.user
    });
    
  } catch (error) {
    console.error('❌ Erreur chargement membres:', error);
    res.render('error', {
      title: 'Erreur',
      message: 'Erreur lors du chargement des membres'
    });
  }
});

// Dans server.js - route POST /follow
app.post('/lists/:token/follow', async (req, res) => {
  console.log('🎯 Route POST /follow appelée');
  
  try {
    const token = req.params.token;
    const list = await GiftList.findByToken(token);
    
    if (!list) {
      return res.status(404).json({ error: 'Liste non trouvée' });
    }

    console.log('🔍 Liste trouvée:', {
      id: list.id,
      name: list.name,
      visibility: list.visibility,
      creator_id: list.creator_id,
      current_user: req.user.id
    });

    // Vérifier que l'utilisateur n'est pas le créateur
    if (list.creator_id === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas suivre votre propre liste' });
    }

    // ✅ NOUVELLE LOGIQUE : Autoriser le suivi si l'utilisateur a accès à la liste
    let canFollow = false;
    
    if (list.visibility === 'public') {
      // Listes publiques : tout le monde peut suivre
      canFollow = true;
      console.log('✅ Liste publique - autorisation accordée');
    } else if (list.visibility === 'private') {
      // Listes privées : vérifier si l'utilisateur a déjà accès
      const [access] = await db.execute(
        'SELECT 1 FROM list_followers WHERE list_id = ? AND user_id = ?',
        [list.id, req.user.id]
      );
      
      if (access.length > 0) {
        // L'utilisateur a déjà accès, il peut "suivre" (rester membre)
        canFollow = true;
        console.log('✅ Liste privée - utilisateur a déjà accès');
      } else {
        // L'utilisateur n'a pas accès, il ne peut pas suivre
        console.log('❌ Liste privée - utilisateur n\'a pas accès');
        return res.status(403).json({ 
          error: 'Cette liste est privée. Demandez au créateur de vous ajouter.' 
        });
      }
    }

    if (!canFollow) {
      return res.status(403).json({ error: 'Accès non autorisé à cette liste' });
    }

    // Ajouter le follower (ou confirmer l'accès pour les listes privées)
    await GiftList.addFollower(list.id, req.user.id);
    
    console.log('✅ Follow réussi');
    res.json({ 
      success: true, 
      message: list.visibility === 'public' 
        ? 'Vous suivez maintenant cette liste' 
        : 'Vous avez accès à cette liste privée'
    });
    
  } catch (error) {
    console.error('❌ Erreur follow liste:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dans server.js - corriger la route /stats/list/:id
app.get('/stats/list/:token', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }
  
  try {
    const token = req.params.token;
    console.log('📊 Route stats/list appelée avec token:', token);
    
    // ✅ CORRIGÉ : Utiliser findByToken au lieu de findById
    let list;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(token)) {
      console.log('🔍 Token est un UUID');
      list = await GiftList.findByToken(token);
    } else {
      console.log('🔍 Token est numérique');
      list = await GiftList.findById(token);
    }
    
    console.log('🔍 Liste trouvée:', list ? {
      id: list.id,
      uuid: list.uuid,
      name: list.name,
      creator_id: list.creator_id,
      current_user: req.user.id
    } : 'null');
    
    if (!list) {
      return res.status(404).render('error', { 
        title: 'Erreur',
        message: 'Liste non trouvée' 
      });
    }

    // Vérifier que l'utilisateur est le créateur
    if (list.creator_id !== req.user.id) {
      console.log('❌ Accès refusé - Créateur:', list.creator_id, 'Utilisateur:', req.user.id);
      return res.status(403).render('error', { 
        title: 'Accès non autorisé',
        message: 'Vous devez être le créateur de la liste pour voir ses statistiques' 
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

    console.log('✅ Statistiques calculées pour:', list.name);
    
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
    console.error('❌ Erreur stats/list:', error);
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

app.post('/lists/:token/unfollow', async (req, res) => {
  if (!req.isAuthenticated()) {
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    return res.redirect('/auth/login');
  }
  
  try {
    const token = req.params.token;
    console.log('🔍 Unfollow liste token:', token);
    
    // Trouver la liste par UUID pour obtenir l'ID
    const list = await GiftList.findByToken(token);
    if (!list) {
      return res.status(404).json({ error: 'Liste non trouvée' });
    }

    const success = await GiftList.removeFollower(list.id, req.user.id);
    
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.xhr) {
      res.json({ success: true, message: 'Vous ne suivez plus cette liste' });
    } else {
      res.redirect('/lists');
    }
  } catch (error) {
    console.error('❌ Erreur unfollow:', error);
    
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.xhr) {
      res.status(500).json({ error: 'Erreur serveur lors de l\'arrêt du suivi' });
    } else {
      res.redirect('/lists');
    }
  }
});


app.get('/items/:id/availability', async (req, res) => {
  try {
    const itemId = req.params.id;
    
    const item = await GiftItem.findById(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    
    const reservedQuantity = await GiftItem.getReservedQuantity(itemId);
    const available = item.quantity - reservedQuantity;
    
    res.json({
      success: true,  // ← Ajoutez ceci
      itemId: itemId,
      totalQuantity: item.quantity,
      reservedQuantity: reservedQuantity,
      availableQuantity: available,
      isAvailable: available > 0
    });
    
  } catch (error) {
    console.error('❌ Erreur vérification disponibilité:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification' });
  }
});

// Route pour réserver un item - VERSION CORRIGÉE
app.post('/items/:id/reserve', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  // Démarrer une transaction pour éviter les conflits
  const connection = await db.getConnection();
  await connection.beginTransaction();
  
  try {
    const { quantity, email, isAnonymous, message } = req.body;
    const itemId = req.params.id;
    
    console.log('🎯 Réservation via modal:', { itemId, quantity, email, isAnonymous, message });
    
    // Vérifier que l'item existe
    const item = await connection.execute('SELECT * FROM gift_items WHERE id = ?', [itemId]);
    if (item[0].length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    const itemData = item[0][0];
    
    // Vérifier la disponibilité AVANT réservation (lecture seule)
    const [reservedResult] = await connection.execute(
      `SELECT COALESCE(SUM(quantity), 0) as total_reserved 
       FROM reservations 
       WHERE item_id = ? AND status = 'confirmed'`,
      [itemId]
    );
    
    const currentReserved = reservedResult[0].total_reserved;
    const available = itemData.quantity - currentReserved;
    
    console.log(`📊 Disponibilité AVANT: ${available} disponible sur ${itemData.quantity} (déjà réservé: ${currentReserved})`);
    
    if (quantity > available) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: `Quantité non disponible. Il ne reste que ${available} article(s)` });
    }
    
    // Créer la réservation CONFIRMÉE
    const [reservationResult] = await connection.execute(
      `INSERT INTO reservations 
       (item_id, list_id, reserved_by, reserved_by_name, quantity, expires_at, is_anonymous, status, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [itemId, itemData.list_id, email, isAnonymous ? null : req.user.username, quantity, new Date(), isAnonymous, 'confirmed']
    );
    
    console.log('✅ Réservation créée, ID:', reservationResult.insertId);

    // Mettre à jour la quantité réservée dans gift_items
    const newTotalReserved = currentReserved + quantity;
    await connection.execute(
      'UPDATE gift_items SET reserved_quantity = ? WHERE id = ?',
      [newTotalReserved, itemId]
    );
    
    console.log(`✅ Après réservation: ${itemData.quantity - newTotalReserved} disponible, ${newTotalReserved} réservé`);

    // Ajouter un commentaire si message
    if (message && message.trim() !== '') {
      await connection.execute(
        `INSERT INTO comments (content, author, list_id, item_id, is_anonymous) 
         VALUES (?, ?, ?, ?, ?)`,
        [message.trim(), isAnonymous ? 'Anonyme' : req.user.username, itemData.list_id, itemId, isAnonymous]
      );
    }
    
    // VALIDER la transaction
    await connection.commit();
    connection.release();
    
    console.log('=== RÉSERVATION FINALISÉE ===');
    console.log(`📊 Item ${itemId}: ${newTotalReserved} réservé sur ${itemData.quantity}`);
    
    res.json({ 
      success: true, 
      message: isAnonymous 
        ? 'Réservation effectuée avec succès ! 🎁\nLe créateur ne saura pas que c\'est vous.' 
        : 'Réservation effectuée avec succès ! 🎁\nLe créateur a été notifié.',
      reservationId: reservationResult.insertId,
      newReservedQuantity: newTotalReserved,
      availableQuantity: itemData.quantity - newTotalReserved,
      isAnonymous: isAnonymous
    });
    
  } catch (error) {
    // ANNULER en cas d'erreur
    await connection.rollback();
    connection.release();
    
    console.error('❌ Erreur réservation:', error);
    res.status(500).json({ error: 'Erreur lors de la réservation: ' + error.message });
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
app.get('/lists/:token/reservations', async (req, res) => {
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

app.get("/stats", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "stats.html"))
);

// Dans la route DELETE /lists/:id
app.delete('/lists/:id', async (req, res) => {
    console.log('🗑️ Route DELETE /lists/:id appelée');
    
    if (!req.isAuthenticated()) {
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(401).json({ error: 'Non authentifié' });
        }
        return res.redirect('/auth/login');
    }
    
    try {
        const token = req.params.id;
        console.log('🔍 Token/ID reçu:', token);
        
        let list;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        if (uuidRegex.test(token)) {
            list = await GiftList.findByToken(token);
        } else {
            list = await GiftList.findById(token);
        }
        
        if (!list) {
            console.log('❌ Liste non trouvée');
            if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(404).json({ error: 'Liste non trouvée' });
            }
            return res.redirect('/home');
        }

        // Vérifier que l'utilisateur est le créateur
        if (list.creator_id !== req.user.id) {
            console.log('❌ Non autorisé');
            if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(403).json({ error: 'Non autorisé' });
            }
            return res.redirect('/home');
        }

        console.log('✅ Suppression de la liste:', list.name);
        await GiftList.delete(list.id, req.user.id);

        // RÉPONSE CLAIRE selon le type de requête
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            console.log('✅ Réponse AJAX - succès');
            return res.json({ 
                success: true, 
                message: 'Liste supprimée avec succès',
                redirect: '/home'  // ← Indiquer la redirection
            });
        } else {
            console.log('✅ Redirection directe vers /home');
            return res.redirect('/home');  // ← return important
        }

    } catch (error) {
        console.error('❌ Erreur suppression liste:', error);
        
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(500).json({ error: 'Erreur lors de la suppression de la liste' });
        } else {
            return res.redirect('/home');
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



// 🔄 REDIRECTION POUR LES UUID DIRECTS - PLUS SPÉCIFIQUE
app.get('/:uuid', async (req, res) => {
  const { uuid } = req.params;
  
  console.log('🔄 Tentative de redirection pour:', uuid);
  
  // Vérifier si c'est un UUID valide (format strict)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (uuidRegex.test(uuid)) {
    try {
      // Vérifier si une liste existe avec cet UUID
      const [lists] = await db.execute(
        'SELECT id FROM gift_lists WHERE uuid = ?',
        [uuid]
      );
      
      if (lists.length > 0) {
        console.log('✅ Redirection vers liste:', uuid);
        return res.redirect(`/lists/${uuid}`);
      }
    } catch (error) {
      console.error('❌ Erreur vérification UUID:', error);
    }
  }
  
  // Si pas un UUID valide ou liste non trouvée, vérifier si c'est une route existante
  const existingRoutes = ['stats', 'profile', 'home', 'search', 'notifications'];
  if (existingRoutes.includes(uuid)) {
    console.log('🔄 Redirection vers route existante:', uuid);
    return res.redirect(`/${uuid}`);
  }
  
  // Sinon, page 404
  console.log('❌ UUID/route non valide, page 404');
  res.status(404).render('error', {
    title: 'Page non trouvée',
    message: 'La page demandée n\'existe pas'
  });
});
/* Local development server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎉 Serveur démarré sur http://localhost:${PORT}`);
});
*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur en production sur le port ${PORT}`);
  console.log(`🌐 URL: https://sofyanojeer.fr/gavalist`);
});