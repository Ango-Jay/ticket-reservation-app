import Decimal from 'decimal.js';
import { ValueTransformer } from 'typeorm';

export const decimalTransformer: ValueTransformer = {
  to(value: Decimal | string | number | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    return new Decimal(value).toFixed(2);
  },
  from(value: string | null): Decimal | null {
    if (value === null) {
      return null;
    }
    return new Decimal(value);
  },
};
