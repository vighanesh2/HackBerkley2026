import { NextResponse } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase env vars are missing or still placeholders.",
      },
      { status: 503 },
    );
  }

  try {
    const url = getSupabaseUrl();
    const key = getSupabaseAnonKey();
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Supabase rejected the API key. Copy anon or publishable key from Project Settings → API.",
          status: response.status,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Supabase health check failed",
      },
      { status: 500 },
    );
  }
}
