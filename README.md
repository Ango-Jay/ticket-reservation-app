# Ticket Reservation

pnpm monorepo for the ticket reservation project.

## Structure

```
.
├── docker-compose.yml   # Postgres 16
├── server/              # NestJS API (@ticket-reservation/server)
└── package.json
```

## Setup

```bash
pnpm install
cp .env.example .env
pnpm db:up              # start Postgres (requires Docker)
pnpm migration:run      # apply schema
```

## Scripts

Run from the repo root (delegates to `server`):

```bash
pnpm start:dev   # watch mode
pnpm build
pnpm test
pnpm lint
pnpm db:up       # start Postgres
pnpm db:down     # stop Postgres
pnpm migration:run
```

Or target the package directly:

```bash
pnpm --filter @ticket-reservation/server start:dev
```
