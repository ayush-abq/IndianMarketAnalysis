# Indian Market Intelligence Terminal

Three engines in one application:

1. **NSE Sector Intelligence** — drawdown, recovery, falling-knife research on official/authorized NSE index history.
2. **Mutual Fund Intelligence** — official AMFI NAV universe, SIP/risk/consistency scoring, and a live link from NSE sector state → fund sector exposure.
3. **Stock + Strategy Lab** — official bhavcopy/constituent universe, market regime & breadth, Opportunity Radar, look-ahead-safe historical screens, watchlist/thesis, paper book.

The UI **never** fetches live market or fund data. Both engines write to the same PostgreSQL database and the same scheduler.

---

# NSE Sector Drawdown & Recovery Scanner

A production research terminal that answers, every trading day:

> Which NSE sectors are deeply beaten down from historical highs, have weak 1Y/2Y/5Y price returns, and are beginning to show recovery evidence — versus sectors that are simply still falling?

It does **not** issue buy or sell recommendations.

## Data architecture

```
Official / authorized source
        ↓
   Local PostgreSQL
        ↓
  Calculations & scores
        ↓
  Dashboard / APIs
```

The UI **never** fetches live market data. It reads precomputed rows from the local database.

### What this is not

This application does **not** scrape unofficial NSE website XHR endpoints. NSE publishes index data through official reports and licensed products; access depends on the product you are entitled to use.

### Providers (replaceable)

| `DATA_PROVIDER` | Kind | Role |
|---|---|---|
| `NSE_OFFICIAL_EOD` (default) | Official published files | Daily `ind_close_all_DDMMYYYY.csv` from NSE archives |
| `LICENSED` | Authorized API | Your NSE / vendor REST feed (`NSE_BASE_URL` + API key) |
| `CSV_IMPORT` | Emergency only | Folder of official NSE/Nifty CSVs |
| `YAHOO` | Third-party fallback | **Not** an NSE source. Enable only via `FALLBACK_PROVIDER` |

Primary → optional fallback. If both fail the previous valid history is kept and the UI shows **DATA STALE**. Nulls never overwrite valid closes.

Official EOD files are **price return (PR)** series. Total return (TR) is stored and scored separately and is only populated when a licensed TRI feed or an official TRI CSV is configured. The scanner defaults to PR.

## Setup

```bash
cp .env.example .env
# set DATA_PROVIDER and, if using a licensed feed, NSE_BASE_URL + NSE_API_KEY
docker compose up --build
```

Open http://localhost:3000

First start: migrate → seed universe/holidays/settings → historical backfill from the official/authorized source → compute metrics → start the web app and the 18:30 IST worker.

### Local development

```bash
docker compose up -d postgres
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run ingest            # NSE sectors only
npm run ingest:all        # full official history: indices + funds + stocks
npm test
npm run dev
```

### Full history (everything)

One command. Official files only. Hours, not minutes. Safe to stop and rerun.

```bash
npm run ingest:all
```

Order: NSE index EOD (`NSE_HISTORICAL_START`) → AMFI NAV (`MF_HISTORICAL_START`) → stock bhavcopy (`STOCK_HISTORICAL_START`, override with `--from=`).

```bash
npm run ingest:all -- --from=2015-01-01
```

In the app: **Data** → “Update latest files” or “Fill missing history”. Last added and next automatic time are shown there. Leave `npm run worker` running if you want those times to happen on their own.

### Daily (latest session only)

After the cash-market close (or any time you want a refresh):

```bash
npm run daily
```

Runs, in order:

1. Official NSE index EOD → calculations → alerts → regime → radar signals → daily brief → thesis checks  
2. Official AMFI NAV → fund scores  
3. Official bhavcopy + index memberships → stock scores  

Already-successful jobs for today are skipped. To force a rerun:

```bash
npm run daily -- --manual
```

Worker (same jobs on a schedule, leave running):

```bash
npm run worker
```

## Environment

See `.env.example`. Credentials stay in environment variables and are never committed.

Licensed API shape (when `DATA_PROVIDER=LICENSED`):

```
GET {NSE_BASE_URL}/indices
GET {NSE_BASE_URL}/indices/{symbol}/history?from=&to=&returnType=PR|TR
GET {NSE_BASE_URL}/indices/{symbol}/latest
GET {NSE_BASE_URL}/indices/{symbol}/constituents
GET {NSE_BASE_URL}/health
Authorization: Bearer $NSE_API_KEY
```

## Calculations

- **ATH**: max historical **closing** price as of the as-of date (intraday high ATH is also stored). No future peaks.
- **Distance from ATH**: `(ATH − close) / ATH × 100`
- **Returns**: trading-day offsets (1Y = 252 bars). Missing history → `null` / “Insufficient history”, never `0%`.
- **Scores**: drawdown, multi-year weakness, momentum, recovery, relative strength vs Nifty 50 / Nifty 500, composite research score.
- **Signals**: Falling knife, Early recovery, Structural weakness, Possible capitulation. High drawdown alone is not an opportunity.

Thresholds and weights are editable on **Settings** (stored in Postgres).

