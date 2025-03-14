import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";

// Настройка регулярных заданий
const crons = cronJobs();

// Запуск процесса производства каждую минуту
crons.interval(
  "process-production",
  { minutes: 1 },
  internal.autoclick.processProduction,
  {}
);

// Проверка статуса бустеров каждые 5 минут
crons.interval(
  "check-boosters-status",
  { minutes: 5 },
  internal.autoclick.checkBoostersStatus,
  {}
);

// Добавление бонусов со спутников каждые 30 минут
crons.interval(
  "satellite-bonus",
  { minutes: 30 },
  internal.satellites.processSatelliteBonus,
  {}
);

// Сброс ежедневных бонусов в полночь
crons.cron(
  "reset-daily-bonuses",
  "0 0 * * *", // Каждый день в полночь
  internal.production.resetDailyBonuses,
  {}
);

// Обновление рейтинга каждый час
crons.interval(
  "update-leaderboard",
  { hours: 1 },
  internal.leaderboard.updateLeaderboard,
  {}
);

export default crons;
