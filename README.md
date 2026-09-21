# Ticket Reservation

pnpm monorepo for the ticket reservation project.

## Structure

```
.
├── server/   # NestJS API (@ticket-reservation/server)
└── package.json
```

## Setup

```bash
pnpm install
```

## Scripts

Run from the repo root (delegates to `server`):

```bash
pnpm start:dev   # watch mode
pnpm build
pnpm test
pnpm lint
```

Or target the package directly:

```bash
pnpm --filter @ticket-reservation/server start:dev
```
