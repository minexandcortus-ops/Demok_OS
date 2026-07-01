const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
    try {
        const response = await axios.get('https://www.assemblee-nationale.fr/dyn/17/scrutins/7313', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            timeout: 10000
        });
        const $ = cheerio.load(response.data);
        console.log('Title:', $('h1').text().trim());
        console.log('Title 2:', $('h2').text().trim());
        console.log('Document numbers?', response.data.match(/n°\s*\d+/gi));
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
