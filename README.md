# Local Market Estimator

A Node.js CLI tool that estimates local market opportunity for a tanning business from:

- geographic context (address, postcode, country)
- nearby competitor signals (count, reviews, ratings, online presence)
- local population data
- service pricing assumptions

It outputs:

- a raw JSON model payload
- an AI-generated market report with four sections:
	- Market Snapshot
	- Current Position
	- Where to Focus
	- Estimation

## What This Project Is

Local Market Estimator is a decision-support utility for local service operators (currently tuned for tanning/sunbed businesses). It combines external APIs and a deterministic opportunity model to produce a practical revenue-uplift estimate range.

The numerical model is deterministic and code-driven. AI is used only to format and summarize computed results into readable report text.

## Key Capabilities

- Geocodes a full address to latitude/longitude using Google Geocoding.
- Locates the business's own Google listing and reads position signals (reviews, rating, website presence, business status).
- Finds nearby competitors (default: 10 km radius) from Google Places.
- Deduplicates competitor listings and excludes likely self-matches.
- Enriches top competitors with website presence via Place Details.
- Resolves local population from UK datasets (NOMIS via postcode district), with fallbacks.
- Computes pressure, visibility gap, reachable customers, acquisition, repeat behavior, and monthly uplift.
- Generates a concise AI market report from already-computed values.

## Tech Stack

- Runtime: Node.js (ES Modules)
- Language: JavaScript
- APIs:
	- Google Geocoding API
	- Google Places API (Text Search, Nearby Search, Place Details)
	- postcodes.io (UK postcode metadata)
	- NOMIS (UK population)
	- GeoNames (fallback population)
	- OpenAI Chat Completions (report summarization)

## Prerequisites

- Node.js 18+ (recommended 20+)
- npm
- API keys/accounts for:
	- Google Maps Platform (`GOOGLE_API_KEY`)
	- OpenAI (`OPENAI_API_KEY`) for AI summary generation
	- GeoNames username (`GEONAMES_USERNAME`) optional, for population fallback

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set environment variables (shell export example):

```bash
export GOOGLE_API_KEY="your_google_key"
export OPENAI_API_KEY="your_openai_key"
export GEONAMES_USERNAME="your_geonames_username"
```

3. Run the CLI:

```bash
npm start -- "Business Name" "Full Address, Postcode, Country"
```

Example:

```bash
npm start -- "Glow Studio" "10 High Street, Bristol BS1 2AA, UK"
```

## Environment Variables

- `GOOGLE_API_KEY` (required): Used for geocoding, own listing lookup, competitors, and competitor enrichment.
- `OPENAI_API_KEY` (optional but recommended): Enables structured narrative report generation.
- `GEONAMES_USERNAME` (optional): Used if UK primary population lookup is unavailable.

If `OPENAI_API_KEY` is missing, numeric modeling still runs and raw JSON output is produced.

## How It Works

### 1. Input & Validation

The CLI expects exactly two positional inputs:

- business name
- full address string

If either is missing, the process exits with usage instructions.

### 2. Geocode + Own Listing Lookup (Parallel)

The app runs in parallel:

- geocodes the address to coordinates/postcode/country
- searches for the business in Google Places and pulls details

The own-listing block also attempts website analysis for:

- pricing visibility
- package/bundle language
- Facebook/Instagram/TikTok mentions

### 3. Competitor Discovery

Competitors are fetched using Nearby Search for each keyword:

- `tanning salon`
- `sunbed`

Results are merged, deduplicated by `place_id`, and filtered to remove likely self-listings.

### 4. Competitor Enrichment

Top competitors by review volume are enriched via Place Details to detect website presence. This is capped (`PLACE_DETAILS_LIMIT`) to control API cost.

### 5. Population Resolution

Resolution order:

1. UK postcode -> admin district via postcodes.io
2. NOMIS population using mapped dataset
3. GeoNames fallback (if configured)
4. static fallback (`FALLBACK_POPULATION`)

### 6. Opportunity Modeling

The deterministic model combines:

- competition pressure
- digital visibility gap
- local population demand layer
- reachable audience
- acquisition rate
- repeat visit behavior
- weighted session price

Output includes low/mid/high uplift bands and supporting metrics.

### 7. AI Report Rendering

If OpenAI is configured, the app sends only final computed values and requests strict JSON output for the four report sections.

## Formulas

The core model is implemented in `calculateOpportunity(...)`.

Let:

- $P$ = population
- $C_t$ = competitor total
- $S_{top3}$ = top-3 review share
- $R_{avg}$ = average competitor reviews
- $W_r$ = competitor website ratio

