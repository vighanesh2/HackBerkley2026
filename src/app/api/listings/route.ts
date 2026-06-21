import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAgent } from "@/lib/auth";
import { createListing, getAllListings } from "@/lib/listings";

export async function GET() {
  const listings = await getAllListings();
  return NextResponse.json({ listings });
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedAgent(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    title?: string;
    description?: string;
    price?: number;
    category?: string;
    condition?: string;
    location?: string;
    sellerId?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, description, price, category, condition, location, sellerId } = body;

  if (!title?.trim() || !description?.trim() || !category?.trim()) {
    return NextResponse.json(
      { error: "title, description, and category are required" },
      { status: 400 },
    );
  }

  if (typeof price !== "number" || Number.isNaN(price) || price < 0) {
    return NextResponse.json(
      { error: "price must be a non-negative number" },
      { status: 400 },
    );
  }

  const { listing, shopifyUrl, shopifyAdminUrl, publishedToShopify } =
    await createListing({
      title,
      description,
      price,
      category,
      condition,
      location,
      sellerId,
    });

  if (!publishedToShopify) {
    return NextResponse.json(
      {
        listing,
        publishedToShopify: false,
        error: listing.shopifyError ?? "Could not publish to Shopify",
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      listing,
      url: shopifyUrl,
      shopifyUrl,
      shopifyAdminUrl,
      publishedToShopify: true,
      message: `Live on Shopify: ${shopifyUrl}`,
    },
    { status: 201 },
  );
}
