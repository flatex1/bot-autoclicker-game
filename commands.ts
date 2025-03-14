/**
 * Обработчики команд бота
 * Содержит функции для обработки текстовых команд
 */
import { api } from "./convex/_generated/api.js";
import { BotContext } from "./types.js";
import { getMainKeyboard } from "./keyboards.js";
import { showCabinet, showComplexesMenu, showBoostersMenu, showLeaderboard } from "./menus.js";

// Обработка команды /start
export async function handleStartCommand(ctx: BotContext) {
  try {
    // Получаем данные пользователя из Telegram
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username;
    const firstName = ctx.from?.first_name;
    const lastName = ctx.from?.last_name;
    
    // Создаем или обновляем пользователя в базе данных
    const result = await ctx.convex.mutation(api.users.upsertUser, {
      telegramId: telegramId!,
      username,
      firstName,
      lastName
    });
    
    // Сохраняем ID пользователя в сессии
    ctx.session.userId = result.userId;
    
    // Отправляем приветственное сообщение
    if (result.isNewUser) {
      // Отправляем изображение КОЛЛЕКТИВ-1 с текстом
      const { InputFile } = await import("grammy");
      await ctx.replyWithPhoto(
        new InputFile("./public/assets/complex_kollektiv.png"),
        {
          caption: `🌟 *Добро пожаловать в "Атомный Прогресс"!* 🌟\n\n` +
          `Товарищ ${firstName}, вы начинаете путь к научному превосходству! Ваш первый комплекс КОЛЛЕКТИВ-1 уже работает и производит 1 Энергон в секунду.\n\n` +
          `Используйте кнопку ниже, чтобы производить энергию вручную и развивать свою научную империю!`,
          parse_mode: "Markdown",
          reply_markup: getMainKeyboard()
        }
      );
    } else {
      const userStatus = await ctx.convex.query(api.game.getUserStatus, {
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
}

// Обработка команды /cabinet
export async function handleCabinetCommand(ctx: BotContext) {
  await showCabinet(ctx);
}

// Обработка команды /complexes
export async function handleComplexesCommand(ctx: BotContext) {
  await showComplexesMenu(ctx);
}

// Обработка команды /boosters
export async function handleBoostersCommand(ctx: BotContext) {
  await showBoostersMenu(ctx);
}

// Обработка команды /daily - ежедневный бонус
export async function handleDailyCommand(ctx: BotContext) {
  try {
    if (!ctx.session.userId) {
      return ctx.reply("Пожалуйста, начните с команды /start");
    }
    
    const result = await ctx.convex.mutation(api.users.claimDailyBonus, {
      userId: ctx.session.userId
    });
    
    if (result.success) {
      await ctx.reply(
        `🎁 Поздравляем! Вы получили ежедневный бонус: +${result.amount} Энергонов!\n` +
        `🔥 Серия: ${result.streak || 0} ${result.streak && result.streak > 1 ? 'дней' : 'день'} подряд`,
        {
          reply_markup: getMainKeyboard()
        }
      );
    } else {
      await ctx.reply(
        "🕒 Вы уже получили свой ежедневный бонус!\n\n" +
        "Возвращайтесь завтра для получения нового бонуса.",
        {
          reply_markup: getMainKeyboard()
        }
      );
    }
  } catch (error) {
    console.error("Ошибка при получении ежедневного бонуса:", error);
    await ctx.reply("Произошла ошибка при получении бонуса. Пожалуйста, попробуйте позже.");
  }
}

// Обработка команды /leaderboard
export async function handleLeaderboardCommand(ctx: BotContext) {
  await showLeaderboard(ctx, "energons");
}

// Обработка команды /help
export async function handleHelpCommand(ctx: BotContext) {
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
    "/cabinet - Ваш научный кабинет\n" +
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
}