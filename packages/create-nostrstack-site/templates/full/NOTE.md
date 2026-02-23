# Full Template

The "full" template is designed to be a complete copy of the web app with all features.

When implementing this template, copy the following from `/apps/web/`:

- `src/` directory (all components, hooks, utils, UI, styles)
- `public/` directory (icons, manifest)
- `index.html`
- `vite.config.ts`
- `tsconfig.json`

Update:
- Remove API-specific integrations if not needed
- Simplify environment variable requirements
- Add basic .env.example file

This ensures users get a production-ready app with:
- PWA support
- All web features
- Keyboard shortcuts
- Spam filtering
- Skeleton loaders
- And more!
