const https = require('https');
https.get('https://www.assemblee-nationale.fr/dyn/17/scrutins', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matches = data.match(/\/dyn\/17\/scrutins\/\d+/g);
    console.log("Derniers scrutins AN (via /dyn/17/scrutins):", matches ? matches.slice(0, 5) : 'aucun');
  });
}).on('error', err => console.log(err));
