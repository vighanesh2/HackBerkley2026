import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAgent } from "@/lib/auth";
import {
  acknowledgeNotifications,
  createSoldNotification,
  getPendingNotifications,
} from "@/lib/notifications";

export async function GET(request: NextRequest) {
  if (!isAuthorizedAgent(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sellerId = request.nextUrl.searchParams.get("sellerId")?.trim();
  if (!sellerId) {
    return NextResponse.json({ error: "sellerId is required" }, { status: 400 });
  }

  const notifications = await getPendingNotifications(sellerId);
  return NextResponse.json({ notifications });
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedAgent(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    action?: string;
    ids?: string[];
    sellerId?: string;
    title?: string;
    price?: number;
    orderId?: string;
    productId?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action === "ack") {
    const ids = body.ids ?? [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "ids is required" }, { status: 400 });
    }

    const acknowledged = await acknowledgeNotifications(ids);
    return NextResponse.json({ acknowledged });
  }

  if (body.action === "simulate-sold") {
    if (!body.sellerId?.trim() || !body.title?.trim()) {
      return NextResponse.json(
        { error: "sellerId and title are required" },
        { status: 400 },
      );
    }

    const notification = await createSoldNotification({
      sellerId: body.sellerId.trim(),
      title: body.title.trim(),
      price: typeof body.price === "number" ? body.price : 0,
      orderId: body.orderId?.trim() || `demo-${Date.now()}`,
      productId: body.productId?.trim() || "demo-product",
    });

    return NextResponse.json({ notification }, { status: 201 });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
