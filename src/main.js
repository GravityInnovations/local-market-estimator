import { GoogleMapsApi } from "./apis/GoogleMapsApi.js";
import { PostcodesApi } from "./apis/PostcodesApi.js";
import { NomisApi } from "./apis/NomisApi.js";
import { GeoNamesApi } from "./apis/GeoNamesApi.js";
import { OpenAiApi } from "./apis/OpenAiApi.js";
import { APP_CONFIG } from "./config/constants.js";
import {
  listSupportedBusinessTypes,
  resolveBusinessType,
} from "./config/businessTypeRegistry.js";
import { ENV } from "./config/env.js";
import { OpportunityCalculator } from "./formulas/OpportunityCalculator.js";
import { MarketReportOutput } from "./output/report.js";
import { CompetitionService } from "./services/CompetitionService.js";
import { OwnBusinessService } from "./services/OwnBusinessService.js";
import { PopulationService } from "./services/PopulationService.js";
import { SummaryService } from "./services/SummaryService.js";
import { WebsiteAnalyzerService } from "./services/WebsiteAnalyzerService.js";
import { MarketEstimatorApp } from "./app/MarketEstimatorApp.js";

export class MarketAnalyticsEngine {
  constructor({ env = ENV, appConfig = APP_CONFIG } = {}) {
    this.env = env;
    this.appConfig = appConfig;
  }

  createApp() {
    const googleMapsApi = new GoogleMapsApi(this.env.GOOGLE_API_KEY);
    const postcodesApi = new PostcodesApi(this.appConfig.postcodesApiBase);
    const nomisApi = new NomisApi();
    const geoNamesApi = new GeoNamesApi(this.env.GEONAMES_USERNAME);
    const openAiApi = new OpenAiApi({
      apiKey: this.env.OPENAI_API_KEY,
      model: this.appConfig.openAiModel,
    });

    const websiteAnalyzer = new WebsiteAnalyzerService();
    const ownBusinessService = new OwnBusinessService({
      googleMapsApi,
      websiteAnalyzer,
    });
    const competitionService = new CompetitionService({
      googleMapsApi,
      config: {
        defaultRadiusMeters: this.appConfig.defaultRadiusMeters,
        placeDetailsLimit: this.appConfig.placeDetailsLimit,
      },
    });
    const populationService = new PopulationService({
      postcodesApi,
      nomisApi,
      geoNamesApi,
      config: {
        fallbackPopulation: this.appConfig.fallbackPopulation,
      },
    });
    const opportunityCalculator = new OpportunityCalculator();
    const summaryService = new SummaryService({
      openAiApi,
      openAiApiKey: this.env.OPENAI_API_KEY,
    });

    return new MarketEstimatorApp({
      googleMapsApi,
      ownBusinessService,
      competitionService,
      populationService,
      opportunityCalculator,
      summaryService,
    });
  }

  createReportOutput() {
    return new MarketReportOutput();
  }

  getSupportedBusinessTypes() {
    return listSupportedBusinessTypes();
  }

  resolveBusinessType(input) {
    return resolveBusinessType(input);
  }

  normalizeAndValidateInput(input) {
    if (!input || typeof input !== "object") {
      throw new Error("Input is required and must be an object.");
    }

    const businessName = String(input.businessName || "").trim();
    const address = String(input.address || "").trim();

    if (!businessName) {
      throw new Error("businessName is required.");
    }

    if (!address) {
      throw new Error("address is required.");
    }

    const businessType = this.resolveBusinessType(input.businessType);
    if (!businessType) {
      throw new Error(
        `Unsupported business type. Supported types: ${this.getSupportedBusinessTypes().join(", ")}`
      );
    }

    if (!Array.isArray(input.pricingOptions) || input.pricingOptions.length === 0) {
      throw new Error("pricingOptions is required and must be a non-empty array.");
    }

    const pricingOptions = input.pricingOptions.map((item) => ({
      title: String(item?.title || "").trim(),
      price: Number(item?.price),
    }));

    const invalidPricing = pricingOptions.some(
      (item) => !item.title || !Number.isFinite(item.price) || item.price < 0
    );

    if (invalidPricing) {
      throw new Error("Each pricingOptions item must include title and price >= 0.");
    }

    let radiusMeters;
    if (input.radiusMeters !== undefined && input.radiusMeters !== null && input.radiusMeters !== "") {
      radiusMeters = Number(input.radiusMeters);
      if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
        throw new Error("radiusMeters must be a positive number when provided.");
      }
    }

    return {
      businessName,
      address,
      businessType,
      radiusMeters,
      pricingOptions,
      verboseReport: Boolean(input.verboseReport),
    };
  }

  async run(input) {
    const normalizedInput = this.normalizeAndValidateInput(input);

    const app = this.createApp();
    const { result, summary } = await app.run(normalizedInput);
    const output = this.createReportOutput().create({ result, summary });
    const verbose = normalizedInput.verboseReport;

    const cliText = verbose
      ? [`\nAnalysing: ${normalizedInput.businessName}`, `Address:   ${normalizedInput.address}\n`, output.verboseText].join("\n")
      : null;

    return {
      stats:result,
      summary: summary
    };
  }
}

export default MarketAnalyticsEngine;
