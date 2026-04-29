import { buildUrl } from "../utils/url.js";
import { fetchJson } from "../utils/http.js";

export class GoogleMapsApi {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async geocodeAddress(query) {
    const data = await fetchJson(
      buildUrl("https://maps.googleapis.com/maps/api/geocode/json", {
        address: query,
        key: this.apiKey,
      }),
      {},
      "geocode"
    );

    if (!data?.results?.length) return {};

    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      postcode: result.address_components.find((c) => c.types.includes("postal_code"))?.long_name,
      countryCode: result.address_components.find((c) => c.types.includes("country"))?.short_name,
    };
  }

  async textSearch(query, label = "textsearch") {
    return fetchJson(
      buildUrl("https://maps.googleapis.com/maps/api/place/textsearch/json", {
        key: this.apiKey,
        query,
      }),
      {},
      label
    );
  }

  async nearbySearch({ lat, lng, radius, keyword }) {
    return fetchJson(
      buildUrl("https://maps.googleapis.com/maps/api/place/nearbysearch/json", {
        key: this.apiKey,
        location: `${lat},${lng}`,
        radius,
        keyword,
      }),
      {},
      "places"
    );
  }

  async placeDetails({ placeId, fields, label = "details" }) {
    return fetchJson(
      buildUrl("https://maps.googleapis.com/maps/api/place/details/json", {
        key: this.apiKey,
        place_id: placeId,
        fields,
      }),
      {},
      label
    );
  }
}
