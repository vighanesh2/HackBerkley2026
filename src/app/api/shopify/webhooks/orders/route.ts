import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSoldNotification, normalizeProductId } from "@/lib/notifications";
import { findProductIndex } from "@/lib/product-index";
import { getAllListings } from "@/lib/listings";

type ShopifyOrderWebhook = {
  id?: number;
  line_items?: {
    product_id?: number | null;
    title?: string;
    price?: string;
  }[];
};

function getWebhookSecret(): string | null {
  return (
    process.env.SHOPIFY_WEBHOOK_SECRET?.trim() ||
    process.env.SHOPIFY_CLIENT_SECRET?.trim() ||
    null
  );
}

function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null): boolean {
  const secret = getWebhookSecret();
  if (!secret || !hmacHeader) {
    return process.env.NODE_ENV === "development";
  }

  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const expected = Buffer.from(digest);
  const received = Buffer.from(hmacHeader);

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

async function findSellerForProduct(productId: number) {
  const indexed = await findProductIndex(productId);
  if (indexed) {
    return indexed;
  }

  const normalized = normalizeProductId(productId);
  if (!normalized) {
    return null;
  }

  const listings = await getAllListings();
  const match = listings.find(
    (listing) =>
      listing.shopifyStatus === "live" &&
      normalizeProductId(listing.shopifyProductId) === normalized,
  );

  if (!match) {
    return null;
  }

  return {
    sellerId: match.sellerId,
    title: match.title,
    price: match.price,
  };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");

  if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let order: ShopifyOrderWebhook;
  try {
    order = JSON.parse(rawBody) as ShopifyOrderWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orderId = order.id ? String(order.id) : `order-${Date.now()}`;
  const created: string[] = [];

  for (const item of order.line_items ?? []) {
    const productId = item.product_id;
    if (!productId) {
      continue;
    }

    const indexed = await findSellerForProduct(productId);
    if (!indexed) {
      continue;
    }

    const price = Number.parseFloat(item.price ?? "0") || indexed.price;
    const notification = await createSoldNotification({
      sellerId: indexed.sellerId,
      title: indexed.title,
      price,
      orderId,
      productId: String(productId),
    });
    created.push(notification.id);
  }

  return NextResponse.json({ ok: true, notifications: created });
}
