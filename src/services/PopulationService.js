import { isConfigured } from "../config/env.js";
import { resolveNomisDataset } from "../formulas/resolveNomisDataset.js";

export class PopulationService {
  constructor({ postcodesApi, nomisApi, geoNamesApi, config }) {
    this.postcodesApi = postcodesApi;
    this.nomisApi = nomisApi;
    this.geoNamesApi = geoNamesApi;
    this.config = config;
  }

  async resolve(postcode, countryCode) {
    if (countryCode === "GB" && postcode) {
      const postcodeData = await this.postcodesApi.lookup(postcode);
      const districtCode = postcodeData?.result?.codes?.admin_district;
      const nomisDataset = resolveNomisDataset(districtCode);

      if (districtCode && nomisDataset) {
        try {
          const population = await this.nomisApi.fetchPopulationByDistrict(
            nomisDataset,
            districtCode
          );

          if (population) {
            return { population, source: "nomis" };
          }

          console.warn("[warn] NOMIS returned suspicious value - falling through");
        } catch (error) {
          console.warn("[warn] nomis:", error.message);
        }
      }
    }

    if (isConfigured(this.geoNamesApi?.username) && postcode) {
      const geo = await this.geoNamesApi.searchPopulation(postcode);
      const population = geo?.geonames?.[0]?.population;

      if (population && population > 0) {
        return { population, source: "geonames" };
      }
    }

    return { population: this.config.fallbackPopulation, source: "fallback" };
  }
}
