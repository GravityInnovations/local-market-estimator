export class MarketEstimatorApp {
  constructor({ googleMapsApi, ownBusinessService, competitionService, populationService, opportunityCalculator, summaryService }) {
    this.googleMapsApi = googleMapsApi;
    this.ownBusinessService = ownBusinessService;
    this.competitionService = competitionService;
    this.populationService = populationService;
    this.opportunityCalculator = opportunityCalculator;
    this.summaryService = summaryService;
  }

  async run({ businessName, address, businessType, radiusMeters, pricingOptions }) {
    if (!Array.isArray(pricingOptions) || pricingOptions.length === 0) {
      throw new Error("pricingOptions is required and must be a non-empty array.");
    }

    const [geo, own] = await Promise.all([
      this.googleMapsApi.geocodeAddress(address),
      this.ownBusinessService.lookup(businessName, address),
    ]);

    if (!geo.lat) {
      throw new Error("Geocoding failed. Check address and API key.");
    }

    const competitionData = await this.competitionService.fetchAndSummarize({
      lat: geo.lat,
      lng: geo.lng,
      businessName,
      businessType,
      radiusMeters,
    });

    const population = await this.populationService.resolve(geo.postcode, geo.countryCode);
    const opportunity = this.opportunityCalculator.calculate(
      population.population,
      competitionData.summary,
      pricingOptions
    );

    opportunity.visibilityScore = this.opportunityCalculator.calculateVisibilityScore(
      competitionData.summary,
      own
    );

    const result = {
      business: { name: businessName, address, type: businessType },
      own,
      population,
      competition: competitionData.summary,
      opportunity,
    };

    const summary = await this.summaryService.generate(result);

    return {
      result,
      summary,
    };
  }
}
