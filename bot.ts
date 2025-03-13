/**
 * Телеграм-бот для игры с кликами
 * Обрабатывает взаимодействие с пользователями и управляет системой буферизации кликов
 */
import { Bot, InlineKeyboard, session, Context, SessionFlavor } from "grammy";
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api";
import { Id } from "./convex/_generated/dataModel";

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

// Инициализация клиента Convex
const convex = new ConvexHttpClient(CONVEX_URL);

/**
 * Система буферизации кликов
 * Оптимизирует количество запросов к базе данных, накапливая клики перед отправкой
 */
// Буфер для хранения кликов по пользователям
const clickBuffer = new Map<string, number>(); 
// Интервал отправки буфера в БД (60 секунд)
const BUFFER_FLUSH_INTERVAL = 60000; 

/**
 * Добавляет клики пользователя в буфер
 * @param userId ID пользователя в Convex
 * @param amount Количество кликов для добавления (по умолчанию 1)
 */
function addClickToBuffer(userId: string, amount: number = 1) {
  const currentClicks = clickBuffer.get(userId) || 0;
  clickBuffer.set(userId, currentClicks + amount);
  console.log(`Буфер для ${userId}: ${currentClicks + amount} кликов`);
}

/**
 * Отправляет накопленные клики конкретного пользователя в базу данных
 * @param userId ID пользователя в Convex
 * @returns Promise, который разрешается когда клики отправлены
 */
async function flushUserBuffer(userId: string) {
  const clicks = clickBuffer.get(userId);
  if (!clicks) return;
  
  try {
    // Отправляем накопленные клики в БД
    await convex.mutation(api.users.addClicks, {
      userId: userId as Id<"users">,
      clicks,
      source: "buffer_flush"
    });
    console.log(`Отправлено ${clicks} кликов для пользователя ${userId}`);
    
    // Очищаем буфер этого пользователя после успешной отправки
    clickBuffer.delete(userId);
  } catch (error) {
    console.error(`Ошибка при отправке буфера для ${userId}:`, error);
  }
}

/**
 * Отправляет все накопленные клики всех пользователей в базу данных
 * Вызывается периодически и при завершении работы бота
 */
async function flushAllBuffers() {
  console.log("Выполняется отправка всех буферизованных кликов...");
  const userIds = Array.from(clickBuffer.keys());
  
  if (userIds.length === 0) {
    console.log("Буфер пуст, нет кликов для отправки");
    return;
  }
  
  for (const userId of userIds) {
    await flushUserBuffer(userId);
  }
}

// Запускаем периодическую отправку буфера раз в минуту
console.log(`Настроена буферизация кликов с интервалом отправки ${BUFFER_FLUSH_INTERVAL / 1000} секунд`);
setInterval(flushAllBuffers, BUFFER_FLUSH_INTERVAL);

// Определяем тип сессии
interface SessionData {
  lastInteraction: number;
  awaitingPromoCode: boolean;
}

// Расширяем тип контекста
type MyContext = Context & SessionFlavor<SessionData>;

// Создание и настройка экземпляра бота с правильным типом
const bot = new Bot<MyContext>(BOT_TOKEN);

// Добавление сессии для хранения состояний пользователей
bot.use(session({
  initial: (): SessionData => ({ lastInteraction: Date.now(), awaitingPromoCode: false })
}));

// Глобальный обработчик ошибок
bot.catch((err) => {
  console.error("Ошибка в работе бота:", err);
});

/**
 * Обработка команды /start
 * Инициализирует пользователя и отображает начальный интерфейс
 */
bot.command("start", async (ctx) => {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username;
  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;
  
  if (!telegramId) {
    await ctx.reply("Произошла ошибка при получении данных пользователя. Пожалуйста, попробуйте снова.");
    return;
  }

  try {
    // Определяем IP и генерируем идентификатор сессии
    const sessionId = `session_${telegramId}_${Date.now()}`;
    
    // Создаем или обновляем пользователя в базе данных
    const userResult = await convex.mutation(api.users.upsertUser, {
      telegramId,
      username,
      firstName,
      lastName,
      sessionId,
    });
    
    // Создаем игровую клавиатуру
    const keyboard = createMainKeyboard();
    
    // Приветственное сообщение зависит от того, новый это пользователь или существующий
    const welcomeMessage = userResult.isNewUser
      ? `Привет, ${firstName || "игрок"}! 👋\n\nДобро пожаловать в игру-кликер. Нажимай на кнопку, чтобы получать клики.\n\nКупи автокликер, чтобы получать клики автоматически!`
      : `С возвращением, ${firstName || "игрок"}! 👋\n\nПродолжай кликать или улучшай свой автокликер!`;
    
    await ctx.reply(welcomeMessage, { reply_markup: keyboard });
  } catch (error) {
    console.error("Ошибка при регистрации пользователя:", error);
    await ctx.reply("Произошла ошибка при подключении к серверу. Пожалуйста, попробуйте позже.");
  }
});

