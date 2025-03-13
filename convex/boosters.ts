/**
 * Функции для работы с бустерами
 */
import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { api } from "./_generated/api.js";
import { BOOSTER_CONFIGS } from "./constants.js";

// Получение доступных бустеров
export const getAvailableBoosters = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      name: v.string(),
      description: v.string(),
      type: v.string(),
      cost: v.object({
        energons: v.number(),
        neutrons: v.optional(v.number()),
        particles: v.optional(v.number()),
      }),
      duration: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Получаем пользователя
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    // Список всех доступных бустеров
    return [
      {
        name: "Ускоритель частиц",
        description: "Увеличивает производство на 50% на 30 минут",
        type: "production_boost",
        cost: {
          energons: 1000,
          neutrons: undefined,
          particles: undefined,
        },
        duration: 30 * 60, // 30 минут в секундах
      },
      {
        name: "Нейронный усилитель",
        description: "Удваивает мощность клика на 15 минут",
        type: "click_boost",
        cost: { 
          energons: 500,
          neutrons: undefined,
          particles: undefined
        },
        duration: 15 * 60,
      },
      // Другие бустеры
    ];
  },
});

// Активация бустера
export const activateBooster = mutation({
  args: {
    userId: v.id("users"),
    boosterType: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Получаем пользователя
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { success: false, error: "Пользователь не найден" };
    }

    // Проверяем, есть ли уже активный бустер
    if (user.activeBoosterType) {
      return { 
        success: false, 
        error: "У вас уже есть активная разработка" 
      };
    }

    // Получаем информацию о бустере
    const boosters = await ctx.runQuery(api.game.getAvailableBoosters, {
      userId: args.userId,
    });

    const booster = boosters.find(b => b.type === args.boosterType);
    if (!booster) {
      return { success: false, error: "Разработка не найдена" };
    }

    // Проверяем, хватает ли ресурсов
    if (user.energons < booster.cost.energons) {
      return { success: false, error: "Недостаточно энергонов" };
    }

    if (booster.cost.neutrons && user.neutrons < booster.cost.neutrons) {
      return { success: false, error: "Недостаточно нейтронов" };
    }

    if (booster.cost.particles && user.particles < booster.cost.particles) {
      return { success: false, error: "Недостаточно квантовых частиц" };
    }

    // Списываем ресурсы
    const update: any = {
      energons: user.energons - booster.cost.energons,
      activeBoosterType: args.boosterType,
      boosterEndTime: Date.now() + booster.duration * 1000,
    };

    if (booster.cost.neutrons) {
      update.neutrons = user.neutrons - booster.cost.neutrons;
    }

    if (booster.cost.particles) {
      update.particles = user.particles - booster.cost.particles;
    }

    // Применяем эффекты бустера
    if (args.boosterType === "production_boost") {
      update.productionMultiplier = 1.5;
    } else if (args.boosterType === "click_boost") {
      update.clickMultiplier = 2;
    }

    // Обновляем пользователя
    await ctx.db.patch(args.userId, update);

    return { success: true };
  },
});