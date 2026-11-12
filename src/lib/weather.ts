import "server-only";

export type Weather = { tempF: number; highF: number; lowF: number; code: number; label: string };

const LABELS: [number[], string][] = [
  [[0], "Clear"],
  [[1, 2], "Partly cloudy"],
  [[3], "Overcast"],
  [[45, 48], "Fog"],
  [[51, 53, 55, 56, 57], "Drizzle"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "Rain"],
  [[71, 73, 75, 77, 85, 86], "Snow"],
  [[95, 96, 99], "Thunderstorms"],
];

export function weatherLabel(code: number) {
  return LABELS.find(([codes]) => codes.includes(code))?.[1] ?? "—";
}

/**
 * Current conditions from Open-Meteo (free, no API key). Cached for 30 min.
 * Returns null when location is unset or the service is unreachable.
 */
export async function getWeather(lat: number | null, lon: number | null, timezone: string): Promise<Weather | null> {
  if (lat == null || lon == null) return null;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&forecast_days=1&timezone=${encodeURIComponent(timezone)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const j = await res.json();
    const code = Number(j.current?.weather_code ?? -1);
    return {
      tempF: Math.round(j.current.temperature_2m),
      highF: Math.round(j.daily.temperature_2m_max[0]),
      lowF: Math.round(j.daily.temperature_2m_min[0]),
      code,
      label: weatherLabel(code),
    };
  } catch {
    return null;
  }
}
