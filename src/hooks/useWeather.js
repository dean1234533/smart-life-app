import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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

const WEATHER_OPT_IN_KEY = 'weather_location_enabled';

// 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'
export function useWeather() {
  const queryClient = useQueryClient();
  const [coords, setCoords] = useState(null);
  const [permState, setPermState] = useState(() => {
    if (!navigator.geolocation) return 'unsupported';
    return 'idle';
  });

  const fetchCoords = useCallback((silent = false) => {
    if (!navigator.geolocation) return;
    if (!silent) setPermState('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        localStorage.setItem(WEATHER_OPT_IN_KEY, '1');
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setPermState('granted');
        queryClient.invalidateQueries({ queryKey: ['weather'] });
      },
      () => {
        if (silent) {
          // Silent attempt failed — browser revoked permission, clear opt-in and show button
          localStorage.removeItem(WEATHER_OPT_IN_KEY);
          setPermState('idle');
        } else {
          setPermState('denied');
        }
      },
      { timeout: 8000, maximumAge: 300000 }
    );
  }, [queryClient]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    // If user previously opted in, fetch silently — no button needed
    if (localStorage.getItem(WEATHER_OPT_IN_KEY)) {
      fetchCoords(true);
      return;
    }
    // Fall back to permissions API where supported
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          fetchCoords(true);
        } else if (result.state === 'denied') {
          setPermState('denied');
        }
        result.onchange = () => {
          if (result.state === 'granted') fetchCoords(true);
          if (result.state === 'denied') { localStorage.removeItem(WEATHER_OPT_IN_KEY); setPermState('denied'); }
        };
      }).catch(() => {});
    }
  }, [fetchCoords]);

  const requestLocation = useCallback(() => {
    fetchCoords(false);
  }, [fetchCoords]);

  const { data, isLoading: weatherLoading, error: weatherError } = useQuery({
    queryKey: ['weather', coords?.lat?.toFixed(2), coords?.lon?.toFixed(2)],
    queryFn: () => fetchWeather(coords.lat, coords.lon),
    enabled: !!coords,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  const loading = permState === 'requesting' || (permState === 'granted' && !data && weatherLoading);
  const error = permState === 'denied' ? 'denied' : (weatherError ? 'unavailable' : null);

  if (!data) {
    return { loading, error, weather: null, permState, requestLocation };
  }

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
    permState,
    requestLocation,
  };
}
