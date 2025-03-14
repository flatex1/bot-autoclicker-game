/**
 * Операции с пользователями
 * API для создания, обновления и получения данных пользователей
 */
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";

/**
 * Создать или обновить пользователя при авторизации через Telegram
 */
export const upsertUser = mutation({
  args: {
    telegramId: v.number(),
    username: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  returns: v.object({
    userId: v.id("users"),
    isNewUser: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Проверяем, существует ли пользователь
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", args.telegramId))
      .unique();

    if (existingUser) {
      // Обновляем существующего пользователя
      await ctx.db.patch(existingUser._id, {
        username: args.username,
        firstName: args.firstName,
        lastName: args.lastName,
        lastActivity: Date.now(),
      });

      return {
        userId: existingUser._id,
        isNewUser: false,
      };
    } else {
      // Создаем нового пользователя
      const now = Date.now();
      const userId = await ctx.db.insert("users", {
        telegramId: args.telegramId,
        username: args.username,
        firstName: args.firstName,
        lastName: args.lastName,

        // Инициализация ресурсов
        energons: 100, // Стартовое количество энергонов
        neutrons: 0,
        particles: 0,

        // Инициализация статистики
        totalProduction: 0,
        totalClicks: 0,
        manualClicks: 0,

        // Прочие поля
        lastActivity: now,
        createdAt: now,
        dailyBonusClaimed: false,
        bonusStreak: 0,
        banned: false,
        isAdmin: false,
      });

      // Создаем начальный комплекс KOLLEKTIV-1
      await ctx.db.insert("complexes", {
        userId,
        type: "KOLLEKTIV-1",
        level: 1,
        production: 1, // 1 Энергон в секунду
        lastUpgraded: now,
        createdAt: now,
      });

      // Обновляем общее производство
      await ctx.db.patch(userId, {
        totalProduction: 1,
      });

      // Создаем запись в таблице рейтинга
      await ctx.db.insert("leaderboard", {
        userId,
        telegramId: args.telegramId,
        username: args.username,
        firstName: args.firstName,
        energons: 100,
        totalLevel: 1,
        totalProduction: 1,
        createdAt: now,
        updatedAt: now,
      });

      return {
        userId,
        isNewUser: true,
      };
    }
  },
});

/**
 * Получить пользователя по Telegram ID
 */
export const getUserByTelegramId = query({
  args: {
    telegramId: v.number(),
  },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      telegramId: v.number(),
      username: v.optional(v.string()),
      firstName: v.optional(v.string()),
      energons: v.number(),
      neutrons: v.number(),
      particles: v.number(),
      totalProduction: v.number(),
      banned: v.boolean(),
      dailyBonusClaimed: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", args.telegramId))
      .unique();

    if (!user) return null;

    return {
      _id: user._id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      energons: user.energons,
      neutrons: user.neutrons,
      particles: user.particles,
      totalProduction: user.totalProduction,
      banned: user.banned || false,
      dailyBonusClaimed: user.dailyBonusClaimed || false,
    };
  },
});

/**
 * Добавить ресурсы пользователю
 */
export const addResources = mutation({
  args: {
    userId: v.id("users"),
    energons: v.optional(v.number()),
    neutrons: v.optional(v.number()),
    particles: v.optional(v.number()),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Пользователь не найден");

    const updates: any = {
      lastActivity: Date.now(),
    };

    if (args.energons) {
      updates.energons = user.energons + args.energons;
    }

    if (args.neutrons) {
      updates.neutrons = user.neutrons + args.neutrons;
    }

    if (args.particles) {
      updates.particles = user.particles + args.particles;
    }

    await ctx.db.patch(args.userId, updates);

    // TODO: сделать запись в статистику (раз в 6 часов)
  },
});

/**
 * Обновить статус бустеров пользователя
 */
export const updateBoostersStatus = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return;

    const now = Date.now();

    // Проверяем, не истек ли бустер
    if (
      user.activeBoosterType &&
      user.boosterEndTime &&
      user.boosterEndTime <= now
    ) {
      // Сбрасываем бустер
      await ctx.db.patch(args.userId, {
        activeBoosterType: undefined,
        activeBoosterName: undefined,
        boosterEndTime: undefined,
        productionMultiplier: 1,
        clickMultiplier: 1,
      });

      // Логируем окончание действия бустера
      await ctx.db.insert("statistics", {
        userId: args.userId,
        event: "booster_expired",
        timestamp: now,
        value: 0,
        metadata: JSON.stringify({
          boosterType: user.activeBoosterType,
          boosterName: user.activeBoosterName,
        }),
      });
    }
  },
});

/**
 * Получить пользователей с активными бустерами
 */
export const getUsersWithActiveBoosters = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      boosterEndTime: v.optional(v.number()),
      activeBoosterType: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("users")
      .filter((q) => q.gt(q.field("boosterEndTime"), now))
      .collect();
  },
});

/**
 * Установить время следующего бонуса от спутника
 */
export const setNextSatelliteBonus = internalMutation({
  args: {
    userId: v.id("users"),
    nextBonusTime: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      nextSatelliteBonusTime: args.nextBonusTime,
    });
  },
});

/**
 * Получение ежедневного бонуса
 */
export const claimDailyBonus = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Пользователь не найден");

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Проверяем, доступен ли бонус
    if (user.dailyBonusClaimed) {
      return { success: false };
    }

    // Обновляем счетчик серии
    const streak = (user.bonusStreak || 0) + 1;

    // Рассчитываем бонус (увеличивается с длиной серии)
    const baseAmount = 100;
    const amount = baseAmount + (streak - 1) * 50;

    // Обновляем пользователя
    await ctx.db.patch(args.userId, {
      energons: (user.energons || 0) + amount,
      dailyBonusClaimed: true,
      bonusStreak: streak,
    });

    return { success: true, amount, streak };
  },
});
