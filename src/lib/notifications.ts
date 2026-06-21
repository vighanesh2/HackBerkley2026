import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type SoldNotification = {
  id: string;
  sellerId: string;
  title: string;
  price: number;
  orderId: string;
  productId: string;
  createdAt: string;
  deliveredAt: string | null;
};

function getDataFile(): string {
  if (process.env.VERCEL) {
    return path.join("/tmp", "sold-notifications.json");
  }
  return path.join(process.cwd(), "data", "sold-notifications.json");
}

let memoryNotifications: SoldNotification[] | null = null;

async function readNotifications(): Promise<SoldNotification[]> {
  if (memoryNotifications) {
    return memoryNotifications;
  }

  try {
    const raw = await fs.readFile(getDataFile(), "utf-8");
    memoryNotifications = JSON.parse(raw) as SoldNotification[];
    return memoryNotifications;
  } catch {
    memoryNotifications = [];
    return memoryNotifications;
  }
}

async function writeNotifications(notifications: SoldNotification[]): Promise<void> {
  memoryNotifications = notifications;
  try {
    await fs.mkdir(path.dirname(getDataFile()), { recursive: true });
    await fs.writeFile(getDataFile(), JSON.stringify(notifications, null, 2));
  } catch {
    // Non-fatal on serverless.
  }
}

export function normalizeProductId(productId: string | number | null | undefined): string | null {
  if (productId === null || productId === undefined || productId === "") {
    return null;
  }

  const raw = String(productId).trim();
  if (raw.startsWith("gid://shopify/Product/")) {
    return raw.split("/").pop() ?? null;
  }

  return raw.replace(/\D/g, "") || null;
}

export async function createSoldNotification(input: {
  sellerId: string;
  title: string;
  price: number;
  orderId: string;
  productId: string;
}): Promise<SoldNotification> {
  const notifications = await readNotifications();
  const duplicate = notifications.find(
    (item) =>
      item.orderId === input.orderId &&
      item.productId === input.productId &&
      item.sellerId === input.sellerId,
  );

  if (duplicate) {
    return duplicate;
  }

  const notification: SoldNotification = {
    id: randomUUID(),
    sellerId: input.sellerId,
    title: input.title,
    price: input.price,
    orderId: input.orderId,
    productId: input.productId,
    createdAt: new Date().toISOString(),
    deliveredAt: null,
  };

  notifications.push(notification);
  await writeNotifications(notifications);
  return notification;
}

export async function getPendingNotifications(sellerId: string): Promise<SoldNotification[]> {
  const notifications = await readNotifications();
  return notifications.filter(
    (item) => item.sellerId === sellerId && item.deliveredAt === null,
  );
}

export async function acknowledgeNotifications(ids: string[]): Promise<number> {
  const notifications = await readNotifications();
  const idSet = new Set(ids);
  let count = 0;

  for (const item of notifications) {
    if (idSet.has(item.id) && item.deliveredAt === null) {
      item.deliveredAt = new Date().toISOString();
      count += 1;
    }
  }

  await writeNotifications(notifications);
  return count;
}
