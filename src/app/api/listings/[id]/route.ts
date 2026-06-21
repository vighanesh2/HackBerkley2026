import { NextResponse } from "next/server";
import { getListingById } from "@/lib/listings";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const listing = await getListingById(id);

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  return NextResponse.json({ listing });
}
