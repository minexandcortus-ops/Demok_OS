const https = require('https');
https.get('https://www2.assemblee-nationale.fr/scrutins/liste/(legislature)/17', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matches = data.match(/Scrutin n° \d+/g);
    console.log("Derniers scrutins AN:", matches ? matches.slice(0, 5) : 'aucun');
  });
}).on('error', err => console.log(err));
