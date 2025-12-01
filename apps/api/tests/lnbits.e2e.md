# LNbits E2E plan

- Spin LNbits via `docker compose -f deploy/lnbits/docker-compose.yml up -d`.
- Configure API env:
  - `LIGHTNING_PROVIDER=lnbits`
  - `LN_BITS_URL=http://localhost:5000`
  - `LN_BITS_API_KEY=<admin api key from LNbits UI>`
- Run API dev: `pnpm --filter api dev`
- E2E steps:
  1) Call `/api/lnurlp/:user/metadata` to fetch minSendable.
  2) Call `/api/lnurlp/:user/invoice?amount=1000` to get bolt11.
  3) Pay invoice via LNbits admin UI or API.
  4) Poll `/api/lnurlp/:user/status/:id` until `PAID`.
  5) (Optional) Configure LNbits webhook to `/api/lnbits/webhook` and confirm immediate status.

Note: LNbits image requires a funding source; this compose uses the built-in dummy backend (no real payments). For real flows, set `LNBITS_FUNDING_SOURCE` and related envs.
