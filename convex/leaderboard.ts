/**
 * Функции для работы с рейтингом
 */
import { query, internalMutation } from "./_generated/server.js";
import { v } from "convex/values";

// Обновление таблицы рейтинга
export const updateLeaderboard = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    for (const user of users) {
      // Получаем все комплексы пользователя
      const complexes = await ctx.db
        .query("complexes")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();

      // Считаем общий уровень всех комплексов
      const totalLevel = complexes.reduce(
        (sum, complex) => sum + complex.level,
        0
      );

      // Проверяем существующую запись в рейтинге
      const leaderboardEntry = await ctx.db
        .query("leaderboard")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique();

      if (leaderboardEntry) {
        // Обновляем существующую запись
        await ctx.db.patch(leaderboardEntry._id, {
          energons: user.energons,
          totalLevel,
          totalProduction: user.totalProduction,
          updatedAt: Date.now(),
        });
      } else {
        // Создаем новую запись
        await ctx.db.insert("leaderboard", {
          userId: user._id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          energons: user.energons,
          totalLevel,
          totalProduction: user.totalProduction,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    return null;
  },
});

// Получение рейтинга пользователей
export const getUsersLeaderboard = query({
  args: {
    type: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Получаем рейтинг пользователей, отсортированный по производству
    return await ctx.db
      .query("users")
      .withIndex("by_totalProduction")
      .order("desc")
      .take(args.limit);
  },
});

// Получение позиции пользователя в рейтинге
export const getUserLeaderboardPosition = query({
  args: {
    userId: v.id("users"),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Пользователь не найден");

    // Считаем позицию по количеству пользователей с большим производством
    const usersAbove = await ctx.db
      .query("users")
      .filter((q) => q.gt(q.field("totalProduction"), user.totalProduction))
      .collect();

    return {
      position: usersAbove.length + 1,
      totalProduction: user.totalProduction,
      energons: user.energons,
      neutrons: user.neutrons || 0,
      particles: user.particles || 0,
    };
  },
});