### Weighted Session Price

$$
	ext{avgSessionPrice} = 0.2\cdot\text{min2} + 0.5\cdot\text{min5} + 0.3\cdot\text{min10}
$$

### Competition Pressure

$$
	ext{pressure} = \text{clamp}\left(0.35\cdot\frac{C_t}{20} + 0.35\cdot S_{top3} + 0.3\cdot\frac{R_{avg}}{100},\ 0,\ 1\right)
$$

### Visibility Gap

$$
	ext{visibilityGap} = \text{clamp}\left((1-W_r)\cdot0.6 + \left(1-\frac{\text{competitorsWithWebsite}}{\max(C_t,1)}\right)\cdot0.4,\ 0,\ 1\right)
$$

### Market Size Layer

Base penetration is fixed at $0.11$.

$$
	ext{saturationAdjustment} = 1 - 0.22\cdot\text{pressure}
$$

$$
	ext{monthlyMarketSize} = \frac{P\cdot0.11\cdot\text{saturationAdjustment}}{12}
$$

### Reach Layer

$$
	ext{reachFactor} = \text{clamp}(0.22 + 0.6\cdot\text{visibilityGap} - 0.18\cdot\text{pressure},\ 0.08,\ 0.55)
$$

$$
	ext{reachableCustomers} = \text{monthlyMarketSize}\cdot\text{reachFactor}
$$

### Acquisition Layer

$$
	ext{acquisitionRate} = \text{clamp}(0.075 + 0.33\cdot\text{visibilityGap} - 0.16\cdot\text{pressure},\ 0.02,\ 0.28)
$$

$$
	ext{newCustomersMid} = \text{round}(\text{reachableCustomers}\cdot\text{acquisitionRate})
$$

### Repeat Behavior

$$
	ext{repeatVisitsPerCustomer} = \text{clamp}(4.3 + 1.5\cdot\text{visibilityGap} - 1.0\cdot\text{pressure},\ 3.6,\ 7.2)
$$

### Secondary Conversion Signal

$$
	ext{searchToVisitRate} = \text{clamp}(0.06 + 0.04\cdot\text{visibilityGap} - 0.02\cdot\text{pressure},\ 0.02,\ 0.11)
$$

$$
	ext{conversionImpact} = \text{round}(\text{newCustomersMid}\cdot\text{searchToVisitRate}, 2)
$$

### Revenue Model

$$
	ext{monthlyRevenue} = \text{newCustomersMid}\cdot\text{repeatVisitsPerCustomer}\cdot\text{avgSessionPrice}
$$

Uplift bands:

- Low: $0.75\cdot\text{monthlyRevenue}$
- Mid: $1.00\cdot\text{monthlyRevenue}$
- High: $1.25\cdot\text{monthlyRevenue}$

### Visibility Score

Computed after opportunity modeling:

$$
	ext{visibilityScore} = \text{round}\left(50\cdot\frac{\text{competitorsWithWebsite}}{\max(C_t,1)} + 25\cdot\mathbb{1}_{\text{ownHasOnlinePresence}} + 25\cdot W_r,\ 2\right)
$$

## Output

The CLI prints:

1. `=== RAW DATA ===` JSON payload with:
	 - `business`
	 - `own`
	 - `population`
	 - `competition`
	 - `opportunity`
2. `=== MARKET REPORT ===` when OpenAI summary is enabled.

## Configuration Constants

Defined in code and important for interpretation:

- `RADIUS_METERS = 10000`
- `PLACE_SEARCH_KEYWORDS = ["tanning salon", "sunbed"]`
- `PLACE_DETAILS_LIMIT = 8`
- `FALLBACK_POPULATION = 500000`

Adjust these if your target vertical, market density, or budget assumptions differ.

## Operational Notes

- API usage costs can rise with Places and Details calls.
- Website scraping in `analyzeWebsite` is heuristic and time-limited.
- Self-match filtering is name-based and can over/under-filter edge cases.
- Population fallback can materially affect outputs if primary sources fail.

## Troubleshooting

- `Geocoding failed. Check address and API key.`
	- Verify `GOOGLE_API_KEY`, API enablement, and billing.
- Empty/weak own business section:
	- Business may not be discoverable via text search for provided query.
- No AI report section:
	- Ensure `OPENAI_API_KEY` is set and valid.
- Population looks generic:
	- Check postcode quality and `GEONAMES_USERNAME` availability.

## Security & Compliance

- Keep API keys in environment variables, never hardcode them.
- Review external API terms for storage, caching, and attribution requirements.
- Validate report usage for business advisory context; outputs are model-based estimates, not guarantees.