# Simplifications after dropping legacy embeds

Done now:
- Removed `data-satoshis-*` attribute support from @nostrstack/embed (only `data-nostrstack-*`).
- Embed auto-mount now queries solely `data-nostrstack-*` selectors.

Further simplifications worth doing:
- Delete any downstream snippets/tests or blog content that reference `data-satoshis-*` (none left in repo; watch external docs).
- Remove legacy bundle aliases, if any, from CDN config (currently none).
- Enforce nostrstack naming in any future CLI/templates.
- Consider migrating staging/prod hostnames away from the `satoshis` Voltage node name when mainnet cutover happens, to avoid confusion.
