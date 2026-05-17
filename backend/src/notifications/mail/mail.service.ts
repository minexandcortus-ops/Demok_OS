import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly config: ConfigService,
  ) {}

  async sendPasswordResetEmail(email: string, token: string, pseudo: string) {
    const frontendUrl = this.config.get('FRONTEND_URL') || 'https://Démok.fr';
    const url = `${frontendUrl}/reset-password?token=${token}`;
    
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Réinitialisation de votre mot de passe Démok',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <h2 style="color: #007AFF; text-align: center;">Démok</h2>
            <p>Bonjour <strong>${pseudo}</strong>,</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Démok.</p>
            <p>Pour définir un nouveau mot de passe, veuillez cliquer sur le bouton ci-dessous :</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${url}" style="display: inline-block; background-color: #007AFF; color: #ffffff; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; font-family: sans-serif; min-width: 200px;">
                Réinitialiser mon mot de passe
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">Ce lien est valable pendant 1 heure.</p>
            <p style="color: #666; font-size: 14px;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">L'équipe Démok</p>
          </div>
        `,
      });
      this.logger.log(`Email de réinitialisation envoyé à ${email}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email à ${email}: ${error.message}`);
      throw error;
    }
  }

  async sendOtpEmail(email: string, code: string, pseudo: string) {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: '🗳️ Votre code de vérification Démok',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <h2 style="color: #007AFF; text-align: center;">Démok</h2>
            <p>Bonjour <strong>${pseudo}</strong>, bienvenue dans la communauté ! 🎉</p>
            <p>Pour activer ton compte, entre ce code dans l'application :</p>
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background-color: #F0F4FF; border: 2px solid #007AFF; border-radius: 12px; padding: 20px 40px;">
                <span style="font-size: 36px; font-weight: bold; color: #007AFF; letter-spacing: 8px;">${code}</span>
              </div>
            </div>
            <p style="color: #666; font-size: 14px; text-align: center;">Ce code est valable pendant <strong>30 minutes</strong>.</p>
            <p style="color: #666; font-size: 14px;">Si tu n'as pas créé de compte Démok, tu peux ignorer cet email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">L'équipe Démok — Démocratisons la Démocratie</p>
          </div>
        `,
      });
      this.logger.log(`Email OTP envoyé à ${email}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'OTP à ${email}: ${error.message}`);
      throw error;
    }
  }
}
