const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'demok_user',
    password: process.env.DB_PASSWORD || 'demok_password',
    database: process.env.DB_NAME || 'demok_db',
});

async function fixEnum() {
    await client.connect();
    console.log('Connected to database.\n');

    try {
        // 1. Voir les valeurs actuelles
        const currentValues = await client.query('SELECT DISTINCT status FROM law');
        console.log('Current status values:', currentValues.rows.map(r => r.status));

        const enumValues = await client.query(`
            SELECT e.enumlabel 
            FROM pg_enum e 
            JOIN pg_type t ON e.enumtypid = t.oid 
            WHERE t.typname = 'law_status_enum'
            ORDER BY e.enumsortorder
        `);
        console.log('Current enum values in DB:', enumValues.rows.map(r => r.enumlabel));

        // 2. Stratégie : changer le type de colonne en TEXT, recréer l'enum, reconvertir
        console.log('\nStep 1: Converting column to TEXT...');
        await client.query(`ALTER TABLE law ALTER COLUMN status TYPE TEXT USING status::TEXT`);

        console.log('Step 2: Dropping old enum (CASCADE)...');
        await client.query(`DROP TYPE IF EXISTS law_status_enum CASCADE`);

        console.log('Step 3: Creating new enum with all required values...');
        await client.query(`
            CREATE TYPE law_status_enum AS ENUM (
                'UPCOMING',
                'PENDING',
                'VOTED_AN',
                'AT_SENATE',
                'VALIDATED',
                'REJECTED'
            )
        `);

        // 3. Migrer les données
        console.log('Step 4: Migrating old values...');
        await client.query(`UPDATE law SET status = 'VOTED_AN' WHERE status = 'VOTED'`);
        await client.query(`UPDATE law SET status = 'VALIDATED' WHERE status = 'PROMULGATED'`);
        await client.query(`UPDATE law SET status = 'PENDING' WHERE status NOT IN ('UPCOMING','PENDING','VOTED_AN','AT_SENATE','VALIDATED','REJECTED')`);

        // 4. Reconvertir la colonne vers l'enum
        console.log('Step 5: Converting column back to enum...');
        await client.query(`ALTER TABLE law ALTER COLUMN status TYPE law_status_enum USING status::law_status_enum`);

        // 5. Vérifier
        const finalValues = await client.query('SELECT DISTINCT status FROM law');
        console.log('\n✅ Final status values:', finalValues.rows.map(r => r.status));

        const finalEnum = await client.query(`
            SELECT e.enumlabel 
            FROM pg_enum e 
            JOIN pg_type t ON e.enumtypid = t.oid 
            WHERE t.typname = 'law_status_enum'
            ORDER BY e.enumsortorder
        `);
        console.log('✅ Final enum values:', finalEnum.rows.map(r => r.enumlabel));
        console.log('\n✅ Enum migration completed successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

fixEnum();
