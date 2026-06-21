export type ShopifyListingStatus = "live" | "failed" | "local_only";

export type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  location: string;
  sellerId: string;
  createdAt: string;
  shopifyProductId: string | null;
  shopifyHandle: string | null;
  shopifyAdminUrl: string | null;
  shopifyStorefrontUrl: string | null;
  shopifyStatus: ShopifyListingStatus | null;
  publishedToShopifyAt: string | null;
  shopifyError: string | null;
};

export type CreateListingInput = {
  title: string;
  description: string;
  price: number;
  category: string;
  condition?: string;
  location?: string;
  sellerId?: string;
};
