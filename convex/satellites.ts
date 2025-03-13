/**
 * Функции для работы со спутниками
 */
import { internalMutation } from "./_generated/server.js";
import { v } from "convex/values";

export const processSatelliteBonus = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Получаем пользователей с активными спутниками
    const users = await ctx.db.query("users").collect();

    const now = Date.now();

    for (const user of users) {
      // Проверяем наличие комплекса SPUTNIK-GAMMA
      const satellite = await ctx.db
        .query("complexes")
        .withIndex("by_userAndType", (q) =>
          q.eq("userId", user._id).eq("type", "SPUTNIK-GAMMA")
        )
        .unique();

      if (satellite && satellite.level > 0) {
        // Проверяем, прошло ли нужное время с последнего бонуса
        if (
          !user.nextSatelliteBonusTime ||
          user.nextSatelliteBonusTime <= now
        ) {
          // Рассчитываем бонус в зависимости от уровня
          const bonusMultiplier = 1 + satellite.level * 0.2; // +20% за каждый уровень

          // Получаем общее производство пользователя
          const complexes = await ctx.db
            .query("complexes")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect();

          let totalProduction = 0;
          for (const complex of complexes) {
            totalProduction += complex.production || 0;
          }

          // Рассчитываем базовый бонус на основе общего производства
          const baseBonus = totalProduction * 30 * 60; // 30 минут производства
          const finalBonus = Math.floor(baseBonus * bonusMultiplier);

          // Добавляем бонус к ресурсам пользователя
          await ctx.db.patch(user._id, {
            energons: user.energons + finalBonus,
            nextSatelliteBonusTime: now + 30 * 60 * 1000, // Следующий бонус через 30 минут
          });

          // Записываем в статистику
          await ctx.db.insert("statistics", {
            userId: user._id,
            event: "satellite_bonus",
            value: finalBonus,
            timestamp: now,
            metadata: JSON.stringify({
              satelliteLevel: satellite.level,
              bonusMultiplier,
            }),
          });

          console.log(
            `Спутник-Гамма выдал бонус ${finalBonus} Энергонов для пользователя ${user.telegramId}`
          );
        }
      }
    }

    return null;
  },
});
