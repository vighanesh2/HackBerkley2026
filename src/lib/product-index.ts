import { promises as fs } from "fs";
import path from "path";
import { normalizeProductId } from "@/lib/notifications";

export type ProductIndexEntry = {
  productId: string;
  sellerId: string;
  listingId: string;
  title: string;
  price: number;
};

function getDataFile(): string {
  if (process.env.VERCEL) {
    return path.join("/tmp", "product-index.json");
  }
  return path.join(process.cwd(), "data", "product-index.json");
}

let memoryIndex: ProductIndexEntry[] | null = null;

async function readIndex(): Promise<ProductIndexEntry[]> {
  if (memoryIndex) {
    return memoryIndex;
  }

  try {
    const raw = await fs.readFile(getDataFile(), "utf-8");
    memoryIndex = JSON.parse(raw) as ProductIndexEntry[];
    return memoryIndex;
  } catch {
    memoryIndex = [];
    return memoryIndex;
  }
}

async function writeIndex(entries: ProductIndexEntry[]): Promise<void> {
  memoryIndex = entries;
  try {
    await fs.mkdir(path.dirname(getDataFile()), { recursive: true });
    await fs.writeFile(getDataFile(), JSON.stringify(entries, null, 2));
  } catch {
    // Non-fatal on serverless.
  }
}

export async function indexLiveProduct(input: {
  shopifyProductId: string;
  sellerId: string;
  listingId: string;
  title: string;
  price: number;
}): Promise<void> {
  const productId = normalizeProductId(input.shopifyProductId);
  if (!productId) {
    return;
  }

  const entries = await readIndex();
  const next = entries.filter((item) => item.productId !== productId);
  next.push({
    productId,
    sellerId: input.sellerId,
    listingId: input.listingId,
    title: input.title,
    price: input.price,
  });
  await writeIndex(next);
}

export async function findProductIndex(
  productId: string | number | null | undefined,
): Promise<ProductIndexEntry | null> {
  const normalized = normalizeProductId(productId);
  if (!normalized) {
    return null;
  }

  const entries = await readIndex();
  return entries.find((item) => item.productId === normalized) ?? null;
}
