export class OwnBusinessService {
  constructor({ googleMapsApi, websiteAnalyzer }) {
    this.googleMapsApi = googleMapsApi;
    this.websiteAnalyzer = websiteAnalyzer;
  }

  async lookup(name, address) {
    const search = await this.googleMapsApi.textSearch(
      `${name} ${address}`,
      "textsearch:self"
    );

    const place = search?.results?.[0];
    if (!place?.place_id) {
      console.warn("[warn] Own business not found in Google Places - position data will be limited.");
      return null;
    }

    const details = await this.googleMapsApi.placeDetails({
      placeId: place.place_id,
      fields: "name,rating,user_ratings_total,website,business_status,types",
      label: "details:self",
    });

    const result = details?.result;
    if (!result) return null;

    const siteData = await this.websiteAnalyzer.analyze(result.website);

    return {
      name: result.name,
      rating: result.rating || null,
      reviews: result.user_ratings_total || 0,
      hasOnlinePresence: Boolean(result.website),
      businessStatus: result.business_status || "OPERATIONAL",
      serviceTypes: result.types || place.types || [],
      visibility: {
        facebook: siteData?.hasFacebook || false,
        instagram: siteData?.hasInstagram || false,
        tiktok: siteData?.hasTiktok || false,
      },
      pricing: {
        visible: siteData?.hasPricing || false,
        packages: siteData?.hasPackages || false,
      },
    };
  }
}
