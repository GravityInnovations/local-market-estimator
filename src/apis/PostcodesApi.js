import { fetchJson } from "../utils/http.js";

export class PostcodesApi {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async lookup(postcode) {
    return fetchJson(
      `${this.baseUrl}/postcodes/${encodeURIComponent(postcode)}`,
      {},
      "postcodes.io"
    );
  }
}
