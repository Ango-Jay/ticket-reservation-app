export const PAYMENT_PORT = Symbol('PAYMENT_PORT');

export interface CreateCheckoutInput {
  amount: string;
  currency: string;
  email: string;
  reference: string;
  metadata: Record<string, string>;
  expiresInMinutes: number;
}

export interface CreateCheckoutResult {
  checkoutId: string;
  checkoutUrl: string;
}

export interface PaymentPort {
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
}
