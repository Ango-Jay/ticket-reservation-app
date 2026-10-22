export enum PaymentStatus {
  Pending = 'pending',
  Succeeded = 'succeeded',
  Failed = 'failed',
}

export const PaymentProviderName = {
  Bachs: 'bachs',
} as const;

export type PaymentProviderName =
  (typeof PaymentProviderName)[keyof typeof PaymentProviderName];
