#!/bin/bash
echo "🚀 Déploiement de GavaList sur AlwaysData..."

# Se positionner dans le répertoire
cd ~/www/gavalist

# Sauvegarder l'ancienne version
if [ -d "app-old" ]; then
    rm -rf app-old
fi
if [ -d "app" ]; then
    mv app app-old
fi

# Créer le nouveau répertoire
mkdir app
cd app

# Copier les fichiers (à adapter selon votre méthode de déploiement)
# Si vous utilisez Git :
git clone https://github.com/SofyanOjeer/gift-list-platform.git .
# Ou copiez via FTP/SSH

# Installer les dépendances
npm install --production

# Copier la configuration
cp ../app-old/.env.production . || echo "⚠️  Fichier .env.production non trouvé"

# Démarrer l'application
pm2 start server.js --name "gavalist" --env production

echo "✅ Déploiement terminé!"
echo "🌐 Vérifiez: https://sofyanojeer.fr/gavalist"