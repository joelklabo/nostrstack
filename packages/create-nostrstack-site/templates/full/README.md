# NostrStack Full Site

A complete Nostr social application with all features:

- Feed with live updates
- Profile pages
- Direct messages (NIP-04/NIP-44)
- Notifications
- Search
- Follow/unfollow
- Mute/block lists
- Lightning tips (NIP-57)
- Keyboard shortcuts
- PWA support
- Spam filtering
- Skeleton loaders
- Error recovery

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

## Environment Variables

Create a `.env` file:

```bash
VITE_NOSTRSTACK_RELAYS=wss://relay.damus.io,wss://relay.nostr.band
VITE_API_BASE_URL=http://localhost:3001
```

## Build for Production

```bash
npm run build
npm run preview
```

## Learn More

- [NostrStack Documentation](https://github.com/nostrstack/nostrstack)
- [Nostr Protocol](https://github.com/nostr-protocol/nostr)
