import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { VoteRegistry } from '../votes/vote-registry.entity';
import { User } from '../users/user.entity';
import { Law } from '../laws/law.entity';
import { NotificationService } from './notification.service';
import { NotificationProcessor } from './notification.processor';
import { MailModule } from './mail/mail.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([VoteRegistry, User, Law]),
        MailModule,

        // Queue Bull pour notifications
        BullModule.registerQueue({
            name: 'notifications',
        }),
    ],
    providers: [
        NotificationService,
        NotificationProcessor,
    ],
    exports: [NotificationService, MailModule],
})
export class NotificationModule { }
