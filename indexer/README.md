# Kyte indexer + API

Follows the chain and serves the order book, positions, fee splits, burns and stats as JSON.
Storage is SQLite through Node's built-in `node:sqlite` (no native build). Node 22.5+.

```bash
node indexer/src/index.mjs            # or: pnpm indexer
```

| Env | Default | Meaning |
|---|---|---|
| `CHAIN_ID` | `31337` | Picks `contracts/deployments/<id>.json` and the default RPC |
| `RPC_URL` | devnet `:8547` / official Robinhood RPCs | |
| `PORT` | `4200` | |
| `POLL_MS` | `2000` | Poll interval |
| `START_BLOCK` | `0` | First block to scan (set to the deploy block on testnet/mainnet) |
| `HOST` | `127.0.0.1` | Bind address. Put a TLS reverse proxy in front; use `0.0.0.0` only inside a container |
| `CORS_ORIGINS` | `*` | Comma list of allowed origins, e.g. `https://kyte.sh` |
| `RATE_LIMIT_PER_MIN` | `240` | Requests per IP per minute; over it returns 429 |
| `TRUST_PROXY` | – | `1` = take the client IP from `X-Forwarded-For` (only behind your own proxy) |

**Hardening:** GET/OPTIONS only, URL ≤ 2 KB, every query parameter validated (400 on bad input), RPC-backed
routes (`/stats`, `/stake/:addr`) cached for a few seconds with shared in-flight requests, generic 500 bodies
(no RPC URLs or stack traces), request timeouts, and startup refuses to run if the RPC's chain id differs from
`CHAIN_ID`.

**How it stays correct:** every event only marks a position as "touched"; the row is then re-read from the
market (`getPosition`) and the NFT (`ownerOf`). The last 8 blocks are re-scanned on every poll, so a reorg or a
missed log can't leave a stale row. "Now" is the latest block's timestamp, not the wall clock.

## Routes

| Route | Returns |
|---|---|
| `GET /health` | chain id, chain time, last indexed block, latest block, contract addresses |
| `GET /assets` | listed tokens with decimals, enabled / puts flags, cap, min strike |
| `GET /offers` | fillable open offers (`?status=open|filled|exercised|expired|cancelled|all`, `?kind=call|put`, `?token=SYM`) |
| `GET /offers/:id` | one position |
| `GET /positions/:address` | `holding` (options the address holds), `selling` (its open/filled offers), `history` |
| `GET /stake/:address` | active / pending stake, claimable WETH, epoch, totals |
| `GET /proof` | every `FeesSplit` and `Burned` event with tx hashes, plus totals |
| `GET /stats` | volume, fees, open interest, burned, staked, stakers, active offers |
| `GET /expirable` | filled positions past expiry (what the keeper will expire) |

Amounts are returned in human units (`amount`, `strike`, `premium`) alongside raw wei strings (`*Raw`).
