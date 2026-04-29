const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GEONAMES_USERNAME = process.env.GEONAMES_USERNAME;
// ============================
// CLI
// ============================ 
// Usage: npm start -- "Business Name" "Full Address, Postcode, Country"
const [,, argName, argAddress] = process.argv;

if (!argName || !argAddress) {
  console.error('Usage: npm start -- "Business Name" "Full Address, Postcode, Country"');
    process.exit(1);
    }

    const businessName = argName;
    const address = argAddress;

    const pricing = {
      min2: 1.80,
        min5: 5,
          min10: 7.50,
          };

// ============================
// CONFIG
// ============================

// Tanning customers visit ~1–2x per week. 6/month is conservative.
// This multiplier converts captured customers into monthly revenue.
const VISIT_FREQUENCY_MONTHLY = 6;

const RADIUS_METERS = 10000;
const FALLBACK_POPULATION = 500000;
const PLACE_SEARCH_KEYWORDS = ["tanning salon", "sunbed"];
const POSTCODES_API_BASE = "https://api.postcodes.io";
const OPENAI_MODEL = "gpt-4.1-mini";

// Enrich only the top N competitors with real website data via Place Details.
// Each lookup costs one API call — keep this reasonable.
const PLACE_DETAILS_LIMIT = 8;

// ============================
// NOMIS DATASET RESOLUTION
// ============================

// NOMIS admin_district code prefixes map to geography types.
// NM_31_1 covers all GB local authorities (England, Wales, Scotland).
// Northern Ireland (N09 codes) is not covered by NOMIS — falls through to GeoNames.
const NOMIS_DATASET_MAP = {
  E06: "NM_31_1", // England — unitary authorities
  E07: "NM_31_1", // England — non-metropolitan districts
  E08: "NM_31_1", // England — metropolitan districts
  E09: "NM_31_1", // England — London boroughs
  W06: "NM_31_1", // Wales — unitary authorities
  S12: "NM_31_1", // Scotland — council areas
};

function resolveNomisDataset(geoCode) {
  if (!geoCode) return null;
  const prefix = geoCode.substring(0, 3).toUpperCase();
  const dataset = NOMIS_DATASET_MAP[prefix] || null;
  if (!dataset) console.warn(`[warn] No NOMIS dataset mapped for geography prefix: ${prefix} — falling through`);
  return dataset;
}

// ============================
// UTILS
// ============================

const round = (v, d = 2) => Number(Number(v).toFixed(d));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const isConfigured = (v) => Boolean(v) && !String(v).startsWith("YOUR_");

const buildUrl = (base, params = {}) => {
  const url = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "")
      url.searchParams.set(k, String(v));
  });
  return url.toString();
};

const fetchJson = async (url, options, label) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn(`[warn] ${label}: ${e.message}`);
    return null;
  }
};

// Returns true if a competitor name likely refers to the business itself.
// Prevents the salon from scoring against its own listing.
function isSelf(placeName, selfName) {
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const pn = normalize(placeName);
  const sn = normalize(selfName);
  const firstWord = sn.split(/\s+/).find((w) => w.length > 3) || sn;
  return pn.includes(firstWord) || sn.includes(pn);
}

// ============================
// GEO
// ============================

async function geocodeAddress(query) {
  const data = await fetchJson(
    buildUrl("https://maps.googleapis.com/maps/api/geocode/json", {
      address: query,
      key: GOOGLE_API_KEY,
    }),
    {},
    "geocode"
  );

  if (!data?.results?.length) return {};

  const r = data.results[0];
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    postcode: r.address_components.find((c) => c.types.includes("postal_code"))?.long_name,
    countryCode: r.address_components.find((c) => c.types.includes("country"))?.short_name,
  };
}

// ============================
// OWN BUSINESS LOOKUP
// ============================

