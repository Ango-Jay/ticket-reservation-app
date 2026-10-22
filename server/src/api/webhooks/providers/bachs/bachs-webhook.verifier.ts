import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Env, EnvironmentVariables } from '../../../../config/env';
import type {
  WebhookSignatureHeaders,
  WebhookVerifier,
} from '../../webhook.contract';

const TIMESTAMP_TOLERANCE_SECONDS = 300;

@Injectable()
export class BachsWebhookVerifier implements WebhookVerifier {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  verifyWebhookSecret(rawBody: Buffer, headers: WebhookSignatureHeaders): void {
    const secret = this.config.getOrThrow(Env.BACHS_WEBHOOK_SECRET, {
      infer: true,
    });
    const parsed = this.parseSignature(headers.signatureV2);
    const timestamp = parsed.timestamp ?? headers.timestamp;
    if (!timestamp || parsed.signatures.length === 0) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const timestampSeconds = Number(timestamp);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      !Number.isFinite(timestampSeconds) ||
      Math.abs(nowSeconds - timestampSeconds) > TIMESTAMP_TOLERANCE_SECONDS
    ) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest('hex');

    const matched = parsed.signatures.some((signature) =>
      this.safeEqual(signature, expected),
    );
    if (!matched) {
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  private parseSignature(header: string | undefined): {
    timestamp?: string;
    signatures: string[];
  } {
    const signatures: string[] = [];
    let timestamp: string | undefined;
    if (!header) {
      return { signatures };
    }
    for (const part of header.split(',')) {
      const [key, value] = part.trim().split('=');
      if (key === 't' && value) {
        timestamp = value;
      }
      if (key === 'v1' && value) {
        signatures.push(value);
      }
    }
    return { timestamp, signatures };
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
