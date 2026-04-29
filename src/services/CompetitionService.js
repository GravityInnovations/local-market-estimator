import { isSelf } from "../utils/businessIdentity.js";
import { round } from "../utils/math.js";
import { BUSINESS_TYPE_REGISTRY } from "../config/businessTypeRegistry.js";

export class CompetitionService {
  constructor({ googleMapsApi, config }) {
    this.googleMapsApi = googleMapsApi;
    this.config = config;
  }

  async fetchPlaces(lat, lng, keyword, radiusMeters) {
    const data = await this.googleMapsApi.nearbySearch({
      lat,
      lng,
      radius: radiusMeters,
      keyword,
    });

    return (data?.results || []).map((place) => ({
      place_id: place.place_id,
      name: place.name,
      rating: place.rating || 0,
      reviews: place.user_ratings_total || 0,
    }));
  }

  async enrichWithWebsite(places) {
    const sorted = [...places].sort((a, b) => b.reviews - a.reviews);
    const toEnrich = sorted.slice(0, this.config.placeDetailsLimit);
    const rest = sorted.slice(this.config.placeDetailsLimit);

    const enriched = await Promise.all(
      toEnrich.map(async (place) => {
        const data = await this.googleMapsApi.placeDetails({
          placeId: place.place_id,
          fields: "website",
          label: `details:${place.name}`,
        });

        return { ...place, hasWebsite: Boolean(data?.result?.website) };
      })
    );

    return [...enriched, ...rest.map((place) => ({ ...place, hasWebsite: false }))];
  }

  buildSearchKeywords(businessType) {
    const keywords = BUSINESS_TYPE_REGISTRY[businessType] || [];
    return keywords.length ? keywords : [businessType];
  }

  summarize(list) {
    const total = list.length;

    if (total === 0) {
      return {
        total: 0,
        direct: 0,
        avg_reviews: 0,
        avg_rating: 0,
        top3_share: 0,
        website_ratio: 0,
        competitors_with_website: 0,
        is_low_competition: true,
      };
    }

    const direct = total;
    const totalReviews = list.reduce((sum, x) => sum + x.reviews, 0);
    const avgReviews = totalReviews / total;

    const top3Reviews = [...list]
      .sort((a, b) => b.reviews - a.reviews)
      .slice(0, 3)
      .reduce((sum, x) => sum + x.reviews, 0);

    const avgRating = list.reduce((sum, x) => sum + x.rating, 0) / total;
    const withWebsite = list.filter((x) => x.hasWebsite).length;

    return {
      total,
      direct,
      avg_reviews: round(avgReviews),
      avg_rating: round(avgRating, 2),
      top3_share: totalReviews ? round(top3Reviews / totalReviews, 4) : 0,
      website_ratio: round(withWebsite / total, 2),
      competitors_with_website: withWebsite,
      is_low_competition: total < 3,
    };
  }

  async fetchAndSummarize({ lat, lng, businessName, businessType, radiusMeters }) {
    const effectiveRadius = radiusMeters || this.config.defaultRadiusMeters;
    const searchKeywords = this.buildSearchKeywords(businessType);

    const rawLists = await Promise.all(
      searchKeywords.map((keyword) =>
        this.fetchPlaces(lat, lng, keyword, effectiveRadius)
      )
    );

    const seen = new Set();
    const deduped = rawLists.flat().filter((place) => {
      if (!place.place_id || seen.has(place.place_id)) return false;
      if (isSelf(place.name, businessName)) return false;
      seen.add(place.place_id);
      return true;
    });

    const enriched = await this.enrichWithWebsite(deduped);

    return {
      competitors: enriched,
      summary: this.summarize(enriched),
    };
  }
}
