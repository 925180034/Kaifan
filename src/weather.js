const weatherLabels = {
  0: "晴",
  1: "晴间多云",
  2: "多云",
  3: "阴",
  45: "有雾",
  48: "雾凇",
  51: "小雨",
  53: "小雨",
  55: "小雨",
  56: "冻雨",
  57: "冻雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "冰粒",
  80: "阵雨",
  81: "阵雨",
  82: "强阵雨",
  85: "阵雪",
  86: "强阵雪",
  95: "雷雨",
  96: "雷暴冰雹",
  99: "雷暴冰雹"
};

const rainyCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

export function isWeatherCacheFresh(weather, now = new Date()) {
  return Boolean(
    weather?.source === "open_meteo" &&
      weather?.fetchedDate === dateKey(now) &&
      weather?.city
  );
}

export function buildWeatherContext(location, forecast, now = new Date()) {
  const current = forecast?.current ?? {};
  const weatherCode = Number(current.weather_code);
  const precipitation = Number(current.precipitation ?? 0);
  const temperature = Math.round(Number(current.temperature_2m));
  if (!location?.name || !Number.isFinite(temperature)) {
    throw new Error("Open-Meteo returned incomplete weather data");
  }

  const weather = {
    city: String(location.name),
    text: weatherLabels[weatherCode] ?? "天气变化",
    temperature,
    isRaining: precipitation > 0 || rainyCodes.has(weatherCode),
    source: "open_meteo",
    fetchedDate: dateKey(now)
  };
  return { weather, dateText: formatDateText(weather, now) };
}

export async function hydrateWeatherContext(context, city, fetchImpl = globalThis.fetch, now = new Date()) {
  const normalizedCity = String(city ?? "").trim();
  if (!normalizedCity || (context?.weather?.city === normalizedCity && isWeatherCacheFresh(context.weather, now))) {
    return { context, changed: false };
  }

  try {
    const locationResponse = await fetchJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(normalizedCity)}&count=1&language=zh&format=json`,
      fetchImpl
    );
    const location = locationResponse?.results?.[0];
    if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
      throw new Error("City was not found");
    }
    const forecastResponse = await fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}&current=temperature_2m,precipitation,weather_code&timezone=auto`,
      fetchImpl
    );
    return {
      context: { ...(context ?? {}), ...buildWeatherContext(location, forecastResponse, now) },
      changed: true
    };
  } catch {
    return { context, changed: false };
  }
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response?.ok) throw new Error("Weather request failed");
  return response.json();
}

function dateKey(now) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateText(weather, now) {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]} · ${weather.city} ${weather.text} ${weather.temperature}°C`;
}
