import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Настройка регулярных заданий
const crons = cronJobs();

// Запуск процесса автокликов каждую минуту
crons.interval("process-autoclicks", { minutes: 1 }, internal.autoclick.processAutoClicks, {});

// Сброс бустеров и проверка достижений каждые 5 минут
crons.interval(
  "check-boosters-and-achievements",
  { minutes: 5 },
  internal.game.checkBoostersAndAchievements,
  {}
);

// Сброс серии ежедневных бонусов в полночь
crons.cron(
  "reset-daily-bonuses",
  "0 0 * * *", // Каждый день в полночь
  internal.game.resetDailyBonuses,
  {}
);

export default crons;