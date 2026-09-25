import type { Segment } from "./ai-types";

const rolePatterns: Array<[RegExp, string]> = [
  [/\b(?:i am|i'm|this is)\s+(?:(?:the|a|am)\s+){0,3}patient\b/i, "Patient"],
  [/\b(?:i am|i'm|this is)\s+(?:(?:the|a|am)\s+){0,3}(?:registered\s+)?nurse\b/i, "Nurse"],
  [/\b(?:i am|i'm|this is)\s+(?:(?:the|a|am)\s+){0,3}(?:doctor|physician|clinician)\b/i, "Doctor"],
  [/\b(?:i am|i'm|this is)\s+[a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*)?\s*,?\s+(?:the\s+|a\s+)?patient\b/i, "Patient"],
  [/\b(?:i am|i'm|this is)\s+[a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*)?\s*,?\s+(?:the\s+|a\s+)?nurse\b/i, "Nurse"],
  [/\b(?:i am|i'm|this is)\s+[a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*)?\s*,?\s+(?:the\s+|a\s+)?(?:doctor|physician|clinician)\b/i, "Doctor"],
];

export function explicitlyStatedRole(text: string): string | null {
  for (const [pattern, role] of rolePatterns) if (pattern.test(text)) return role;
  return null;
}

/** Assigns roles only when a speaker explicitly identifies themself. */
export function attributeExplicitSpeakers(segments: Segment[]): Segment[] {
  const labelRoles = new Map<string, string>();
  for (const segment of segments) {
    const role = explicitlyStatedRole(segment.text);
    if (role) labelRoles.set(segment.speaker, role);
  }
  return segments.map(segment => ({
    ...segment,
    speaker: labelRoles.get(segment.speaker) || segment.speaker,
  }));
}
