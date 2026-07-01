const axios = require('axios');
const cheerio = require('cheerio');
(async () => {
    try {
        const response = await axios.get('https://www.assemblee-nationale.fr/dyn/17/scrutins/7313', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        const $ = cheerio.load(response.data);
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('dossier')) {
                console.log('Found dossier link:', href);
            }
        });
        console.log('Any DLR... ref?', response.data.match(/DLR5L17N\d+/g));
        console.log('Document numbers?', response.data.match(/n°\s*\d+/gi));
    } catch (e) {
        console.log("Error:", e.message);
    }
})();
