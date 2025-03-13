/**
 * Система автоматических кликов
 * Обрабатывает автоклики для всех активных пользователей
 */
"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

/**
 * Выполнение автокликов для всех активных пользователей
 * Запускается по расписанию (cron) каждую минуту
 */
export const processAutoClicks = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Получаем активных пользователей с настроенным автокликером
    const users = await ctx.runQuery(internal.autoclickQueries.getActiveAutoClickers, {});
    
    // Интервал в секундах между выполнениями крона (60 секунд = 1 минута)
    const CRON_INTERVAL_SECONDS = 60;
    
    console.log(`Запущена автоматическая обработка кликов для ${users.length} пользователей`);
    
    // Обрабатываем каждого пользователя
    for (const user of users) {
      if (user.autoClicksPerSecond > 0) {
        try {
          // Рассчитываем клики за весь период между выполнениями крона
          const clicksToAdd = Math.floor(user.autoClicksPerSecond * CRON_INTERVAL_SECONDS);
          
          if (clicksToAdd > 0) {
            // Добавляем клики пользователю с пометкой источника "autoclick"
            await ctx.runMutation(api.users.addClicks, {
              userId: user._id,
              clicks: clicksToAdd,
              source: "autoclick"
            });
            
            console.log(`Пользователь ${user.telegramId}: +${clicksToAdd} кликов автоматически (${user.autoClicksPerSecond} кликов/сек × ${CRON_INTERVAL_SECONDS} сек)`);
          }
        } catch (error) {
          console.error(`Ошибка при обработке автокликов для пользователя ${user.telegramId}:`, error);
        }
      }
    }
    
    return null;
  },
});

/**
 * Запуск процесса автокликов вручную (для отладки)
 */
export const manuallyTriggerAutoClicks = internalAction({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await ctx.runAction(internal.autoclick.processAutoClicks, {});
    return "Процесс автокликов запущен вручную";
  },
});