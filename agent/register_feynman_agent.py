"""
Register Feynman Course Agent for Agentverse / ASI:One discoverability.

Use this for external (mailbox) agents OR to update profile metadata programmatically.
For hosted agents, you usually configure everything in the Agentverse dashboard instead
(see agent/ASI_ONE_SETUP.md).

Usage:
  export AGENTVERSE_KEY="your-agentverse-api-key"
  export AGENT_SEED_PHRASE="unique seed from Agentverse dashboard"
  export AGENT_ENDPOINT="https://agentverse.ai/v1/inspect/..."   # mailbox URL
  export COURSE_API_URL="https://your-app.vercel.app/api/course"  # optional, for docs only

  pip install uagents-core
  python agent/register_feynman_agent.py
"""

from __future__ import annotations

import os
from pathlib import Path

from uagents_core.utils.registration import (
    AgentverseRequestError,
    RegistrationRequestCredentials,
    register_chat_agent,
)

AGENT_NAME = "Feynman Course Agent"
AGENT_HANDLE = "feynman-coach"
README_PATH = Path(__file__).with_name("AGENTVERSE_README.md")

DESCRIPTION = (
    "Generates personalized courses and teaches with the Feynman Technique. "
    "Includes a vision drawing coach for learning diagrams step-by-step. "
    "Discoverable on ASI:One."
)

METADATA = {
    "categories": ["education", "tutoring", "learning", "courses", "drawing"],
    "is_public": "True",
}


def main() -> None:
    api_key = os.environ.get("AGENTVERSE_KEY", "").strip()
    seed = os.environ.get("AGENT_SEED_PHRASE", "").strip()
    endpoint = os.environ.get("AGENT_ENDPOINT", "").strip()

    if not api_key:
        raise SystemExit("Missing AGENTVERSE_KEY — get it from agentverse.ai/profile/api-keys")
    if not seed:
        raise SystemExit("Missing AGENT_SEED_PHRASE — copy from your Agentverse agent dashboard")
    if not endpoint:
        raise SystemExit(
            "Missing AGENT_ENDPOINT — mailbox/inspector URL from Agent Inspector.\n"
            "For hosted agents, use the Agentverse dashboard instead (see ASI_ONE_SETUP.md)."
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
                **METADATA,
                "handle": AGENT_HANDLE,
            },
        )
    except AgentverseRequestError as error:
        raise SystemExit(f"Registration failed: {error}") from error

    print(f"Registered {AGENT_NAME} on Agentverse.")
    print(f"Suggested handle: @{AGENT_HANDLE}")
    print(f"Endpoint: {endpoint}")
    print("Test on ASI:One with Agents toggle ON.")
    course_url = os.environ.get("COURSE_API_URL", "").strip()
    if course_url:
        print(f"Remember to set COURSE_API_URL={course_url} in Agentverse secrets.")


if __name__ == "__main__":
    main()
