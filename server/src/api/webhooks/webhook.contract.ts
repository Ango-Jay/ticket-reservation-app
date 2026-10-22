export const WEBHOOK_VERIFIER = Symbol('WEBHOOK_VERIFIER');

export interface WebhookSignatureHeaders {
  signatureV2?: string;
  timestamp?: string;
}

export interface WebhookVerifier {
  verifyWebhookSecret(rawBody: Buffer, headers: WebhookSignatureHeaders): void;
}

export interface BachsWebhookData {
  checkout_id?: string;
  charge_id?: string | null;
  amount?: string | number;
  currency?: string;
  reference?: string;
}

export interface BachsWebhookPayload {
  id: string;
  type: string;
  data?: BachsWebhookData;
}
