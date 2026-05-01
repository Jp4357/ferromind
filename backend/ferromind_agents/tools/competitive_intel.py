"""
Competitive Intelligence Tool — FerroMind Advisor Team
Surface-level competitive analysis:
Samancor Chrome, Glencore Merafe, Hernic Ferrochrome,
Tata Steel Ferro Alloys, ENRC (Eurasian).
"""

from datetime import datetime


def run_competitive_analysis(client=None) -> dict:
    if client is not None:
        return _live_competitive(client)
    return _simulated_competitive()


def _live_competitive(client) -> dict:
    try:
        from openai import OpenAI
        resp = client.responses.create(
            model="gpt-4o",
            tools=[{"type": "web_search_preview"}],
            input=(
                "Provide a surface-level competitive analysis of the top ferrochrome producers: "
                "Samancor Chrome, Glencore Merafe, Hernic Ferrochrome, and ENRC/Eurasian. "
                "For each: estimated annual capacity (kt FeCr), recent news or developments, "
                "any known production challenges or expansions in 2024-2025. "
                "Keep it concise and factual."
            ),
        )
        raw = next((b.text for b in resp.output if hasattr(b, "text")), "")
        return {
            "source":       "live_web_search",
            "searched_at":  datetime.now().isoformat(),
            "raw_findings": raw,
            "competitors":  _simulated_competitive()["competitors"],
        }
    except Exception as e:
        print(f"  [competitive intel] live search failed: {e} — using simulated")
        return _simulated_competitive()


def _simulated_competitive() -> dict:
    return {
        "source":      "simulated_research",
        "searched_at": datetime.now().isoformat(),
        "raw_findings": (
            "Top ferrochrome producers competitive snapshot 2025: "
            "Samancor Chrome (South Africa) remains the world's largest producer "
            "at ~900kt/year capacity, operating multiple SAF complexes in the "
            "North West and Mpumalanga provinces. Recently announced a R2.1bn "
            "smelter upgrade at Ferrometals. Glencore Merafe (JSE: MRF) operates "
            "the Merafe Resources joint venture producing ~450kt/year; reported "
            "H1 2024 EBITDA of ZAR 1.2bn despite lower prices. Hernic Ferrochrome "
            "(Brits, NW) capacity ~140kt/year, privately held by Ruukki Group; "
            "known for low-cost operations. ENRC/Eurasian (Kazakhstan) is the "
            "largest non-SA producer at ~370kt/year; benefiting from cheaper "
            "electricity but facing logistics constraints. All producers dealing "
            "with soft demand from EU stainless sector; Chinese demand recovery "
            "is the key variable for H2 2025."
        ),
        "competitors": [
            {
                "name":             "Samancor Chrome",
                "country":          "South Africa",
                "capacity_kt_yr":   900,
                "market_share_pct": 28,
                "status":           "Smelter upgrade underway (R2.1bn)",
                "our_advantage":    "We are smaller and more agile; faster to optimise blend ratios",
                "our_risk":         "They have significantly lower cost base at scale",
            },
            {
                "name":             "Glencore Merafe",
                "country":          "South Africa",
                "capacity_kt_yr":   450,
                "market_share_pct": 14,
                "status":           "H1 2024 EBITDA ZAR 1.2bn; holding capacity steady",
                "our_advantage":    "Our AI-driven anomaly detection reduces downtime vs their older ops",
                "our_risk":         "Glencore's supply chain scale gives better procurement pricing",
            },
            {
                "name":             "Hernic Ferrochrome",
                "country":          "South Africa",
                "capacity_kt_yr":   140,
                "market_share_pct": 4,
                "status":           "Stable production; no major news",
                "our_advantage":    "Our forecast accuracy (MAPE 1.49%) likely superior",
                "our_risk":         "Similar size — direct competition in spot market",
            },
            {
                "name":             "ENRC / Eurasian",
                "country":          "Kazakhstan",
                "capacity_kt_yr":   370,
                "market_share_pct": 12,
                "status":           "Logistics constraints; Chinese rail route uncertainty",
                "our_advantage":    "SA location closer to key export routes",
                "our_risk":         "Cheaper electricity gives them ~$80/t cost advantage",
            },
        ],
        "our_capacity_kt_yr":   150,
        "our_market_share_pct": 5,
        "global_market_kt_yr":  3_200,
        "competitive_position": "Niche SA producer — differentiated by AI-optimised operations",
    }
