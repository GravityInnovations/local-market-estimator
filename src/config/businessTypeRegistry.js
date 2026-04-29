export const BUSINESS_TYPE_REGISTRY = {
  tanning_salon: ["tanning salon", "tanning", "sunbed", "sunbeds"],
  dentist: ["dentist", "dental", "dental clinic"],
  gym: ["gym", "fitness gym", "fitness center"],
  barber: ["barber", "barbershop", "barber shop"],
  clinic: ["clinic", "medical clinic", "health clinic"],
  restaurant: ["restaurant", "eatery", "bistro"],
  local_service: ["local service", "service business", "appointment service"],
};

export function listSupportedBusinessTypes() {
  return Object.keys(BUSINESS_TYPE_REGISTRY);
}

export function resolveBusinessType(input) {
  const normalizedInput = String(input || "").trim().toLowerCase();
  if (!normalizedInput) return null;

  if (Object.prototype.hasOwnProperty.call(BUSINESS_TYPE_REGISTRY, normalizedInput)) {
    return normalizedInput;
  }

  for (const [businessType, aliases] of Object.entries(BUSINESS_TYPE_REGISTRY)) {
    if (aliases.includes(normalizedInput)) {
      return businessType;
    }
  }

  return null;
}

export default BUSINESS_TYPE_REGISTRY;