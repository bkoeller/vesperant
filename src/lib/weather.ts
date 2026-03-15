export interface WeatherContext {
  temp_f: number;
  humidity: number;
  condition: string;
  wind_mph: number;
}

const WEATHER_CODE_MAP: Record<number, string> = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow',
  80: 'light showers', 81: 'showers', 82: 'heavy showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
};

export async function getCurrentWeather(lat: number, lon: number): Promise<WeatherContext> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error('Weather API failed');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;

  return {
    temp_f: Math.round(data.current.temperature_2m),
    humidity: data.current.relative_humidity_2m,
    condition: WEATHER_CODE_MAP[data.current.weather_code] ?? 'unknown',
    wind_mph: Math.round(data.current.wind_speed_10m),
  };
}

export async function getLocationWeather(): Promise<WeatherContext | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const weather = await getCurrentWeather(pos.coords.latitude, pos.coords.longitude);
          resolve(weather);
        } catch {
          resolve(null);
        }
      },
      () => resolve(null),
      { timeout: 5000 },
    );
  });
}
