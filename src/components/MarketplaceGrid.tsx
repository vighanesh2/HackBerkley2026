import Link from "next/link";
import type { Listing } from "@/types/listing";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

export default function MarketplaceGrid({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
        <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          No products yet
        </p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Chat with the agent to auto-post your first product to Shopify.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {listings.map((listing) => (
        <div
          key={listing.id}
          className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {listing.category}
              </span>
              {listing.shopifyStatus === "live" && (
                <span className="rounded-full bg-[#F4F8EC] px-2.5 py-1 text-xs font-medium text-[#435A2B]">
                  Live on Shopify
                </span>
              )}
            </div>
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {formatPrice(listing.price)}
            </span>
          </div>

          <Link href={`/listings/${listing.id}`} className="group">
            <h3 className="text-lg font-semibold group-hover:underline">
              {listing.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {listing.description}
            </p>
          </Link>

          {listing.shopifyStorefrontUrl && (
            <a
              href={listing.shopifyStorefrontUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-medium text-[#96BF48] hover:underline"
            >
              View on Shopify →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
