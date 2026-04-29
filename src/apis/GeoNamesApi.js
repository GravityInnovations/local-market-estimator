import { buildUrl } from "../utils/url.js";
import { fetchJson } from "../utils/http.js";

export class GeoNamesApi {
  constructor(username) {
    this.username = username;
  }

  async searchPopulation(postcode) {
    return fetchJson(
      buildUrl("https://api.geonames.org/searchJSON", {
        q: postcode,
        maxRows: 1,
        username: this.username,
      }),
      {},
      "geonames"
    );
  }
}
