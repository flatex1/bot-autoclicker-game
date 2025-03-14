/**
 * Запросы для получения данных пользователей и их производственных комплексов
 */
import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Получение активных пользователей с производственными комплексами
 */
export const getActiveProducers = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Получаем всех пользователей, у которых есть хотя бы один комплекс
    const users = await ctx.db
      .query("users")
      .filter(q => q.gt(q.field("totalProduction"), 0))
      .collect();
    
    // Фильтруем заблокированных пользователей
    const activeUsers = users.filter(user => !user.banned);
    
    // Оптимизация: возвращаем только необходимые поля для обработки
    return activeUsers.map(user => ({
      _id: user._id,
      telegramId: user.telegramId,
      totalProduction: user.totalProduction,
      productionMultiplier: user.productionMultiplier || 1,
      nextSatelliteBonusTime: user.nextSatelliteBonusTime,
    }));
  },
});

/**
 * Получение всех производственных комплексов пользователя
 */
export const getUserComplexes = internalQuery({
  args: {
    userId: v.id("users")
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("complexes")
      .withIndex("by_userId", q => q.eq("userId", args.userId))
      .collect();
  },
});

/**
 * Получение пользователей с активными бустерами
 */
export const getUsersWithActiveBoosters = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("users")
      .filter(q => q.gt(q.field("boosterEndTime"), now))
      .collect();
  },
});

/**
 * Получение статистики по системе производства
 */
export const getProductionStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const complexes = await ctx.db.query("complexes").collect();
    
    const totalUsers = users.length;
    const usersWithComplexes = users.filter(u => u.totalProduction > 0).length;
    const totalComplexes = complexes.length;
    const complexDistribution: { [key: string]: number } = {};
    
    complexes.forEach(complex => {
      complexDistribution[complex.type] = (complexDistribution[complex.type] || 0) + 1;
    });
    
    return {
      totalUsers,
      usersWithComplexes,
      totalComplexes,
      complexDistribution
    };
  }
});