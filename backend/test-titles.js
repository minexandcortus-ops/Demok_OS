const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
    try {
        const response = await axios.get('https://www.assemblee-nationale.fr/dyn/17/scrutins', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            timeout: 10000
        });
        const $ = cheerio.load(response.data);
        const list = [];
        $('a[href^="/dyn/17/scrutins/"]').each((_, el) => {
            const href = $(el).attr('href');
            const title = $(el).text().trim();
            if (title.length > 20 && !title.includes("Analyse complète du scrutin")) {
                const id = href.split('/').pop();
                if (id) {
                    list.push({ id, title });
                }
            }
        });
        console.log(list.slice(0, 5)); // print first 5
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
