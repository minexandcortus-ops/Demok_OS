const { Client } = require('pg'); 
const client = new Client({ user: 'demok_user', password: 'demok_password', database: 'demok_db', host: 'localhost', port: 5432 }); 
client.connect()
  .then(() => client.query('SELECT "titleOfficial", "latestTextUrl", "officialUrl" FROM law LIMIT 50;'))
  .then(res => { 
     const row = res.rows.find(r => r.latestTextUrl && r.latestTextUrl.includes('l17b2869'));
     if (row) {
         console.table([row]);
     } else {
         console.table(res.rows.filter(r => r.latestTextUrl));
     }
     client.end(); 
   });