// Looks up the business's own Google listing via Text Search, then fetches
// Place Details to get their actual review count, rating, and online presence.
// This data populates Section 2 of the report (current position).
async function lookupOwnBusiness(name, addr) {
  const search = await fetchJson(
    buildUrl("https://maps.googleapis.com/maps/api/place/textsearch/json", {
      key: GOOGLE_API_KEY,
      query: `${name} ${addr}`,
    }),
    {},
    "textsearch:self"
  );

  const place = search?.results?.[0];
  if (!place?.place_id) {
    console.warn("[warn] Own business not found in Google Places — position data will be limited.");
    return null;
  }

  const details = await fetchJson(
    buildUrl("https://maps.googleapis.com/maps/api/place/details/json", {
      key: GOOGLE_API_KEY,
      place_id: place.place_id,
      fields: "name,rating,user_ratings_total,website,business_status",
    }),
    {},
    "details:self"
  );

  const r = details?.result;
  if (!r) return null;

 const siteData = await analyzeWebsite(r.website);

return {
  name: r.name,
  rating: r.rating || null,
  reviews: r.user_ratings_total || 0,
  hasOnlinePresence: !!r.website,
  businessStatus: r.business_status || "OPERATIONAL",

  // ✅ NEW (non-breaking)
  visibility: {
    facebook: siteData?.hasFacebook || false,
    instagram: siteData?.hasInstagram || false,
    tiktok: siteData?.hasTiktok || false,
  },

  pricing: {
    visible: siteData?.hasPricing || false,
    packages: siteData?.hasPackages || false,
  }
};
}

// ============================
// COMPETITION
// ============================

async function fetchPlaces(lat, lng, keyword) {
  const data = await fetchJson(
    buildUrl("https://maps.googleapis.com/maps/api/place/nearbysearch/json", {
      key: GOOGLE_API_KEY,
      location: `${lat},${lng}`,
      radius: RADIUS_METERS,
      keyword,
    }),
    {},
    "places"
  );

  return (data?.results || []).map((p) => ({
    place_id: p.place_id,
    name: p.name,
    rating: p.rating || 0,
    reviews: p.user_ratings_total || 0,
  }));
}

// Nearby Search does not return website data — requires a separate Place Details call.
// Only enriching the top N by review count to control API cost.
async function enrichWithWebsite(places) {
  const sorted = [...places].sort((a, b) => b.reviews - a.reviews);
  const toEnrich = sorted.slice(0, PLACE_DETAILS_LIMIT);
  const rest = sorted.slice(PLACE_DETAILS_LIMIT);

  const enriched = await Promise.all(
    toEnrich.map(async (p) => {
      const data = await fetchJson(
        buildUrl("https://maps.googleapis.com/maps/api/place/details/json", {
          key: GOOGLE_API_KEY,
          place_id: p.place_id,
          fields: "website",
        }),
        {},
        `details:${p.name}`
      );
      return { ...p, hasWebsite: !!data?.result?.website };
    })
  );

  // Remaining places not enriched default to false (conservative)
  return [
    ...enriched,
    ...rest.map((p) => ({ ...p, hasWebsite: false })),
  ];
}

function summarizeCompetition(list) {
  const total = list.length;

  if (total === 0) {
    return {
      total: 0,
      direct: 0,
      avg_reviews: 0,
      avg_rating: 0,
      top3_share: 0,
      website_ratio: 0,
      competitors_with_website: 0,
      is_low_competition: true,
    };
  }

  const direct = list.filter((x) => /(tanning|sunbed)/i.test(x.name)).length;
  const totalReviews = list.reduce((s, x) => s + x.reviews, 0);
  const avgReviews = totalReviews / total;

  const top3Reviews = [...list]
    .sort((a, b) => b.reviews - a.reviews)
    .slice(0, 3)
    .reduce((s, x) => s + x.reviews, 0);

  const avgRating = list.reduce((s, x) => s + x.rating, 0) / total;
  const withWebsite = list.filter((x) => x.hasWebsite).length;

  return {
    total,
    direct,
    avg_reviews: round(avgReviews),
    avg_rating: round(avgRating, 2),
    top3_share: totalReviews ? round(top3Reviews / totalReviews, 4) : 0,
    website_ratio: round(withWebsite / total, 2),
    competitors_with_website: withWebsite,
    is_low_competition: total < 3,
  };
}

// ============================
// POPULATION
// ============================

