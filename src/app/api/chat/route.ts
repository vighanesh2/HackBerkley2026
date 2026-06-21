import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { createListing } from "@/lib/listings";
import { processListingMessage } from "@/lib/listing-flow";

export async function POST(request: NextRequest) {
  let message = "";
  try {
    const body = (await request.json()) as { message?: string };
    message = body.message?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  let sessionId = cookieStore.get("listing_session")?.value;

  if (!sessionId) {
    sessionId = randomUUID();
  }

  const result = processListingMessage(sessionId, message);

  if (result.readyToPost && result.draft) {
    const { listing, shopifyUrl, shopifyAdminUrl, publishedToShopify } =
      await createListing({
        title: result.draft.title!,
        description: result.draft.description!,
        price: result.draft.price!,
        category: result.draft.category!,
        sellerId: "local-demo-chat",
      });

    const reply = publishedToShopify
      ? `Done! Your listing is live.\n\nView: ${shopifyUrl}${shopifyAdminUrl ? `\nManage: ${shopifyAdminUrl}` : ""}`
      : `Your listing could not be published: ${listing.shopifyError ?? "Unknown error"}. Please try again.`;

    const response = NextResponse.json({
      reply,
      shopifyUrl,
      shopifyAdminUrl,
      listingId: listing.id,
      published: publishedToShopify,
    });

    response.cookies.set("listing_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return response;
  }

  const response = NextResponse.json({ reply: result.reply });
  response.cookies.set("listing_session", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
