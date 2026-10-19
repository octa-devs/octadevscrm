/**
 * Discord notifications.
 *
 * All writes stay server-side: the webhook URL is a secret, so it lives in the
 * environment and is never sent to the browser. Failures are logged and
 * swallowed — a webhook outage must never break a chat or booking write, which
 * is why every caller awaits this but nothing reads the result.
 */

type Embed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
};

/** Palette pulled from the site so notifications look theirs at a glance. */
export const BRAND = {
  accent: 0xeb4d6d, // #eb4d6d — visitor events
  ok: 0x2b7a47,     // team did the thing
};

export function discordConfigured() {
  return typeof process.env.DISCORD_WEBHOOK_URL === 'string' &&
    process.env.DISCORD_WEBHOOK_URL.length > 0;
}

export function notifyDiscord(embed: Embed): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url || !/^https:\/\/(canary\.|ptb\.)?discord(app|status)?.com\/api\/webhooks\//.test(url)) {
    return Promise.resolve();
  }
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  })
    .then(() => undefined)
    .catch((err: unknown) => {
      console.warn('[discord] webhook unreachable:', (err as any)?.message ?? err);
    });
}
