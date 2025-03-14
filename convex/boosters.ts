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
      image: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    // Получаем пользователя
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    // Получаем доступные комплексы для проверки требований
    const complexes = await ctx.db
      .query("complexes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Список всех доступных бустеров из конфигурации
    const boosters = [];

    for (const [type, config] of Object.entries(BOOSTER_CONFIGS)) {
      // Проверяем, соответствует ли пользователь требованиям
      let isAvailable = true;

      if (config.requiredComplex) {
        const requiredComplex = complexes.find(
          (c) =>
            c.type === config.requiredComplex &&
            c.level >= (config.requiredLevel || 1)
        );
        if (!requiredComplex) {
          isAvailable = false;
        }
      }

      if (isAvailable) {
        boosters.push({
          name: config.name,
          description: config.description,
          type: type,
          cost: config.cost,
          duration: config.duration,
          image: config.image,
        });
      }
    }

    return boosters;
  },
});

// Активация бустера
export const activateBooster = mutation({
  args: {
    userId: v.id("users"),
    boosterType: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Пользователь не найден");

    // Проверяем, что нет активного бустера
    if (user.activeBoosterType) {
      return { success: false, error: "У вас уже активирован бустер" };
    }

    // Получаем конфигурацию бустера
    const boosterConfig =
      BOOSTER_CONFIGS[args.boosterType as keyof typeof BOOSTER_CONFIGS];
    if (!boosterConfig) {
      return { success: false, error: "Бустер не найден" };
    }

    // Проверяем достаточно ли ресурсов
    if (user.energons < boosterConfig.cost.energons) {
      return { success: false, error: "Недостаточно энергонов" };
    }

    if (
      boosterConfig.cost.neutrons !== undefined &&
      user.neutrons < boosterConfig.cost.neutrons
    ) {
      return { success: false, error: "Недостаточно нейтронов" };
    }

    if (
      boosterConfig.cost.particles !== undefined &&
      user.particles < boosterConfig.cost.particles
    ) {
      return { success: false, error: "Недостаточно квантовых частиц" };
    }

    // Сохраняем начальные значения мультипликаторов
    const baseProductionMultiplier = user.productionMultiplier || 1;
    const baseClickMultiplier = user.clickMultiplier || 1;
    
    // Рассчитываем новые мультипликаторы в зависимости от типа бустера
    let newProductionMultiplier = baseProductionMultiplier;
    let newClickMultiplier = baseClickMultiplier;

    if (args.boosterType.includes("production") || ["PROTON-M87", "RED-STAR"].includes(args.boosterType)) {
      newProductionMultiplier = baseProductionMultiplier * boosterConfig.multiplier;
    } else if (args.boosterType.includes("click") || ["ATOMIC-HEART-42", "IRON-COMRADE"].includes(args.boosterType)) {
      newClickMultiplier = baseClickMultiplier * boosterConfig.multiplier;
    } else if (args.boosterType === "T-POLYMER") {
      // Особый бустер, который увеличивает все
      newProductionMultiplier = baseProductionMultiplier * 1.5;
      newClickMultiplier = baseClickMultiplier * 1.5;
    }

    // Вычитаем стоимость бустера
    await ctx.db.patch(args.userId, {
      energons: user.energons - boosterConfig.cost.energons,
      neutrons: (user.neutrons || 0) - (boosterConfig.cost.neutrons || 0),
      particles: (user.particles || 0) - (boosterConfig.cost.particles || 0),

      // Сохраняем информацию о бустере
      activeBoosterType: args.boosterType,
      activeBoosterName: boosterConfig.name,
      boosterEndTime: Date.now() + boosterConfig.duration * 1000,

      // Устанавливаем множители в зависимости от типа бустера
      productionMultiplier: newProductionMultiplier,
      clickMultiplier: newClickMultiplier
    });

    // Логируем активацию бустера
    await ctx.db.insert("statistics", {
      userId: args.userId,
      event: "booster_activated",
      timestamp: Date.now(),
      value: 0,
      metadata: JSON.stringify({
        boosterType: args.boosterType,
        boosterName: boosterConfig.name,
        duration: boosterConfig.duration,
      }),
    });

    return {
      success: true,
      duration: boosterConfig.duration,
      boosterName: boosterConfig.name,
    };
  },
});
