export const DEFAULT_PRICING_OPTIONS = [
  { title: "Basic", price: 25 },
  { title: "Standard", price: 70 },
  { title: "Premium", price: 110 },
];

export const APP_CONFIG = {
  defaultRadiusMeters: 10000,
  fallbackPopulation: 500000,
  postcodesApiBase: "https://api.postcodes.io",
  openAiModel: "gpt-4.1-mini",
  placeDetailsLimit: 8,
};

export const NOMIS_DATASET_MAP = {
  E06: "NM_31_1",
  E07: "NM_31_1",
  E08: "NM_31_1",
  E09: "NM_31_1",
  W06: "NM_31_1",
  S12: "NM_31_1",
};
