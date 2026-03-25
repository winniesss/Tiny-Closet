import { WeatherData } from '../types';

// Map WMO weather code to our app types
function mapWeatherCode(code: number, windSpeed?: number): { condition: WeatherData['condition']; description: string } {
  let condition: WeatherData['condition'] = 'Cloudy';
  let description = 'Partly Cloudy';

  if (code === 0) { condition = 'Sunny'; description = 'Clear sky'; }
  else if (code <= 3) { condition = 'Cloudy'; description = 'Partly cloudy'; }
  else if (code <= 48) { condition = 'Cloudy'; description = 'Foggy'; }
  else if (code <= 67) { condition = 'Rainy'; description = 'Drizzle or Rain'; }
  else if (code <= 77) { condition = 'Snowy'; description = 'Snow fall'; }
  else if (code <= 82) { condition = 'Rainy'; description = 'Rain showers'; }
  else if (code <= 86) { condition = 'Snowy'; description = 'Snow showers'; }
  else { condition = 'Rainy'; description = 'Thunderstorm'; }

  if (windSpeed && windSpeed > 30 && condition !== 'Rainy' && condition !== 'Snowy') {
    condition = 'Windy';
    description = 'Breezy';
  }

  return { condition, description };
}

// Fetch 7-day daily forecast, returns a map of YYYY-MM-DD → WeatherData
export const fetchWeekForecast = async (lat: number, lon: number): Promise<Map<string, WeatherData>> => {
  const result = new Map<string, WeatherData>();
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max&temperature_unit=celsius&timezone=auto`
    );
    const data = await response.json();
    const daily = data.daily;
    if (daily?.time) {
      for (let i = 0; i < daily.time.length; i++) {
        const dateKey = daily.time[i]; // YYYY-MM-DD
        const avgTemp = Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2);
        const { condition, description } = mapWeatherCode(daily.weather_code[i], daily.wind_speed_10m_max[i]);
        result.set(dateKey, {
          condition,
          temp: avgTemp,
          description: `${Math.round(daily.temperature_2m_min[i])}°–${Math.round(daily.temperature_2m_max[i])}° ${description}`,
        });
      }
    }
  } catch (e) {
    console.error('Forecast fetch failed', e);
  }
  return result;
};

export const getCoordinates = (): Promise<{ lat: number; lon: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      { timeout: 10000 }
    );
  });
};

export const fetchWeather = async (lat: number, lon: number): Promise<WeatherData> => {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=celsius`
    );
    const data = await response.json();
    const current = data.current;
    const { condition, description } = mapWeatherCode(current.weather_code, current.wind_speed_10m);

    return {
        condition,
        temp: Math.round(current.temperature_2m),
        description
    };
  } catch (e) {
      console.error("Weather fetch failed", e);
      return { condition: 'Sunny', temp: 22, description: 'Weather unavailable' };
  }
};