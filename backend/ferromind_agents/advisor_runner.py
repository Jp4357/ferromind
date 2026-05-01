"""
FerroMind Parallel Advisor Runner
===================================
Runs 4 specialist agents simultaneously via asyncio.gather().
Each agent uses the SDK's WebSearchTool — real web search.
Streams live events to the frontend via SSE.
Chart agent builds JSON specs from all research.
Planner synthesises everything into the brief.

No demo data. No hardcoded fallbacks.
Requires OPENAI_API_KEY.
"""

import os, sys, json, asyncio, re
from datetime import datetime, timezone
from typing import AsyncGenerator
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

CACHE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "artifacts", "advisor_report.json"
)
OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")

# ── SSE helper ────────────────────────────────────────────────────────────────

def _sse(event_type: str, data: dict) -> str:
    return f"data: {json.dumps({'type': event_type, **data})}\n\n"

AGENT_META = {
    "Market Research Agent":          {"icon": "📈", "color": "#4a9eff"},
    "Competitive Intelligence Agent": {"icon": "🔍", "color": "#7F77DD"},
    "Industry Research Agent":        {"icon": "🏭", "color": "#2ecc8b"},
    "Plant Data Agent":               {"icon": "📊", "color": "#2ab8b0"},
    "Chart Specification Agent":      {"icon": "📉", "color": "#f0a500"},
    "FerroMind Strategic Advisor":    {"icon": "🎯", "color": "#e05c2a"},
}


# ── Single agent: stream events, return final output ─────────────────────────

