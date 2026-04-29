import { buildUrl } from "../utils/url.js";

export class NomisApi {
  async fetchPopulationByDistrict(dataset, districtCode) {
    const url = buildUrl(
      `https://www.nomisweb.co.uk/api/v01/dataset/${dataset}.data.csv`,
      {
        geography: districtCode,
        date: "latest",
        age: 0,
        measures: 20100,
      }
    );

    const csv = await fetch(url).then((response) => response.text());
    const lines = csv.trim().split("\n");

    const headers = lines[0].split(",").map((header) =>
      header.trim().replace(/"/g, "").toUpperCase()
    );
    const obsIndex = headers.indexOf("OBS_VALUE");

    if (obsIndex === -1 || !lines[1]) return null;

    const value = Number(lines[1].split(",")[obsIndex]);
    if (!Number.isFinite(value) || value < 10000) return null;

    return value;
  }
}
