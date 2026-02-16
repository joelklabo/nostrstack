# MCP script: real relay comment

1. Launch Chrome debug: `./scripts/mcp/chrome.sh`
2. Start MCP server: `npx -y chrome-devtools-mcp@0.12.1 --browser-url=http://127.0.0.1:9222` (pinned to match repo dependency)
3. MCP actions:
   - Open http://localhost:4173
   - Set relays field to `wss://relay.damus.io`
   - Ensure NIP-07 signer is available in the debug profile (Alby/nos2x)
   - Enter comment text and click Post
   - Observe relay pill shows `real`
   - Subscribe to relay via DevTools console (verifies publish/subscribe):
     ```js
     const relay = NostrTools.relayInit('wss://relay.damus.io');
     await relay.connect();
     const sub = relay.sub([{ kinds: [1], '#t': ['demo-thread'] }]);
     sub.on('event', (ev) => console.log('EVENT', ev));
     ```
   - Confirm the posted event appears in console (match your message substring). If not within 10s, flag failure.
   - Optional: read Network WS frames to ensure `EVENT` was sent.
   - Take screenshot of UI + console evidence
4. Export trace/screenshot for evidence.
