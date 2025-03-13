/**
 * Операции с пользователями
 * API для создания, обновления и получения данных пользователей
 */
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
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
        totalProduction: 1
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
      lastActivity: Date.now()
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
    
    // Записываем в статистику
    await ctx.db.insert("statistics", {
      userId: args.userId,
      event: `resource_gain_${args.source}`,
      value: args.energons || args.neutrons || args.particles || 0,
      timestamp: Date.now(),
      metadata: JSON.stringify({
        energons: args.energons,
        neutrons: args.neutrons,
        particles: args.particles
      })
    });
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
    
    // Проверяем, активен ли еще бустер
    if (user.boosterEndTime && user.boosterEndTime <= now) {
      // Бустер истек, сбрасываем его эффекты
      const updates: any = {
        activeBoosterType: null,
        boosterEndTime: null
      };
      
      // Сбрасываем соответствующие множители в зависимости от типа бустера
      if (user.productionMultiplier && user.productionMultiplier > 1) {
        updates.productionMultiplier = 1;
      }
      
      if (user.clickMultiplier && user.clickMultiplier > 1) {
        updates.clickMultiplier = 1;
      }
      
      if (user.researchMultiplier && user.researchMultiplier > 1) {
        updates.researchMultiplier = 1;
      }
      
      if (user.sellMultiplier && user.sellMultiplier > 1) {
        updates.sellMultiplier = 1;
      }
      
      await ctx.db.patch(args.userId, updates);
      
      // Записываем в статистику
      await ctx.db.insert("statistics", {
        userId: args.userId,
        event: "booster_expired",
        value: 0,
        timestamp: now,
        metadata: JSON.stringify({
          boosterType: user.activeBoosterType
        })
      });
    }
  },
});

/**
 * Получить пользователей с активными бустерами
 */
export const getUsersWithActiveBoosters = internalQuery({
  args: {},
  returns: v.array(v.object({
    _id: v.id("users"),
    boosterEndTime: v.optional(v.number()),
    activeBoosterType: v.optional(v.string()),
  })),
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("users")
      .filter(q => q.gt(q.field("boosterEndTime"), now))
      .collect();
  },
});