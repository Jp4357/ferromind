"""
Industry Research Tool — FerroMind Advisor Team
Covers three research tracks:
1. Stainless steel industry outlook (primary demand driver for FeCr)
2. Chrome ore supply chain & geopolitical factors
3. Technology & innovation trends in ferrochrome production
"""

from datetime import datetime


def run_industry_research(client=None) -> dict:
    """Runs all three industry research tracks."""
    if client is not None:
        return _live_industry(client)
    return _simulated_industry()


def _live_industry(client) -> dict:
    try:
        from openai import OpenAI
        resp = client.responses.create(
            model="gpt-4o",
            tools=[{"type": "web_search_preview"}],
            input=(
                "Research three topics for a ferrochrome producer's strategic report:\n"
                "1. STAINLESS STEEL OUTLOOK 2025: global production forecasts, "
                "key consuming regions, grade mix trends affecting FeCr demand\n"
                "2. CHROME ORE SUPPLY CHAIN: South African mining constraints, "
                "geopolitical factors (Zimbabwe, India), UG2 vs lumpy ore dynamics\n"
                "3. FERROCHROME TECHNOLOGY TRENDS: latest in DC arc furnace adoption, "
                "pre-reduction technology, AI/ML applications in smelting, "
                "carbon capture pilots. Be specific with company names and dates."
            ),
        )
        raw = next((b.text for b in resp.output if hasattr(b, "text")), "")
        return {
            "source":       "live_web_search",
            "searched_at":  datetime.now().isoformat(),
            "raw_findings": raw,
            "stainless_steel": _simulated_industry()["stainless_steel"],
            "chrome_ore":      _simulated_industry()["chrome_ore"],
            "technology":      _simulated_industry()["technology"],
        }
    except Exception as e:
        print(f"  [industry research] live search failed: {e} — using simulated")
        return _simulated_industry()


def _simulated_industry() -> dict:
    return {
        "source":      "simulated_research",
        "searched_at": datetime.now().isoformat(),

        "stainless_steel": {
            "raw_findings": (
                "Global stainless steel production 2025 outlook: ISSF forecasts total "
                "output of 58.5Mt in 2025, up 3.2% from 56.7Mt in 2024. China remains "
                "dominant at ~58% of global output (~34Mt), with production driven by "
                "construction recovery and EV sector demand for 300-series grades. "
                "European production soft at ~7.2Mt due to energy costs and automotive "
                "sector headwinds. India growing strongly +8% YoY to ~4.5Mt. "
                "200-series grade production in India and China is displacing some "
                "300-series demand (lower FeCr content), but 316L demand from "
                "pharmaceutical and chemical sectors is offsetting this. "
                "FeCr demand derived: approximately 960kg FeCr per tonne of 300-series SS."
            ),
            "global_ss_production_mt_2025": 58.5,
            "yoy_growth_pct":               3.2,
            "china_share_pct":              58,
            "fecr_per_tonne_ss_kg":         960,
            "implied_fecr_demand_mt":       3.4,
            "key_risks": [
                "200-series grade substitution reducing FeCr intensity",
                "EU stainless production contraction from energy costs",
                "Trade protection measures in key markets",
            ],
            "key_opportunities": [
                "India SS output growing 8% YoY — near-term demand driver",
                "EV & battery sector driving 316L stainless demand",
                "Chinese construction recovery supporting restocking cycle",
            ],
        },

        "chrome_ore": {
            "raw_findings": (
                "Chrome ore supply chain dynamics 2025: South Africa supplies ~70% of "
                "global chrome ore, with the Bushveld Complex (BIC) the world's largest "
                "reserve. Key constraints: Eskom load-shedding (up to Stage 4) adding "
                "$15-25/t to SA production costs through diesel backup generation. "
                "Transnet rail inefficiencies causing 3-5 day delivery delays from "
                "inland mines to Durban port. Zimbabwe's Great Dyke deposits increasing "
                "output — Zimasco and Zimalloys collectively adding ~2Mt/yr. India "
                "reducing chrome ore exports to protect domestic smelter feedstock. "
                "UG2 ore (from PGM mining as by-product) now ~35% of SA chrome ore "
                "supply — lower Cr:Fe ratio but cheaper. Geopolitical: SA's AGOA status "
                "under review, potential tariff implications for US exports of FeCr."
            ),
            "sa_global_ore_share_pct":  70,
            "eskom_cost_impact_usd_t":  "15-25",
            "transnet_delay_days":      "3-5",
            "ug2_ore_share_pct":        35,
            "key_risks": [
                "Eskom load-shedding — structural cost burden",
                "Transnet logistics — port and rail unreliability",
                "Zimbabwe supply growth adding ore market competition",
                "AGOA tariff risk for US-bound FeCr exports",
            ],
            "key_opportunities": [
                "UG2 ore cheaper feedstock — blend optimisation opportunity",
                "India ore export restrictions tightening global ore supply",
                "Long-term offtake contracts now pricing at $202-208/t",
            ],
        },

        "technology": {
            "raw_findings": (
                "Ferrochrome technology & innovation 2025: DC arc furnace technology "
                "gaining traction — Outotec/Metso reporting 15-18% energy reduction vs "
                "conventional SAF in pilot installations. Pre-reduction rotary kiln "
                "technology (Premus process by Glencore) achieving 40% energy savings "
                "at scale. AI/ML applications accelerating: Samancor piloting "
                "reinforcement learning for electrode positioning, reporting 3-4% "
                "energy reduction. Anglo American Platinum using ML for UG2 blend "
                "optimisation. Carbon capture & storage: pilot at Hernic (2024) using "
                "off-gas CO₂ recovery — early stage. Hydrogen reduction trials ongoing "
                "in Europe (Outokumpu partnership with H2 Green Steel) — commercial "
                "viability >2030. Industry consensus: AI-driven process optimisation "
                "is the near-term highest ROI technology investment."
            ),
            "key_technologies": [
                {
                    "name":       "DC Arc Furnace",
                    "energy_saving_pct": "15-18",
                    "readiness":  "Commercial — new builds",
                    "relevance":  "SAF upgrade path for our SAF-03/04 when reactivating",
                },
                {
                    "name":       "Premus Pre-reduction",
                    "energy_saving_pct": "40",
                    "readiness":  "Commercial — Glencore deployed",
                    "relevance":  "Capital intensive but significant cost reduction",
                },
                {
                    "name":       "AI/ML Process Optimisation",
                    "energy_saving_pct": "3-4",
                    "readiness":  "Deploying now — we already have this",
                    "relevance":  "We are AHEAD of most peers — competitive advantage",
                },
                {
                    "name":       "Carbon Capture (off-gas CO₂)",
                    "energy_saving_pct": "N/A",
                    "readiness":  "Pilot stage (2024-2025)",
                    "relevance":  "ESG positioning — monitor Hernic pilot outcomes",
                },
            ],
            "our_tech_position": (
                "Vantech is ahead of most peers on AI/ML deployment. "
                "The FerroMind system's anomaly detection and demand forecasting "
                "places us in the top tier of technologically advanced SA producers. "
                "DC arc and Premus are medium-term capex decisions worth modelling."
            ),
        },
    }
