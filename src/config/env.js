export const ENV = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  GEONAMES_USERNAME: process.env.GEONAMES_USERNAME,
};

export function isConfigured(value) {
  return Boolean(value) && !String(value).startsWith("YOUR_");
}
