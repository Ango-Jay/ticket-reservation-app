# DB / API benchmark learning harness

This folder is a **sandbox for learning databases**, using the real reservation booking path in this project.

You do **not** need to be a DBA. The idea is:

1. Run a simple command.
2. Look at a log file.
3. Connect what you see to a few core ideas (transactions, locks, indexes, plans).

Nothing here is meant as a CI gate or a production load test. Local Docker Postgres only.

---

## Why this benchmark matters

Ticket booking is a classic database hard problem: **many people want the same scarce resource at once**.

If you only ever insert rows one-at-a-time in a quiet app, the database looks “fine.” Under concurrent load you discover:

- Whether your **transaction + lock** design prevents **overselling**
- Whether a **popular ticket type** becomes a bottleneck (everyone queues on one row)
- Whether your **indexes** actually help the queries you care about
- How **API latency** grows when the database is waiting on locks (not just “slow SQL text”)

That is why we stress **this** path on purpose: create hold → lock ticket type → sum reserved → insert. It is the core of the product, and it teaches more than synthetic `pgbench` “update random row” demos.

In industry terms you are practicing **correctness under concurrency** and **observability** (EXPLAIN, locks, latency) — skills that transfer to inventory, wallets, seat maps, coupon redemption, etc.

---

## What you will learn

After working through this harness you should be able to:

1. **Explain oversellig risk** in plain language, and why `BEGIN` + `FOR UPDATE` + check + `INSERT` + `COMMIT` fixes it.
2. **Recognize lock contention** — many workers, few successes beyond capacity, rising wait time, entries in the lock snapshot log.
3. **Read a basic EXPLAIN** — spot seq scan vs index scan, and what `Buffers hit/read` says about cache.
4. **Say what an index is for** in this schema (slug lookup, held expiry, etc.) and why a partial index exists.
5. **Separate “good errors” from outages** — HTTP 409 / “not enough tickets” vs 5xx / connection pool exhaustion.
6. **Compare SQL-only vs full HTTP stack** — same booking rules; k6 adds Nest, JSON, and connection pooling to the story.
7. **Propose a next experiment** — e.g. change capacity, drop an index, run reads during a write storm — and predict what should change before you run it.

You will *not* finish as a performance engineer. You *will* have concrete logs from *your* app to point at when these topics come up again.

---

## Tiny glossary (read this once)

| Term | Plain English |
|------|----------------|
| **Table** | A spreadsheet of rows (e.g. `reservations`). |
| **Row** | One record (one ticket type, one booking). |
| **Index** | A side “phone book” that helps Postgres find rows fast by a column (slug, email, …). Without it, Postgres may scan the whole table. |
| **Query plan** | The steps Postgres chooses to run a query (scan table? use index? sort?). |
| **EXPLAIN** | “Show me the plan” — and with `ANALYZE`, “run it and show real timings.” |
| **Transaction** | A bundle of SQL that either all succeeds (`COMMIT`) or all undoes (`ROLLBACK`). Booking uses one transaction so we never oversell mid-flight. |
| **Lock** | A “please wait, I’m using this row” marker. Other writers queue; they don’t corrupt the count. |
| **Contention** | Many clients fighting for the same lock (here: the same ticket type). |
| **MVCC** | Postgres keeps row versions so **readers** often don’t block on writers (simplified). Writers of the *same* row still wait. |
| **Buffer / cache** | Recently used table pages kept in RAM. `shared hit` = already in memory; `shared read` = had to fetch from disk. |
| **p95 latency** | 95% of requests finished faster than this number. A few slow outliers don’t dominate it. |
| **409 Conflict** | Our API saying “not enough tickets” — expected when capacity is gone, not a server crash. |

---

## What problem are we studying?

When two people try to buy the **last** tickets at the same time, a naive app can **oversell** (sell 51 seats when there are 50).

This app avoids that by (simplified):

```text
BEGIN
  lock the ticket_type row          -- FOR UPDATE (others wait here)
  count how many seats are already taken
  if room left → insert a held reservation
COMMIT                              -- lock released
```

So under a “storm” of bookers:

- **Correctness:** you should never go above capacity.
- **Cost:** bookers **line up** on that one row. Throughput is limited by lock wait, not by how fast your CPU is.

That’s the main lesson this harness is built to show.

---

## Prerequisites

```bash
pnpm db:up
pnpm migration:run
```

For HTTP tests later: `pnpm start:dev`, and install [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) (`brew install k6` on macOS).

---

## Quick start (do this first)

### 1) SQL bench (recommended first)

