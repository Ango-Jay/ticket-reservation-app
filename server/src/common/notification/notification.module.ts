import { Global, Module } from '@nestjs/common';
import { EmailChannel } from './channels/email.channel';
import { EMAIL_PROVIDER } from './email.contract';
import { NotificationService } from './notification.service';
import { ResendEmailProvider } from './providers/resend';

@Global()
@Module({
  providers: [
    NotificationService,
    EmailChannel,
    ResendEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useExisting: ResendEmailProvider,
    },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
