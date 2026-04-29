import { breakdown, clamp, round } from "../utils/math.js";

export class OpportunityCalculator {
  calculate(population, competition, pricingOptions) {
    const validOptions = (pricingOptions || []).filter(
      (item) => String(item?.title || "").trim() && Number.isFinite(item?.price)
    );

    const averageTierPrice =
      validOptions.length > 0
        ? validOptions.reduce((sum, item) => sum + item.price, 0) / validOptions.length
        : 0;

    const pressure = clamp(
      0.35 * (competition.total / 20) +
        0.35 * competition.top3_share +
        0.3 * (competition.avg_reviews / 100),
      0,
      1
    );

    const visibilityGap = clamp(
      (1 - competition.website_ratio) * 0.6 +
        (1 - competition.competitors_with_website / Math.max(competition.total, 1)) * 0.4,
      0,
      1
    );

    const addressableMarketFactor = 0.11;
    const saturationAdjustment = 1 - pressure * 0.22;

    const addressableMarket =
      (population * addressableMarketFactor * saturationAdjustment) / 12;

    const reachFactor = clamp(
      0.22 + visibilityGap * 0.6 - pressure * 0.18,
      0.08,
      0.55
    );

    const reachableCustomers = addressableMarket * reachFactor;

    const conversionProbability = clamp(
      0.075 + visibilityGap * 0.33 - pressure * 0.16,
      0.02,
      0.28
    );

    const newCustomersMid = round(reachableCustomers * conversionProbability);

    const usageFrequencyPerCustomer = clamp(
      4.3 + visibilityGap * 1.5 - pressure * 1.0,
      3.6,
      7.2
    );

    const reachToCustomerRate = clamp(
      0.06 + visibilityGap * 0.04 - pressure * 0.02,
      0.02,
      0.11
    );

    const conversionImpact = round(newCustomersMid * reachToCustomerRate, 2);

    const monthlyRevenue =
      newCustomersMid * usageFrequencyPerCustomer * averageTierPrice;

    return {
      averageTierPrice,
      uplift: {
        low: breakdown(monthlyRevenue * 0.75),
        mid: breakdown(monthlyRevenue),
        high: breakdown(monthlyRevenue * 1.25),
      },
      pressure,
      visibilityGap,
      addressableMarket: round(addressableMarket),
      reachableCustomers: round(reachableCustomers),
      conversionProbability: round(conversionProbability, 4),
      newCustomersMid,
      usageFrequencyPerCustomer: round(usageFrequencyPerCustomer, 2),
      reachToCustomerRate: round(reachToCustomerRate, 4),
      conversionImpact,
      monthlyRevenue: round(monthlyRevenue),
      assumedUsageFrequencyMonthly: round(usageFrequencyPerCustomer, 2),
    };
  }

  calculateVisibilityScore(competition, own) {
    return round(
      (competition.competitors_with_website / Math.max(competition.total, 1)) * 50 +
        (own?.hasOnlinePresence ? 25 : 0) +
        competition.website_ratio * 25,
      2
    );
  }
}
