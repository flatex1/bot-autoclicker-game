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
    const users = await ctx.runQuery(
      internal.autoclickQueries.getActiveProducers,
      {}
    );

    // Интервал в секундах между выполнениями крона (60 секунд = 1 минута)
    const CRON_INTERVAL_SECONDS = 60;

    console.log(
      `Запущено автоматическое производство для ${users.length} научных империй`
    );

    // Обрабатываем каждого пользователя
    for (const user of users) {
      try {
        // Получаем все активные комплексы пользователя
        const complexes = await ctx.runQuery(
          internal.autoclickQueries.getUserComplexes,
          {
            userId: user._id,
          }
        );

        // Рассчитываем и применяем производство от всех комплексов
        let totalEnergons = 0;
        let totalNeutrons = 0;
        let totalParticles = 0;

        // Применяем множители к производству
        const productionMultiplier = user.productionMultiplier || 1;

        // Дополнительные множители от комплексов
        let zaryaBonus = 1;
        let akademgorodBonus = 1;

        // Сначала вычисляем все бонусы
        for (const complex of complexes) {
          if (complex.type === "ZARYA-M" && complex.level > 0) {
            // ЗАРЯ-М: +5% к энергонам за уровень
            zaryaBonus += complex.level * 0.05;
          }

          if (complex.type === "AKADEMGOROD-17" && complex.level > 0) {
            // АКАДЕМГОРОД-17: +10% ко всему производству за уровень
            akademgorodBonus += complex.level * 0.1;
          }
        }

        // Применяем все множители
        const totalMultiplier = productionMultiplier * akademgorodBonus;

        // Считаем базовое производство с учетом бонусов
        for (const complex of complexes) {
          if (complex.type === "KOLLEKTIV-1") {
            // Применяем бонус от ЗАРЯ-М к энергонам
            totalEnergons +=
              complex.production *
              complex.level *
              zaryaBonus *
              totalMultiplier *
              CRON_INTERVAL_SECONDS;
          } else if (complex.type === "SOYUZ-ATOM" && complex.level > 0) {
            totalNeutrons +=
              complex.production *
              complex.level *
              totalMultiplier *
              CRON_INTERVAL_SECONDS;
          } else if (complex.type === "KVANT-SIBIR" && complex.level > 0) {
            totalParticles +=
              complex.production *
              complex.level *
              totalMultiplier *
              CRON_INTERVAL_SECONDS;
          }
          // TODO: доделать эти комплексы:
          // MATERIYA-3: редкие материалы - могут быть отдельным ресурсом
          // POLYUS-K88: сезонные события - специальная логика
        }

        // Добавляем бонусы от MOZG-MACHINA (автокликер)
        const mozgMachinaComplex = complexes.find(
          (c) => c.type === "MOZG-MACHINA"
        );
        if (mozgMachinaComplex && mozgMachinaComplex.level > 0) {
          // Получаем базовую мощность клика пользователя
          const userStatus = await ctx.runQuery(api.game.getUserStatus, {
            userId: user._id,
          });
          if (userStatus) {
            // Добавляем автоматические клики (1 клик в секунду за каждый уровень)
            const autoClicks = mozgMachinaComplex.level * CRON_INTERVAL_SECONDS;
            const clickPower = userStatus.clickPower || 10;

            // Добавляем энергоны от автокликов
            totalEnergons += autoClicks * clickPower;
          }
        }

        // Добавляем ресурсы пользователю
        if (totalEnergons > 0 || totalNeutrons > 0 || totalParticles > 0) {
          await ctx.runMutation(api.users.addResources, {
            userId: user._id,
            energons: Math.floor(totalEnergons),
            neutrons: Math.floor(totalNeutrons),
            particles: Math.floor(totalParticles),
            source: "production",
          });

          console.log(
            `Империя ${user.telegramId}: +${Math.floor(totalEnergons)} Энергонов, +${Math.floor(totalNeutrons)} Нейтронов, +${Math.floor(totalParticles)} Квантовых частиц`
          );
        }
      } catch (error) {
        console.error(
          `Ошибка при обработке производства для пользователя ${user.telegramId}:`,
          error
        );
      }
    }

    return null;
  },
});

/**
 * Процесс бонусов от Спутника-Гамма
 * Запускается по расписанию (cron) каждые 30 минут
 */
export const processSatelliteBonus = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.autoclickQueries.getActiveProducers, {});
    console.log(`Проверка бонусов от Спутника-Гамма для ${users.length} империй`);
    
    const now = Date.now();
    
    for (const user of users) {
      try {
        // Проверяем наличие комплекса SPUTNIK-GAMMA
        const complexes = await ctx.runQuery(internal.autoclickQueries.getUserComplexes, {
          userId: user._id
        });
        
        const satelliteComplex = complexes.find(c => c.type === "SPUTNIK-GAMMA");
        
        if (satelliteComplex && satelliteComplex.level > 0) {
          // Проверяем, прошло ли нужное время с последнего бонуса
          if (!user.nextSatelliteBonusTime || user.nextSatelliteBonusTime <= now) {
            // Рассчитываем бонус в зависимости от уровня
            const bonusMultiplier = 1 + satelliteComplex.level * 0.2; // +20% за каждый уровень
            
            // Получаем общее производство пользователя
            let totalProduction = user.totalProduction || 0;
            
            // Рассчитываем базовый бонус на основе общего производства
            const baseBonus = totalProduction * 30 * 60; // 30 минут производства
            const finalBonus = Math.floor(baseBonus * bonusMultiplier);
            
            // Добавляем бонус к ресурсам пользователя
            await ctx.runMutation(api.users.addResources, {
              userId: user._id,
              energons: finalBonus,
              neutrons: 0,
              particles: 0,
              source: "satellite_bonus"
            });
            
            // Обновляем время следующего бонуса
            await ctx.runMutation(internal.users.setNextSatelliteBonus, {
              userId: user._id,
              nextBonusTime: now + 30 * 60 * 1000 // Следующий бонус через 30 минут
            });
            
            console.log(`Спутник-Гамма выдал бонус ${finalBonus} Энергонов для пользователя ${user.telegramId}`);
          }
        }
      } catch (error) {
        console.error(`Ошибка при обработке бонуса Спутника-Гамма для пользователя ${user.telegramId}:`, error);
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
    const users = await ctx.runQuery(
      internal.users.getUsersWithActiveBoosters,
      {}
    );

    console.log(`Проверка статуса бустеров для ${users.length} пользователей`);

    for (const user of users) {
      await ctx.runMutation(internal.users.updateBoostersStatus, {
        userId: user._id,
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