/**
 * Создает основную игровую клавиатуру
 */
function createMainKeyboard() {
  return new InlineKeyboard()
    .text("🎮 Играть", "menu_play")
    .text("🛍 Магазин", "menu_shop")
    .row()
    .text("📊 Статистика", "menu_stats")
    .text("🏆 Рейтинг", "menu_leaderboard")
    .row()
    .text("ℹ️ Помощь", "menu_help")
    .text("⚙️ Настройки", "menu_settings");
}

/**
 * Создает клавиатуру для игрового меню
 */
function createPlayKeyboard() {
  return new InlineKeyboard()
    .text("👆 Кликнуть", "click")
    .text("🔄 Обновить", "refresh_stats")
    .row()
    .text("⬅️ Назад", "menu_main");
}

/**
 * Создает клавиатуру для магазина
 */
function createShopKeyboard() {
  return new InlineKeyboard()
    .text("🤖 Автокликер", "buy_autoclick")
    .text("⚡️ Бустер x2", "buy_booster")
    .row()
    .text("🎲 Бонус", "daily_bonus")
    .text("🎁 Промокод", "enter_promo")
    .row()
    .text("⬅️ Назад", "menu_main");
}

/**
 * Создает клавиатуру для статистики
 */
function createStatsKeyboard() {
  return new InlineKeyboard()
    .text("📈 Общая", "stats_general")
    .text("📊 Детальная", "stats_detailed")
    .row()
    .text("📅 История", "stats_history")
    .text("🏅 Достижения", "stats_achievements")
    .row()
    .text("⬅️ Назад", "menu_main");
}

/**
 * Обработка всех нажатий на инлайн-кнопки
 */
