export const DEFAULT_USD_CNY_RATE = 6.8;

const CACHE_KEY = "openpix_usd_cny_rate";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedUsdCnyRate = {
  rate: number;
  fetchedAt: number;
};

export type UsdCnyRateSource = "api" | "cache" | "default";

export type UsdCnyRateResult = {
  rate: number;
  source: UsdCnyRateSource;
};

function readCachedRate(): CachedUsdCnyRate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedUsdCnyRate;
    if (
      typeof parsed.rate !== "number" ||
      typeof parsed.fetchedAt !== "number" ||
      parsed.rate <= 0
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedRate(rate: number) {
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ rate, fetchedAt: Date.now() } satisfies CachedUsdCnyRate),
  );
}

async function fetchUsdCnyRateFromApi(): Promise<number | null> {
  try {
    const response = await fetch(
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY",
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { rates?: { CNY?: number } };
    const rate = data.rates?.CNY;
    if (typeof rate !== "number" || rate <= 0) return null;
    return rate;
  } catch {
    return null;
  }
}

export async function getUsdToCnyRate(): Promise<UsdCnyRateResult> {
  const cached = readCachedRate();
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { rate: cached.rate, source: "cache" };
  }

  const apiRate = await fetchUsdCnyRateFromApi();
  if (apiRate != null) {
    writeCachedRate(apiRate);
    return { rate: apiRate, source: "api" };
  }

  if (cached) {
    return { rate: cached.rate, source: "cache" };
  }

  return { rate: DEFAULT_USD_CNY_RATE, source: "default" };
}

export function formatUsdCnyRate(rate: number): string {
  return rate.toFixed(2);
}

export function formatCostCny(usd: number, rate: number): string {
  const cny = usd * rate;
  if (cny >= 1) return `¥${cny.toFixed(2)}`;
  if (cny >= 0.1) return `¥${cny.toFixed(3)}`;
  if (cny >= 0.01) return `¥${cny.toFixed(4)}`;
  return `¥${cny.toFixed(5)}`;
}
