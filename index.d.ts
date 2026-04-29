// @gravityinnovations/market-analytics-engine — TypeScript declarations

/** A single pricing tier for the business. */
export interface PricingOption {
  /** Display label for this tier, e.g. "Basic" or "Premium". */
  title: string;
  /** Price in the operator's currency, e.g. 25. */
  price: number;
}

/** Input contract for MarketAnalyticsEngine.run(). */
export interface EngineInput {
  /** Registered name of the business. */
  businessName: string;
  /** Full postal address including postcode and country, e.g. "10 High St, Bristol BS1 2AA, UK". */
  address: string;
  /**
   * Business type key or recognized alias.
   * Use MarketAnalyticsEngine.getSupportedBusinessTypes() for valid values.
   * Aliases (e.g. "sunbed" → "tanning_salon") are resolved automatically.
   */
  businessType: string;
  /** Pricing tiers for this business. At least one tier is required. */
  pricingOptions: PricingOption[];
  /**
   * Search radius in meters for competitor discovery.
   * Defaults to 10 000 m when omitted.
   */
  radiusMeters?: number;
}

/** Optional environment overrides for the engine. */
export interface EngineEnv {
  GOOGLE_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEONAMES_USERNAME?: string;
}

/** Optional application config overrides. */
export interface EngineAppConfig {
  defaultRadiusMeters?: number;
  fallbackPopulation?: number;
  postcodesApiBase?: string;
  openAiModel?: string;
  placeDetailsLimit?: number;
}

/** Constructor options for MarketAnalyticsEngine. */
export interface EngineOptions {
  /** Override environment variable defaults. */
  env?: EngineEnv;
  /** Override application configuration defaults. */
  appConfig?: EngineAppConfig;
}

/** Aggregated competitor metrics from the search area. */
export interface CompetitionSummary {
  total: number;
  avg_reviews: number;
  top3_share: number;
  website_ratio: number;
  competitors_with_website: number;
}

/** Own business signals from Google Places. */
export interface OwnBusinessData {
  name: string;
  rating: number | null;
  reviews: number;
  hasOnlinePresence: boolean;
  businessStatus: string;
  serviceTypes: string[];
  visibility: {
    facebook: boolean;
    instagram: boolean;
    tiktok: boolean;
  };
  pricing: {
    visible: boolean;
    packages: boolean;
  };
}

/** Population data resolved for the address. */
export interface PopulationData {
  population: number;
  source: string;
  region?: string;
}

/** Revenue uplift broken into bands. */
export interface UpliftBand {
  low: number;
  mid: number;
  high: number;
}

/** Full opportunity model output. */
export interface OpportunityResult {
  averageTierPrice: number;
  uplift: UpliftBand;
  pressure: number;
  visibilityGap: number;
  addressableMarket: number;
  reachableCustomers: number;
  conversionProbability: number;
  newCustomersMid: number;
  usageFrequencyPerCustomer: number;
  reachToCustomerRate: number;
  conversionImpact: number;
  monthlyRevenue: number;
  assumedUsageFrequencyMonthly: number;
  visibilityScore: number;
}

/** Structured result payload from a run. */
export interface EngineResult {
  business: { name: string; address: string; type: string };
  own: OwnBusinessData | null;
  population: PopulationData;
  competition: CompetitionSummary;
  opportunity: OpportunityResult;
}

/** AI-generated report sections. null when OpenAI is not configured. */
export interface EngineReportSummary {
  market_snapshot: string[];
  current_position: string[];
  improvements: string[];
  estimation: string[];
}

/** Formatted text representations of the result. */
export interface EngineOutput {
  /** Raw JSON payload as formatted text. */
  rawText: string;
  /** Formatted four-section market report text, or null when AI summary is unavailable. */
  summaryText: string | null;
  /** Combined rawText + summaryText. */
  verboseText: string;
}

/** Return shape from MarketAnalyticsEngine.run(). */
export interface EngineRunResult {
  result: EngineResult;
  summary: EngineReportSummary | null;
  output: EngineOutput;
}

/**
 * Primary public API for the market-analytics-engine package.
 *
 * @example
 * ```js
 * import { MarketAnalyticsEngine } from '@gravityinnovations/market-analytics-engine';
 *
 * const engine = new MarketAnalyticsEngine();
 *
 * const { result, summary, output } = await engine.run({
 *   businessName: 'Glow Studio',
 *   address: '10 High Street, Bristol BS1 2AA, UK',
 *   businessType: 'tanning_salon',
 *   pricingOptions: [
 *     { title: 'Basic', price: 25 },
 *     { title: 'Premium', price: 60 },
 *   ],
 * });
 * ```
 */
export declare class MarketAnalyticsEngine {
  constructor(options?: EngineOptions);

  /** Returns the list of canonical business type keys. */
  getSupportedBusinessTypes(): string[];

  /**
   * Resolves a raw business type string or alias to its canonical key.
   * Returns null when the input is not recognized.
   */
  resolveBusinessType(input: string): string | null;

  /** Validates and normalizes engine input. Throws on invalid input. */
  normalizeAndValidateInput(input: EngineInput): Required<Omit<EngineInput, "radiusMeters">> & { radiusMeters?: number };

  /** Runs the full market estimation pipeline. */
  run(input: EngineInput): Promise<EngineRunResult>;
}

/**
 * Builds printable text representations from engine output.
 *
 * @example
 * ```js
 * import { MarketReportOutput } from '@gravityinnovations/market-analytics-engine';
 *
 * const formatter = new MarketReportOutput();
 * const { rawText, summaryText } = formatter.create({ result, summary });
 * ```
 */
export declare class MarketReportOutput {
  create(data: { result: EngineResult; summary: EngineReportSummary | null }): EngineOutput;
  buildRaw(result: EngineResult): string;
  buildSummary(summary: EngineReportSummary): string;
}
