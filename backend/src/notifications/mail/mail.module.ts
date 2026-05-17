import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        transport: {
          host: config.get('SMTP_HOST'),
          port: parseInt(config.get('SMTP_PORT')),
          secure: config.get('SMTP_PORT') === '465',
          auth: {
            user: config.get('SMTP_USER'),
            pass: config.get('SMTP_PASSWORD'),
          },
          dkim: config.get('DKIM_PRIVATE_KEY') ? {
            domainName: 'demok.fr',
            keySelector: 'default',
            privateKey: config.get('DKIM_PRIVATE_KEY').replace(/\\n/g, '\n'),
          } : undefined,
        },
        defaults: {
          from: `"Démok" <${config.get('SMTP_FROM')}>`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
