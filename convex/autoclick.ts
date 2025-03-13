/**
 * Система автоматического производства ресурсов
 * Обрабатывает генерацию ресурсов для всех активных комплексов игроков
 */
"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api.js";

/**
 * Выполнение автоматического производства для всех пользователей
 * Запускается по расписанию (cron) каждую минуту
 */
export const processProduction = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Получаем активных пользователей с производственными комплексами
    const users = await ctx.runQuery(internal.autoclickQueries.getActiveProducers, {});
    
    // Интервал в секундах между выполнениями крона (60 секунд = 1 минута)
    const CRON_INTERVAL_SECONDS = 60;
    
    console.log(`Запущено автоматическое производство для ${users.length} научных империй`);
    
    // Обрабатываем каждого пользователя
    for (const user of users) {
      try {
        // Получаем все активные комплексы пользователя
        const complexes = await ctx.runQuery(internal.autoclickQueries.getUserComplexes, {
          userId: user._id
        });
        
        // Рассчитываем и применяем производство от всех комплексов
        let totalEnergons = 0;
        let totalNeutrons = 0;
        let totalParticles = 0;
        
        // Применяем множители к производству
        const productionMultiplier = user.productionMultiplier || 1;
        
        for (const complex of complexes) {
          if (complex.type === "KOLLEKTIV-1") {
            totalEnergons += complex.production * complex.level * productionMultiplier * CRON_INTERVAL_SECONDS;
          } else if (complex.type === "SOYUZ-ATOM" && complex.level > 0) {
            totalNeutrons += complex.production * complex.level * productionMultiplier * CRON_INTERVAL_SECONDS;
          } else if (complex.type === "KVANT-SIBIR" && complex.level > 0) {
            totalParticles += complex.production * complex.level * productionMultiplier * CRON_INTERVAL_SECONDS;
          }
          // Другие типы комплексов...
        }
        
        // Добавляем ресурсы пользователю
        if (totalEnergons > 0) {
          await ctx.runMutation(api.users.addResources, {
            userId: user._id,
            energons: Math.floor(totalEnergons),
            neutrons: Math.floor(totalNeutrons),
            particles: Math.floor(totalParticles),
            source: "production"
          });
          
          console.log(`Империя ${user.telegramId}: +${Math.floor(totalEnergons)} Энергонов, +${Math.floor(totalNeutrons)} Нейтронов, +${Math.floor(totalParticles)} Квантовых Частиц`);
        }
      } catch (error) {
        console.error(`Ошибка при обработке производства для пользователя ${user.telegramId}:`, error);
      }
    }
    
    return null;
  },
});

/**
 * Проверка и обновление временных бустеров
 */
export const checkBoostersStatus = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.autoclickQueries.getUsersWithActiveBoosters, {});
    
    for (const user of users) {
      await ctx.runMutation(internal.users.updateBoostersStatus, { 
        userId: user._id 
      });
    }
    
    return null;
  },
});

/**
 * Запуск процесса производства вручную (для отладки)
 */
export const manuallyTriggerProduction = internalAction({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await ctx.runAction(internal.autoclick.processProduction, {});
    return "Процесс производства запущен вручную";
  },
});