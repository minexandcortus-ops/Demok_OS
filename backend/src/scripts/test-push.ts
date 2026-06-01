import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { NotificationService } from '../notifications/notification.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

/**
 * Script pour tester l'envoi d'une notification push.
 * Usage: npx ts-node src/scripts/test-push.ts "votre_email@exemple.com"
 */
async function bootstrap() {
    const email = process.argv[2];
    if (!email) {
        console.error('❌ Veuillez fournir l\'email de l\'utilisateur à notifier.');
        console.error('Exemple: npx ts-node src/scripts/test-push.ts "mario@demok.fr"');
        process.exit(1);
    }

    console.log(`🚀 Préparation de la notification de test pour: ${email}`);
    
    const app = await NestFactory.createApplicationContext(AppModule, { 
        logger: ['error', 'warn'] 
    });
    
    try {
        const userRepository = app.get<Repository<User>>(getRepositoryToken(User));
        const notificationService = app.get(NotificationService);

        const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
        const user = await userRepository.findOne({ where: { emailHash } });
        
        if (!user) {
            console.error(`❌ Utilisateur non trouvé avec l'email: ${email}`);
            process.exit(1);
        }

        if (!user.fcmToken) {
            console.error(`❌ L'utilisateur ${email} n'a pas de token FCM d'enregistré. (Il doit se connecter et autoriser les notifications sur son téléphone).`);
            process.exit(1);
        }

        console.log(`✅ Token trouvé. Envoi de la notification en cours...`);

        await notificationService.sendPushNotification(
            user.fcmToken,
            "🚀 Test Démok",
            "Ceci est une notification de test depuis votre ordinateur !",
            { type: 'test' }
        );

        console.log('✅ Notification envoyée avec succès à Firebase ! (Vérifiez le téléphone)');
    } catch (error) {
        console.error('❌ Erreur lors du test:', error);
    } finally {
        await app.close();
        process.exit(0);
    }
}

bootstrap();
