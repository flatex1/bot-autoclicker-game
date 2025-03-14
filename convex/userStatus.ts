/**
 * Функции для получения и обновления статуса пользователя
 */
import { query } from "./_generated/server.js";
import { v } from "convex/values";

// Получение статуса пользователя
export const getUserStatus = query({
  args: { userId: v.id("users") },
  returns: v.object({
    energons: v.number(),
    neutrons: v.number(),
    particles: v.number(),
    clickPower: v.number(),
    totalProduction: v.number(),
    hasSpaceStation: v.boolean(),
    activeBooster: v.optional(v.object({
      name: v.string(),
      type: v.string(),
      timeLeft: v.number(),
    })),
    nextSatelliteBonusTime: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    // Вычисляем мощность клика
    let clickPower = 10; // базовая мощность клика
    
    const complexes = await ctx.db
      .query("complexes")
      .withIndex("by_userId", q => q.eq("userId", args.userId))
      .collect();
    
    // Проверяем наличие специального комплекса для увеличения клика
    const clickComplex = complexes.find(c => c.type === "KRASNIY-CIKLOTRON");
    if (clickComplex) {
      clickPower += clickPower * (clickComplex.level * 0.1); // +10% за уровень
    }
    
    // Применяем мультипликатор клика от активного бустера
    if (user.clickMultiplier && user.clickMultiplier > 1) {
      clickPower *= user.clickMultiplier;
    }
    
    // Проверяем наличие космической станции
    const spaceStationComplex = complexes.find(c => c.type === "POLYUS-K88");
    
    // Информация об активном бустере
    let boosterInfo = undefined;
    if (user.activeBoosterType && user.boosterEndTime) {
      const timeLeft = Math.max(0, Math.floor((user.boosterEndTime - Date.now()) / 1000));
      if (timeLeft > 0) {
        boosterInfo = {
          name: user.activeBoosterType,
          type: user.activeBoosterType,
          timeLeft: timeLeft
        };
      }
    }
    
    return {
      clickPower: Math.floor(clickPower),
      energons: user.energons,
      neutrons: user.neutrons || 0,
      particles: user.particles || 0,
      totalProduction: user.totalProduction || 0,
      hasSpaceStation: Boolean(spaceStationComplex),
      activeBooster: boosterInfo,
      nextSatelliteBonusTime: user.nextSatelliteBonusTime
    };
  }
});