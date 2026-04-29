export function isSelf(placeName, selfName) {
  const normalize = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

  const placeNormalized = normalize(placeName);
  const selfNormalized = normalize(selfName);
  const firstWord = selfNormalized.split(/\s+/).find((word) => word.length > 3) || selfNormalized;

  return placeNormalized.includes(firstWord) || selfNormalized.includes(placeNormalized);
}