```bash
pnpm bench:sql
# harder storm:
WORKERS=40 pnpm bench:sql
```

What this does, in order:

1. Seeds a fake event `bench-hot-path` with **50** tickets (scarce on purpose).
2. Adds ~2000 old/cancelled rows so tables aren’t unrealistically empty (for EXPLAIN practice).
3. Runs **EXPLAIN** on important queries → `bench/out/02_explain.log`.
4. Starts many parallel “bookers” in Postgres that copy the app’s lock + insert logic.
5. Mid-run, snapshots who is waiting on locks → `bench/out/05_locks_mid.log`.
6. Prints how many succeeded vs failed → `bench/out/summary.txt`.
7. Checks you didn’t oversell → `bench/out/06_correctness.log`.

Also writes `bench/.env.bench` (event/ticket IDs for k6).

### 2) HTTP bench (after the API is up)

```bash
pnpm bench:sql          # if you haven’t already
pnpm start:dev          # other terminal
pnpm bench:k6           # many POST /reservations
pnpm bench:k6:reads     # many GETs (lighter)
```

Same booking rules, but through Nest (network + ORM + DB). Email sends are fire-and-forget; a bad Resend key should not block the HTTP response.

---

## After `pnpm bench:sql`: what to open

| File | Look for | What it means if you’re new |
|------|----------|-----------------------------|
| `bench/out/summary.txt` | `ok=…` `fail=…` | At most ~50 `ok` (capacity). Extra workers should mostly `fail` with “not enough tickets”. |
| `bench/out/06_correctness.log` | `active_reserved` ≤ `capacity` | If reserved **exceeds** capacity, locking is broken. You want ≤. |
| `bench/out/02_explain.log` | `Seq Scan` vs `Index Scan` | Seq = walk the table. Index = use the phone book. |
| `bench/out/02_explain.log` | `Buffers: shared hit=… read=…` | Hits = RAM; reads = disk. Re-run EXPLAIN: hits should rise (warm cache). |
| `bench/out/05_locks_mid.log` | `blocked_pid` / `Lock` | Proof that writers are waiting on each other — contention made visible. |
| `bench/out/worker-*.log` | error text | Failures from full inventory are **expected**, not a broken script. |

If something looks empty, re-run with more workers: `WORKERS=40 pnpm bench:sql`.

---

## Reading EXPLAIN without panic

Open `02_explain.log`. You’ll see blocks like:

```text
Seq Scan on reservations r  (cost=... rows=... width=...)
  (actual time=... rows=... loops=1)
  Filter: ...
  Buffers: shared hit=12 read=3
Planning Time: ...
Execution Time: ...
```

How to read it:

1. **Start at the bottom / innermost** of nested plans (children run first). For simple queries there’s often one main scan.
2. Prefer **`actual time`** over **`cost`**. Cost is the planner’s guess; actual is measured.
3. **`rows`**: how many rows that step produced. Big unexpected numbers → maybe a missing/wrong index.
4. **`Buffers`**:
   - lots of **`read`** after a DB restart → cold cache
   - mostly **`hit`** on second run → warm cache (same plan, less I/O)
5. **`Rows Removed by Filter`**: Postgres fetched rows then threw them away — the index (if any) wasn’t selective enough.

### Seq Scan vs Index Scan

| You see | Intuition |
|---------|-----------|
| **Seq Scan** | Read most/all of the table. Fine for tiny tables. Painful when `reservations` is huge. |
| **Index Scan using NAME** | Used index `NAME`. Check `Index Cond` — that’s the lookup key. |
| **Index Only Scan** | Answer came mostly from the index (extra efficient when possible). |

**Experiment:** the “held expires_at” query should tend to use the **partial index** `IDX_reservations_held_expires_at` (only rows with `status = 'held'`). If you drop that index on a throwaway DB and re-EXPLAIN, you may see a seq scan — that’s the “why indexes exist” lightbulb.

---

## Locks (the heart of this demo)

### Why lock?

Without a lock, two transactions can both read “49 of 50 taken”, both think there’s room, both insert → **51 sold**.

`FOR UPDATE` means: “I’m about to decide based on this ticket type; nobody else may change related booking math until I’m done.”

### What you’ll feel under load

- Worker A holds the lock, does SUM + INSERT, commits.
- Workers B, C, D **wait**.
- Wall clock goes up even if each query is “simple.”

That’s **lock contention**. Correct and slow-for-one-hot-SKU can both be true.

### MVCC in one sentence

