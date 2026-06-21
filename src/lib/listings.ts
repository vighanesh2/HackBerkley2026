import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { isShopifyConfigured, publishProductToShopify } from "@/lib/shopify";
import { indexLiveProduct } from "@/lib/product-index";
import type { CreateListingInput, Listing } from "@/types/listing";

function getDataFile(): string {
  if (process.env.VERCEL) {
    return path.join("/tmp", "listings.json");
  }
  return path.join(process.cwd(), "data", "listings.json");
}

function getBundledDataFile(): string {
  return path.join(process.cwd(), "data", "listings.json");
}

let memoryListings: Listing[] | null = null;

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

async function readListingsFromFile(filePath: string): Promise<Listing[] | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Listing>[];
    return parsed.map((item) => normalizeListing(item as Listing));
  } catch {
    return null;
  }
}

async function ensureDataFile(): Promise<Listing[]> {
  if (memoryListings) {
    return memoryListings;
  }

  const dataFile = getDataFile();
  const fromPrimary = await readListingsFromFile(dataFile);
  if (fromPrimary) {
    memoryListings = fromPrimary;
    return fromPrimary;
  }

  if (process.env.VERCEL) {
    const fromBundled = await readListingsFromFile(getBundledDataFile());
    if (fromBundled) {
      memoryListings = fromBundled;
      return fromBundled;
    }
  }

  memoryListings = [];
  return memoryListings;
}

async function writeListings(listings: Listing[]): Promise<void> {
  memoryListings = listings;

  const dataFile = getDataFile();
  try {
    await fs.mkdir(path.dirname(dataFile), { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(listings, null, 2));
  } catch {
    // Vercel may reject writes outside /tmp; Shopify success matters more than persistence.
  }
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

      await indexLiveProduct({
        shopifyProductId: shopify.productId,
        sellerId: listing.sellerId,
        listingId: listing.id,
        title: listing.title,
        price: listing.price,
      });
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