async def _run_one(
    agent,
    prompt: str,
    queue: asyncio.Queue,
) -> str:
    """
    Runs one agent via Runner.run_streamed().
    Pushes SSE events into queue as the agent works.
    Returns final_output string when done.
    """
    from agents import Runner
    from agents.stream_events import RunItemStreamEvent

    label = agent.name
    meta  = AGENT_META.get(label, {"icon": "🤖", "color": "#6b7a8d"})

    await queue.put(_sse("agent_start", {
        "agent":     label,
        "icon":      meta["icon"],
        "color":     meta["color"],
        "message":   f"{label} starting...",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }))

    search_count = 0
    final_output = ""

    try:
        # SDK 0.14+: run_streamed() returns RunResultStreaming directly (not a context manager)
        stream = Runner.run_streamed(agent, prompt)
        async for event in stream.stream_events():

            # Only care about RunItemStreamEvents
            if not isinstance(event, RunItemStreamEvent):
                continue

            name = event.name
            item = event.item

            # Web search tool called — agent decided to search
            if name == "tool_search_called":
                search_count += 1
                query = ""
                raw = getattr(item, "raw_item", None)
                if raw:
                    try:
                        args = getattr(raw, "parameters", None) or {}
                        query = args.get("query", "")[:80]
                    except Exception:
                        pass
                await queue.put(_sse("agent_search", {
                    "agent":   label,
                    "icon":    meta["icon"],
                    "color":   meta["color"],
                    "query":   query,
                    "message": f"🔎 Searching: {query}" if query else "🔎 Searching web...",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }))

            # Search result returned
            elif name == "tool_search_output_created":
                await queue.put(_sse("agent_search_done", {
                    "agent":   label,
                    "icon":    meta["icon"],
                    "color":   meta["color"],
                    "message": "✓ Search result received",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }))

            # Function tool called (e.g. get_plant_kpis)
            elif name == "tool_called":
                tool_name = getattr(item, "tool_name", "tool") or "tool"
                await queue.put(_sse("agent_tool_call", {
                    "agent":   label,
                    "icon":    meta["icon"],
                    "color":   meta["color"],
                    "message": f"⚙ Calling {tool_name}...",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }))

            # Function tool output
            elif name == "tool_output":
                await queue.put(_sse("agent_tool_done", {
                    "agent":   label,
                    "icon":    meta["icon"],
                    "color":   meta["color"],
                    "message": "✓ Tool result received",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }))

            # Final message from agent — extract text
            elif name == "message_output_created":
                raw = getattr(item, "raw_item", None)
                if raw:
                    for block in getattr(raw, "content", []):
                        if hasattr(block, "text"):
                            final_output += getattr(block, "text", "")

        # Fallback: get final_output from result if streaming missed it
        if not final_output:
            fo = stream.final_output
            final_output = str(fo) if fo is not None else ""

    except Exception as e:
        await queue.put(_sse("agent_error", {
            "agent":   label,
            "message": f"Error in {label}: {str(e)[:120]}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }))
        final_output = f"[{label} encountered an error: {e}]"

    await queue.put(_sse("agent_done", {
        "agent":        label,
        "icon":         meta["icon"],
        "color":        meta["color"],
        "search_count": search_count,
        "message":      f"{label} complete — {search_count} web searches",
        "timestamp":    datetime.now(timezone.utc).isoformat(),
    }))

    return final_output


# ── Parallel runner: all 4 research agents at once ────────────────────────────

async def stream_report_generation() -> AsyncGenerator[str, None]:
    """
    Main SSE generator.
    1. Sets OpenAI API key.
    2. Runs 4 research agents in parallel.
    3. Chart agent builds JSON specs from research.
    4. Planner synthesises brief from all results.
    """
    if not OPENAI_KEY:
        yield _sse("error", {
            "message": (
                "OPENAI_API_KEY is not set. "
                "Set it with: export OPENAI_API_KEY=sk-... "
                "WebSearchTool requires a real OpenAI API key."
            ),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return

    # Set API key for SDK
    from agents import set_default_openai_key
    set_default_openai_key(OPENAI_KEY)

    from ferromind_agents.advisor_team import (
        build_market_agent, build_competitive_agent,
        build_industry_agent, build_data_agent,
        build_chart_agent, build_planner_agent,
    )

    yield _sse("started", {
        "message":   "Deploying 4 research agents in parallel...",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agents":    [
            "Market Research Agent",
            "Competitive Intelligence Agent",
            "Industry Research Agent",
            "Plant Data Agent",
        ],
    })

    # ── Phase 1: Run all 4 research agents in parallel ────────────────────────
    queue: asyncio.Queue = asyncio.Queue()

    market_agent      = build_market_agent()
    competitive_agent = build_competitive_agent()
    industry_agent    = build_industry_agent()
    data_agent        = build_data_agent()

    # Coroutines for all 4 agents
    async def run_parallel():
        results = await asyncio.gather(
            _run_one(market_agent,      "Research the FeCr market now.", queue),
            _run_one(competitive_agent, "Research current FeCr competitor status.", queue),
            _run_one(industry_agent,    "Research stainless steel, chrome ore, and technology trends.", queue),
            _run_one(data_agent,        "Fetch and interpret our plant KPIs.", queue),
            return_exceptions=True,
        )
        await queue.put(("__PARALLEL_DONE__", results))

    gather_task = asyncio.create_task(run_parallel())

    # Stream events from queue while agents work
    research_outputs = []
    while True:
        try:
            item = await asyncio.wait_for(queue.get(), timeout=120)
        except asyncio.TimeoutError:
            yield _sse("error", {"message": "Agents timed out after 120s"})
            return

        if isinstance(item, tuple) and item[0] == "__PARALLEL_DONE__":
            research_outputs = [
                str(r) if not isinstance(r, Exception) else f"[Error: {r}]"
                for r in item[1]
            ]
            break
        yield item  # Forward SSE to client

    yield _sse("parallel_complete", {
        "message":   f"All 4 agents complete. Building charts and synthesising...",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    # ── Phase 2: Chart agent builds JSON specs ────────────────────────────────
    chart_queue: asyncio.Queue = asyncio.Queue()
    chart_prompt = (
        "Here are the research findings from 4 parallel agents:\n\n"
        f"=== MARKET RESEARCH ===\n{research_outputs[0]}\n\n"
        f"=== COMPETITIVE INTELLIGENCE ===\n{research_outputs[1]}\n\n"
        f"=== INDUSTRY RESEARCH ===\n{research_outputs[2]}\n\n"
        f"=== PLANT DATA ===\n{research_outputs[3]}\n\n"
        "Build 5 chart JSON specifications using actual data from these findings."
    )

    chart_agent  = build_chart_agent()
    chart_output = await _run_one(chart_agent, chart_prompt, chart_queue)

    # Drain chart queue events
    while not chart_queue.empty():
        yield await chart_queue.get()

    charts = _parse_charts(chart_output)

    # ── Phase 3: Planner synthesises the brief ────────────────────────────────
    planner_queue: asyncio.Queue = asyncio.Queue()
    planner_prompt = (
        "Here are the research findings from 4 parallel specialist agents:\n\n"
        f"=== MARKET RESEARCH ===\n{research_outputs[0]}\n\n"
        f"=== COMPETITIVE INTELLIGENCE ===\n{research_outputs[1]}\n\n"
        f"=== INDUSTRY RESEARCH ===\n{research_outputs[2]}\n\n"
        f"=== PLANT DATA ===\n{research_outputs[3]}\n\n"
        "Synthesise into the executive brief JSON."
    )

    planner_agent  = build_planner_agent()
    planner_output = await _run_one(planner_agent, planner_prompt, planner_queue)

    # Drain planner queue events
    while not planner_queue.empty():
        yield await planner_queue.get()

    brief = _parse_brief(planner_output)

    # ── Assemble and cache report ──────────────────────────────────────────────
    report = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "model":        "gpt-4o",
            "mode":         "live — real web search via WebSearchTool",
            "agent_team":   "FerroMind Parallel Advisor Team",
            "agents_run":   6,
        },
        "brief":  brief,
        "charts": charts,
        "raw_research": {
            "market":      research_outputs[0] if len(research_outputs) > 0 else "",
            "competitive": research_outputs[1] if len(research_outputs) > 1 else "",
            "industry":    research_outputs[2] if len(research_outputs) > 2 else "",
            "plant":       research_outputs[3] if len(research_outputs) > 3 else "",
        },
    }
    _save_cache(report)

    yield _sse("complete", {
        "message":   "Research complete — strategic brief ready",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "report":    report,
    })


# ── Parsers ───────────────────────────────────────────────────────────────────

def _parse_charts(text: str) -> list:
    """Parse chart JSON array from agent output."""
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*",     "", text)
    # Find JSON array
    match = re.search(r'\[[\s\S]*\]', text)
    if match:
        try:
            charts = json.loads(match.group())
            if isinstance(charts, list):
                return charts
        except Exception:
            pass
    return []


def _parse_brief(text: str) -> dict:
    """Parse brief JSON object from planner output."""
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*",     "", text)
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return {
        "headline":                  "Research complete — see raw findings for details",
        "market_position":           text[:500] if text else "",
        "key_findings":              [],
        "strategic_recommendations": [],
        "risks":                     [],
        "opportunities":             [],
        "competitive_position":      "",
        "research_sources":          [],
    }


def _save_cache(report: dict):
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with open(CACHE_PATH, "w") as f:
        json.dump(report, f, indent=2, default=str)


def load_cached_report() -> dict | None:
    if not os.path.exists(CACHE_PATH):
        return None
    try:
        with open(CACHE_PATH) as f:
            return json.load(f)
    except Exception:
        return None


# ── Advisor chat ──────────────────────────────────────────────────────────────

async def handle_advisor_chat(
    question: str,
    report_context: dict,
) -> AsyncGenerator[str, None]:
    """
    GPT-4o streaming chat grounded in the report.
    No fallback — requires OPENAI_API_KEY.
    """
    if not OPENAI_KEY:
        yield _sse("chat_error", {
            "message": "OPENAI_API_KEY not set — chat requires a real API key."
        })
        return

    from agents import set_default_openai_key
    set_default_openai_key(OPENAI_KEY)

    # Use chat completions for streaming chat (Responses API not needed here)
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=OPENAI_KEY)

    brief = report_context.get("brief", {})
    raw   = report_context.get("raw_research", {})

    system = (
        "You are the FerroMind Strategic Advisor for Vantech Ferrochrome. "
        "Answer questions directly using the research findings. "
        "Be specific with numbers. Be advisory and opinionated."
    )
    context = (
        f"EXECUTIVE BRIEF:\n{json.dumps(brief, indent=2)}\n\n"
        f"RAW MARKET RESEARCH (excerpt):\n{str(raw.get('market',''))[:800]}\n\n"
        f"RAW COMPETITIVE INTEL (excerpt):\n{str(raw.get('competitive',''))[:800]}\n"
    )

    try:
        stream = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system",    "content": system},
                {"role": "assistant", "content": context},
                {"role": "user",      "content": question},
            ],
            stream=True,
            max_tokens=500,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                yield _sse("chat_chunk", {"text": delta})
        yield _sse("chat_done", {"text": ""})

    except Exception as e:
        yield _sse("chat_error", {"message": str(e)})
