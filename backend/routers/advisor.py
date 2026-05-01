"""
Advisor Router — FerroMind
Endpoints:
  GET  /api/advisor/stream          ← SSE: live agent activity + final report
  GET  /api/advisor/report          ← fetch cached report
  POST /api/advisor/chat            ← follow-up Q&A
  GET  /api/advisor/status          ← is a report cached?
"""

import asyncio, json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()


@router.get("/advisor/stream")
async def stream_advisor(force: bool = False):
    """SSE endpoint — streams agent activity events then the final report."""
    from ferromind_agents.advisor_runner import stream_report_generation, load_cached_report

    if not force:
        cached = load_cached_report()
        if cached:
            async def serve_cached():
                import json
                yield f"data: {json.dumps({'type': 'cached', 'report': cached})}\n\n"
            return StreamingResponse(serve_cached(), media_type="text/event-stream",
                                     headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    return StreamingResponse(
        stream_report_generation(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/advisor/report")
async def get_advisor_report():
    from ferromind_agents.advisor_runner import load_cached_report
    report = load_cached_report()
    if not report:
        return {"status": "no_report", "message": "No report generated yet. Use /api/advisor/stream"}
    return report


class ChatRequest(BaseModel):
    question: str
    include_context: bool = True


@router.post("/advisor/chat")
async def advisor_chat(req: ChatRequest):
    from ferromind_agents.advisor_runner import load_cached_report, handle_advisor_chat

    report = load_cached_report() if req.include_context else {}

    async def stream_chat():
        async for chunk in handle_advisor_chat(req.question, report or {}):
            yield chunk

    return StreamingResponse(
        stream_chat(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/advisor/status")
async def advisor_status():
    from ferromind_agents.advisor_runner import load_cached_report, OPENAI_KEY
    cached = load_cached_report()
    return {
        "has_report":   cached is not None,
        "generated_at": cached["meta"]["generated_at"] if cached else None,
        "model":        cached["meta"].get("model", "unknown") if cached else None,
        "openai_key_set": bool(OPENAI_KEY),
        "mode":         "live gpt-4o" if OPENAI_KEY else "demo (fallback narratives)",
    }
