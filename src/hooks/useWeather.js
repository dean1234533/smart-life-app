import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

export function wmoToCondition(code) {
  if (code === 0)          return { label: 'Clear',        emoji: '☀️' };
  if (code <= 2)           return { label: 'Partly Cloudy', emoji: '⛅' };
  if (code <= 3)           return { label: 'Overcast',      emoji: '☁️' };
  if (code <= 48)          return { label: 'Foggy',         emoji: '🌫️' };
  if (code <= 55)          return { label: 'Drizzle',       emoji: '🌦️' };
  if (code <= 65)          return { label: 'Rain',          emoji: '🌧️' };
  if (code <= 75)          return { label: 'Snow',          emoji: '❄️' };
  if (code <= 82)          return { label: 'Showers',       emoji: '🌦️' };
  if (code <= 99)          return { label: 'Thunderstorm',  emoji: '⛈️' };
  return { label: 'Unknown', emoji: '🌡️' };
}

async function fetchWeather(lat, lon) {
  const [weatherRes, geoRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`
    ),
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'User-Agent': 'SmartLifeApp/1.0' } }
    ),
  ]);
  const weather = await weatherRes.json();
  const geo = await geoRes.json().catch(() => ({}));
  const city =
    geo.address?.city ||
    geo.address?.town ||
    geo.address?.village ||
    geo.address?.county ||
    'Your location';
  return { weather, city };
}

export function useWeather() {
  const [coords, setCoords] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [geoLoading, setGeoLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported');
      setGeoLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoLoading(false);
      },
      () => {
        setGeoError('Location access denied');
        setGeoLoading(false);
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  const { data, isLoading: weatherLoading, error: weatherError } = useQuery({
    queryKey: ['weather', coords?.lat?.toFixed(2), coords?.lon?.toFixed(2)],
    queryFn: () => fetchWeather(coords.lat, coords.lon),
    enabled: !!coords,
    staleTime: 30 * 60 * 1000,  // re-fetch every 30 minutes
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  const loading = geoLoading || weatherLoading;
  const error = geoError || (weatherError ? 'Weather unavailable' : null);

  if (!data) return { loading, error, weather: null };

  const { weather, city } = data;
  const cur = weather.current;
  const unit = weather.current_units?.temperature_2m || '°C';

  return {
    loading: false,
    error: null,
    weather: {
      city,
      temp: Math.round(cur.temperature_2m),
      feelsLike: Math.round(cur.apparent_temperature),
      humidity: cur.relative_humidity_2m,
      wind: Math.round(cur.wind_speed_10m),
      condition: wmoToCondition(cur.weather_code),
      unit,
      forecast: weather.daily.time.slice(0, 4).map((date, i) => ({
        date,
        condition: wmoToCondition(weather.daily.weather_code[i]),
        high: Math.round(weather.daily.temperature_2m_max[i]),
        low: Math.round(weather.daily.temperature_2m_min[i]),
      })),
    },
  };
}