async function resolvePopulation(postcode, countryCode) {
  if (countryCode === "GB" && postcode) {
    const pc = await fetchJson(
      `${POSTCODES_API_BASE}/postcodes/${encodeURIComponent(postcode)}`,
      {},
      "postcodes.io"
    );

    const code = pc?.result?.codes?.admin_district;
    const nomisDataset = resolveNomisDataset(code);

    if (code && nomisDataset) {
      try {
        const csv = await fetch(
          buildUrl(
            `https://www.nomisweb.co.uk/api/v01/dataset/${nomisDataset}.data.csv`,
            { geography: code, date: "latest", age: 0, measures: 20100 }
          )
        ).then((r) => r.text());

        const lines = csv.trim().split("\n");

        // Resolve by column header — last column is a status flag, not the value.
        const headers = lines[0].split(",").map((h) =>
          h.trim().replace(/"/g, "").toUpperCase()
        );
        const obsIdx = headers.indexOf("OBS_VALUE");

        if (obsIdx !== -1 && lines[1]) {
          const val = Number(lines[1].split(",")[obsIdx]);

          // Any real UK district has at least 10,000 people. Reject absurd values.
          if (Number.isFinite(val) && val >= 10000) {
            return { population: val, source: "nomis" };
          } else {
            console.warn(`[warn] NOMIS returned suspicious value: ${val} — falling through`);
          }
        }
      } catch (e) {
        console.warn("[warn] nomis:", e.message);
      }
    }
  }

  if (isConfigured(GEONAMES_USERNAME)) {
    const geo = await fetchJson(
      buildUrl("https://api.geonames.org/searchJSON", {
        q: postcode,
        maxRows: 1,
        username: GEONAMES_USERNAME,
      }),
      {},
      "geonames"
    );

    const pop = geo?.geonames?.[0]?.population;
    if (pop && pop > 0) return { population: pop, source: "geonames" };
  }

  return { population: FALLBACK_POPULATION, source: "fallback" };
}

// ============================
// OPPORTUNITY MODEL
// ============================

function breakdown(monthly) {
  return {
    monthly: round(monthly),
    weekly: round(monthly / 4.33),
  };
}

function calculateOpportunity(population, comp, pricing) {
  // ----------------------------
  // PRICE MODEL (weighted but stable)
  // ----------------------------
  const avgSessionPrice =
    pricing.min2 * 0.2 +
    pricing.min5 * 0.5 +
    pricing.min10 * 0.3;

  // ----------------------------
  // PRESSURE MODEL (0–1)
  // ----------------------------
  const pressure = clamp(
    0.35 * (comp.total / 20) +
    0.35 * comp.top3_share +
    0.3 * (comp.avg_reviews / 100),
    0,
    1
  );

  // ----------------------------
  // VISIBILITY GAP (0–1)
  // ----------------------------
  const visibilityGap = clamp(
    (1 - comp.website_ratio) * 0.6 +
    (1 - comp.competitors_with_website / Math.max(comp.total, 1)) * 0.4,
    0,
    1
  );

  // ----------------------------
  // DEMAND LAYER (REALISTIC MARKET SIZE)
  // ----------------------------
  const basePenetration = 0.11; // balanced UK tanning engagement rate

  const saturationAdjustment = 1 - pressure * 0.22;

  const monthlyMarketSize =
    (population * basePenetration * saturationAdjustment) / 12;

  // ----------------------------
  // REACH LAYER (who can realistically be influenced)
  // ----------------------------
  const reachFactor = clamp(
    0.22 + visibilityGap * 0.6 - pressure * 0.18,
    0.08,
    0.55
  );

  const reachableCustomers = monthlyMarketSize * reachFactor;

  // ----------------------------
  // ACQUISITION LAYER (conversion from reach → customers)
  // ----------------------------
  const acquisitionRate = clamp(
    0.075 + visibilityGap * 0.33 - pressure * 0.16,
    0.02,
    0.28
  );

  const newCustomersMid = round(reachableCustomers * acquisitionRate);

  // ----------------------------
  // BEHAVIOUR LAYER (frequency per customer)
  // ----------------------------
  const repeatVisitsPerCustomer = clamp(
    4.3 + visibilityGap * 1.5 - pressure * 1.0,
    3.6,
    7.2
  );

  // ----------------------------
  // SECONDARY SIGNAL (analytics only)
  // ----------------------------
  const searchToVisitRate = clamp(
    0.06 + visibilityGap * 0.04 - pressure * 0.02,
    0.02,
    0.11
  );

  const conversionImpact = round(newCustomersMid * searchToVisitRate, 2);

  // ----------------------------
  // REVENUE MODEL (stable, no artificial churn hacks)
  // ----------------------------
  const monthlyRevenue =
    newCustomersMid *
    repeatVisitsPerCustomer *
    avgSessionPrice;

  return {
    avgSessionPrice,

    uplift: {
      low: breakdown(monthlyRevenue * 0.75),
      mid: breakdown(monthlyRevenue),
      high: breakdown(monthlyRevenue * 1.25),
    },

    pressure,
    visibilityGap,

    monthlyMarketSize: round(monthlyMarketSize),
    reachableCustomers: round(reachableCustomers),

    acquisitionRate: round(acquisitionRate, 4),
    newCustomersMid,

    repeatVisitsPerCustomer: round(repeatVisitsPerCustomer, 2),

    searchToVisitRate: round(searchToVisitRate, 4),
    conversionImpact,

    monthlyRevenue: round(monthlyRevenue),

    assumedVisitFrequencyMonthly: round(repeatVisitsPerCustomer, 2),
  };
}

// ============================
// AI SUMMARY — THREE SECTIONS
// ============================

async function generateSummary(data) {
  if (!isConfigured(OPENAI_API_KEY)) return null;

  const { business, own, population, competition, opportunity } = data;

  const estimatedAudience = Math.round(population.population * 0.06);

  const ownStatus = !own
    ? "Business not found in local search results — no verified data available"
    : [
        `Reviews: ${own.reviews} (local average is ${competition.avg_reviews})`,
        `Rating: ${own.rating ?? "none"}/5 (local average is ${competition.avg_rating}/5)`,
        `Appears in local search: ${own.hasOnlinePresence ? "yes, with a listed presence" : "appears in Maps but has no discoverable online presence beyond that"}`,
        `Business status: ${own.businessStatus}`,
      ].join(" | ");

  const competitorOnlineDesc =
    competition.competitors_with_website === 0
      ? `none of the ${competition.total} competitors are discoverable online — first-mover opportunity`
      : `${competition.competitors_with_website} of ${competition.total} competitors are already discoverable online`;

  const context = `
BUSINESS: ${business.name}
AREA POPULATION: ${population.population.toLocaleString()}
ESTIMATED LOCAL TANNING AUDIENCE: ~${estimatedAudience.toLocaleString()} people
DATA SOURCE: ${population.source}

OWN BUSINESS POSITION:
${ownStatus}

COMPETITION (within 10km):
- Total nearby salons and sunbed businesses: ${competition.total}
- Directly named tanning/sunbed businesses: ${competition.direct}
- Online discoverability: ${competitorOnlineDesc}
- Average competitor reviews: ${competition.avg_reviews}
- Average competitor rating: ${competition.avg_rating}/5
- Market pressure: ${competition.pressure > 0.6 ? "high" : competition.pressure > 0.3 ? "moderate" : "low"}

REVENUE OPPORTUNITY:
- Average session price: £${opportunity.avgSessionPrice} per visit
- Visit frequency assumed: ${opportunity.assumedVisitFrequencyMonthly} sessions/month per regular customer
- Dynamic repeat visits per customer: ${opportunity.repeatVisitsPerCustomer} sessions/month
- Estimated new reachable customers per month: ~${opportunity.newCustomersMid}
- Conservative monthly uplift: £${opportunity.uplift.low.monthly}
- Mid monthly uplift: £${opportunity.uplift.mid.monthly}
- Search to visit rate: ${opportunity.searchToVisitRate}
- Conversion impact (search to visit): ${opportunity.conversionImpact}
- Visibility score: ${opportunity.visibilityScore}

ONLINE VISIBILITY BREAKDOWN:
- Website: ${own?.hasOnlinePresence ? "yes" : "no"}
- Facebook: ${own?.visibility?.facebook ? "yes" : "no"}
- Instagram: ${own?.visibility?.instagram ? "yes" : "no"}
- TikTok: ${own?.visibility?.tiktok ? "yes" : "no"}

PRICING TRANSPARENCY:
- Session pricing visible: ${own?.pricing?.visible ? "yes" : "no"}
- Packages or bulk deals visible: ${own?.pricing?.packages ? "yes" : "no"}
`;

  const systemPrompt = `You write structured sales intelligence reports for UK tanning salons.

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
→ Output exactly: "Not measurable from current model"

========================
SECTION RULES
========================

MARKET SNAPSHOT (3 sentences)
- Population + tanning audience size
- Competitor count + digital presence level
- Competition pressure level impact

CURRENT POSITION (3–4 sentences)
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

1. Monthly revenue uplift (use only provided £ range)
2. Repeat visit frequency (use provided value only)
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

  const res = await fetchJson(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context },
        ],
      }),
    },
    "openai"
  );

  const raw = res?.choices?.[0]?.message?.content || null;
  if (!raw) return null;

  try {
    
    return JSON.parse(raw);
  } catch {
    console.warn("[warn] Could not parse AI response as JSON");
    return null;
  }
}

// ============================
// OUTPUT FORMATTING
// ============================

function printSection(title, items) {
  console.log(`\n── ${title} ──`);
  if (!items?.length) {
    console.log("  No data.");
    return;
  }
  items.forEach((item) => console.log(`  • ${item}`));
}

//analyse website 
async function analyzeWebsite(url) {
  if (!url || !url.startsWith("http")) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const html = await fetch(url, { signal: controller.signal }).then(r => r.text());

    clearTimeout(timeout);

    const lower = html.toLowerCase();

    return {
      hasPricing:
        lower.includes("£") ||
        lower.includes("price") ||
        lower.includes("session"),

      hasPackages:
        lower.includes("course") ||
        lower.includes("bundle") ||
        lower.includes("minute"),

      hasFacebook: lower.includes("facebook.com"),
      hasInstagram: lower.includes("instagram.com"),
      hasTiktok: lower.includes("tiktok.com"),
    };
  } catch {
    return {
      hasFacebook: false,
      hasInstagram: false,
      hasTiktok: false,
      hasPricing: false,
      hasPackages: false,
    };
  }
}

// ============================
// MAIN
// ============================

async function main() {
  console.log(`\nAnalysing: ${businessName}`);
  console.log(`Address:   ${address}\n`);

  // Geocode and own-business lookup run in parallel
  const [geo, own] = await Promise.all([
    geocodeAddress(address),
    lookupOwnBusiness(businessName, address),
  ]);

  if (!geo.lat) {
    console.error("Geocoding failed. Check address and API key.");
    return;
  }

  // Fetch competitor places for all keywords
  const rawLists = await Promise.all(
    PLACE_SEARCH_KEYWORDS.map((k) => fetchPlaces(geo.lat, geo.lng, k))
  );

  // Deduplicate by place_id and remove own business from competitor list
  const seen = new Set();
  const deduped = rawLists.flat().filter((p) => {
    if (!p.place_id || seen.has(p.place_id)) return false;
    if (isSelf(p.name, businessName)) return false;
    seen.add(p.place_id);
    return true;
  });

  // Enrich top competitors with real online presence data
  const enriched = await enrichWithWebsite(deduped);

  const comp = summarizeCompetition(enriched);
  const pop = await resolvePopulation(geo.postcode, geo.countryCode);
  const opp = calculateOpportunity(pop.population, comp, pricing);

  const visibilityScore = round(
  (comp.competitors_with_website / Math.max(comp.total, 1)) * 50 +
  (own?.hasOnlinePresence ? 25 : 0) +
  (comp.website_ratio * 25),
  2
);

  opp.visibilityScore = round(visibilityScore, 2);

  const result = {
    business: { name: businessName, address },
    own,
    population: pop,
    competition: comp,
    opportunity: opp,
  };

  console.log("=== RAW DATA ===");
  console.log(JSON.stringify(result, null, 2));

  const summary = await generateSummary(result);

  if (summary) {
    console.log("\n=== MARKET REPORT ===");
    printSection("1. Market Snapshot", summary.market_snapshot);
    printSection("2. Current Position", summary.current_position);
    printSection("3. Where to Focus", summary.improvements);
    printSection("4. Estimation", summary.estimation  );
  }
}

main();