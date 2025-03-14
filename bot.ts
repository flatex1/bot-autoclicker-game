/**
 * Телеграм-бот для игры "Атомный Прогресс"
 * Обрабатывает взаимодействие с пользователями и управляет игровым процессом
 */
import { Bot, session, Context } from "grammy";
import { ConvexHttpClient } from "convex/browser";
import { BotContext, SessionData } from "./types.js";
import { 
  handleStartCommand,
  handleCabinetCommand,
  handleComplexesCommand,
  handleBoostersCommand,
  handleDailyCommand,
  handleLeaderboardCommand,
  handleHelpCommand
} from "./commands.js";
import { handleCallbacks } from "./callbacks.js";

// Получаем токен и URL из переменных окружения
const BOT_TOKEN = process.env.BOT_TOKEN;
const CONVEX_URL = process.env.CONVEX_URL;

// Проверяем наличие необходимых переменных окружения
if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN не определен в переменных окружения");
}

if (!CONVEX_URL) {
  throw new Error("CONVEX_URL не определен в переменных окружения");
}

// Создаем клиент для взаимодействия с Convex
const convex = new ConvexHttpClient(CONVEX_URL);

// Создаем экземпляр бота
const bot = new Bot<BotContext>(BOT_TOKEN);

// Добавляем Convex клиент в контекст бота
bot.use((ctx, next) => {
  ctx.convex = convex;
  return next();
});

// Настраиваем хранение сессий
bot.use(session({
  initial: (): SessionData => ({
    state: "idle",
    data: {}
  })
}));

// Регистрируем обработчики команд
bot.command("start", handleStartCommand);
bot.command("cabinet", handleCabinetCommand);
bot.command("complexes", handleComplexesCommand);
bot.command("boosters", handleBoostersCommand);
bot.command("daily", handleDailyCommand);
bot.command("leaderboard", handleLeaderboardCommand);
bot.command("help", handleHelpCommand);

// Обработка колбэков от инлайн-кнопок
bot.on("callback_query:data", handleCallbacks);

// Запускаем бота
console.log("Телеграм-бот запущен и ожидает подключений...");
bot.start();

// Функция для остановки бота при завершении работы
export function stopBot() {
  console.log("Останавливаем бота...");
  bot.stop();
}