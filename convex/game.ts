/**
 * Игровая механика и улучшения
 * Обрабатывает покупку улучшений и рассчитывает их эффекты
 */
import { mutation, query, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";

// Константы для игры
const UPGRADE_BASE_COST = 50; // Базовая стоимость первого уровня улучшения
const UPGRADE_MULTIPLIER = 1.5; // Множитель увеличения стоимости каждого следующего уровня

/**
 * Получить стоимость следующего уровня улучшения
 */
export const getUpgradeCost = query({
  args: {
    userId: v.id("users"),
    upgradeType: v.string(), // Тип улучшения (autoclick, multiplier, etc)
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }
    
    let level = 0;
    
    // Определяем текущий уровень улучшения по типу
    if (args.upgradeType === "autoclick") {
      level = user.autoClickLevel;
    }
    // В будущем можно добавить другие типы улучшений
    
    // Рассчитываем стоимость следующего уровня по формуле
    return Math.floor(UPGRADE_BASE_COST * Math.pow(UPGRADE_MULTIPLIER, level));
  },
});

/**
 * Купить улучшение автоклика
 */
export const buyAutoClickUpgrade = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
    newLevel: v.number(),
    newClicksPerSecond: v.number(),
    cost: v.number(),
    remainingClicks: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }
    
    if (user.banned) {
      throw new Error("Аккаунт заблокирован");
    }
    
    const nextLevel = user.autoClickLevel + 1;
    const cost = Math.floor(UPGRADE_BASE_COST * Math.pow(UPGRADE_MULTIPLIER, user.autoClickLevel));
    const currentTime = Date.now();
    
    // Проверяем, может ли пользователь позволить себе улучшение
    if (user.clicks < cost) {
      return {
        success: false,
        newLevel: user.autoClickLevel,
        newClicksPerSecond: user.autoClicksPerSecond,
        cost,
        remainingClicks: user.clicks,
      };
    }
    
    // Вычисляем новое значение автокликов в секунду (формула может быть изменена)
    const newClicksPerSecond = nextLevel;
    
    // Обновляем данные пользователя
    await ctx.db.patch(args.userId, {
      clicks: user.clicks - cost,
      autoClickLevel: nextLevel,
      autoClicksPerSecond: newClicksPerSecond,
      lastActivity: currentTime,
    });
    
    // Обновляем рейтинг
    await ctx.db
      .query("leaderboard")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique()
      .then(entry => {
        if (entry) {
          ctx.db.patch(entry._id, {
            clicks: user.clicks - cost,
            updatedAt: currentTime,
          });
        }
      });
    
    // Записываем в таблицу улучшений
    await ctx.db.insert("upgrades", {
      userId: args.userId,
      type: "autoclick",
      level: nextLevel,
      cost,
      effect: newClicksPerSecond,
      purchasedAt: currentTime,
    });
    
    // Записываем в статистику
    await ctx.db.insert("statistics", {
      userId: args.userId,
      event: "upgrade_purchased",
      value: cost,
      timestamp: currentTime,
      metadata: JSON.stringify({
        type: "autoclick",
        newLevel: nextLevel,
        clicksPerSecond: newClicksPerSecond
      })
    });
    
    return {
      success: true,
      newLevel: nextLevel,
      newClicksPerSecond,
      cost,
      remainingClicks: user.clicks - cost,
    };
  },
});

/**
 * Получить топ игроков
 */
export const getLeaderboard = query({
  args: {
    limit: v.number(),
    cursor: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      telegramId: v.number(),
      username: v.optional(v.string()),
      firstName: v.optional(v.string()),
      clicks: v.number(),
      rank: v.number(),
      autoClickLevel: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Получаем записи из таблицы рейтинга с пагинацией
    const paginationResult = await ctx.db
      .query("leaderboard")
      .withIndex("by_clicks")
      .order("desc")
      .paginate({ numItems: args.limit, cursor: args.cursor || null });
    
    const result = [];
    
    // Получаем детальную информацию о каждом пользователе
    for (let i = 0; i < paginationResult.page.length; i++) {
      const entry = paginationResult.page[i];
      const user = await ctx.db.get(entry.userId);
      
      if (user) {
        result.push({
          userId: entry.userId,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          clicks: entry.clicks,
          rank: i + 1, // Позиция в текущей странице рейтинга
          autoClickLevel: user.autoClickLevel,
        });
      }
    }
    
    return result;
  },
});

/**
 * Получить историю улучшений пользователя
 */
export const getUserUpgrades = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("upgrades")
      .withIndex("by_userId", q => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

/**
 * Получить ежедневный бонус
 */
export const claimDailyBonus = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
    amount: v.optional(v.number()),
    timeLeft: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Пользователь не найден");
    
    const now = Date.now();
    const lastBonusTime = user.lastBonusTime || 0;
    const bonusCooldown = 24 * 60 * 60 * 1000; // 24 часа
    
    if (now - lastBonusTime < bonusCooldown) {
      const timeLeft = bonusCooldown - (now - lastBonusTime);
      const hours = Math.floor(timeLeft / (60 * 60 * 1000));
      const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
      return {
        success: false,
        timeLeft: `${hours}ч ${minutes}м`,
      };
    }
    
    const bonusAmount = Math.floor(100 + Math.random() * 900); // 100-1000 кликов
    
    await ctx.db.patch(args.userId, {
      clicks: user.clicks + bonusAmount,
      lastBonusTime: now,
    });
    
    // Обновляем рейтинг
    await ctx.db
      .query("leaderboard")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique()
      .then(entry => {
        if (entry) {
          ctx.db.patch(entry._id, {
            clicks: user.clicks + bonusAmount,
            updatedAt: now,
          });
        }
      });
    
    return {
      success: true,
      amount: bonusAmount,
    };
  },
});

