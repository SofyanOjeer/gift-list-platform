const axios = require('axios');
const cheerio = require('cheerio');

class ScraperService {
    static async extractProductInfo(url) {
        try {
            console.log('🔍 Extraction des données depuis:', url);
            
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            
            // Extraction du titre
            const title = this.extractTitle($);
            
            // Extraction du prix
            const price = this.extractPrice($);
            
            // Extraction de l'image
            const image = this.extractImage($, url);
            
            // Extraction de la description
            const description = this.extractDescription($);
            
            return {
                success: true,
                title: title || null,
                price: price || null,
                image: image || null,
                description: description || null
            };
            
        } catch (error) {
            console.error('❌ Erreur extraction:', error.message);
            return {
                success: false,
                error: 'Impossible d\'extraire les informations depuis cette URL'
            };
        }
    }

    static extractTitle($) {
        // Priorité des sélecteurs pour le titre
        const selectors = [
            'meta[property="og:title"]',
            'meta[name="twitter:title"]',
            'h1.product-title',
            'h1.product-name',
            'h1.title',
            'h1',
            'title'
        ];

        for (const selector of selectors) {
            const element = $(selector);
            if (element.length) {
                const title = element.attr('content') || element.text();
                if (title && title.trim()) {
                    return title.trim().substring(0, 200);
                }
            }
        }
        return null;
    }

    static extractPrice($) {
        // Priorité des sélecteurs pour le prix
        const priceSelectors = [
            'meta[property="product:price:amount"]',
            'meta[property="og:price:amount"]',
            '[class*="price"]',
            '.price',
            '.prix',
            '.cost',
            '.amount',
            '[itemprop="price"]'
        ];

        for (const selector of priceSelectors) {
            const element = $(selector);
            if (element.length) {
                let priceText = element.attr('content') || element.text();
                
                if (priceText) {
                    // Nettoyage du texte du prix
                    priceText = priceText.replace(/[^\d,.]/g, '').replace(',', '.');
                    const price = parseFloat(priceText);
                    
                    if (!isNaN(price) && price > 0) {
                        return price;
                    }
                }
            }
        }
        return null;
    }

    static extractImage($, baseUrl) {
        // Priorité des sélecteurs pour l'image
        const imageSelectors = [
            'meta[property="og:image"]',
            'meta[name="twitter:image"]',
            '[itemprop="image"]',
            '.product-image',
            '.main-image',
            'img[class*="product"]',
            'img[src*="product"]'
        ];

        for (const selector of imageSelectors) {
            const element = $(selector);
            if (element.length) {
                let imageUrl = element.attr('content') || element.attr('src');
                
                if (imageUrl) {
                    // Conversion des URLs relatives en absolues
                    if (imageUrl.startsWith('//')) {
                        imageUrl = 'https:' + imageUrl;
                    } else if (imageUrl.startsWith('/')) {
                        const urlObj = new URL(baseUrl);
                        imageUrl = urlObj.origin + imageUrl;
                    }
                    
                    // Validation de l'URL de l'image
                    if (this.isValidImageUrl(imageUrl)) {
                        return imageUrl;
                    }
                }
            }
        }
        return null;
    }

    static extractDescription($) {
        const descriptionSelectors = [
            'meta[property="og:description"]',
            'meta[name="description"]',
            '[itemprop="description"]',
            '.product-description',
            '.description'
        ];

        for (const selector of descriptionSelectors) {
            const element = $(selector);
            if (element.length) {
                const description = element.attr('content') || element.text();
                if (description && description.trim()) {
                    return description.trim().substring(0, 300);
                }
            }
        }
        return null;
    }

    static isValidImageUrl(url) {
        return url.match(/\.(jpeg|jpg|gif|png|webp)$/) !== null;
    }
}

module.exports = ScraperService;