bot.on("callback_query:data", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const telegramId = ctx.from.id;
  
  try {
    // Получаем данные пользователя
    const user = await convex.query(api.users.getUserByTelegramId, {
      telegramId,
    });
    
    if (!user) {
      await ctx.answerCallbackQuery("Произошла ошибка. Пожалуйста, начните заново с /start");
      return;
    }
    
    // Проверка на блокировку аккаунта
    if (user.banned) {
      await ctx.answerCallbackQuery("Ваш аккаунт заблокирован.");
      return;
    }
    
    // Обновляем время последнего взаимодействия
    ctx.session.lastInteraction = Date.now();
    
    // Обрабатываем различные типы действий
    switch (callbackData) {
      // Главное меню
      case "menu_main":
        await ctx.editMessageText("🎮 Главное меню", { 
          reply_markup: createMainKeyboard() 
        });
        break;

      // Игровое меню
      case "menu_play":
        await ctx.editMessageText(
          "🎮 Игровое меню\n\n" +
          `Текущий баланс: ${user.clicks + (clickBuffer.get(user._id) || 0)} кликов\n` +
          `Автокликер: ${user.autoClicksPerSecond} кликов/сек`,
          { reply_markup: createPlayKeyboard() }
        );
        break;

      // Магазин
      case "menu_shop":
        const upgradeCost = await convex.query(api.game.getUpgradeCost, {
          userId: user._id as Id<"users">,
          upgradeType: "autoclick",
        });
        await ctx.editMessageText(
          "🛍 Магазин улучшений\n\n" +
          `💰 Ваш баланс: ${user.clicks} кликов\n` +
          `🤖 Стоимость улучшения автокликера: ${upgradeCost} кликов\n` +
          `⚡️ Бустер x2 (30 минут): 1000 кликов\n` +
          `🎲 Бонус доступен через: 12:34:56`,
          { reply_markup: createShopKeyboard() }
        );
        break;

      // Статистика
      case "menu_stats":
        await ctx.editMessageText(
          "📊 Меню статистики\n\n" +
          "Выберите тип статистики:",
          { reply_markup: createStatsKeyboard() }
        );
        break;

      // Новые обработчики
      case "daily_bonus":
        await handleDailyBonus(ctx, user);
        break;

      case "enter_promo":
        await handlePromoCode(ctx, user);
        break;

      case "stats_achievements":
        await handleAchievements(ctx, user);
        break;

      case "buy_booster":
        await handleBuyBooster(ctx, user);
        break;

      case "refresh_stats":
        await handleRefreshStats(ctx, user);
        break;

      // Обработка клика
      case "click":
        const clickResult = await convex.mutation(api.users.addClicks, {
          userId: user._id,
          clicks: 1,
          source: "manual_click"
        });
        addClickToBuffer(user._id, 1);
        await ctx.answerCallbackQuery(`+1 клик (${clickBuffer.get(user._id) || 0} в буфере)`);
        break;

      // Покупка автокликера
      case "buy_autoclick":
        const upgradeResult = await convex.mutation(api.game.buyAutoClickUpgrade, {
          userId: user._id,
        });
        if (upgradeResult.success) {
          await ctx.answerCallbackQuery(
            `✅ Автокликер улучшен до ${upgradeResult.newLevel} уровня!`
          );
        } else {
          await ctx.answerCallbackQuery(
            `❌ Недостаточно кликов (нужно ${upgradeResult.cost})`
          );
        }
        break;

      // Статистика
      case "stats_general":
        const stats = await convex.query(api.game.getUserStats, {
          userId: user._id,
        });
        await ctx.editMessageText(
          "📊 Общая статистика:\n\n" +
          `Всего кликов: ${stats.totalClicks}\n` +
          `Уровень автокликера: ${stats.autoClickLevel}\n` +
          `Клики в секунду: ${stats.clicksPerSecond}`,
          { reply_markup: createStatsKeyboard() }
        );
        break;

      case "stats_detailed":
        await handleDetailedStats(ctx, user);
        break;

      case "stats_history":
        await handleStatsHistory(ctx, user);
        break;

      case "menu_leaderboard":
        const leaderboard = await convex.query(api.game.getLeaderboard, {
          limit: 10,
        });
        
        let leaderboardText = "🏆 Топ игроков:\n\n";
        leaderboard.forEach((entry, index) => {
          leaderboardText += `${index + 1}. ${entry.firstName || entry.username || 'Игрок'}: ${entry.clicks} кликов\n`;
        });
        
        await ctx.editMessageText(leaderboardText, {
          reply_markup: new InlineKeyboard().text("⬅️ Назад", "menu_main")
        });
        break;

      case "menu_help":
        await ctx.editMessageText(
          "ℹ️ Помощь по игре:\n\n" +
          "🎮 Кликайте кнопку для получения кликов\n" +
          "🤖 Купите автокликер для автоматического получения кликов\n" +
          "⚡️ Используйте бустеры для временного увеличения кликов\n" +
          "🎁 Активируйте промокоды для получения бонусов\n" +
          "🎲 Получайте ежедневный бонус\n\n" +
          "Удачной игры! 🎯",
          { reply_markup: new InlineKeyboard().text("⬅️ Назад", "menu_main") }
        );
        break;

      case "menu_settings":
        await ctx.editMessageText(
          "⚙️ Настройки\n\n" +
          "🔧 Раздел в разработке",
          { reply_markup: new InlineKeyboard().text("⬅️ Назад", "menu_main") }
        );
        break;
    }
  } catch (error) {
    // Обработка различных типов ошибок
    if (error instanceof Error && error.message.includes("message is not modified")) {
      await ctx.answerCallbackQuery("Контент не изменился");
    } else {
      console.error("Ошибка при обработке запроса:", error);
      await ctx.answerCallbackQuery("Произошла ошибка. Пожалуйста, попробуйте снова.");
    }
  }
});

/**
 * Обработчик ежедневного бонуса
 */
async function handleDailyBonus(ctx: any, user: any) {
  const bonusResult = await convex.mutation(api.game.claimDailyBonus, {
    userId: user._id as Id<"users">
  });

  if (bonusResult.success) {
    await ctx.answerCallbackQuery(
      `Получен бонус: ${bonusResult.amount} кликов!`
    );
  } else {
    await ctx.answerCallbackQuery(
      `Бонус будет доступен через: ${bonusResult.timeLeft}`
    );
  }
}

/**
 * Обработчик достижений
 */
