/**
 * Arrondit et formate un prix
 * @param {number|string} price - Le prix à formater
 * @returns {number} Prix arrondi à 2 décimales
 */
function roundPrice(price) {
  if (!price && price !== 0) return null;
  
  // Convertir en nombre (gérer les virgules)
  const number = typeof price === 'string' 
    ? parseFloat(price.replace(',', '.').replace(/\s/g, '')) 
    : Number(price);
  
  if (isNaN(number)) return null;
  
  // Arrondir à 2 décimales
  return Math.round(number * 100) / 100;
}

/**
 * Formate un prix pour l'affichage
 * @param {number|string} price - Le prix à formater
 * @returns {string} Prix formaté (ex: "19,99 €")
 */
function formatPriceForDisplay(price) {
  const rounded = roundPrice(price);
  if (rounded === null) return 'Non spécifié';
  
  return new Intl.NumberFormat('fr-FR', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rounded);
}

/**
 * Nettoie et valide un prix saisi par l'utilisateur
 * @param {string} input - Input utilisateur
 * @returns {number|null} Prix nettoyé ou null si invalide
 */
function cleanPriceInput(input) {
  if (!input) return null;
  
  // Remplacer la virgule par un point et supprimer les espaces
  const cleaned = input.replace(',', '.').replace(/\s/g, '');
  
  // Vérifier que c'est un nombre valide
  const number = parseFloat(cleaned);
  if (isNaN(number) || number < 0) return null;
  
  return roundPrice(number);
}

module.exports = {
  roundPrice,
  formatPriceForDisplay,
  cleanPriceInput
};