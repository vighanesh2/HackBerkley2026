export function isEmailRateLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("email rate limit exceeded")
  );
}

export function formatAuthError(message: string): string {
  if (isEmailRateLimitError(message)) {
    return "Email rate limit exceeded — Supabase caps how many auth emails can be sent per hour.";
  }
  return message;
}

export const EMAIL_RATE_LIMIT_HINT = [
  "Add SUPABASE_SERVICE_ROLE_KEY to .env.local — sign-up will confirm instantly with zero emails.",
  "Or in Supabase: Authentication → Providers → Email → turn off Confirm email.",
  "Password sign-in never sends email. Wait ~1 hour if the hourly quota was already hit.",
].join(" ");
