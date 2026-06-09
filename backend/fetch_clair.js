const https = require('https');
const fs = require('fs');
https.get('https://clair-production.up.railway.app/api/v1/scrutins?limit=2', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('clair_sample.json', JSON.stringify(JSON.parse(data), null, 2));
    console.log('Saved to clair_sample.json');
  });
});
