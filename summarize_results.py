import os
import sys

from openai import OpenAI


def main():
    if len(sys.argv) < 2:
        print("Usage: python summarize_results.py <metrics_string>")
        sys.exit(1)

    metrics_context = sys.argv[1]

    # Simple parsing or just passing the raw string is fine?
    # The shell script will pass something like:
    # "Accuracy: 0.00%, Latency: 190523ms, Hit@10: 60%, MRR: 0.233"

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY not set")
        sys.exit(1)

    client = OpenAI(api_key=api_key)

    prompt = f"""
You are a performance engineer analyzing benchmark results for 'Memsy', a vector-based long-term memory system.
Analyze the following metrics and provide a **very concise, single-sentence** summary for a developer.
Highlight if the run looks good (high accuracy/retrieval) or bad (low accuracy, high latency).

Metrics:
{metrics_context}

Example outputs:
- "Performance is critical; total latency is extremely high (190s) and accuracy is 0%, indicating a potential timeout or ingestion bottleneck."
- "Strong retrieval (Hit@10: 95%) but low final accuracy suggests the answering model is failing to utilize context."
- "Excellent run; low latency and high accuracy."

Summary:
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": "You are a helpful performance analyst helper."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=60,
        )
        content = response.choices[0].message.content.strip()
        # Remove quotes if present
        content = content.strip('"')
        print(content)
    except Exception as e:
        print(f"Failed to generate summary: {e}")


if __name__ == "__main__":
    main()
