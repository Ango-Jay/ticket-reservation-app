import { Injectable } from '@nestjs/common';
import { EmailChannel } from './channels/email.channel';

export interface NotifyEmailParams {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

@Injectable()
export class NotificationService {
  constructor(private readonly emailChannel: EmailChannel) {}

  async sendEmail(params: NotifyEmailParams): Promise<void> {
    await this.emailChannel.send(params);
  }
}
