import ListingChat from "@/components/ListingChat";
import MarketplaceFeed from "@/components/MarketplaceFeed";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
              ASI:One + Agentverse + Shopify
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              SellAnything Agent
            </h1>
          </div>
          <a
            href="https://agentverse.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Deploy on Agentverse
          </a>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-10 px-6 py-10 lg:grid-cols-2">
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Posted products</h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Products the agent creates appear here with links to your live Shopify store.
            </p>
          </div>
          <MarketplaceFeed />
        </section>

        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Try the agent</h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Describe what you want to sell. The agent posts it to Shopify via the real Admin API.
            </p>
          </div>
          <ListingChat />

          <div className="rounded-2xl border border-zinc-200 p-5 text-sm leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              Agentverse deployment (hackathon track)
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Deploy this app to Vercel (Shopify creds on server)</li>
              <li>Paste <code className="text-xs">agent/agent.py</code> into Agentverse Build tab</li>
              <li>Paste <code className="text-xs">agent/AGENTVERSE_README.md</code> into README tab</li>
              <li>Add secrets: ASI_API_KEY, MARKETPLACE_API_URL, LISTINGS_API_SECRET</li>
              <li>Test on ASI:One with Agents toggle on</li>
            </ol>
            <p className="mt-3 text-xs text-zinc-500">
              Full guide: AGENTVERSE_DEPLOY.md
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
