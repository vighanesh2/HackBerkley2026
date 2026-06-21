"""
Register SellAnything as an EXTERNAL agent on Agentverse (mailbox / Render path).

Do NOT use this for Hosted Agents (paste agent.py in Agentverse editor instead).

Usage:
  export AGENTVERSE_KEY=your-agentverse-api-key
  export AGENT_SEED_PHRASE="your unique seed phrase"
  python agent/register_external.py

After running your agent with mailbox=True, the endpoint must be the agent's
mailbox URL from Agent Inspector — NOT your Vercel app URL.

Vercel is only for Shopify actions:
  MARKETPLACE_API_URL=https://hack-berkley2026.vercel.app/api/listings
"""

import os
from pathlib import Path

from uagents_core.utils.registration import (
    AgentverseRequestError,
    RegistrationRequestCredentials,
    register_chat_agent,
)

README = Path(__file__).with_name("AGENTVERSE_README.md").read_text()


def main() -> None:
    api_key = os.environ.get("AGENTVERSE_KEY")
    seed = os.environ.get("AGENT_SEED_PHRASE")
    # Must be the uAgent mailbox/inspector endpoint — never your Next.js site
    endpoint = os.environ.get("AGENT_ENDPOINT")

    if not api_key or not seed or not endpoint:
        raise SystemExit(
            "Set AGENTVERSE_KEY, AGENT_SEED_PHRASE, and AGENT_ENDPOINT.\n"
            "AGENT_ENDPOINT = mailbox URL from Agent Inspector after running the agent.\n"
            "Example: https://agentverse.ai/v1/inspect/...\n"
            "Your Vercel URL belongs in MARKETPLACE_API_URL inside the agent secrets, not here."
        )

    try:
        register_chat_agent(
            "SellAnything",
            endpoint,
            active=True,
            credentials=RegistrationRequestCredentials(
                agentverse_api_key=api_key,
                agent_seed_phrase=seed,
            ),
            readme=README,
            description=(
                "Autonomous commerce agent that posts live products to Shopify. "
                "Discoverable on ASI:One. Understands sell intent and executes real listings."
            ),
            metadata={
                "categories": ["commerce", "ecommerce", "shopify"],
                "is_public": "True",
            },
        )
        print("SellAnything registered on Agentverse successfully.")
    except AgentverseRequestError as error:
        raise SystemExit(f"Registration failed: {error}") from error


if __name__ == "__main__":
    main()
