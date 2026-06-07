import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

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

    // Serve Flutter Web App
    const webBuildPath = join(process.cwd(), '..', 'mobile', 'build', 'web');
    app.useStaticAssets(webBuildPath);
    
    
    // Fallback to index.html for SPA routing
    app.use((req: any, res: any, next: any) => {
        if (req.method === 'GET' && !req.path.startsWith('/api')) {
            res.sendFile(join(webBuildPath, 'index.html'));
        } else {
            next();
        }
    });

    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`Application running on port ${port}`);
}
bootstrap();

