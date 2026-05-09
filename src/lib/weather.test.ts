import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCurrentWeather } from './weather';

describe('getCurrentWeather', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockOk(body: unknown) {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => body,
    } as Response);
  }

  it('rounds temperature and wind to whole numbers', async () => {
    mockOk({
      current: {
        temperature_2m: 68.7,
        relative_humidity_2m: 45,
        weather_code: 0,
        wind_speed_10m: 8.4,
      },
    });

    const w = await getCurrentWeather(30.27, -97.74);
    expect(w.temp_f).toBe(69);
    expect(w.wind_mph).toBe(8);
    expect(w.humidity).toBe(45);
  });

  it('maps weather code to a human-readable condition', async () => {
    mockOk({
      current: { temperature_2m: 50, relative_humidity_2m: 70, weather_code: 63, wind_speed_10m: 5 },
    });
    const w = await getCurrentWeather(0, 0);
    expect(w.condition).toBe('rain');
  });

  it('returns "unknown" for an unmapped weather code', async () => {
    mockOk({
      current: { temperature_2m: 50, relative_humidity_2m: 70, weather_code: 999, wind_speed_10m: 5 },
    });
    const w = await getCurrentWeather(0, 0);
    expect(w.condition).toBe('unknown');
  });

  it('throws when the API returns a non-OK response', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false } as Response);
    await expect(getCurrentWeather(0, 0)).rejects.toThrow('Weather API failed');
  });

  it('passes lat/lon and fahrenheit/mph in the query string', async () => {
    mockOk({
      current: { temperature_2m: 50, relative_humidity_2m: 70, weather_code: 0, wind_speed_10m: 5 },
    });
    await getCurrentWeather(30.27, -97.74);
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('latitude=30.27');
    expect(url).toContain('longitude=-97.74');
    expect(url).toContain('temperature_unit=fahrenheit');
    expect(url).toContain('wind_speed_unit=mph');
  });
});
