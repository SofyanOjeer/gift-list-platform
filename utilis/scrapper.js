const axios = require('axios');
const cheerio = require('cheerio');

class ProductScraper {
  static async scrapeProductInfo(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Amazon
      if (url.includes('amazon.')) {
        return this.scrapeAmazon($);
      }
      // Fnac
      else if (url.includes('fnac.')) {
        return this.scrapeFnac($);
      }
      // Etsy
      else if (url.includes('etsy.')) {
        return this.scrapeEtsy($);
      }
      // Site générique
      else {
        return this.scrapeGeneric($);
      }
    } catch (error) {
      console.error('Erreur scraping:', error.message);
      return null;
    }
  }

  static scrapeAmazon($) {
    const name = $('#productTitle').text().trim() || $('h1.a-size-large').text().trim();
    const priceText = $('.a-price-whole').first().text().trim();
    const price = priceText ? parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.')) : null;
    const image = $('#landingImage').attr('src') || $('.a-dynamic-image').attr('src');
    
    return { name, price, image };
  }

  static scrapeFnac($) {
    const name = $('h1[data-product-name]').text().trim() || $('h1').first().text().trim();
    const priceText = $('.f-priceBox__price').first().text().trim();
    const price = priceText ? parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.')) : null;
    const image = $('.js-zoom-image').attr('src') || $('.at-identity__image').attr('src');
    
    return { name, price, image };
  }

  static scrapeEtsy($) {
    const name = $('h1[data-buy-box-listing-title]').text().trim() || $('h1').first().text().trim();
    const priceText = $('.wt-text-title-03 .currency-value').first().text().trim();
    const price = priceText ? parseFloat(priceText.replace(/[^\d.]/g, '')) : null;
    const image = $('#image-carousel-container img').first().attr('src');
    
    return { name, price, image };
  }

  static scrapeGeneric($) {
    const name = $('h1').first().text().trim() || $('title').text().trim();
    const priceText = $('[class*="price"]').first().text().trim();
    const price = this.extractPrice(priceText);
    const image = $('img').first().attr('src');
    
    return { name, price, image };
  }

  static extractPrice(text) {
    const match = text.match(/(\d+[.,]\d+)/);
    return match ? parseFloat(match[1].replace(',', '.')) : null;
  }
}

module.exports = ProductScraper;