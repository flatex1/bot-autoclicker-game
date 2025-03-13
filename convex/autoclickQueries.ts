/**
 * Запросы для получения пользователей с автокликом
 */
import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Получение активных пользователей с настроенным автокликером
 * Возвращает только необходимые поля для оптимизации производительности
 */
export const getActiveAutoClickers = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Получаем всех пользователей с положительным значением autoClicksPerSecond
    const users = await ctx.db.query("users")
      .withIndex("by_autoClicksPerSecond")
      .filter(q => q.gt(q.field("autoClicksPerSecond"), 0))
      .collect();
    
    // Фильтруем заблокированных пользователей
    const activeUsers = users.filter(user => !user.banned);
    
    // Оптимизация: возвращаем только необходимые поля для обработки
    return activeUsers.map(user => ({
      _id: user._id,
      telegramId: user.telegramId,
      autoClicksPerSecond: user.autoClicksPerSecond
    }));
  },
});

/**
 * Получение статистики по системе автокликов
 */
export const getAutoClickStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    
    const totalUsers = users.length;
    const usersWithAutoClicks = users.filter(u => u.autoClicksPerSecond > 0).length;
    const totalClicksPerSecond = users.reduce((sum, u) => sum + u.autoClicksPerSecond, 0);
    const maxClicksPerSecond = Math.max(...users.map(u => u.autoClicksPerSecond));
    
    return {
      totalUsers,
      usersWithAutoClicks,
      totalClicksPerSecond,
      maxClicksPerSecond,
      averageClicksPerSecond: totalClicksPerSecond / (usersWithAutoClicks || 1)
    };
  }
});