async function handleAchievements(ctx: any, user: any) {
  const achievements = await convex.query(api.game.getUserAchievements, {
    userId: user._id as Id<"users">
  });

  let text = "🏅 Ваши достижения:\n\n";
  achievements.forEach((achievement: any) => {
    text += `${achievement.completed ? "✅" : "❌"} ${achievement.name}\n`;
    text += `└ ${achievement.description}\n\n`;
  });

  await ctx.editMessageText(text, {
    reply_markup: createStatsKeyboard()
  });
}

/**
 * Обработчик промокодов
 */
async function handlePromoCode(ctx: any, user: any) {
  // Создаем клавиатуру для отмены
  const cancelKeyboard = new InlineKeyboard()
    .text("❌ Отмена", "menu_shop");
    
  await ctx.editMessageText(
    "🎁 Введите промокод:\n\n" +
    "Отправьте промокод в следующем сообщении или нажмите отмену.",
    { reply_markup: cancelKeyboard }
  );
  
  // Устанавливаем флаг ожидания промокода
  ctx.session.awaitingPromoCode = true;
}

/**
 * Обработчик покупки бустера
 */
async function handleBuyBooster(ctx: any, user: any) {
  try {
    const result = await convex.mutation(api.game.buyBooster, {
      userId: user._id as Id<"users">
    });
    
    if (result.success) {
      await ctx.answerCallbackQuery(
        `✅ Бустер x2 активирован на 30 минут!`
      );
    } else {
      await ctx.answerCallbackQuery(
        result.timeLeft 
          ? `⏳ У вас уже есть активный бустер (${Math.floor(result.timeLeft / 60)}м)`
          : `❌ Недостаточно кликов (нужно ${result.cost})`
      );
    }
  } catch (error) {
    await ctx.answerCallbackQuery("❌ Ошибка при покупке бустера");
  }
}

/**
 * Обработчик обновления статистики
 */
async function handleRefreshStats(ctx: any, user: any) {
  try {
    // Получаем актуальные данные пользователя
    const updatedUser = await convex.query(api.users.getUserByTelegramId, {
      telegramId: user.telegramId,
    });
    
    if (!updatedUser) {
      throw new Error("Пользователь не найден");
    }
    
    // Получаем статус бустера
    const boosterStatus = await convex.query(api.game.getBoosterStatus, {
      userId: updatedUser._id as Id<"users">
    });
    
    await ctx.editMessageText(
      "🎮 Игровое меню\n\n" +
      `💰 Баланс: ${updatedUser.clicks + (clickBuffer.get(updatedUser._id) || 0)} кликов\n` +
      `🤖 Автокликер: ${updatedUser.autoClicksPerSecond} кликов/сек\n` +
      (boosterStatus.active 
        ? `⚡️ Бустер x${boosterStatus.multiplier} (${Math.floor(boosterStatus.timeLeft! / 60)}м)\n`
        : ""),
      { reply_markup: createPlayKeyboard() }
    );
    
    await ctx.answerCallbackQuery("✅ Статистика обновлена");
  } catch (error) {
    await ctx.answerCallbackQuery("❌ Ошибка при обновлении");
  }
}

/**
 * Обработчик детальной статистики
 */
async function handleDetailedStats(ctx: any, user: any) {
  const stats = await convex.query(api.game.getUserDetailedStats, {
    userId: user._id,
  });
  
  await ctx.editMessageText(
    "📊 Детальная статистика:\n\n" +
    `Всего кликов: ${stats.totalClicks}\n` +
    `Ручные клики: ${stats.manualClicks}\n` +
    `Авто клики: ${stats.autoClicks}\n` +
    `Бонусные клики: ${stats.bonusClicks}\n` +
    `Серия бонусов: ${stats.bonusStreak || 0}`,
    { reply_markup: createStatsKeyboard() }
  );
}

/**
 * Обработчик истории действий
 */
async function handleStatsHistory(ctx: any, user: any) {
  const history = await convex.query(api.game.getUserHistory, {
    userId: user._id,
  });
  
  const historyText = history
    .map((entry: any) => `${entry.event}: ${entry.value} (${new Date(entry.timestamp).toLocaleString()})`)
    .join('\n');
  
  await ctx.editMessageText(
    "📅 История действий:\n\n" + historyText,
    { reply_markup: createStatsKeyboard() }
  );
}

// Запускаем бота
bot.start();
console.log("Бот запущен и готов к работе!");

// Обработка завершения работы
process.on('SIGINT', async () => {
  console.log('Сохранение буферизованных кликов перед выходом...');
  await flushAllBuffers();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Получен сигнал завершения, сохраняем данные...');
  await flushAllBuffers();
  process.exit(0);
});