"""
Hackathon registration script — run exactly as the submission page shows.

Prerequisites:
  export AGENTVERSE_KEY="paste from hackathon Copy button"
  export AGENT_SEED_PHRASE="any unique phrase e.g. sellanything-hackathon-2026"

Run:
  pip install uagents-core
  python agent/register_hackathon.py
"""

import os

from uagents_core.utils.registration import (
    RegistrationRequestCredentials,
    register_chat_agent,
)

AGENT_NAME = "SellAnything"
# Endpoint URL shown on the hackathon submission page
AGENT_ENDPOINT = "https://hack-berkley2026.vercel.app/"


def main() -> None:
    api_key = os.environ.get("AGENTVERSE_KEY")
    seed = os.environ.get("AGENT_SEED_PHRASE")

    if not api_key:
        raise SystemExit("Missing AGENTVERSE_KEY — click Copy on the hackathon page and export it.")
    if not seed:
        raise SystemExit("Missing AGENT_SEED_PHRASE — pick a unique phrase and export it.")

    readme_path = os.path.join(os.path.dirname(__file__), "AGENTVERSE_README.md")
    readme = ""
    if os.path.exists(readme_path):
        readme = open(readme_path, encoding="utf-8").read()

    register_chat_agent(
        AGENT_NAME,
        AGENT_ENDPOINT,
        active=True,
        credentials=RegistrationRequestCredentials(
            agentverse_api_key=api_key,
            agent_seed_phrase=seed,
        ),
        readme=readme or None,
        description=(
            "Autonomous commerce agent discoverable on ASI:One. "
            "Understands sell intent and posts live products to Shopify."
        ),
    )

    print(f"Registered {AGENT_NAME} on Agentverse.")
    print(f"Endpoint: {AGENT_ENDPOINT}")
    print("Go back to the hackathon page and click 'Evaluate my Agents registration'.")


if __name__ == "__main__":
    main()
