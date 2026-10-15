import { Inject, Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import Handlebars from 'handlebars';
import { join } from 'path';
import { EMAIL_PROVIDER } from '../email.contract';
import type { EmailProvider } from '../email.contract';

export interface SendTemplatedEmailParams {
  to: string | string[];
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);
  private readonly templateCache = new Map<
    string,
    Handlebars.TemplateDelegate
  >();

  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
  ) {}

  async send(params: SendTemplatedEmailParams): Promise<void> {
    const html = this.renderTemplate(params.template, params.context);
    await this.emailProvider.sendEmail({
      to: params.to,
      subject: params.subject,
      html,
    });
  }

  private renderTemplate(
    templateName: string,
    context: Record<string, unknown>,
  ): string {
    let compiled = this.templateCache.get(templateName);
    if (!compiled) {
      const source = this.loadTemplateSource(templateName);
      compiled = Handlebars.compile(source);
      this.templateCache.set(templateName, compiled);
    }
    return compiled(context);
  }

  private loadTemplateSource(templateName: string): string {
    const fileName = `${templateName}.hbs`;
    const candidates = [
      // dist/common/notification/channels → dist/templates
      join(__dirname, '..', '..', '..', 'templates', fileName),
      // src/common/notification/channels → src/templates (ts-node / watch)
      join(__dirname, '..', '..', '..', '..', 'src', 'templates', fileName),
      // cwd-relative fallback
      join(process.cwd(), 'src', 'templates', fileName),
      join(process.cwd(), 'dist', 'templates', fileName),
    ];

    for (const path of candidates) {
      if (existsSync(path)) {
        return readFileSync(path, 'utf8');
      }
    }

    this.logger.error(
      `Template not found: ${templateName} (tried ${candidates.join(', ')})`,
    );
    throw new Error(`Email template not found: ${templateName}`);
  }
}
