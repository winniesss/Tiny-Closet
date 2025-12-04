import { WeatherData } from '../types';

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
    // Using Open-Meteo API (Free, no key required)
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=celsius`
    );
    const data = await response.json();
    const current = data.current;
    
    // Map WMO codes to our app types
    const code = current.weather_code;
    let condition: WeatherData['condition'] = 'Cloudy';
    let description = "Partly Cloudy";

    // WMO Weather interpretation codes (WW)
    if (code === 0) {
        condition = 'Sunny';
        description = "Clear sky";
    } else if (code <= 3) {
        condition = 'Cloudy';
        description = "Partly cloudy";
    } else if (code <= 48) {
        condition = 'Cloudy';
        description = "Foggy";
    } else if (code <= 67) {
        condition = 'Rainy';
        description = "Drizzle or Rain";
    } else if (code <= 77) {
        condition = 'Snowy';
        description = "Snow fall";
    } else if (code <= 82) {
        condition = 'Rainy';
        description = "Rain showers";
    } else if (code <= 86) {
        condition = 'Snowy';
        description = "Snow showers";
    } else {
        condition = 'Rainy'; // Thunderstorms
        description = "Thunderstorm";
    }

    // Override for high wind (approx > 30km/h)
    if (current.wind_speed_10m > 30 && condition !== 'Rainy' && condition !== 'Snowy') {
        condition = 'Windy';
        description = "Breezy";
    }

    return {
        condition,
        temp: Math.round(current.temperature_2m),
        description
    };
  } catch (e) {
      console.error("Weather fetch failed", e);
      // Fallback
      return {
          condition: 'Sunny',
          temp: 22,
          description: 'Weather unavailable'
      };
  }
};