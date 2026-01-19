import type { Event } from 'nostr-tools';

export interface SpamScore {
  score: number;
  reasons: string[];
  isSpam: boolean;
}

/**
 * Heuristic spam detection for Nostr events
 * Returns spam score (0-100, higher = more likely spam)
 */
export function calculateSpamScore(event: Event): SpamScore {
  let score = 0;
  const reasons: string[] = [];

  // 1. Excessive capitalization (SCREAMING)
  const capsRatio = (event.content.match(/[A-Z]/g) || []).length / event.content.length;
  if (capsRatio > 0.7 && event.content.length > 20) {
    score += 25;
    reasons.push('Excessive capitalization');
  }

  // 2. Excessive emoji/special characters
  // eslint-disable-next-line security/detect-unsafe-regex -- Simple Unicode range match, not user-controlled
  const emojiCount = (event.content.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  const emojiRatio = emojiCount / Math.max(1, event.content.length);
  if (emojiRatio > 0.3 && event.content.length > 10) {
    score += 20;
    reasons.push('Excessive emojis');
  }

  // 3. Repetitive content (e.g., "!!!!!!!" or "aaaaaaa")
  const repetitivePattern = /(.)\1{5,}/g;
  if (repetitivePattern.test(event.content)) {
    score += 15;
    reasons.push('Repetitive characters');
  }

  // 4. URL spam (too many links)
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const urls = event.content.match(urlPattern) || [];
  const urlRatio = urls.length / Math.max(1, event.content.split(/\s+/).length);

  if (urls.length > 5) {
    score += 30;
    reasons.push('Excessive URLs');
  } else if (urlRatio > 0.5 && event.content.split(/\s+/).length > 3) {
    score += 20;
    reasons.push('High URL density');
  }

  // 5. Known spam phrases
  const spamPhrases = [
    /\b(crypto|nft|invest|pump|moon|lambo)\b.*\b(guaranteed|profit|rich|money)\b/i,
    /\b(click here|check this out|limited time|act now)\b/i,
    /\b(won|winner|congratulations).*\b(prize|reward|claim)\b/i,
    /\b(bitcoin|btc|eth).*\b(giveaway|airdrop|free)\b/i
  ];

  for (const pattern of spamPhrases) {
    if (pattern.test(event.content)) {
      score += 25;
      reasons.push('Spam phrase detected');
      break; // Only count once
    }
  }

  // 6. Very short or empty content (kind 1 only)
  if (event.kind === 1 && event.content.trim().length < 3) {
    score += 15;
    reasons.push('Very short content');
  }

  // 7. Suspicious tag patterns (excessive mentions)
  const pTags = event.tags.filter((t) => t[0] === 'p');
  if (pTags.length > 20) {
    score += 20;
    reasons.push('Excessive mentions');
  }

  // 8. Content length anomalies
  if (event.content.length > 5000) {
    score += 10;
    reasons.push('Unusually long content');
  }

  // 9. Suspicious timing (too many posts too quickly - would need external state)
  // This heuristic requires tracking post frequency per pubkey, skipped for now

  // Determine if spam (threshold: 50)
  const isSpam = score >= 50;

  return {
    score,
    reasons,
    isSpam
  };
}

/**
 * Filter spam events from a list
 */
export function filterSpam(events: Event[], threshold = 50): Event[] {
  return events.filter((event) => {
    const { score } = calculateSpamScore(event);
    return score < threshold;
  });
}

/**
 * Get spam statistics for debugging
 */
export function getSpamStats(events: Event[]): {
  total: number;
  spam: number;
  clean: number;
  spamRate: number;
} {
  const total = events.length;
  const spam = events.filter((e) => calculateSpamScore(e).isSpam).length;
  const clean = total - spam;
  const spamRate = total > 0 ? spam / total : 0;

  return { total, spam, clean, spamRate };
}
