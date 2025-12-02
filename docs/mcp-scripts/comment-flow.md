# MCP script: real relay comment

1) Launch Chrome debug: `./scripts/mcp-chrome.sh`
2) Start MCP server: `npx -y chrome-devtools-mcp@latest --browser-url=http://127.0.0.1:9222`
3) MCP actions:
   - Open http://localhost:4173
   - Set relays field to `wss://relay.damus.io`
   - Ensure NIP-07 signer is available in the debug profile (Alby/nos2x)
   - Enter comment text and click Post
   - Observe relay pill shows `real`
   - Subscribe to relay via DevTools console:
     ```js
     const relay = NostrTools.relayInit('wss://relay.damus.io');
     await relay.connect();
     const sub = relay.sub([{ kinds: [1], '#t': ['demo-thread'] }]);
     sub.on('event', ev => console.log('EVENT', ev));
     ```
   - Confirm the posted event appears
   - Take screenshot of UI + console evidence
4) Export trace/screenshot for evidence.
