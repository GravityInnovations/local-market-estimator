import { isConfigured } from "../config/env.js";

const SYSTEM_PROMPT = `You write structured revenue intelligence reports for local service businesses.

You ONLY format and summarize pre-computed metrics.

You DO NOT calculate, estimate, infer, or modify any values.

Return ONLY valid JSON:

{
  "market_snapshot": [],
  "current_position": [],
  "improvements": [],
  "estimation": []
}

========================
ABSOLUTE RULES
========================
- Never calculate any metric
- Never infer missing data
- Never modify numeric values
- Only use values explicitly provided in input
- Every array item = exactly 1 sentence
- Max 16 words per sentence
- No explanations
- No reasoning words ("because", "therefore", "leads to")
- No repetition of ideas
- No extra formatting

If a metric is missing:
-> Output exactly: "Not measurable from current model"

========================
SECTION RULES
========================

MARKET SNAPSHOT (3 sentences)
- Population + addressable market size
- Competitor count + digital presence level
- Competition pressure level impact

CURRENT POSITION (3-4 sentences)
- Reviews vs competitors
- Rating vs competitors
- Local search visibility status
- Social media status (or "unverified")

IMPROVEMENTS (4 sentences)
Must include:
- digital presence improvement
- social media visibility improvement
- pricing transparency improvement
- local search visibility improvement

Each sentence = one action + one business outcome

========================
ESTIMATION (5 sentences)
========================
Each sentence MUST map directly to these inputs:

1. Monthly revenue uplift (use only provided GBP range)
2. Usage frequency (use provided value only)
3. New customer acquisition (use provided number only)
4. Conversion impact (use computed value only OR fallback text)
5. Visibility score (numeric only OR fallback text)

STRICT RULES:
- Exactly 5 sentences
- One metric per sentence
- Max 16 words
- No invented metrics
- No percentage creation
- No reinterpretation of values
- No narrative framing
- All numeric inputs are FINAL ENGINE OUTPUTS and must never be interpreted, modified, or normalized.

========================
LANGUAGE RULES
========================
- Never use "website"
- Use: "digital presence", "online footprint", "discoverable online"
- No hedging words allowed
- Keep language factual and minimal`;

export class SummaryService {
  constructor({ openAiApi, openAiApiKey }) {
    this.openAiApi = openAiApi;
    this.openAiApiKey = openAiApiKey;
  }

  async generate(data) {
    if (!isConfigured(this.openAiApiKey) || !this.openAiApi) {
      return null;
    }

    const { business, own, population, competition, opportunity } = data;

    const ownStatus = !own
      ? "Business not found in local search results - no verified data available"
      : [
          `Reviews: ${own.reviews} (local average is ${competition.avg_reviews})`,
          `Rating: ${own.rating ?? "none"}/5 (local average is ${competition.avg_rating}/5)`,
          `Appears in local search: ${
            own.hasOnlinePresence
              ? "yes, with a listed presence"
              : "appears in Maps but has no discoverable online presence beyond that"
          }`,
          `Business status: ${own.businessStatus}`,
        ].join(" | ");

    const competitorOnlineDesc =
      competition.competitors_with_website === 0
        ? `none of the ${competition.total} competitors are discoverable online - first-mover opportunity`
        : `${competition.competitors_with_website} of ${competition.total} competitors are already discoverable online`;

    const context = `
BUSINESS: ${business.name}
AREA POPULATION: ${population.population.toLocaleString()}
  ESTIMATED ADDRESSABLE MARKET: ~${opportunity.addressableMarket.toLocaleString()} customers/month
DATA SOURCE: ${population.source}

OWN BUSINESS POSITION:
${ownStatus}

COMPETITION (within 10km):
  - Total nearby comparable businesses: ${competition.total}
  - Directly comparable businesses: ${competition.direct}
- Online discoverability: ${competitorOnlineDesc}
- Average competitor reviews: ${competition.avg_reviews}
- Average competitor rating: ${competition.avg_rating}/5
- Market pressure: ${competition.pressure > 0.6 ? "high" : competition.pressure > 0.3 ? "moderate" : "low"}

REVENUE OPPORTUNITY:
  - Average service tier price: GBP ${opportunity.averageTierPrice} per service interaction
  - Usage frequency assumed: ${opportunity.assumedUsageFrequencyMonthly} service interactions/month per regular customer
  - Dynamic usage frequency per customer: ${opportunity.usageFrequencyPerCustomer} service interactions/month
- Estimated new reachable customers per month: ~${opportunity.newCustomersMid}
- Conservative monthly uplift: GBP ${opportunity.uplift.low.monthly}
- Mid monthly uplift: GBP ${opportunity.uplift.mid.monthly}
  - Reach to customer rate: ${opportunity.reachToCustomerRate}
  - Conversion impact: ${opportunity.conversionImpact}
- Visibility score: ${opportunity.visibilityScore}

ONLINE VISIBILITY BREAKDOWN:
- Website: ${own?.hasOnlinePresence ? "yes" : "no"}
- Facebook: ${own?.visibility?.facebook ? "yes" : "no"}
- Instagram: ${own?.visibility?.instagram ? "yes" : "no"}
- TikTok: ${own?.visibility?.tiktok ? "yes" : "no"}

PRICING TRANSPARENCY:
- Service pricing visible: ${own?.pricing?.visible ? "yes" : "no"}
- Package or bundled pricing visible: ${own?.pricing?.packages ? "yes" : "no"}
`;

    const response = await this.openAiApi.createStructuredSummary({
      systemPrompt: SYSTEM_PROMPT,
      context,
    });

    const raw = response?.choices?.[0]?.message?.content || null;
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      console.warn("[warn] Could not parse AI response as JSON");
      return null;
    }
  }
}
