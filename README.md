# Local Market Estimator

Professional, API-driven market estimation engine for local businesses.

This project calculates local opportunity and revenue uplift signals from:
- location context
- own business presence
- nearby competitors
- population context
- pricing tiers

It exposes:
- a reusable class engine: `MarketAnalyticsEngine`
- a command-line interface for operations and reporting

## Contents

- [What It Is](#what-it-is)
- [Features](#features)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Formula Reference](#formula-reference)
- [Setup](#setup)
- [CLI Usage](#cli-usage)
- [Input Contracts](#input-contracts)
- [Output Contract](#output-contract)
- [Business Type Resolution](#business-type-resolution)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Documentation References](#documentation-references)

## What It Is

Local Market Estimator is a Node.js ES module project that produces a structured market opportunity estimate for a specific local business.

The numeric model is deterministic and code-based. AI is used only to convert computed data into a readable business report.

## Features

- Named-flag CLI commands (`help`, `types`, `exec`)
- Engine-level validation and normalization
- Required pricing tiers with schema `{ title, price }`
- Deterministic business-type normalization through a registry
- Competitor discovery and summary metrics
- Population lookup with fallback strategy
- Structured output in raw JSON and formatted report sections

## Architecture

The project is split into focused modules:

- CLI adapter: `index.js`
- Reusable engine: `src/main.js`
- Application orchestrator: `src/app/MarketEstimatorApp.js`
- APIs: `src/apis/*`
- Services: `src/services/*`
- Formulas: `src/formulas/OpportunityCalculator.js`
- Business type registry: `src/config/businessTypeRegistry.js`
- Constants and app config: `src/config/constants.js`
- Output formatting: `src/output/report.js`

## How It Works

1. CLI parses and validates command input.
2. Engine normalizes all required fields and resolves business type.
3. App geocodes the address and looks up own business signals.
4. Competitors are discovered and summarized.
5. Population is resolved.
6. Opportunity formulas compute pressure, visibility gap, reach, conversion, and uplift.
7. Summary service generates narrative sections from computed values.
8. Output formatter builds raw and summary report text.

## Formula Reference

Source: `src/formulas/OpportunityCalculator.js`

Let:
- $C_t$ = total competitors
- $S_{top3}$ = top-3 review share
- $R_{avg}$ = average competitor reviews
- $W_r$ = website ratio
- $P$ = population

### Average Tier Price

Given pricing tiers $\{(title_i, price_i)\}$:

$$
\text{averageTierPrice} = \frac{\sum_{i=1}^{n} price_i}{n}
$$

### Competition Pressure

$$
\text{pressure} = \text{clamp}\left(0.35\cdot\frac{C_t}{20} + 0.35\cdot S_{top3} + 0.3\cdot\frac{R_{avg}}{100}, 0, 1\right)
$$

### Visibility Gap

$$
\text{visibilityGap} = \text{clamp}\left((1-W_r)\cdot0.6 + \left(1-\frac{\text{competitorsWithWebsite}}{\max(C_t,1)}\right)\cdot0.4, 0, 1\right)
$$

### Addressable Market

$$
\text{addressableMarket} = \frac{P\cdot0.11\cdot(1-0.22\cdot\text{pressure})}{12}
$$

### Reach, Conversion, and Revenue

$$
\text{reachFactor} = \text{clamp}(0.22 + 0.6\cdot\text{visibilityGap} - 0.18\cdot\text{pressure}, 0.08, 0.55)
$$

$$
\text{conversionProbability} = \text{clamp}(0.075 + 0.33\cdot\text{visibilityGap} - 0.16\cdot\text{pressure}, 0.02, 0.28)
$$

$$
\text{newCustomersMid} = \text{round}(\text{addressableMarket}\cdot\text{reachFactor}\cdot\text{conversionProbability})
$$

$$
\text{usageFrequencyPerCustomer} = \text{clamp}(4.3 + 1.5\cdot\text{visibilityGap} - 1.0\cdot\text{pressure}, 3.6, 7.2)
$$

$$
\text{monthlyRevenue} = \text{newCustomersMid}\cdot\text{usageFrequencyPerCustomer}\cdot\text{averageTierPrice}
$$

Uplift bands:
- low = $0.75\cdot\text{monthlyRevenue}$
- mid = $1.00\cdot\text{monthlyRevenue}$
- high = $1.25\cdot\text{monthlyRevenue}$

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
export GOOGLE_API_KEY="your_google_key"
export OPENAI_API_KEY="your_openai_key"
export GEONAMES_USERNAME="your_geonames_username"
```

3. Run commands via npm script:

```bash
npm start -- --help
```

## CLI Usage

### Show Help

```bash
npm start -- --help
```

### List Supported Business Types

```bash
npm start -- types
```

### Run Estimation

```bash
npm start -- exec \
  --name "Business Name" \
  --address "Full Address, Postcode, Country" \
  --type "businessType" \
  --pricing '[{"title":"Basic","price":25},{"title":"Premium","price":60}]' \
  --radius 10000 \
  --verbose
```

Minimal required form:

```bash
npm start -- exec \
  --name "Business Name" \
  --address "Full Address, Postcode, Country" \
  --type "businessType" \
  --pricing '[{"title":"Basic","price":25}]'
```

## Input Contracts

Required fields for `exec`:
- `--name`
- `--address`
- `--type`
- `--pricing`

Optional:
- `--radius` (positive number in meters)
- `--verbose`

Pricing schema:

```json
[
  { "title": "Basic", "price": 25 },
  { "title": "Standard", "price": 70 },
  { "title": "Premium", "price": 110 }
]
```

Validation rules:
- pricing must be valid JSON
- pricing must be a non-empty array
- each item must include non-empty `title`
- each item must include finite `price >= 0`

## Output Contract

Engine response from `run(input)`:

```json
{
  "result": { "...": "raw computed market payload" },
  "promptResult": { "...": "summary sections from AI service or null" },
  "output": {
    "rawText": "=== RAW DATA === ...",
    "summaryText": "=== MARKET REPORT === ...",
    "verboseText": "raw + summary"
  },
  "cliText": "formatted text when verboseReport=true"
}
```

## Business Type Resolution

Business types are resolved through registry aliases.

Example:
- input `"sunbed"` resolves to canonical `"tanning_salon"`

Use `types` command to list canonical keys currently supported.

## Configuration

Source: `src/config/constants.js`

Defaults:
- `defaultRadiusMeters`: `10000`
- `fallbackPopulation`: `500000`
- `openAiModel`: `gpt-4.1-mini`
- `placeDetailsLimit`: `8`
- `DEFAULT_PRICING_OPTIONS`: Basic/Standard/Premium tier examples

## Troubleshooting

- Error: unsupported business type
  - Run `npm start -- types` and use one of the supported values.
- Error: pricing required or invalid
  - Confirm `--pricing` is valid JSON array with `{ title, price }` objects.
- Error: geocoding failed
  - Verify `GOOGLE_API_KEY`, API enablement, and billing configuration.
- No AI summary output
  - Verify `OPENAI_API_KEY` and model access.

## Documentation References

Core source references:
- CLI command parsing and validation: [index.js](index.js)
- Engine API and input normalization: [src/main.js](src/main.js)
- App orchestration flow: [src/app/MarketEstimatorApp.js](src/app/MarketEstimatorApp.js)
- Opportunity formulas: [src/formulas/OpportunityCalculator.js](src/formulas/OpportunityCalculator.js)
- Business type aliases/registry: [src/config/businessTypeRegistry.js](src/config/businessTypeRegistry.js)
- Runtime constants/defaults: [src/config/constants.js](src/config/constants.js)
- Output formatting: [src/output/report.js](src/output/report.js)
- Own business lookup service: [src/services/OwnBusinessService.js](src/services/OwnBusinessService.js)
- Competition service: [src/services/CompetitionService.js](src/services/CompetitionService.js)
- Population service: [src/services/PopulationService.js](src/services/PopulationService.js)
- Summary generation service: [src/services/SummaryService.js](src/services/SummaryService.js)

## Notes

This estimator is an analytical decision-support tool. Results are modeled estimates, not guaranteed outcomes.