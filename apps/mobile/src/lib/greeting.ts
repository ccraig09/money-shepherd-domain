/** Returns a time-aware greeting based on the hour (0–23). */
export function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const DISPLAY_NAMES: Record<string, string> = {
  "user-los": "Los",
  "user-jackia": "Jackia",
};

/** Maps a userId to a display name. Falls back to "friend" for unknown IDs. */
export function getDisplayName(userId: string): string {
  return DISPLAY_NAMES[userId] ?? "friend";
}
