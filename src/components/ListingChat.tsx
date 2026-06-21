"use client";

import { useState } from "react";
import ShopifyPublishOverlay from "@/components/ShopifyPublishOverlay";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

const START_MESSAGE =
  'Hi! I\'m your Shopify Listing Agent. Tell me what to sell — e.g. "Sell my road bike for $450" — and I\'ll post it to your Shopify store.';

export default function ListingChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: START_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const isConfirm = ["yes", "y", "confirm", "post", "post it"].includes(
      text.toLowerCase(),
    );

    const nextMessages = [...messages, { role: "user" as const, text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    if (isConfirm) setPublishing(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = (await response.json()) as {
        reply: string;
        published?: boolean;
        shopifyUrl?: string;
      };

      setMessages([...nextMessages, { role: "assistant", text: data.reply }]);

      if (data.published) {
        window.dispatchEvent(new Event("listing-created"));
        if (data.shopifyUrl) {
          window.open(data.shopifyUrl, "_blank", "noopener,noreferrer");
        }
      }
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          text: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setPublishing(false);
    }
  }

  return (
    <>
      <ShopifyPublishOverlay active={publishing} />

      <div className="flex h-[420px] flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <p className="text-sm font-medium">Shopify listing agent</p>
          <p className="text-xs text-zinc-500">
            Real posts via Shopify Admin API
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={sendMessage}
          className="flex gap-2 border-t border-zinc-200 p-4 dark:border-zinc-800"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder='e.g. "Sell my desk for $80"'
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-[#96BF48] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#7da63a] disabled:opacity-50"
          >
            {loading ? "..." : "Send"}
          </button>
        </form>
      </div>
    </>
  );
}
