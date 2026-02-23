# create-nostrstack-site

Scaffold a new NostrStack site with one command.

## Usage

```bash
npx create-nostrstack-site
```

Follow the interactive prompts to create your site.

## Templates

### Minimal

A simple Nostr feed with basic posting functionality. Perfect for getting started quickly.

Features:
- Timeline feed
- Post composer  
- Nostr extension auth

### Full

A complete web application with all NostrStack features.

Features:
- Live feed with real-time updates
- User profiles
- Direct messages (encrypted)
- Notifications
- Search
- Follow/unfollow
- Mute/block lists
- Lightning tips
- PWA support
- Keyboard shortcuts
- Spam filtering
- And more!

## Options

```bash
npx create-nostrstack-site my-site --template minimal
npx create-nostrstack-site my-site --template full
```

## Next Steps

After creating your site:

```bash
cd my-site
npm install
npm run dev
```

Open http://localhost:5173 to see your site.

## Learn More

- [NostrStack Documentation](https://github.com/nostrstack/nostrstack)
- [Nostr Protocol](https://github.com/nostr-protocol/nostr)

## License

MIT
