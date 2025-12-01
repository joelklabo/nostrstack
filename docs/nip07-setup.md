# NIP-07 signer setup (for nostrstack demo)

To post real comments to relays from the demo, you need a NIP-07 browser signer.

## Recommended (Alby)
1) Install Alby extension: https://getalby.com (Chrome/Firefox).
2) Create or import a Nostr key in Alby (Settings → Nostr). You can also generate a fresh key just for testing.
3) Allow the site (http://localhost:4173 or your host) when prompted. If not prompted, open Alby → Permissions and add the origin.

## Alternative (nos2x)
- Install nos2x (Chrome): https://github.com/fiatjaf/nos2x
- Generate/import a key; nos2x automatically injects NIP-07.

## Using it in the demo
- Open http://localhost:4173
- In the Config card, set “Relays (comments)” to a real relay (e.g., `wss://relay.damus.io`)
- Post a comment; your signer will prompt to sign. Approve to publish to the relay.

## If you don’t want to install a signer
- Set “Relays (comments)” to `mock`. Comments stay local to the page (no relay, no key needed).
