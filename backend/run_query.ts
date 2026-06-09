import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';

async function run() {
    try {
        const app = await NestFactory.createApplicationContext(AppModule);
        const ds = app.get(DataSource);
        await ds.query('ALTER TABLE deputy ADD COLUMN IF NOT EXISTS "lastName" varchar;');
        await app.close();
        console.log("SUCCESS");
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
