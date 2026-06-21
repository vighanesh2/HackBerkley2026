"use client";

import { useEffect, useState } from "react";
import type { Listing } from "@/types/listing";
import MarketplaceGrid from "@/components/MarketplaceGrid";

export default function MarketplaceFeed() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadListings() {
    const response = await fetch("/api/listings");
    const data = (await response.json()) as { listings: Listing[] };
    setListings(data.listings);
    setLoading(false);
  }

  useEffect(() => {
    loadListings();

    function handleListingCreated() {
      loadListings();
    }

    window.addEventListener("listing-created", handleListingCreated);
    return () => window.removeEventListener("listing-created", handleListingCreated);
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 p-8 text-center text-zinc-500 dark:border-zinc-800">
        Loading listings...
      </div>
    );
  }

  return <MarketplaceGrid listings={listings} />;
}
