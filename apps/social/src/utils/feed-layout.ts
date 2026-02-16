import type { Event } from 'nostr-tools';

const BASE_POST_ROW_HEIGHT = 230;
const POST_TEXT_LINE_HEIGHT = 22;
const CHARS_PER_LINE = 78;
const MAX_TEXT_LINES = 18;
const LINK_PREVIEW_SLOT = 152;
const PAYWALL_SLOT = 170;
const ACTION_PANEL_HEIGHT = 88;
const MIN_ROW_HEIGHT = 260;
const MAX_POST_ROW_HEIGHT = 980;

const URL_MATCHER = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
const MEDIA_URL_PATTERN = /\.(?:jpe?g|png|gif|webp|mp4|webm|mov|mkv)(?:[?#].*)?$/i;
const PAYWALL_TAG = 'paywall';

const normalizeContent = (content: string | undefined): string => (content ?? '').trim();

export const estimatePostRowHeight = (post: Event | undefined): number => {
  if (!post) {
    return MIN_ROW_HEIGHT;
  }

  const content = normalizeContent(post.content);
  const contentLength = content.length;
  const estimatedLines = Math.max(1, Math.ceil(contentLength / CHARS_PER_LINE));
  const textLines = Math.min(MAX_TEXT_LINES, estimatedLines);

  const urls = content.match(URL_MATCHER) ?? [];
  const hasLink = urls.length > 0;
  const hasMediaUrl = content ? MEDIA_URL_PATTERN.test(content) : false;
  const hasPaywall = post.tags?.some((tag) => tag[0] === PAYWALL_TAG) ?? false;
  const zapAmountSection = content.includes('zap') || content.includes('lnurl');

  const mediaBonus = hasMediaUrl || hasLink ? 40 : 0;
  const linkBonus = hasLink ? LINK_PREVIEW_SLOT : 0;
  const paywallBonus = hasPaywall || zapAmountSection ? PAYWALL_SLOT : 0;
  const textHeight = textLines * POST_TEXT_LINE_HEIGHT;

  return Math.max(
    MIN_ROW_HEIGHT,
    Math.min(
      MAX_POST_ROW_HEIGHT,
      BASE_POST_ROW_HEIGHT +
        textHeight +
        linkBonus +
        mediaBonus +
        paywallBonus +
        ACTION_PANEL_HEIGHT
    )
  );
};