/**
 * Получить достижения пользователя
 */
export const getUserAchievements = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(v.object({
    name: v.string(),
    description: v.string(),
    completed: v.boolean(),
    progress: v.optional(v.number()),
  })),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Пользователь не найден");
    
    const achievements = [
      {
        name: "Начинающий кликер",
        description: "Набрать 1,000 кликов",
        completed: user.totalClicks >= 1000,
        progress: Math.min(100, (user.totalClicks / 1000) * 100),
      },
      {
        name: "Автоматизатор",
        description: "Достичь 5 уровня автокликера",
        completed: user.autoClickLevel >= 5,
        progress: Math.min(100, (user.autoClickLevel / 5) * 100),
      },
      {
        name: "Постоянный игрок",
        description: "Получить 7 ежедневных бонусов",
        completed: (user.bonusStreak || 0) >= 7,
        progress: Math.min(100, ((user.bonusStreak || 0) / 7) * 100),
      },
      {
        name: "Миллионер",
        description: "Накопить 1,000,000 кликов",
        completed: user.totalClicks >= 1000000,
        progress: Math.min(100, (user.totalClicks / 1000000) * 100),
      },
    ];
    
    return achievements;
  },
});

/**
 * Активировать временный бустер
 */
export const buyBooster = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
    timeLeft: v.optional(v.number()),
    cost: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Пользователь не найден");
    
    const BOOSTER_COST = 1000;
    const BOOSTER_DURATION = 30 * 60 * 1000; // 30 минут
    const now = Date.now();
    
    // Проверяем, нет ли уже активного бустера
    if (user.boosterEndTime && user.boosterEndTime > now) {
      return {
        success: false,
        timeLeft: Math.ceil((user.boosterEndTime - now) / 1000),
        cost: BOOSTER_COST,
      };
    }
    
    // Проверяем, хватает ли кликов
    if (user.clicks < BOOSTER_COST) {
      return {
        success: false,
        cost: BOOSTER_COST,
      };
    }
    
    // Активируем бустер
    await ctx.db.patch(args.userId, {
      clicks: user.clicks - BOOSTER_COST,
      boosterEndTime: now + BOOSTER_DURATION,
      clickMultiplier: 2,
    });
    
    return {
      success: true,
      timeLeft: BOOSTER_DURATION / 1000,
      cost: BOOSTER_COST,
    };
  },
});

/**
 * Проверить статус бустера
 */
export const getBoosterStatus = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    active: v.boolean(),
    timeLeft: v.optional(v.number()),
    multiplier: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Пользователь не найден");
    
    const now = Date.now();
    const boosterEndTime = user.boosterEndTime || 0;
    
    if (boosterEndTime > now) {
      return {
        active: true,
        timeLeft: Math.ceil((boosterEndTime - now) / 1000),
        multiplier: user.clickMultiplier || 1,
      };
    }
    
    return {
      active: false,
      multiplier: 1,
    };
  },
});

/**
 * Проверка бустеров и достижений (для крона)
 */
export const checkBoostersAndAchievements = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    
    // Получаем всех пользователей с активными бустерами
    const users = await ctx.runQuery(internal.users.getUsersWithActiveBooster, {});
    
    for (const user of users) {
      await ctx.runMutation(internal.users.checkAndUpdateBooster, { 
        userId: user._id 
      });
    }
    
    return null;
  },
});

/**
 * Сброс ежедневных бонусов (для крона)
 */
export const resetDailyBonuses = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Логика сброса бонусов
    return null;
  },
});

export const addClicks = mutation({
  args: {
    userId: v.id("users"),
    clicks: v.number(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Пользователь не найден");

    const multiplier = user.clickMultiplier || 1;
    const totalClicks = args.clicks * multiplier;

    await ctx.db.patch(args.userId, {
      clicks: user.clicks + totalClicks,
      totalClicks: user.totalClicks + totalClicks,
    });
  },
});

export const getUserStats = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Пользователь не найден");

    return {
      totalClicks: user.totalClicks,
      autoClickLevel: user.autoClickLevel,
      clicksPerSecond: user.autoClicksPerSecond,
    };
  },
});

export const getUserDetailedStats = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    totalClicks: v.number(),
    manualClicks: v.number(),
    autoClicks: v.number(),
    bonusClicks: v.number(),
    bonusStreak: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Пользователь не найден");

    const stats = await ctx.db
      .query("statistics")
      .withIndex("by_userId", q => q.eq("userId", args.userId))
      .collect();

    return {
      totalClicks: user.totalClicks || 0,
      manualClicks: stats.filter(s => s.event === "manual_click").reduce((sum, s) => sum + (s.value || 0), 0),
      autoClicks: stats.filter(s => s.event === "auto_click").reduce((sum, s) => sum + (s.value || 0), 0),
      bonusClicks: stats.filter(s => s.event === "bonus").reduce((sum, s) => sum + (s.value || 0), 0),
      bonusStreak: user.bonusStreak,
    };
  },
});

export const getUserHistory = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(v.object({
    event: v.string(),
    value: v.number(),
    timestamp: v.number(),
    metadata: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("statistics")
      .withIndex("by_userId", q => q.eq("userId", args.userId))
      .order("desc")
      .take(10);

    return history.map(entry => ({
      event: entry.event,
      value: entry.value,
      timestamp: entry.timestamp,
      metadata: entry.metadata,
    }));
  },
});