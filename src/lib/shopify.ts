type ShopifyGraphqlResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

type ProductCreateResult = {
  productCreate: {
    product: {
      id: string;
      title: string;
      handle: string;
      onlineStoreUrl: string | null;
      variants: { nodes: { id: string }[] };
    } | null;
    userErrors: { field: string[]; message: string }[];
  };
};

type VariantsBulkUpdateResult = {
  productVariantsBulkUpdate: {
    productVariants: { id: string; price: string }[];
    userErrors: { field: string[]; message: string }[];
  };
};

type TokenResponse = {
  access_token: string;
  scope: string;
  expires_in: number;
};

export type ShopifyPublishResult = {
  productId: string;
  handle: string;
  adminUrl: string;
  storefrontUrl: string;
};

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function getStoreDomain(): string {
  const raw = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  if (!raw) {
    throw new Error("SHOPIFY_STORE_DOMAIN is not configured");
  }

  if (raw.includes(".myshopify.com")) {
    return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }

  return `${raw}.myshopify.com`;
}

function getApiVersion(): string {
  return process.env.SHOPIFY_API_VERSION?.trim() || "2025-01";
}

function hasDirectAccessToken(): boolean {
  return Boolean(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim());
}

function hasClientCredentials(): boolean {
  return Boolean(
    process.env.SHOPIFY_CLIENT_ID?.trim() &&
      process.env.SHOPIFY_CLIENT_SECRET?.trim(),
  );
}

export function isShopifyConfigured(): boolean {
  const hasStore = Boolean(process.env.SHOPIFY_STORE_DOMAIN?.trim());
  const hasToken = Boolean(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim());
  const hasClientCreds = Boolean(
    process.env.SHOPIFY_CLIENT_ID?.trim() &&
      process.env.SHOPIFY_CLIENT_SECRET?.trim(),
  );

  return hasStore && (hasToken || hasClientCreds);
}

function extractNumericId(gid: string): string {
  const parts = gid.split("/");
  return parts[parts.length - 1] ?? gid;
}

async function fetchAccessTokenWithClientCredentials(): Promise<string> {
  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET are required");
  }

  const domain = getStoreDomain();
  const response = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    const oauthError = text.match(/Oauth error ([^:<]+)/i)?.[1]?.trim();
    if (oauthError === "app_not_installed") {
      throw new Error(
        `Your Shopify app is not installed on ${domain}. ` +
          "In Dev Dashboard → your app → Home → Install app → select this store → Install. " +
          "Release a version with write_products scope under Versions first.",
      );
    }
    if (oauthError) {
      throw new Error(`Shopify OAuth error: ${oauthError}`);
    }
    throw new Error(
      `Shopify token exchange failed (${response.status}). ` +
        "Make sure the app is installed on your store and has write_products scope.",
    );
  }

  const payload = (await response.json()) as TokenResponse;

  if (!payload.access_token) {
    throw new Error("Shopify token response did not include access_token");
  }

  cachedToken = payload.access_token;
  tokenExpiresAt = Date.now() + payload.expires_in * 1000;

  return payload.access_token;
}

async function getAccessToken(): Promise<string> {
  const directToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  if (directToken) {
    return directToken;
  }

  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  return fetchAccessTokenWithClientCredentials();
}

async function shopifyGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const domain = getStoreDomain();
  const token = await getAccessToken();

  const response = await fetch(
    `https://${domain}/admin/api/${getApiVersion()}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify API error (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as ShopifyGraphqlResponse<T>;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(", "));
  }

  if (!payload.data) {
    throw new Error("Shopify API returned no data");
  }

  return payload.data;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function publishProductToShopify(input: {
  title: string;
  description: string;
  price: number;
  category: string;
  condition?: string;
  location?: string;
}): Promise<ShopifyPublishResult> {
  const domain = getStoreDomain();
  const descriptionHtml = [
    `<p>${escapeHtml(input.description)}</p>`,
    input.condition ? `<p><strong>Condition:</strong> ${escapeHtml(input.condition)}</p>` : "",
    input.location ? `<p><strong>Location:</strong> ${escapeHtml(input.location)}</p>` : "",
  ]
    .filter(Boolean)
    .join("");

  const createData = await shopifyGraphql<ProductCreateResult>(
    `
      mutation productCreate($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            onlineStoreUrl
            variants(first: 1) {
              nodes {
                id
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      product: {
        title: input.title,
        descriptionHtml,
        productType: input.category,
        status: "ACTIVE",
        vendor: "Marketplace Agent",
      },
    },
  );

  const createResult = createData.productCreate;

  if (createResult.userErrors.length > 0) {
    throw new Error(
      createResult.userErrors.map((error) => error.message).join(", "),
    );
  }

  const product = createResult.product;
  if (!product) {
    throw new Error("Shopify did not return a created product");
  }

  const variantId = product.variants.nodes[0]?.id;
  if (!variantId) {
    throw new Error("Shopify product was created without a default variant");
  }

  const price = input.price.toFixed(2);

  const updateData = await shopifyGraphql<VariantsBulkUpdateResult>(
    `
      mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants {
            id
            price
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      productId: product.id,
      variants: [{ id: variantId, price }],
    },
  );

  if (updateData.productVariantsBulkUpdate.userErrors.length > 0) {
    throw new Error(
      updateData.productVariantsBulkUpdate.userErrors
        .map((error) => error.message)
        .join(", "),
    );
  }

  const numericId = extractNumericId(product.id);
  const adminUrl = `https://${domain}/admin/products/${numericId}`;
  const storefrontUrl =
    product.onlineStoreUrl ||
    `https://${domain}/products/${product.handle}`;

  return {
    productId: product.id,
    handle: product.handle,
    adminUrl,
    storefrontUrl,
  };
}
