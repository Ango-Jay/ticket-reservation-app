import { config } from 'dotenv';
import { join } from 'path';

/** Repo-root and server-local .env paths (resolved from this file under src/config). */
export const envFilePaths = [
  join(__dirname, '..', '..', '..', '.env'),
  join(__dirname, '..', '..', '.env'),
];

export function loadEnv(): void {
  for (const path of envFilePaths) {
    config({ path });
  }
}
