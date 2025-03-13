/**
 * Операции с пользователями
 * API для создания, обновления и получения данных пользователей
 */
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Создать или обновить пользователя при авторизации через Telegram
 */
export const upsertUser = mutation({
  args: {
    telegramId: v.number(),
    username: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    // Опциональные данные сессии
    sessionId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  returns: v.object({
    userId: v.id("users"),
    isNewUser: v.boolean(), // Флаг нового пользователя
  }),
  handler: async (ctx, args) => {
    // Проверяем, существует ли пользователь
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", args.telegramId))
      .unique();

    // Текущее время
    const currentTime = Date.now();
    
    if (existingUser) {
      // Проверка на бан
      if (existingUser.banned) {
        throw new Error("Аккаунт заблокирован");
      }
      
      // Обновляем информацию о пользователе
      await ctx.db.patch(existingUser._id, {
        username: args.username,
        firstName: args.firstName,
        lastName: args.lastName,
        lastActivity: currentTime,
        // Обновляем данные сессии, если предоставлены
        ...(args.sessionId && { sessionId: args.sessionId }),
        ...(args.ipAddress && { lastIp: args.ipAddress }),
      });
      
      // Записываем событие активности
      await ctx.db.insert("statistics", {
        userId: existingUser._id,
        event: "login",
        value: 1,
        timestamp: currentTime,
        metadata: JSON.stringify({
          ip: args.ipAddress || "unknown",
          session: args.sessionId || "unknown"
        })
      });
      
      return { 
        userId: existingUser._id, 
        isNewUser: false 
      };
    } else {
      // Создаем нового пользователя
      const userId = await ctx.db.insert("users", {
        telegramId: args.telegramId,
        username: args.username,
        firstName: args.firstName,
        lastName: args.lastName,
        clicks: 0,
        totalClicks: 0,
        lastActivity: currentTime,
        createdAt: currentTime,
        autoClickLevel: 0,
        autoClicksPerSecond: 0,
        banned: false,
        sessionId: args.sessionId,
        lastIp: args.ipAddress,
      });
      
      // Инициализируем запись в таблице рейтинга
      await ctx.db.insert("leaderboard", {
        userId,
        clicks: 0,
        updatedAt: currentTime,
      });
      
      // Записываем событие регистрации
      await ctx.db.insert("statistics", {
        userId,
        event: "registration",
        value: 1,
        timestamp: currentTime,
        metadata: JSON.stringify({
          ip: args.ipAddress || "unknown",
          session: args.sessionId || "unknown"
        })
      });
      
      return { 
        userId, 
        isNewUser: true 
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
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", args.telegramId))
      .unique();
  },
});

/**
 * Проверить авторизацию пользователя по сессии
 */
export const validateSession = query({
  args: {
    telegramId: v.number(),
    sessionId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", args.telegramId))
      .unique();
      
    if (!user || user.banned) {
      return false;
    }
    
    return user.sessionId === args.sessionId;
  },
});

/**
 * Добавить клики пользователю
 * Обновляет счетчики кликов и таблицу рейтинга
 */
export const addClicks = mutation({
  args: {
    userId: v.id("users"),
    clicks: v.number(),
    source: v.optional(v.string()), // Источник кликов: "manual", "autoclick", etc.
  },
  returns: v.number(), // Возвращаем текущее количество кликов
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }
    
    if (user.banned) {
      throw new Error("Аккаунт заблокирован");
    }
    
    const newClicks = user.clicks + args.clicks;
    const newTotalClicks = user.totalClicks + args.clicks;
    const currentTime = Date.now();
    
    // Обновляем пользователя
    await ctx.db.patch(args.userId, {
      clicks: newClicks,
      totalClicks: newTotalClicks,
      lastActivity: currentTime,
    });
    
    // Обновляем рейтинг
    await updateLeaderboard(ctx, args.userId, newClicks);
    
    // Записываем статистику
    await ctx.db.insert("statistics", {
      userId: args.userId,
      event: "clicks_added",
      value: args.clicks,
      timestamp: currentTime,
      metadata: JSON.stringify({
        source: args.source || "unknown",
        newTotal: newClicks
      })
    });
    
    return newClicks;
  },
});

/**
 * Обновление данных рейтинга пользователя
 */
async function updateLeaderboard(
  ctx: any,
  userId: Id<"users">,
  clicks: number
) {
  const existingEntry = await ctx.db
    .query("leaderboard")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .unique();

  const currentTime = Date.now();

  if (existingEntry) {
    await ctx.db.patch(existingEntry._id, {
      clicks,
      updatedAt: currentTime,
    });
  } else {
    await ctx.db.insert("leaderboard", {
      userId,
      clicks,
      updatedAt: currentTime,
    });
  }
}

/**
 * Получить статистику пользователя
 */
export const getUserStats = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }
    
    // Получаем позицию в рейтинге
    const leaderboardPosition = await getLeaderboardPosition(ctx, args.userId);
    
    // Получаем последние события
    const recentEvents = await ctx.db
      .query("statistics")
      .withIndex("by_userId", q => q.eq("userId", args.userId))
      .order("desc")
      .take(10);
      
    // Возвращаем расширенную статистику
    return {
      user,
      rank: leaderboardPosition,
      recentActivity: recentEvents,
    };
  },
});

/**
 * Получить позицию пользователя в рейтинге
 */
async function getLeaderboardPosition(ctx: any, userId: Id<"users">) {
  const allEntries = await ctx.db
    .query("leaderboard")
    .withIndex("by_clicks")
    .order("desc")
    .collect();
    
  const position = allEntries.findIndex((entry: any) => 
    entry.userId.toString() === userId.toString()
  );
  
  return position !== -1 ? position + 1 : null;
}

/**
 * Обновить статистику пользователя
 */
export const updateUserStats = mutation({
  args: {
    userId: v.id("users"),
    achievement: v.optional(v.string()),
    bonusStreak: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Пользователь не найден");

    const updates: any = {};
    
    // Обновляем достижения
    if (args.achievement) {
      const achievements = user.achievements || [];
      if (!achievements.includes(args.achievement)) {
        achievements.push(args.achievement);
        updates.achievements = achievements;
      }
    }

    // Обновляем серию бонусов
    if (args.bonusStreak !== undefined) {
      updates.bonusStreak = args.bonusStreak;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.userId, updates);
    }

    return null;
  },
});

/**
 * Проверить и обновить статус бустера
 */
export const checkAndUpdateBooster = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    multiplier: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Пользователь не найден");

    const now = Date.now();
    const boosterEndTime = user.boosterEndTime || 0;

    if (boosterEndTime < now && user.clickMultiplier !== 1) {
      await ctx.db.patch(args.userId, {
        clickMultiplier: 1,
        boosterEndTime: undefined,
      });
      return { multiplier: 1 };
    }

    return { multiplier: user.clickMultiplier || 1 };
  },
});

/**
 * Получить пользователей с активными бустерами
 */
export const getUsersWithActiveBooster = internalQuery({
  args: {},
  returns: v.array(v.object({
    _id: v.id("users"),
    boosterEndTime: v.optional(v.number()),
    clickMultiplier: v.optional(v.number()),
  })),
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("users")
      .filter(q => q.gt(q.field("boosterEndTime"), now))
      .collect();
  },
});