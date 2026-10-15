import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { Env, EnvironmentVariables } from '../../../config/env';
import type { EmailProvider, SendEmailOptions } from '../email.contract';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);
  private readonly client: Resend;
  private readonly from: string;

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    const apiKey = this.config.getOrThrow(Env.RESEND_API_KEY, { infer: true });
    this.from = this.config.getOrThrow(Env.EMAIL_FROM, { infer: true });
    this.client = new Resend(apiKey);
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      ...(options.text ? { text: options.text } : {}),
    });

    if (error) {
      this.logger.error(`Resend send failed: ${error.message}`);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    this.logger.debug(`Email sent via Resend id=${data?.id}`);
  }
}
