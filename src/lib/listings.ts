import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { isShopifyConfigured, publishProductToShopify } from "@/lib/shopify";
import type { CreateListingInput, Listing } from "@/types/listing";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "listings.json");

function normalizeListing(raw: Partial<Listing> & Pick<Listing, "id">): Listing {
  return {
    id: raw.id,
    title: raw.title ?? "Untitled",
    description: raw.description ?? "",
    price: raw.price ?? 0,
    category: raw.category ?? "Other",
    condition: raw.condition ?? "Used - Good",
    location: raw.location ?? "Berkeley, CA",
    sellerId: raw.sellerId ?? "marketplace-agent",
    createdAt: raw.createdAt ?? new Date().toISOString(),
    shopifyProductId: raw.shopifyProductId ?? null,
    shopifyHandle: raw.shopifyHandle ?? null,
    shopifyAdminUrl: raw.shopifyAdminUrl ?? null,
    shopifyStorefrontUrl: raw.shopifyStorefrontUrl ?? null,
    shopifyStatus: raw.shopifyStatus ?? null,
    publishedToShopifyAt: raw.publishedToShopifyAt ?? null,
    shopifyError: raw.shopifyError ?? null,
  };
}

async function ensureDataFile(): Promise<Listing[]> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Listing>[];
    return parsed.map((item) => normalizeListing(item as Listing));
  } catch {
    const empty: Listing[] = [];
    await fs.writeFile(DATA_FILE, JSON.stringify(empty, null, 2));
    return empty;
  }
}

async function writeListings(listings: Listing[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(listings, null, 2));
}

export async function getAllListings(): Promise<Listing[]> {
  const listings = await ensureDataFile();
  return listings.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getListingById(id: string): Promise<Listing | null> {
  const listings = await ensureDataFile();
  const listing = listings.find((item) => item.id === id);
  return listing ? normalizeListing(listing) : null;
}

export type CreateListingResult = {
  listing: Listing;
  shopifyUrl: string | null;
  shopifyAdminUrl: string | null;
  publishedToShopify: boolean;
};

export async function createListing(
  input: CreateListingInput,
): Promise<CreateListingResult> {
  const listings = await ensureDataFile();

  let listing: Listing = {
    id: randomUUID(),
    title: input.title.trim(),
    description: input.description.trim(),
    price: input.price,
    category: input.category.trim(),
    condition: input.condition?.trim() || "Used - Good",
    location: input.location?.trim() || "Berkeley, CA",
    sellerId: input.sellerId?.trim() || "marketplace-agent",
    createdAt: new Date().toISOString(),
    shopifyProductId: null,
    shopifyHandle: null,
    shopifyAdminUrl: null,
    shopifyStorefrontUrl: null,
    shopifyStatus: null,
    publishedToShopifyAt: null,
    shopifyError: null,
  };

  if (isShopifyConfigured()) {
    try {
      const shopify = await publishProductToShopify({
        title: listing.title,
        description: listing.description,
        price: listing.price,
        category: listing.category,
        condition: listing.condition,
        location: listing.location,
      });

      listing = {
        ...listing,
        shopifyProductId: shopify.productId,
        shopifyHandle: shopify.handle,
        shopifyAdminUrl: shopify.adminUrl,
        shopifyStorefrontUrl: shopify.storefrontUrl,
        shopifyStatus: "live",
        publishedToShopifyAt: new Date().toISOString(),
      };
    } catch (error) {
      listing = {
        ...listing,
        shopifyStatus: "failed",
        shopifyError:
          error instanceof Error ? error.message : "Unknown Shopify error",
      };
    }
  } else {
    listing = {
      ...listing,
      shopifyStatus: "local_only",
      shopifyError: "Shopify credentials not configured",
    };
  }

  listings.push(listing);
  await writeListings(listings);

  return {
    listing,
    shopifyUrl: listing.shopifyStorefrontUrl,
    shopifyAdminUrl: listing.shopifyAdminUrl,
    publishedToShopify: listing.shopifyStatus === "live",
  };
}
