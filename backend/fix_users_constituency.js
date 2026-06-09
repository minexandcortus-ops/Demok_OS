const { Client } = require('pg'); 

async function updateCitizens() {
  const client = new Client({ user: 'demok_user', password: 'demok_password', database: 'demok_db', host: 'localhost', port: 5432 }); 
  await client.connect();

  try {
    // Get all citizens without constituencyCode but with postalCode
    const citizensRes = await client.query('SELECT id, "postalCode" FROM citizen WHERE "constituencyCode" IS NULL AND "postalCode" IS NOT NULL');
    const citizens = citizensRes.rows;

    console.log(`Found ${citizens.length} citizens to update.`);

    for (const citizen of citizens) {
      const isDomTom = citizen.postalCode.startsWith('97') || citizen.postalCode.startsWith('98');
      const deptCode = isDomTom ? citizen.postalCode.substring(0, 3) : citizen.postalCode.substring(0, 2);

      const deputyRes = await client.query('SELECT "constituencyCode" FROM deputy WHERE "constituencyCode" LIKE $1 AND "isActive" = true LIMIT 1', [`${deptCode}-%`]);
      
      if (deputyRes.rows.length > 0) {
        const constituencyCode = deputyRes.rows[0].constituencyCode;
        await client.query('UPDATE citizen SET "constituencyCode" = $1 WHERE id = $2', [constituencyCode, citizen.id]);
        console.log(`Updated citizen ${citizen.id} with constituency ${constituencyCode}`);
      } else {
        console.log(`No active deputy found for department ${deptCode} for citizen ${citizen.id}`);
      }
    }

    console.log('Update finished.');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

updateCitizens();
