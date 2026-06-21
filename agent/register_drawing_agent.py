"""
Register Diagram Drawing Coach on Agentverse for ASI:One discoverability.

  export AGENTVERSE_KEY="your-agentverse-api-key"
  export AGENT_SEED_PHRASE="seed from Agentverse dashboard"
  export AGENT_ENDPOINT="mailbox/inspector URL"
  python agent/register_drawing_agent.py
"""

from __future__ import annotations

import os
from pathlib import Path

from uagents_core.utils.registration import (
    AgentverseRequestError,
    RegistrationRequestCredentials,
    register_chat_agent,
)

AGENT_NAME = "Diagram Drawing Coach"
AGENT_HANDLE = "diagram-coach"
README_PATH = Path(__file__).with_name("DRAWING_AGENT_README.md")

DESCRIPTION = (
    "Vision-powered drawing coach for learning technical diagrams — circuits, "
    "neural networks, flowcharts. Step-by-step canvas guidance on ASI:One."
)


def main() -> None:
    api_key = os.environ.get("AGENTVERSE_KEY", "").strip()
    seed = os.environ.get("AGENT_SEED_PHRASE", "").strip()
    endpoint = os.environ.get("AGENT_ENDPOINT", "").strip()

    if not api_key or not seed or not endpoint:
        raise SystemExit(
            "Set AGENTVERSE_KEY, AGENT_SEED_PHRASE, and AGENT_ENDPOINT.\n"
            "For hosted agents, use DRAWING_ASI_ONE_SETUP.md dashboard steps instead."
        )

    readme = README_PATH.read_text(encoding="utf-8") if README_PATH.exists() else None

    try:
        register_chat_agent(
            AGENT_NAME,
            endpoint,
            active=True,
            credentials=RegistrationRequestCredentials(
                agentverse_api_key=api_key,
                agent_seed_phrase=seed,
            ),
            description=DESCRIPTION,
            readme=readme,
            metadata={
                "categories": ["education", "drawing", "diagram", "vision"],
                "is_public": "True",
                "handle": AGENT_HANDLE,
            },
        )
    except AgentverseRequestError as error:
        raise SystemExit(f"Registration failed: {error}") from error

    print(f"Registered {AGENT_NAME} (@{AGENT_HANDLE})")
    print(f"Endpoint: {endpoint}")
    print('Test on ASI:One: "Teach me to draw an electrical circuit"')


if __name__ == "__main__":
    main()
