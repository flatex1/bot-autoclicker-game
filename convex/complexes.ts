/**
 * Функции для работы с научными комплексами
 */
import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { COMPLEX_CONFIGS } from "./constants.js";
import { updateUserTotalProduction } from "./utils.js";

type ComplexConfig = {
  name: string;
  description: string;
  baseProduction: number;
  baseCost: {
    energons: number;
    neutrons?: number;
    particles?: number;
  };
  costMultiplier?: number;
  requiredComplex?: string;
  requiredLevel?: number;
};

// Получение стоимости улучшения комплекса
export const getComplexUpgradeCost = query({
  args: {
    userId: v.id("users"),
    complexType: v.string(),
  },
  returns: v.object({
    name: v.string(),
    energonCost: v.number(),
    neutronCost: v.optional(v.number()),
    particleCost: v.optional(v.number()),
    currentLevel: v.number(),
    nextLevel: v.number(),
    production: v.number(),
    nextProduction: v.number(),
    isUnlocked: v.boolean(),
    requiredLevel: v.optional(v.number()),
    requiredComplex: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Получаем текущий комплекс пользователя, если он существует
    const existingComplex = await ctx.db
      .query("complexes")
      .withIndex("by_userAndType", (q) =>
        q.eq("userId", args.userId).eq("type", args.complexType)
      )
      .unique();

    // Получаем базовую конфигурацию комплекса
    const complexConfig = COMPLEX_CONFIGS[
      args.complexType as keyof typeof COMPLEX_CONFIGS
    ] as ComplexConfig;
    if (!complexConfig) {
      throw new Error(`Неизвестный тип комплекса: ${args.complexType}`);
    }

    const currentLevel = existingComplex?.level || 0;
    const nextLevel = currentLevel + 1;

    // Проверяем, разблокирован ли комплекс
    let isUnlocked = true;
    let requiredLevel, requiredComplex;

    if (complexConfig?.requiredComplex && currentLevel === 0) {
      // Проверяем наличие и уровень требуемого комплекса
      const requiredComplexData = await ctx.db
        .query("complexes")
        .withIndex("by_userAndType", (q) =>
          q
            .eq("userId", args.userId)
            .eq("type", complexConfig.requiredComplex!)
        )
        .unique();

      if (
        !requiredComplexData ||
        requiredComplexData.level < complexConfig.requiredLevel!
      ) {
        isUnlocked = false;
        requiredComplex = complexConfig.requiredComplex;
        requiredLevel = complexConfig.requiredLevel;
      }
    }

    // Рассчитываем текущее и будущее производство
    const baseProduction = complexConfig.baseProduction;
    const currentProduction = baseProduction * currentLevel;
    const nextProduction = baseProduction * nextLevel;

    // Рассчитываем стоимость улучшения с экспоненциальным ростом
    const baseCost = complexConfig.baseCost;
    const costMultiplier = complexConfig.costMultiplier || 1.5;

    const energonCost = Math.floor(
      baseCost.energons * Math.pow(costMultiplier, currentLevel)
    );

    // Для продвинутых комплексов рассчитываем стоимость в других ресурсах
    let neutronCost, particleCost;

    if (baseCost.neutrons) {
      neutronCost = Math.floor(
        baseCost.neutrons * Math.pow(costMultiplier, currentLevel)
      );
    }

    if (baseCost.particles) {
      particleCost = Math.floor(
        baseCost.particles * Math.pow(costMultiplier, currentLevel)
      );
    }

    return {
      name: complexConfig.name,
      energonCost,
      neutronCost,
      particleCost,
      currentLevel,
      nextLevel,
      production: currentProduction,
      nextProduction,
      isUnlocked,
      requiredLevel,
      requiredComplex,
    };
  },
});

// Получение всех комплексов пользователя
export const getUserComplexes = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      type: v.string(),
      name: v.string(),
      description: v.string(),
      level: v.number(),
      production: v.number(),
      isUnlocked: v.boolean(),
      upgradeCost: v.object({
        energons: v.number(),
        neutrons: v.optional(v.number()),
        particles: v.optional(v.number()),
      }),
      requiredComplex: v.optional(v.string()),
      requiredLevel: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    // Получаем все имеющиеся комплексы пользователя
    const userComplexes = await ctx.db
      .query("complexes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Формируем карту комплексов для быстрого доступа
    const complexMap = new Map();
    userComplexes.forEach((complex) => {
      complexMap.set(complex.type, complex);
    });

    // Формируем результат для всех возможных комплексов
    const result = [];

    for (const [type, config] of Object.entries(COMPLEX_CONFIGS)) {
      const userComplex = complexMap.get(type);
      const level = userComplex?.level || 0;

      // Проверяем, разблокирован ли комплекс
      let isUnlocked = true;

      if ("requiredComplex" in config && level === 0) {
        const configWithReq = config as ComplexConfig & {
          requiredComplex: string;
          requiredLevel: number;
        };
        const requiredComplex = complexMap.get(configWithReq.requiredComplex);
        if (
          !requiredComplex ||
          requiredComplex.level < configWithReq.requiredLevel
        ) {
          isUnlocked = false;
        }
      }

      // Рассчитываем стоимость следующего улучшения
      const nextLevel = level + 1;
      const costMultiplier = config.costMultiplier || 1.5;

      const energonCost = Math.floor(
        config.baseCost.energons * Math.pow(costMultiplier, level)
      );

      let neutronCost, particleCost;

      if ("neutrons" in config.baseCost) {
        neutronCost = Math.floor(
          config.baseCost.neutrons * Math.pow(costMultiplier, level)
        );
      }

      if ("particles" in config.baseCost) {
        particleCost = Math.floor(
          config.baseCost.particles * Math.pow(costMultiplier, level)
        );
      }

      result.push({
        type,
        name: config.name,
        description: config.description,
        level,
        production: level * config.baseProduction,
        isUnlocked,
        upgradeCost: {
          energons: energonCost,
          neutrons: neutronCost,
          particles: particleCost,
        },
        requiredComplex:
          "requiredComplex" in config ? config.requiredComplex : undefined,
        requiredLevel:
          "requiredLevel" in config ? config.requiredLevel : undefined,
      });
    }

    return result;
  },
});

