/**
 * Обработчики колбэков от инлайн кнопок
 * Содержит функции для обработки нажатий на кнопки бота
 */
import { api } from "./convex/_generated/api.js";
import { BotContext } from "./types.js";
import { showCabinet, showComplexesMenu, showBoostersMenu, showLeaderboard, showComplexDetails, showComplexBuyDetails, showAvailableComplexes } from "./menus.js";
import { getMainKeyboard } from "./keyboards.js";

// Буфер для кликов (оптимизация обращений к базе данных)
const clickBuffer: Record<string, { count: number, lastFlush: number }> = {};
const CLICK_BUFFER_LIMIT = 10; // Сколько кликов накапливать перед отправкой
const CLICK_BUFFER_TIMEOUT = 5000; // Таймаут в мс для авто-отправки

// Обработка клика по атому
export async function handleAtomClick(ctx: BotContext) {
  const userId = ctx.session.userId;
  if (!userId) {
    return ctx.answerCallbackQuery("Необходимо начать игру с команды /start");
  }
  
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
    const userStatus = await ctx.convex.query(api.game.getUserStatus, {
      userId
    });
    
    // Рассчитываем, сколько ресурсов получит пользователь за клики
    const energonsToAdd = Math.floor(clickCount * userStatus.clickPower);
    
    // Отправляем клики на сервер
    await ctx.convex.mutation(api.users.addResources, {
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
}

// Обработка улучшения комплекса
export async function handleUpgradeComplex(ctx: BotContext, complexType: string) {
  try {
    const result = await ctx.convex.mutation(api.complexes.upgradeComplex, {
      userId: ctx.session.userId!,
      complexType
    });
    
    if (result.success) {
      await ctx.answerCallbackQuery(`🔧 Комплекс улучшен до уровня ${result.newLevel}!`);
      // Обновляем меню комплексов
      await showComplexesMenu(ctx);
    } else {
      await ctx.answerCallbackQuery(`❌ ${result.error}`);
    }
  } catch (error) {
    console.error("Ошибка при улучшении комплекса:", error);
    await ctx.answerCallbackQuery("Произошла ошибка при улучшении комплекса");
  }
}

// Обработка покупки комплекса
export async function handleBuyComplex(ctx: BotContext, complexType: string) {
  try {
    const result = await ctx.convex.mutation(api.complexes.buyComplex, {
      userId: ctx.session.userId!,
      complexType
    });
    
    if (result.success) {
      await ctx.answerCallbackQuery(`🏗 Комплекс ${complexType} построен!`);
      // Возвращаемся к меню комплексов
      await showComplexesMenu(ctx);
    } else {
      await ctx.answerCallbackQuery(`❌ ${result.error}`);
    }
  } catch (error) {
    console.error("Ошибка при покупке комплекса:", error);
    await ctx.answerCallbackQuery("Произошла ошибка при покупке комплекса");
  }
}

// Обработка активации бустера
export async function handleActivateBooster(ctx: BotContext, boosterType: string) {
  try {
    const result = await ctx.convex.mutation(api.boosters.activateBooster, {
      userId: ctx.session.userId!,
      boosterType
    });
    
    if (result.success) {
      await ctx.answerCallbackQuery(`🚀 Бустер активирован!`);
      // Обновляем меню бустеров
      await showBoostersMenu(ctx);
    } else {
      await ctx.answerCallbackQuery(`❌ ${result.error}`);
    }
  } catch (error) {
    console.error("Ошибка при активации бустера:", error);
    await ctx.answerCallbackQuery("Произошла ошибка при активации бустера");
  }
}

// Обработка всех колбэков
export async function handleCallbacks(ctx: BotContext) {
  try {
    if (!ctx.session.userId) {
      return ctx.answerCallbackQuery("Необходимо начать игру с команды /start");
    }
    
    const callbackData = ctx.callbackQuery?.data;

    if (!callbackData) {
      return ctx.answerCallbackQuery("Некорректный формат запроса (callbackData is undefined)");
    }
    
    // Обработка клика по атому
    if (callbackData === "click_atom") {
      await handleAtomClick(ctx);
      return;
    }
    
    // Обработка кнопок меню
    if (callbackData === "show_complexes") {
      await showComplexesMenu(ctx);
      return;
    }
    
    if (callbackData === "show_cabinet") {
      await showCabinet(ctx);
      return;
    }
    
    if (callbackData === "show_boosters") {
      await showBoostersMenu(ctx);
      return;
    }
    
    if (callbackData === "show_leaderboard") {
      await ctx.deleteMessage();
      await showLeaderboard(ctx, "energons");
      return;
    }
    
    // Возврат в главное меню
    if (callbackData === "back_to_main") {
      await ctx.editMessageReplyMarkup({ reply_markup: getMainKeyboard() });
      return;
    }

    // Обработка просмотра доступных комплексов
    if (callbackData === "show_available_complexes") {
      await showAvailableComplexes(ctx);
      return;
    }
    
    // Обработка просмотра деталей комплекса
    if (callbackData.startsWith("show_complex_details:")) {
      const complexType = callbackData.split(":")[1];
      await showComplexDetails(ctx, complexType);
      return;
    }
    
    // Обработка просмотра деталей комплекса для покупки
    if (callbackData.startsWith("show_complex_buy_details:")) {
      const complexType = callbackData.split(":")[1];
      await showComplexBuyDetails(ctx, complexType);
      return;
    }
    
    // Обработка покупки комплекса
    if (callbackData.startsWith("buy_complex:")) {
      const complexType = callbackData.split(":")[1];
      await handleBuyComplex(ctx, complexType);
      return;
    }
    
    // Обработка улучшения комплекса
    if (callbackData.startsWith("upgrade_complex:")) {
      const complexType = callbackData.split(":")[1];
      await handleUpgradeComplex(ctx, complexType);
      return;
    }
    
    // Обработка активации бустера
    if (callbackData.startsWith("activate_booster:")) {
      const boosterType = callbackData.split(":")[1];
      await handleActivateBooster(ctx, boosterType);
      return;
    }
    
    // Обработка выбора типа рейтинга
    if (callbackData.startsWith("leaderboard:")) {
      const leaderboardType = callbackData.split(":")[1];
      await showLeaderboard(ctx, leaderboardType);
      return;
    }
    
    // Если мы дошли сюда, значит колбэк не обработан
    await ctx.answerCallbackQuery("Неизвестная команда");
  } catch (error) {
    console.error("Ошибка при обработке колбэка:", error);
    await ctx.answerCallbackQuery("Произошла ошибка");
  }
}