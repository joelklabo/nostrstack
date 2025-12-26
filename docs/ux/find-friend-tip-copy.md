# Find friend + tip: UX copy matrix

## Global guidance
- Keep messages short, direct, and action-oriented.
- Use specific next steps ("Try a different npub" instead of "Something went wrong").
- Payment success must be explicit; zap receipts are not proof of payment.

## Login screen
- Title: "Sign in to NostrStack"
- Subtitle: "Connect your Nostr identity to continue"
- NIP-07 button: "Sign in with NIP-07"
- Nsec button: "Enter nsec manually"
- LNURL button: "Login with Lightning"
- Error: "Sign-in failed. Check your extension or key and try again."

## Find friend entry points
- Sidebar item: "Find friend"
- Feed CTA header: "Find someone to tip"
- Feed CTA body: "Paste a Nostr identifier (npub, nprofile, or NIP-05)."
- Feed CTA action: "Find friend"

## Search input
- Label: "Friend identifier"
- Placeholder: "npub1... or name@domain"
- Helper: "We support npub, nprofile, hex pubkey, NIP-05, and lightning addresses."
- Primary action: "Search"
- Secondary action: "Clear"

## Search states
- Empty state: "Paste an identifier to begin."
- Validating: "Checking format…"
- Resolving: "Looking up identity…"
- Resolved: "Found a match"
- No match: "No identity found. Try another identifier."
- Timeout: "Lookup timed out. Retry?"
- Invalid format: "That doesn't look like a Nostr identifier."

## Search result card
- Title: "{display_name || name || npub}"
- Subtitle: "Verified via NIP-05" (only if verified)
- Action: "Open profile"
- Secondary: "Copy pubkey"

## Profile tip panel
- Header: "Tip this friend"
- Subtext: "Send a direct payment to their Lightning address."
- Primary CTA: "Tip 500"
- Secondary CTA: "Custom amount"
- Missing lightning: "No Lightning address found for this profile."

## Zap modal
- Title: "Send a zap"
- Status: "Preparing zap request…"
- Invoice ready: "Invoice ready. Scan or pay in wallet."
- Payment pending: "Waiting for payment confirmation…"
- Paid: "Payment confirmed."
- Receipt note: "Zap receipt received (not proof of payment)."
- Error: "Zap failed. Check your wallet and try again."

## Send sats modal
- Title: "Send sats"
- Status: "Generating invoice…"
- Invoice ready: "Invoice ready. Scan or pay in wallet."
- Payment pending: "Waiting for payment confirmation…"
- Paid: "Payment confirmed."
- Error: "Payment failed. Try again or use a different wallet."

## Error copy (generic)
- Network error: "Network error. Check your connection and retry."
- Not logged in: "You must be signed in to send a zap or tip."
- Amount invalid: "Amount must be between {min} and {max} sats."

## Success copy
- Zap success: "Zap sent."
- Tip success: "Tip sent. Thanks for supporting them!"
- Copy success: "Copied"
