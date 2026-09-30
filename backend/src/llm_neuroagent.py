"""
MindMash / NeuroAgent
LLM-based reasoning layer for EEG artifact decisions.

The existing pipeline already performs:
    ICLabel + PSD + ALICE -> Evidence Fusion -> NeuroAgent

This module adds an LLM reasoning layer on top of that evidence.
"""

import json
import requests


OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "qwen2.5:7b"


def ask_llm(evidence):
    """
    Send structured EEG evidence to the local Qwen model.
    """

    prompt = f"""
You are an EEG artifact classification assistant.

You will receive evidence about one ICA component.

Use ONLY the evidence provided.
Do not invent information.

Possible decisions:
- KEEP
- REMOVE
- REVIEW

Rules:
- REMOVE if the evidence strongly indicates an artifact.
- KEEP if the evidence strongly indicates brain/clean activity.
- REVIEW if the evidence is conflicting or insufficient.

Return ONLY valid JSON in this format:

{{
    "decision": "KEEP",
    "confidence": 0.0,
    "reason": "short explanation"
}}

EEG evidence:
{json.dumps(evidence, indent=2)}
"""

    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "stream": False,
        "format": "json"
    }

    response = requests.post(
        OLLAMA_URL,
        json=payload,
        timeout=120
    )

    response.raise_for_status()

    result = response.json()

    content = result["message"]["content"]

    return json.loads(content)


if __name__ == "__main__":

    example_evidence = {
        "component": 0,
        "iclabel_label": "eye blink",
        "iclabel_confidence": 0.995,
        "psd_artifact_score": 0.85,
        "alice_artifact_score": 0.90,
        "fusion_artifact_score": 0.89,
        "fusion_decision": "REMOVE"
    }

    decision = ask_llm(example_evidence)

    print(json.dumps(decision, indent=2))