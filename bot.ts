/**
 * Телеграм-бот для игры "Атомный Прогресс"
 * Обрабатывает взаимодействие с пользователями и управляет игровым процессом
 */
import { Bot, InlineKeyboard, session, Context, SessionFlavor } from "grammy";
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import { Id } from "./convex/_generated/dataModel.js";

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

// Интерфейс для сессии пользователя
interface SessionData {
  userId?: Id<"users">;
  state?: string;
  data?: any;
}

// Расширяем контекст бота, включая сессию
type BotContext = Context & SessionFlavor<SessionData>;

// Создаем экземпляр бота
const bot = new Bot<BotContext>(BOT_TOKEN);

// Буфер для кликов (оптимизация обращений к базе данных)
const clickBuffer: Record<string, { count: number, lastFlush: number }> = {};
const CLICK_BUFFER_LIMIT = 10; // Сколько кликов накапливать перед отправкой
const CLICK_BUFFER_TIMEOUT = 5000; // Таймаут в мс для авто-отправки

// Настраиваем хранение сессий
bot.use(session({
  initial: (): SessionData => ({
    state: "idle",
    data: {}
  })
}));

// Обработка команды /start
bot.command("start", async (ctx) => {
  try {
    // Получаем данные пользователя из Telegram
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username;
  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;
    
    // Создаем или обновляем пользователя в базе данных
    const result = await convex.mutation(api.users.upsertUser, {
      telegramId: telegramId!,
      username,
      firstName,
      lastName
    });
    
    // Сохраняем ID пользователя в сессии
    ctx.session.userId = result.userId;
    
    // Отправляем приветственное сообщение
    if (result.isNewUser) {
      await ctx.reply(
        `🌟 *Добро пожаловать в "Атомный Прогресс"!* 🌟\n\n` +
        `Товарищ ${firstName}, вы начинаете путь к научному превосходству! Ваш первый комплекс КОЛЛЕКТИВ-1 уже работает и производит 1 Энергон в секунду.\n\n` +
        `Используйте кнопку ниже, чтобы производить энергию вручную и развивать свою научную империю!`,
        {
          parse_mode: "Markdown",
          reply_markup: getMainKeyboard()
        }
      );
    } else {
      const userStatus = await convex.query(api.game.getUserStatus, {
        userId: result.userId
      });
      
      await ctx.reply(
        `С возвращением, товарищ ${firstName}!\n\n` +
        `💡 У вас ${userStatus.energons} Энергонов\n` +
        `⚛️ Производство: ${userStatus.totalProduction} ед./сек\n` +
        `⚡ Мощность клика: ${userStatus.clickPower} Энергонов`,
        {
          reply_markup: getMainKeyboard()
        }
      );
    }
  } catch (error) {
    console.error("Ошибка при обработке команды /start:", error);
    await ctx.reply("Произошла ошибка при подключении к научной базе. Пожалуйста, попробуйте позже.");
  }
});