## Scheduler

Default `30 18 * * 1-5` Asia/Kolkata (after cash-market close). The job is idempotent (`ingest:daily:YYYY-MM-DD`). NSE weekends/holidays are not treated as data errors.

## API

`GET /health` · `GET /api/data-health` · `GET /api/dashboard` · `GET /api/scanner` · `GET /api/indices/:id` · `GET /api/historical?asOf=` · `GET /api/changes` · `GET /api/alerts` · `GET /api/config` · `GET /api/export?format=csv|xlsx|json|pdf`

Historical scan uses **only** information available on `asOf` (no look-ahead). Optional forward returns are labelled as subsequent outcomes.

## Testing

```bash
npm test
```

Covers ATH, drawdowns, 1Y/2Y/5Y, insufficient history, relative strength, scores, falling knife / early recovery / structural weakness, official CSV parsing, look-ahead isolation, data-quality flags, idempotent job keys.

## Data licensing

You are responsible for using a source you are allowed to use (NSE official published files, an NSE licensed product, or another licensed vendor). This repo does not redistribute NSE data. Do not configure unofficial scrape endpoints as `DATA_PROVIDER`.

## Mutual Fund Intelligence

Official AMFI published files are the default source (not unofficial website scrapers):

- Daily: `https://www.amfiindia.com/spages/NAVAll.txt`
- History: AMFI NAV History Report portal download

Portfolio, TER, AUM, riskometer, and fund-manager fields are **not** in the daily NAV file. They are stored only when an authorized/licensed feed is configured (`MF_PROVIDER=LICENSED` or `MF_LICENSED_BASE_URL` + `MF_API_KEY`). Missing fields stay blank. Nothing is invented.

```bash
npm run ingest:mf            # NAVAll + sparse-history backfill + scores
npm run ingest:mf:backfill   # full official history from MF_HISTORICAL_START
npm run recompute:mf
```

Default research screen: **Direct + Growth**. Direct/Regular and Growth/IDCW are never mixed.

Ranking is a configurable composite (risk-adjusted returns, consistency, drawdown, benchmark excess, cost, portfolio, manager, AUM, NSE sector alignment). Highest 5-year return is not “best”.

Scheduler (same worker, not a second process):

- NSE: `SCHEDULER_CRON` (default 18:30 IST weekdays)
- MF NAV: `MF_NAV_CRON` (default 22:00 IST Mon–Sat)
- MF monthly enrichment: 07:00 IST on the 3rd

APIs: `GET /api/mutual-funds`, `/best`, `/best-sip`, `/recovery`, `/falling-knife`, `/index-funds`, `/compare`, `/sector/:sector`, `/mutual-funds/:id`, plus SIP, score, backtest, research shortlist.

## Alpha research (this increment)

Feedback loop on the existing engines:

`Market data → scores → regime → Opportunity Radar → Strategy Lab → next-session backtest → walk-forward / costs / EV → signal tracking → thesis`

Research modes (`CONSERVATIVE` / `BALANCED` / `AGGRESSIVE`) change screens, not honesty. Aggressive still excludes falling knives and value traps, still shows a **risk penalty**, and still requires sample-size caution.

Strategy Lab defaults:

- Signal at close **T**
- Earliest fill = **next session**
- Base **40 bps** round-trip cost (low 15 / high 80). If EV dies under high cost: **cost-sensitive strategy**
- Historical expected value, evidence strength, regime matrix, alpha-decay horizons
- Robust out-of-sample + drawdown ranks above the highest in-sample CAGR

Missing PE/ROE/earnings stay **N/A** (omitted from confluence, never zero).

## Stock intelligence & Strategy Lab

- Official bhavcopy: `npm run ingest:stocks` (latest session) / `ingest:stocks:manual` / `ingest:stocks:backfill` (day-by-day official files from `STOCK_HISTORICAL_START`, default 2020-01-01). Resume-safe. Optional: `npm run ingest:stocks:backfill -- --from=2024-01-01`. Closes are unadjusted unless a corporate-action factor is stored.
- Index memberships from official NSE constituent CSVs (Nifty 50/100/200/500, midcap, smallcap)
- Fundamentals (PE, ROE, earnings) stay **N/A** until `EQUITY_FUNDAMENTAL_BASE_URL` + API key are configured. Missing is never stored as 0.
- Strategy Lab (`/strategy-lab`, `POST /api/strategy-lab`) screens as-of date T using only information available on T, then labels subsequent 1M/3M/6M/1Y outcomes. Walk-forward, parameter sensitivity, and sample-size caution are included.
- Opportunity Radar: `/radar`
- Research assistant (app data only): `/research`

Same worker process adds `STOCK_BHAV_CRON` (default 18:45 IST weekdays). After each NSE ingest the terminal writes a regime snapshot, radar signals, daily brief, and thesis checks.

## Disclaimer

Research tool only. Not investment advice. Classifications such as “Early recovery candidate”, “Falling knife”, “Research candidate”, or “Contrarian Research Candidate” are analytical labels, not trade instructions. Past SIP XIRR and CAGR are not guaranteed future returns.
