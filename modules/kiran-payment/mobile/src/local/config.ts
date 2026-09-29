/**
 * Settings for the in-app server, baked in at build time.
 *
 * The same names and defaults as the backend's config.py. A standalone build
 * reads them from the backend's .env through scripts/build-standalone.mjs,
 * which passes each one to Vite as VITE_<NAME>; nothing here is committed.
 *
 * Anything baked into an app can be read back out of it. That is acceptable
 * for a build that only its owner installs, and for nothing else.
 */
const env = import.meta.env;
const read = (value: string | undefined) => (value ?? '').trim();

export const STANDALONE = env.VITE_STANDALONE === 'true';

export const OPENAI_API_KEY = read(env.VITE_OPENAI_API_KEY);
export const OPENAI_BASE_URL = (
  read(env.VITE_OPENAI_BASE_URL) || 'https://api.openai.com/v1'
).replace(/\/$/, '');
export const OPENAI_MODEL = read(env.VITE_OPENAI_MODEL) || 'gpt-4o-mini';
export const OPENAI_EXTRACTION_MODEL = read(env.VITE_OPENAI_EXTRACTION_MODEL) || OPENAI_MODEL;

export const GOOGLE_CLIENT_ID = read(env.VITE_GOOGLE_CLIENT_ID);
export const GOOGLE_CLIENT_SECRET = read(env.VITE_GOOGLE_CLIENT_SECRET);
export const GOOGLE_CALENDAR_REFRESH_TOKEN =
  read(env.VITE_GOOGLE_CALENDAR_REFRESH_TOKEN) || read(env.VITE_GOOGLE_REFRESH_TOKEN);
export const GOOGLE_MEET_REFRESH_TOKEN =
  read(env.VITE_GOOGLE_MEET_REFRESH_TOKEN) || read(env.VITE_GOOGLE_REFRESH_TOKEN);

/** The company runs on IST; every meeting defaults to it. */
export const DEFAULT_TIME_ZONE = read(env.VITE_RTS_TIME_ZONE) || 'Asia/Kolkata';
export const ENFORCE_BUDGET = ['1', 'true', 'yes'].includes(
  read(env.VITE_RTS_ENFORCE_BUDGET).toLowerCase(),
);

export const hasOpenAiKey = () => Boolean(OPENAI_API_KEY);

export function googleConfigured(kind: 'calendar' | 'meet' = 'calendar'): boolean {
  const token = kind === 'calendar' ? GOOGLE_CALENDAR_REFRESH_TOKEN : GOOGLE_MEET_REFRESH_TOKEN;
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && token);
}
