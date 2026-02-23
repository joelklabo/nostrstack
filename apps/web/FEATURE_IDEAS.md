# NostrStack Web: Feature Ideas & Implementation Plan

## Research Summary

Based on comprehensive analysis of Primal.net, Damus iOS, and broader Nostr ecosystem trends, here are prioritized feature improvements for NostrStack Web.

---

## Tier 1: High-Impact, Medium Effort

### 1. Immersive Scroll Mode

**Source**: Primal, Damus
**Description**: Hide header, nav, and compose button when scrolling down. Reappear on scroll up or tap.

- Reduces visual clutter during content consumption
- Creates more screen real estate on mobile
- Smooth CSS transitions

### 2. Top Zaps Display

**Source**: Primal
**Description**: Show top zappers at bottom of each post with amounts and optional short messages.

- Social proof drives engagement
- Displays zap messages (4-5 words max)
- Top zapper gets prominent display

### 3. Thread Chat View

**Source**: Damus
**Description**: New conversation-style thread view for replies.

- Chat-bubble layout for thread participants
- Clear visual hierarchy showing who replied to whom
- Reply counts displayed

### 4. Link Previews (Open Graph)

**Source**: All major clients
**Description**: Rich previews for shared URLs with title, description, image.

- Server-side or client-side metadata fetching
- Fallback for sites without OG tags
- YouTube/video embeds

### 5. Media Upload in Post Editor

**Source**: All major clients
**Description**: Drag-drop or click to upload images/GIFs to posts.

- Integration with nostr.build or Blossom protocol
- Upload progress indicator
- Preview before posting

### 6. Emoji Picker for Reactions

**Source**: Damus, Amethyst
**Description**: Click reaction button to show emoji grid instead of single heart.

- Custom emoji support
- Frequently used emojis
- NIP-25 compliant reactions

---

## Tier 2: High-Impact, Higher Effort

### 7. Custom Feeds / Feed Marketplace

**Source**: Primal
**Description**: Toggle between algorithmic feeds, create custom feeds from hashtags/searches.

- Save searches as feeds
- Subscribe to DVM-powered feeds
- Feed tabs in header

### 8. Advanced Search with Filters

**Source**: Primal
**Description**: Filter by content type, time range, author, has:media, has:zaps.

- Search syntax or filter UI
- Sort by relevance/time/zaps
- Save searches

### 9. NIP-17 Private DMs

**Source**: Ecosystem (replacing NIP-04)
**Description**: Gift-wrapped encrypted DMs that hide metadata.

- No public record of who you message
- Forward secrecy improvements
- Backward compatible

### 10. Profile Editor in Settings

**Source**: Gap in current app
**Description**: Edit display name, bio, avatar, banner, Lightning address, NIP-05.

- Real-time preview
- Image upload for avatar/banner
- Publish Kind 0 event

### 11. Bookmark Collections

**Source**: Primal, Damus
**Description**: Save posts to personal collections (public or private).

- Multiple lists/folders
- Quick bookmark with long-press
- NIP-51 lists support

### 12. User Mention Autocomplete

**Source**: All major clients
**Description**: Type @ and get autocomplete suggestions from contacts.

- Search contacts and recent interactions
- Show profile pics in dropdown
- Insert npub in note

---

## Tier 3: Medium-Impact, Quick Wins

### 13. Scroll-to-Top New Content Indicator

**Source**: Primal
**Description**: Bubble showing "X new posts" with avatars of posters.

- Click to scroll to top
- Shows who posted without jumping
- Reduces FOMO scrolling

### 14. Keyboard Navigation for Posts

**Source**: Gap in current app (TODO in code)
**Description**: Arrow keys to navigate between posts, Enter to open.

- J/K vim-style navigation
- R to reply, Z to zap, L to like
- Matches existing shortcuts modal

### 15. Image Zoom/Gallery

**Source**: Primal
**Description**: Pinch-to-zoom on images, full-screen carousel for multi-image posts.

- Swipe between images
- Tap outside to close
- Share image button

### 16. Quote Post Inline Preview

**Source**: All clients
**Description**: When quoting a post, show compact preview of quoted content.

- Nested quote display
- Link to original
- Author attribution

### 17. Content Warning Cover

**Source**: Current is basic
**Description**: Blur/cover content with CW tags, click to reveal.

- Configurable sensitivity levels
- "Show this account's content" option
- NSFW filter setting

