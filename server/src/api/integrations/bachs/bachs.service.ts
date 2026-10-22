import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env, EnvironmentVariables } from '../../../config/env';
import type { CreateCheckoutInput, CreateCheckoutResult } from '../ports/payment.port';

interface BachsCheckoutSessionResponse {
  checkout_id?: string;
  checkout_url?: string;
  message?: string;
}

@Injectable()
export class BachsService {
  private readonly logger = new Logger(BachsService.name);

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    const apiKey = this.config.getOrThrow(Env.BACHS_API_KEY, { infer: true });
    const baseUrl = this.config
      .getOrThrow(Env.BACHS_API_BASE_URL, { infer: true })
      .replace(/\/$/, '');

    const response = await fetch(`${baseUrl}/v1/checkout-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pricing: {
          currency: input.currency,
          amount: input.amount,
        },
        customer: { email: input.email },
        reference: input.reference,
        metadata: input.metadata,
        expires_in_minutes: input.expiresInMinutes,
      }),
    });

    const body = (await response.json()) as BachsCheckoutSessionResponse;
    if (!response.ok || !body.checkout_id || !body.checkout_url) {
      const message = body.message ?? response.statusText;
      this.logger.error(`Bachs checkout failed: ${message}`);
      throw new Error(`Failed to create Bachs checkout: ${message}`);
    }

    return {
      checkoutId: body.checkout_id,
      checkoutUrl: body.checkout_url,
    };
  }
}