// Покупка нового комплекса
export const buyComplex = mutation({
  args: {
    userId: v.id("users"),
    complexType: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    newLevel: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    // Получаем пользователя
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { success: false, error: "Пользователь не найден" };
    }

    // Получаем информацию о комплексе
    const complexConfig = COMPLEX_CONFIGS[args.complexType as keyof typeof COMPLEX_CONFIGS];
    if (!complexConfig) {
      return { success: false, error: "Неизвестный тип комплекса" };
    }

    // Проверяем, есть ли у пользователя достаточно ресурсов
    if (user.energons < complexConfig.baseCost.energons) {
      return { success: false, error: "Недостаточно энергонов" };
    }

    // Создаем новый комплекс
    const now = Date.now();
    await ctx.db.insert("complexes", {
      userId: args.userId,
      type: args.complexType,
      level: 1,
      production: complexConfig.baseProduction,
      lastUpgraded: now,
      createdAt: now,
    });

    // Списываем ресурсы у пользователя
    await ctx.db.patch(args.userId, {
      energons: user.energons - complexConfig.baseCost.energons,
    });

    // Обновляем общее производство пользователя
    await updateUserTotalProduction(ctx, args.userId);

    return { success: true, newLevel: 1 };
  },
});

// Улучшение существующего комплекса
export const upgradeComplex = mutation({
  args: {
    userId: v.id("users"),
    complexType: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    newLevel: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    // Получаем пользователя
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { success: false, error: "Пользователь не найден" };
    }

    // Получаем существующий комплекс
    const complex = await ctx.db
      .query("complexes")
      .withIndex("by_userAndType", (q) =>
        q.eq("userId", args.userId).eq("type", args.complexType)
      )
      .first();

    if (!complex) {
      return { success: false, error: "Комплекс не найден" };
    }

    // Расчет стоимости улучшения (упрощенно)
    const nextLevel = complex.level + 1;
    const upgradeCost = Math.floor(1000 * Math.pow(1.5, complex.level));

    // Проверяем, хватает ли ресурсов
    if (user.energons < upgradeCost) {
      return { success: false, error: "Недостаточно энергонов" };
    }

    // Обновляем комплекс
    const newProduction = Math.floor(complex.production * 1.2);
    await ctx.db.patch(complex._id, {
      level: nextLevel,
      production: newProduction,
      lastUpgraded: Date.now(),
    });

    // Списываем ресурсы
    await ctx.db.patch(args.userId, {
      energons: user.energons - upgradeCost,
    });

    // Обновляем общее производство
    await updateUserTotalProduction(ctx, args.userId);

    return {
      success: true,
      newLevel: nextLevel,
    };
  },
});
