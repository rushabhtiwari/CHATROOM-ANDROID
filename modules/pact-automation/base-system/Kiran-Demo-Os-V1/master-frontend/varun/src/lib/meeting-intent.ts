/** Deterministic meeting-intent routing keeps the demo independent of an LLM key. */

const MEETING_NOUN = String.raw`(?:google\s+meet(?:ing)?|video\s+call|meeting|meet|call|sync)`;
const MEETING_VERB = String.raw`(?:schedule|book|arrange|create|plan|set\s*up|host|start)`;

const VERB_FIRST = new RegExp(String.raw`\b${MEETING_VERB}\b[\s\S]{0,48}\b${MEETING_NOUN}\b`, "i");
const NEW_MEETING = new RegExp(String.raw`\bnew\s+(?:google\s+)?${MEETING_NOUN}\b`, "i");

/**
 * Recognises actionable scheduling requests without treating phrases such as
 * "summarise the meeting notes" as commands. The actual details are collected
 * in the scheduler, so this only needs to route the intent reliably.
 */
export function isMeetingScheduleIntent(prompt: string): boolean {
  const value = prompt.trim();
  if (!value) return false;
  return VERB_FIRST.test(value) || NEW_MEETING.test(value);
}

/** Uses a useful subject from the request when it is unambiguous. */
export function meetingTitleFromPrompt(prompt: string, fallback: string): string {
  const match = prompt.match(/\b(?:about|regarding|for|titled|named)\s+(.+)$/i);
  const subject = match?.[1]
    ?.replace(/\b(?:today|tomorrow|on\s+\w+|at\s+\d.+)$/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  if (!subject) return fallback;
  return subject.charAt(0).toUpperCase() + subject.slice(1, 90);
}