### 18. Relative Timestamps with Tooltip

**Source**: Damus
**Description**: Show "5m ago" with full timestamp on hover.

- Updates automatically
- Locale-aware formatting
- Consistent across app

---

## Tier 4: Differentiation Features

### 19. Web of Trust Scoring

**Source**: Ecosystem trend
**Description**: Show trust indicators based on follower overlap and reputation.

- "Followed by X people you follow"
- Spam score filtering
- Visual trust indicators

### 20. Trending Topics/Hashtags

**Source**: Primal
**Description**: Sidebar or dedicated tab showing trending hashtags.

- Click to see feed for hashtag
- Time-based trending (24h, 4h)
- Add to saved feeds

### 21. Long-form Content (Reads)

**Source**: Primal (NIP-23)
**Description**: Dedicated tab for articles/blog posts.

- Nice reading layout
- Estimated read time
- Separate from short-form feed

### 22. Multi-Account Switching

**Source**: Amethyst, Nostur
**Description**: Quick switch between multiple Nostr accounts.

- Account picker in sidebar
- Per-account relay configs
- Shared or separate feeds

### 23. Offline Support (Service Worker)

**Source**: Best practice
**Description**: Cache content for offline viewing, queue posts for later.

- Service worker caching
- Offline indicator
- Queue failed posts

### 24. Relay Health Dashboard

**Source**: Current is basic
**Description**: Visual connection status, latency graphs, event counts per relay.

- Real-time status
- Reconnect buttons
- Relay recommendations

---

## Tier 5: Future Considerations

### 25. Live Streaming Integration

**Source**: Amethyst
**Description**: Watch/host live streams with chat.

### 26. Communities/Groups (NIP-29)

**Source**: Ecosystem
**Description**: Topic-based groups with moderation.

### 27. Calendar/Events

**Source**: Ecosystem
**Description**: Create and RSVP to events.

### 28. Polls

**Source**: Multiple clients
**Description**: Create polls in posts.

### 29. Voice Notes

**Source**: Emerging
**Description**: Record and share audio clips.

### 30. AI-Powered Features via DVMs

**Source**: Primal
**Description**: Content summarization, translation, recommendations.

---

## Implementation Priority Matrix

| Feature                  | Impact | Effort | Priority |
| ------------------------ | ------ | ------ | -------- |
| Immersive Scroll         | High   | Low    | P0       |
| Top Zaps Display         | High   | Medium | P0       |
| Link Previews            | High   | Medium | P0       |
| Emoji Picker             | Medium | Low    | P1       |
| Thread Chat View         | High   | High   | P1       |
| Profile Editor           | High   | Medium | P1       |
| Media Upload             | High   | High   | P1       |
| Scroll-to-Top Indicator  | Medium | Low    | P2       |
| Keyboard Post Navigation | Medium | Low    | P2       |
| Advanced Search          | High   | High   | P2       |
| Bookmarks                | Medium | Medium | P2       |
| Mention Autocomplete     | Medium | Medium | P2       |
| Custom Feeds             | High   | High   | P3       |
| NIP-17 DMs               | High   | High   | P3       |
| Web of Trust             | Medium | High   | P3       |

---

## Design Principles (from research)

1. **Jakob's Law**: Follow familiar Twitter-like patterns
2. **Progressive Disclosure**: Don't overwhelm - reveal complexity over time
3. **Mobile-First**: Design for touch, adapt for desktop
4. **Performance**: Batch updates, cache aggressively, lazy load
5. **Accessibility**: WCAG 2.1 AA compliance
6. **Privacy by Default**: Minimize metadata leakage

---

## Technical Considerations

### Performance

- Event batching already in place (300ms debounce)
- IndexedDB caching exists but could expand
- Consider service worker for offline
- Profile image caching critical (top 1k accounts = 1GB+ images)

### Relay Management

- Current: basic relay list
- Target: outbox model (NIP-65) for optimal relay selection
- Per-author relay routing

### State Management

- Currently using hooks + localStorage
- May need more robust solution for complex features (feeds, bookmarks)

---

## Next Steps

1. **Phase 1 (Immediate)**: Immersive scroll, top zaps, emoji picker
2. **Phase 2 (Short-term)**: Link previews, media upload, profile editor
3. **Phase 3 (Medium-term)**: Thread view, advanced search, bookmarks
4. **Phase 4 (Long-term)**: Custom feeds, NIP-17 DMs, multi-account
