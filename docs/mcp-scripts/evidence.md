# MCP evidence checklist

- Screenshots:
  - Invoice popover after tip button click.
  - /api/lnurlp/pay/status response showing PAID.
  - Comment posted with relay pill showing `real` and console showing received event.
- Logs/trace:
  - DevTools network HAR/trace capturing invoice request + status poll.
  - Console log of relay event (comment) from subscription.
- Commands captured:
  - `lncli payinvoice` output (payer).
- Store artifacts in `evidence/` with timestamp + commit hash.
