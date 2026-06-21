"""
Hackathon registration script for Feynman Course Agent.

Prerequisites:
  export AGENTVERSE_KEY="paste from hackathon Copy button or agentverse.ai/profile/api-keys"
  export AGENT_SEED_PHRASE="seed phrase from Agentverse agent dashboard"
  export AGENT_ENDPOINT="mailbox/inspector URL from Agentverse (external agents only)"

Run:
  pip install uagents-core
  python agent/register_hackathon.py

For hosted agents, prefer the Agentverse dashboard walkthrough in ASI_ONE_SETUP.md.
"""

import os
from pathlib import Path

from uagents_core.utils.registration import (
    AgentverseRequestError,
    RegistrationRequestCredentials,
    register_chat_agent,
)

AGENT_NAME = "Feynman Course Agent"
README_PATH = Path(__file__).with_name("AGENTVERSE_README.md")


def main() -> None:
    api_key = os.environ.get("AGENTVERSE_KEY", "").strip()
    seed = os.environ.get("AGENT_SEED_PHRASE", "").strip()
    endpoint = os.environ.get("AGENT_ENDPOINT", "").strip()

    if not api_key:
        raise SystemExit("Missing AGENTVERSE_KEY — click Copy on the hackathon page or use agentverse.ai/profile/api-keys")
    if not seed:
        raise SystemExit("Missing AGENT_SEED_PHRASE — copy from your Agentverse agent dashboard")
    if not endpoint:
        raise SystemExit(
            "Missing AGENT_ENDPOINT — mailbox URL from Agent Inspector.\n"
            "Hosted agents: use ASI_ONE_SETUP.md dashboard steps instead."
        )

    readme = README_PATH.read_text(encoding="utf-8") if README_PATH.exists() else ""

    try:
        register_chat_agent(
            AGENT_NAME,
            endpoint,
            active=True,
            credentials=RegistrationRequestCredentials(
                agentverse_api_key=api_key,
                agent_seed_phrase=seed,
            ),
            readme=readme or None,
            description=(
                "AI tutor that generates personalized courses using the Feynman Technique. "
                "Includes a vision drawing coach. Discoverable on ASI:One."
            ),
            metadata={
                "categories": ["education", "tutoring", "learning"],
                "is_public": "True",
                "handle": "feynman-coach",
            },
        )
    except AgentverseRequestError as error:
        raise SystemExit(f"Registration failed: {error}") from error

    print(f"Registered {AGENT_NAME} on Agentverse.")
    print(f"Endpoint: {endpoint}")
    print("Go back to the hackathon page and click 'Evaluate my Agents registration' if required.")
    print("Test on ASI:One: enable Agents toggle → 'I want to learn basic cryptography'")


if __name__ == "__main__":
    main()