Readers looking at old row versions usually **don’t** sit behind that write lock the same way. So `pnpm bench:k6:reads` can stay snappy while `hold-storm` writers queue. Try both at once in two terminals.

---

## Indexes in *this* project

| Index | Helps which kind of query |
|-------|---------------------------|
| Unique `events.slug` | “Get event by URL slug” |
| `IDX_events_status` | “List active events” |
| `IDX_ticket_types_event_id` | “Ticket types for this event” |
| Unique `reservation_number` | “Find / confirm this booking code” |
| `IDX_reservations_event_id` | “All bookings for an event” |
| `IDX_reservations_email` | “Bookings for this email” |
| Partial `held` + `expires_at` | “Find holds that should expire” |

**Partial index** = index only some rows (here: `WHERE status = 'held'`). Smaller and faster for that specific job.

When the SUM over reservations for one `ticket_type_id` gets slow on big data, people often add something like `(ticket_type_id, …)`. Use EXPLAIN before/after — never add indexes “for luck.”

---

## Correctness check (no oversell)

After a storm you want:

```text
capacity | active_reserved | remaining
      50 |            ≤ 50 |      ≥ 0
```

`active_reserved` counts **confirmed** seats plus **held** seats that haven’t expired yet (same idea as the app).

Manual re-check:

```bash
docker compose exec -T postgres \
  psql -U ticket -d ticket_reservation -f - < bench/sql/06_correctness.sql
```

Clear only the storm holds (keep seed history):

```bash
docker compose exec -T postgres \
  psql -U ticket -d ticket_reservation -f - < bench/sql/04_reset.sql
```

---

## HTTP / k6: what the numbers mean

In the k6 summary:

| Metric | Meaning |
|--------|---------|
| `http_req_duration` p95 | Most users waited less than this; a few waited more. |
| Status **409** | Inventory full or conflict — **expected** once 50 holds exist. |
| Status **5xx** / connection errors | Something else (API down, DB pool exhausted). Investigate. |
| `reservations_created` | Successful holds through the API. |

Workflow:

1. `pnpm bench:sql` → scarce inventory + `.env.bench`
2. Optionally `04_reset.sql` so capacity is free again before k6
3. `pnpm start:dev`
4. `pnpm bench:k6`

---

## Suggested learning path (in order)

1. Run `pnpm bench:sql` with default workers. Read `summary.txt` + `06_correctness.log`.
2. Open `02_explain.log`. Find one `Index Scan` and one place with `Buffers`.
3. Run again with `WORKERS=40`. Compare wall time and fail count — capacity still caps successes.
4. Mid-run, skim `05_locks_mid.log` — name the idea “queue on one row.”
5. Start API + `pnpm bench:k6`. Watch 201/200 then mostly 409.
6. In another terminal, `pnpm bench:k6:reads` during a storm — reads vs writes.
7. **Optional advanced:** on a disposable DB, `DROP INDEX "IDX_reservations_held_expires_at";` then re-run only the explain script and see the plan change; recreate the index after.

Edit quantity in `bench/sql/01_seed.sql` (50 → 5000) if you want fewer conflicts and more pure lock-queue behaviour.

---

## Layout

```
bench/
  README.md                 ← you are here
  sql/
    00_enable_extensions.sql
    01_seed.sql               # bench-hot-path, qty 50, + history rows
    02_explain_availability.sql
    03_contention_book.sql    # one locked booking attempt
    04_reset.sql              # delete bench-live-* holds
    05_locks_snapshot.sql
    06_correctness.sql
  k6/
    hold-storm.js
    mixed-read.js
  scripts/
    run-sql-bench.sh
    run-k6.sh
  out/                      # generated logs
  .env.bench                # generated IDs for k6
```

Root scripts: `pnpm bench:sql`, `pnpm bench:k6`, `pnpm bench:k6:reads`.

---

## Non-goals

- Passing/failing CI
- Stressing production or remote DBs
- Bachs payments
- “Make Nest infinitely scalable” — observe pool/connection limits; don’t treat them as the main lesson yet

---

## If something fails

| Symptom | Likely cause |
|---------|----------------|
| `docker` / permission errors | Docker Desktop not running |
| relation does not exist | Run `pnpm migration:run` |
| k6: missing EVENT_ID | Run `pnpm bench:sql` first |
| k6: connection refused | Start API with `pnpm start:dev`; check `BASE_URL` (default `http://localhost:4000`) |
| All SQL workers fail immediately | Capacity already full — run `04_reset.sql` or re-seed |

When in doubt: re-seed with `pnpm bench:sql` and read `summary.txt` first.
