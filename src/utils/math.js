export const round = (value, digits = 2) => Number(Number(value).toFixed(digits));
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function breakdown(monthly) {
  return {
    monthly: round(monthly),
    weekly: round(monthly / 4.33),
  };
}
