import { Sun, Moon, CloudSun, MapPin, Droplets, Wind } from "lucide-react";
import { motion } from "framer-motion";

function ForecastDay({ day }) {
  const d = new Date(day.date + 'T12:00:00');
  const label = d.toLocaleDateString('en-GB', { weekday: 'short' });
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1">
      <span className="text-[10px] text-white/60">{label}</span>
      <span className="text-base leading-none">{day.condition.emoji}</span>
      <span className="text-[10px] font-medium text-white/90">{day.high}°</span>
      <span className="text-[10px] text-white/50">{day.low}°</span>
    </div>
  );
}

export default function DailyBriefing({ user, taskCount, noteCount, memoryCount, weather, weatherLoading, weatherError, permState, requestLocation }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const Icon = hour < 12 ? Sun : hour < 18 ? CloudSun : Moon;
  const firstName = user?.full_name?.split(" ")[0] || "there";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-secondary p-6 text-primary-foreground"
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-accent/10 -translate-y-8 translate-x-8 blur-2xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-accent/5 translate-y-6 -translate-x-6 blur-xl" />

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 border border-white/30">
            <Icon className="w-5 h-5 text-white drop-shadow-md" />
          </div>
          <span className="text-base font-heading font-semibold tracking-wide text-white/90">
            {greeting}
          </span>
        </div>
        <h1 className="text-3xl font-display font-bold mb-4 tracking-tight">{firstName}</h1>

        {/* Weather section */}
        {weatherLoading && (
          <div className="mb-4 rounded-xl bg-white/10 p-3 backdrop-blur-sm animate-pulse">
            <div className="h-4 w-24 rounded bg-white/20 mb-1.5" />
            <div className="h-3 w-16 rounded bg-white/10" />
          </div>
        )}

        {!weatherLoading && weather && (
          <div className="mb-4 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
            {/* Current conditions */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-4xl leading-none">{weather.condition.emoji}</span>
                <div>
                  <div className="text-3xl font-bold leading-none">
                    {weather.temp}{weather.unit}
                  </div>
                  <div className="text-xs text-white/70 mt-0.5">{weather.condition.label}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end text-xs text-white/70 mb-1">
                  <MapPin className="w-3 h-3" />
                  <span>{weather.city}</span>
                </div>
                <div className="text-xs text-white/60">Feels {weather.feelsLike}{weather.unit}</div>
                <div className="flex items-center gap-2 mt-1 justify-end">
                  <span className="flex items-center gap-0.5 text-[10px] text-white/50">
                    <Droplets className="w-2.5 h-2.5" />{weather.humidity}%
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] text-white/50">
                    <Wind className="w-2.5 h-2.5" />{weather.wind} km/h
                  </span>
                </div>
              </div>
            </div>

            {/* 4-day forecast */}
            <div className="flex border-t border-white/10 pt-2 gap-1">
              {weather.forecast.map((day) => (
                <ForecastDay key={day.date} day={day} />
              ))}
            </div>
          </div>
        )}

        {permState === 'idle' && !weather && !weatherLoading && (
          <div className="mb-4 rounded-xl bg-white/10 p-3 backdrop-blur-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="w-4 h-4 text-white/70 shrink-0" />
              <p className="text-xs text-white/70">Enable weather for your location</p>
            </div>
            <button
              onClick={requestLocation}
              className="shrink-0 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Enable
            </button>
          </div>
        )}

        {permState === 'denied' && (
          <p className="text-xs text-primary-foreground/50 mb-4 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Location blocked — allow it in your browser settings to see weather
          </p>
        )}

        {!weatherLoading && weatherError && weatherError !== 'denied' && (
          <p className="text-xs text-primary-foreground/50 mb-4 flex items-center gap-1">
            <MapPin className="w-3 h-3" />Weather unavailable
          </p>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
            <p className="text-2xl font-bold">{taskCount}</p>
            <p className="text-[10px] text-primary-foreground/70">Pending Tasks</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
            <p className="text-2xl font-bold">{noteCount}</p>
            <p className="text-[10px] text-primary-foreground/70">Recent Notes</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
            <p className="text-2xl font-bold">{memoryCount}</p>
            <p className="text-[10px] text-primary-foreground/70">Memories</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
