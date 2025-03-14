/**
 * Функции для обработки производства ресурсов
 */
import { internalMutation } from "./_generated/server.js";
import { v } from "convex/values";

// Сброс ежедневных бонусов
export const resetDailyBonuses = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Сбрасываем статус ежедневных бонусов для всех пользователей
    const users = await ctx.db.query("users").collect();

    for (const user of users) {
      await ctx.db.patch(user._id, {
        dailyBonusClaimed: false,
      });
    }

    console.log(`Ежедневные бонусы сброшены для ${users.length} пользователей`);
    return null;
  },
});