// Обработка команды /profile - статистика пользователя
bot.command("profile", async (ctx) => {
  try {
    if (!ctx.session.userId) {
      return ctx.reply("Пожалуйста, начните с команды /start");
    }
    
    const user = await convex.query(api.users.getUserByTelegramId, {
      telegramId: ctx.from?.id!
    });
    
    if (!user) {
      return ctx.reply("Ваш профиль не найден. Пожалуйста, используйте /start для регистрации.");
    }
    
    const userStatus = await convex.query(api.game.getUserStatus, {
      userId: ctx.session.userId
    });
    
    let boosterInfo = "";
    if (userStatus.activeBooster) {
      const minutes = Math.floor(userStatus.activeBooster.timeLeft / 60);
      const seconds = userStatus.activeBooster.timeLeft % 60;
      boosterInfo = `\n\n🚀 *Активный бустер:* ${userStatus.activeBooster.name}\n` +
                    `⏱ Осталось времени: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    await ctx.reply(
      `📊 *Профиль научного сотрудника*\n\n` +
      `👤 *${user.firstName || "Товарищ"}*\n` +
      `💡 *Энергоны:* ${userStatus.energons}\n` +
      `🔬 *Нейтроны:* ${userStatus.neutrons}\n` +
      `✨ *Квантовые частицы:* ${userStatus.particles}\n\n` +
      `⚡ *Мощность клика:* ${userStatus.clickPower}\n` +
      `⚛️ *Производство:* ${userStatus.totalProduction} ед./сек${boosterInfo}`,
      {
        parse_mode: "Markdown",
        reply_markup: getMainKeyboard()
      }
    );
  } catch (error) {
    console.error("Ошибка при получении профиля:", error);
    await ctx.reply("Произошла ошибка при загрузке профиля. Пожалуйста, попробуйте позже.");
  }
});

// Обработка команды /complexes - просмотр и улучшение комплексов
bot.command("complexes", async (ctx) => {
  try {
    if (!ctx.session.userId) {
      return ctx.reply("Пожалуйста, начните с команды /start");
    }
    
    await showComplexesMenu(ctx);
  } catch (error) {
    console.error("Ошибка при загрузке комплексов:", error);
    await ctx.reply("Произошла ошибка при доступе к научным комплексам. Пожалуйста, попробуйте позже.");
  }
});

// Обработка команды /boosters - управление бустерами
bot.command("boosters", async (ctx) => {
  try {
    if (!ctx.session.userId) {
      return ctx.reply("Пожалуйста, начните с команды /start");
    }
    
    await showBoostersMenu(ctx);
  } catch (error) {
    console.error("Ошибка при загрузке бустеров:", error);
    await ctx.reply("Произошла ошибка при доступе к разработкам. Пожалуйста, попробуйте позже.");
  }
});

// Обработка команды /daily - ежедневный бонус
bot.command("daily", async (ctx) => {
  try {
    if (!ctx.session.userId) {
      return ctx.reply("Пожалуйста, начните с команды /start");
    }
    
    const user = await convex.query(api.users.getUserByTelegramId, {
      telegramId: ctx.from?.id!
    });
    
    if (user?.dailyBonusClaimed) {
      await ctx.reply(
        "🕒 Вы уже получили свой ежедневный бонус!\n\n" +
        "Возвращайтесь завтра для получения нового бонуса.",
        {
          reply_markup: getMainKeyboard()
        }
          );
        } else {
      // Логика получения ежедневного бонуса будет здесь
      await ctx.reply(
        "🎁 Поздравляем! Вы получили ежедневный бонус: +500 Энергонов!",
        {
          reply_markup: getMainKeyboard()
        }
      );
    }
  } catch (error) {
    console.error("Ошибка при получении ежедневного бонуса:", error);
    await ctx.reply("Произошла ошибка при получении бонуса. Пожалуйста, попробуйте позже.");
  }
});

// Обработка команды /leaderboard - рейтинг игроков
bot.command("leaderboard", handleLeaderboardCommand);

// Обработка команды /help - справка по игре
bot.command("help", async (ctx) => {
  await ctx.reply(
    "📚 *Справка по игре «Атомный Прогресс»* 📚\n\n" +
    "🔬 *Основы игры:*\n" +
    "• Нажимайте на кнопку «⚛️ Расщепить атом» для получения Энергонов\n" +
    "• Используйте Энергоны для строительства и улучшения научных комплексов\n" +
    "• Комплексы автоматически производят ресурсы даже когда вы не в игре\n\n" +
    
    "🏭 *Научные комплексы:*\n" +
    "• КОЛЛЕКТИВ-1: Базовый генератор Энергонов\n" +
    "• ЗАРЯ-М: Увеличивает производство всех Энергонов\n" +
    "• СОЮЗ-АТОМ: Производит Нейтроны для продвинутых исследований\n" +
    "• КРАСНЫЙ ЦИКЛОТРОН: Увеличивает эффективность кликов\n" +
    "• АКАДЕМГОРОД-17: Обучает научных сотрудников\n" +
    "• СПУТНИК-ГАММА: Дает бонусы каждые 30 минут\n" +
    "• КВАНТ-СИБИРЬ: Генерирует Квантовые Частицы\n\n" +
    
    "🔧 *Команды:*\n" +
    "/start - Начать игру\n" +
    "/profile - Ваш научный профиль\n" +
    "/complexes - Ваши научные комплексы\n" +
    "/boosters - Временные усиления\n" +
    "/daily - Ежедневный бонус\n" +
    "/leaderboard - Рейтинг научных империй\n" +
    "/help - Эта справка\n\n" +
    
    "Удачи в построении великой научной империи! 🚀",
    {
      parse_mode: "Markdown",
      reply_markup: getMainKeyboard()
    }
  );
});

// Базовая клавиатура для основных действий
function getMainKeyboard() {
  return new InlineKeyboard()
    .row().text("⚛️ Расщепить атом", "click_atom")
    .row()
      .text("🏭 Комплексы", "show_complexes")
      .text("👤 Профиль", "show_profile")
    .row()
      .text("🚀 Разработки", "show_boosters")
      .text("📊 Рейтинг", "show_leaderboard");
}

// Обработка колбэков от инлайн кнопок
bot.on("callback_query:data", async (ctx) => {
  try {
    if (!ctx.session.userId) {
      return ctx.answerCallbackQuery("Необходимо начать игру с команды /start");
    }
    
    const callbackData = ctx.callbackQuery.data;
    
    // Обработка клика по атому
    if (callbackData === "click_atom") {
      const userId = ctx.session.userId;
      const userIdStr = userId.toString();
      
      // Используем буфер для оптимизации запросов
      if (!clickBuffer[userIdStr]) {
        clickBuffer[userIdStr] = { count: 0, lastFlush: Date.now() };
      }
      
      // Увеличиваем счетчик кликов в буфере
      clickBuffer[userIdStr].count++;
      
      // Проверяем, нужно ли отправить клики на сервер
      const shouldFlush = 
        clickBuffer[userIdStr].count >= CLICK_BUFFER_LIMIT || 
        Date.now() - clickBuffer[userIdStr].lastFlush > CLICK_BUFFER_TIMEOUT;
      
      if (shouldFlush) {
        const clickCount = clickBuffer[userIdStr].count;
        
        // Получаем информацию о мощности клика пользователя
        const userStatus = await convex.query(api.game.getUserStatus, {
          userId: ctx.session.userId
        });
        
        // Рассчитываем, сколько ресурсов получит пользователь за клики
        const energonsToAdd = Math.floor(clickCount * userStatus.clickPower);
        
        // Отправляем клики на сервер
        await convex.mutation(api.users.addResources, {
          userId,
          energons: energonsToAdd,
          neutrons: 0,
          particles: 0,
          source: "manual_click"
        });
        
        // Сбрасываем буфер
        clickBuffer[userIdStr] = { count: 0, lastFlush: Date.now() };
        
        // Отправляем уведомление
        await ctx.answerCallbackQuery(`⚡ +${energonsToAdd} энергонов!`);
      } else {
        // Просто подтверждаем клик
        await ctx.answerCallbackQuery("⚛️ Атом расщеплен!");
      }
      return;
    }
    
    // Обработка других кнопок меню
    if (callbackData === "show_complexes") {
      await showComplexesMenu(ctx);
      return;
    }
    
    if (callbackData === "show_profile") {
      await ctx.reply("/profile");
      return;
    }
    
    if (callbackData === "show_boosters") {
      await showBoostersMenu(ctx);
      return;
    }
    
    if (callbackData === "show_leaderboard") {
      await ctx.deleteMessage();
      await ctx.reply("Загружаю рейтинг...");
      await handleLeaderboardCommand(ctx);
      return;
    }
    
    // Если мы дошли сюда, значит колбэк не обработан
    await ctx.answerCallbackQuery("Неизвестная команда");
  } catch (error) {
    console.error("Ошибка при обработке колбэка:", error);
    await ctx.answerCallbackQuery("Произошла ошибка");
  }
});

// Показать меню научных комплексов
async function showComplexesMenu(ctx: BotContext) {
  try {
    // Получаем все доступные комплексы пользователя
    const complexes = await convex.query(api.game.getUserComplexes, {
      userId: ctx.session.userId!
    });
    
    // Сортируем комплексы по порядку открытия
    const sortedComplexes = [
      "KOLLEKTIV-1", "ZARYA-M", "SOYUZ-ATOM", "KRASNIY-CIKLOTRON", 
      "AKADEMGOROD-17", "SPUTNIK-GAMMA", "KVANT-SIBIR", "MATERIYA-3", 
      "MOZG-MACHINA", "POLYUS-K88"
    ];
    
    const keyboard = new InlineKeyboard();
    
    let messageText = "🏭 *Ваши научные комплексы:*\n\n";
    
    // Добавляем информацию о каждом комплексе
    for (const complexType of sortedComplexes) {
      const complex = complexes.find(c => c.type === complexType);
      
      if (complex) {
        // Комплекс уже открыт
        messageText += `*${complex.name}* (Ур. ${complex.level})\n`;
        messageText += `⚡ Производит: ${complex.production} ед./сек\n\n`;
        
        // Добавляем кнопку улучшения
        keyboard.row().text(
          `🔧 Улучшить ${complex.name} (${complex.upgradeCost} Э)`, 
          `upgrade_complex:${complexType}`
    );
  } else {
        // Комплекс еще не открыт
        const complexInfo = await convex.query(api.game.getComplexUpgradeCost, {
          userId: ctx.session.userId!,
          complexType
        });
        
        if (complexInfo.isUnlocked) {
          // Комплекс доступен для покупки
          messageText += `*${complexInfo.name}* (Не построен)\n`;
          messageText += `🔓 Доступен для строительства\n\n`;
          
          keyboard.row().text(
            `🏗 Построить ${complexInfo.name} (${complexInfo.energonCost} Э)`,
            `buy_complex:${complexType}`
          );
        } else if (complexInfo.requiredComplex) {
          // Комплекс заблокирован, показываем требования
          messageText += `🔒 *${complexInfo.name}*\n`;
          messageText += `Требуется: ${complexInfo.requiredComplex} ур. ${complexInfo.requiredLevel}\n\n`;
        }
      }
    }
    
    // Добавляем кнопку возврата
    keyboard.row().text("⬅️ Назад", "back_to_main");
    
    await ctx.reply(messageText, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  } catch (error) {
    console.error("Ошибка при отображении комплексов:", error);
    await ctx.reply("Произошла ошибка при загрузке комплексов. Пожалуйста, попробуйте позже.");
  }
}

// Показать меню бустеров
async function showBoostersMenu(ctx: BotContext) {
  try {
    // Получаем доступные бустеры и статус пользователя
    const userStatus = await convex.query(api.game.getUserStatus, {
      userId: ctx.session.userId!
    });
    
    const boosters = await convex.query(api.game.getAvailableBoosters, {
      userId: ctx.session.userId!
    });
    
    let messageText = "🚀 *Научные разработки (бустеры):*\n\n";
    
    // Добавляем информацию об активном бустере, если есть
    if (userStatus.activeBooster) {
      const minutes = Math.floor(userStatus.activeBooster.timeLeft / 60);
      const seconds = userStatus.activeBooster.timeLeft % 60;
      
      messageText += `*Активная разработка:* ${userStatus.activeBooster.name}\n`;
      messageText += `⏱ Осталось времени: ${minutes}:${seconds.toString().padStart(2, '0')}\n\n`;
    } else {
      messageText += "*Нет активных разработок*\n\n";
    }
    
    messageText += "Доступные разработки:\n\n";
    
    const keyboard = new InlineKeyboard();
    
    // Добавляем каждый доступный бустер
    for (const booster of boosters) {
      messageText += `🔬 *${booster.name}*\n`;
      messageText += `${booster.description}\n`;
      
      let costText = `${booster.cost.energons} Э`;
      if (booster.cost.neutrons) costText += ` + ${booster.cost.neutrons} Н`;
      if (booster.cost.particles) costText += ` + ${booster.cost.particles} КЧ`;
      
      messageText += `💰 Стоимость: ${costText}\n\n`;
      
      // Проверяем, хватает ли ресурсов
      let canAfford = userStatus.energons >= booster.cost.energons;
      if (booster.cost.neutrons) canAfford = canAfford && userStatus.neutrons >= booster.cost.neutrons;
      if (booster.cost.particles) canAfford = canAfford && userStatus.particles >= booster.cost.particles;
      
      if (canAfford && !userStatus.activeBooster) {
        keyboard.row().text(`Активировать ${booster.name}`, `activate_booster:${booster.type}`);
      }
    }
    
    // Кнопка возврата
    keyboard.row().text("⬅️ Назад", "back_to_main");
    
    await ctx.reply(messageText, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  } catch (error) {
    console.error("Ошибка при отображении бустеров:", error);
    await ctx.reply("Произошла ошибка при загрузке разработок. Пожалуйста, попробуйте позже.");
  }
}

// Обработка всех остальных сообщений
bot.on("message", async (ctx) => {
  try {
    // Если сообщение не обработано другими обработчиками
    if (!ctx.session.userId) {
      await ctx.reply("Добро пожаловать! Пожалуйста, начните игру с команды /start");
      return;
    }
    
    if (ctx.message.text) {
      await ctx.reply(
        "Используйте кнопки или команды для взаимодействия с научными системами.\n\n" +
        "Для получения справки введите /help",
        {
          reply_markup: getMainKeyboard()
        }
      );
    }
  } catch (error) {
    console.error("Ошибка при обработке сообщения:", error);
  }
});

// Функция для периодического сброса буфера кликов
function flushClickBuffers() {
  const now = Date.now();
  
  for (const userIdStr in clickBuffer) {
    const buffer = clickBuffer[userIdStr];
    
    if (buffer.count > 0 && now - buffer.lastFlush > CLICK_BUFFER_TIMEOUT) {
      try {
        // Отправляем накопленные клики
        convex.mutation(api.users.addResources, {
          userId: userIdStr as Id<"users">,
          energons: buffer.count,
          neutrons: 0,
          particles: 0,
          source: "manual_click"
        });
        
        // Сбрасываем буфер
        clickBuffer[userIdStr] = { count: 0, lastFlush: now };
      } catch (error) {
        console.error(`Ошибка при сбросе буфера кликов для ${userIdStr}:`, error);
      }
    }
  }
  
  // Повторяем каждые 10 секунд
  setTimeout(flushClickBuffers, 10000);
}

// Запускаем периодический сброс буфера
flushClickBuffers();

// Устанавливаем вебхук или запускаем поллинг в зависимости от конфигурации
if (process.env.NODE_ENV === "production" && process.env.WEBHOOK_URL) {
  const webhookUrl = process.env.WEBHOOK_URL;
  console.log(`Устанавливаем вебхук на ${webhookUrl}`);
  
  bot.api.setWebhook(webhookUrl);
} else {
  console.log("Запускаем бота в режиме поллинга");
  bot.start();
}

// Добавьте функцию в верхней части файла
async function handleLeaderboardCommand(ctx: BotContext) {
  try {
    if (!ctx.session.userId) {
      return ctx.reply("Пожалуйста, начните с команды /start");
    }
    
    const leaderboard = await convex.query(api.game.getUsersLeaderboard, {
      limit: 10 // Показываем топ-10 игроков
    });
    
    if (leaderboard.length === 0) {
      return ctx.reply("Рейтинг пока формируется. Попробуйте позже.");
    }
    
    let leaderboardText = "🏆 *ТОП НАУЧНЫХ ИМПЕРИЙ* 🏆\n\n";
    
    leaderboard.forEach((entry: any, index: number) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
      const name = entry.firstName || entry.username || "Ученый";
      leaderboardText += `${medal} *${name}*\n`;
      leaderboardText += `⚛️ ${entry.totalProduction} ед/сек | 💡 ${entry.energons} энергонов\n\n`;
    });
    
    // Добавляем позицию текущего пользователя, если он не в топе
    const userPosition = await convex.query(api.game.getUserLeaderboardPosition, { 
      userId: ctx.session.userId 
    });
    
    if (userPosition && userPosition.position > 10) {
      leaderboardText += `...\n*Ваша позиция:* #${userPosition.position}\n`;
      leaderboardText += `⚛️ ${userPosition.totalProduction} ед/сек | 💡 ${userPosition.energons} энергонов`;
    }
    
    await ctx.reply(leaderboardText, {
      parse_mode: "Markdown",
      reply_markup: getMainKeyboard()
    });
  } catch (error) {
    console.error("Ошибка при получении рейтинга:", error);
    await ctx.reply("Произошла ошибка при загрузке рейтинга. Пожалуйста, попробуйте позже.");
  }
}

export default bot;