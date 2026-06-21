import Link from "next/link";
import { notFound } from "next/navigation";
import { getListingById } from "@/lib/listings";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingPage({ params }: PageProps) {
  const { id } = await params;
  const listing = await getListingById(id);

  if (!listing) {
    notFound();
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            SellAnything
          </Link>
          <Link
            href="/"
            className="text-sm text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <div className="rounded-2xl border border-zinc-200 p-8 dark:border-zinc-800">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {listing.category}
              </span>
              {listing.shopifyStatus === "live" && (
                <span className="rounded-full bg-[#F4F8EC] px-3 py-1 text-sm font-medium text-[#435A2B]">
                  Live
                </span>
              )}
              {listing.shopifyStatus === "failed" && (
                <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                  Publish failed
                </span>
              )}
            </div>
            <span className="text-3xl font-bold">{formatPrice(listing.price)}</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight">{listing.title}</h1>
          <p className="mt-6 whitespace-pre-wrap leading-relaxed text-zinc-600 dark:text-zinc-400">
            {listing.description}
          </p>

          {listing.shopifyError && listing.shopifyStatus !== "live" && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {listing.shopifyError}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {listing.shopifyStorefrontUrl && (
              <a
                href={listing.shopifyStorefrontUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-[#96BF48] px-4 py-2 text-sm font-medium text-white hover:bg-[#7da63a]"
              >
                View listing
              </a>
            )}
            {listing.shopifyAdminUrl && (
              <a
                href={listing.shopifyAdminUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Manage listing
              </a>
            )}
          </div>

          <div className="mt-8 border-t border-zinc-200 pt-6 text-sm text-zinc-500 dark:border-zinc-800">
            Posted by {listing.sellerId} on{" "}
            {new Date(listing.createdAt).toLocaleString()}
          </div>
        </div>
      </main>
    </div>
  );
}
