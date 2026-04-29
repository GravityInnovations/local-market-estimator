import { NOMIS_DATASET_MAP } from "../config/constants.js";

export function resolveNomisDataset(geoCode) {
  if (!geoCode) return null;

  const prefix = geoCode.substring(0, 3).toUpperCase();
  const dataset = NOMIS_DATASET_MAP[prefix] || null;

  if (!dataset) {
    console.warn(
      `[warn] No NOMIS dataset mapped for geography prefix: ${prefix} - falling through`
    );
  }

  return dataset;
}
