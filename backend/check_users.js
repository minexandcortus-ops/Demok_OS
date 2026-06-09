const { Client } = require('pg'); 
const client = new Client({ user: 'demok_user', password: 'demok_password', database: 'demok_db', host: 'localhost', port: 5432 }); 
client.connect().then(() => client.query('SELECT u.id, u."emailVerified", u."otpCode", c.pseudo FROM "user" u LEFT JOIN citizen c ON c."userId" = u.id ORDER BY u."createdAt" DESC LIMIT 5')).then(res => { 
  console.table(res.rows); 
  client.end(); 
}).catch(err => { 
  console.error(err); 
  client.end(); 
});
