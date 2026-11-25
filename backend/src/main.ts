import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    
    // Prefix all API routes so they don't conflict with frontend
    app.setGlobalPrefix('api');

    // Enable CORS
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Accept, Authorization, x-admin-key, Cache-Control, Pragma, Expires, Bypass-Tunnel-Reminder',
        credentials: true,
    });

    // Le front (Flutter Web) est servi par Firebase Hosting : l'API ne sert que /api et /uploads.

    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`Application running on port ${port}`);
}
bootstrap();

