export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url.replace(/\/$/, "");
}

const PLACEHOLDER_KEY_PATTERN =
  /^(your-anon|your-anon-key|your-anon-public-key|your-project|insert|example)/i;

export function getSupabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();

  if (!key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (PLACEHOLDER_KEY_PATTERN.test(key)) {
    throw new Error(
      "Supabase API key is still a placeholder — paste your anon or publishable key from Project Settings → API",
    );
  }

  return key;
}

export function isSupabaseConfigured(): boolean {
  try {
    getSupabaseUrl();
    getSupabaseAnonKey();
    return true;
  } catch {
    return false;
  }
}

export function supabaseConfigHint(): string {
  return [
    "Copy the anon or publishable key from Supabase → Project Settings → API.",
    "Do not use the service_role / secret key in the browser.",
    "Save .env.local to disk, then restart npm run dev.",
    "Add http://localhost:3000/auth/callback under Authentication → URL Configuration.",
  ].join(" ");
}

export function getSupabaseServiceRoleKey(): string | null {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();
  return key || null;
}
