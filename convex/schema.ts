/**
 * Схема базы данных приложения "Атомный Прогресс"
 * Определяет структуру таблиц и связи между ними
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Таблица пользователей - основная информация о пользователях
  users: defineTable({
    // Идентификация пользователя
    telegramId: v.number(), // ID пользователя в Telegram
    username: v.optional(v.string()), // Имя пользователя в Telegram
    firstName: v.optional(v.string()), // Имя пользователя
    lastName: v.optional(v.string()), // Фамилия пользователя
    
    // Основные ресурсы
    energons: v.number(), // Основная валюта
    neutrons: v.number(), // Вторичная валюта
    particles: v.number(), // Престижная валюта
    
    // Статистика производства
    totalProduction: v.number(), // Общее производство в секунду
    productionMultiplier: v.optional(v.number()), // Множитель производства
    
    // Статистика кликов
    totalClicks: v.number(), // Общее количество кликов
    manualClicks: v.number(), // Количество ручных кликов
    clickMultiplier: v.optional(v.number()), // Множитель кликов
    
    // Статистика игровой активности
    lastActivity: v.number(), // Время последней активности
    createdAt: v.number(), // Время создания аккаунта
    
    // Бустеры
    activeBoosterType: v.optional(v.string()), // Тип активного бустера
    boosterEndTime: v.optional(v.number()), // Время окончания действия бустера
    researchMultiplier: v.optional(v.number()), // Множитель исследований
    sellMultiplier: v.optional(v.number()), // Множитель продажи ресурсов
    
    // Бонусы
    dailyBonusClaimed: v.boolean(), // Получен ли ежедневный бонус
    bonusStreak: v.number(), // Сколько дней подряд получен бонус
    nextSatelliteBonusTime: v.optional(v.number()), // Время следующего бонуса от спутника
    
    // Административное
    banned: v.boolean(), // Забанен ли пользователь
    isAdmin: v.boolean(), // Является ли пользователь администратором
  })
  .index("by_telegramId", ["telegramId"]) // Для быстрого поиска по Telegram ID
  .index("by_totalProduction", ["totalProduction"]), // Для сортировки по производству
  
  // Таблица комплексов - научные и производственные комплексы игроков
  complexes: defineTable({
    userId: v.id("users"), // ID пользователя
    type: v.string(), // Тип комплекса (KOLLEKTIV-1, ZARYA-M и т.д.)
    level: v.number(), // Уровень комплекса
    production: v.number(), // Производство ресурсов в секунду
    lastUpgraded: v.number(), // Время последнего улучшения
    createdAt: v.number(), // Время создания
  })
  .index("by_userId", ["userId"]) // Для поиска всех комплексов пользователя
  .index("by_userAndType", ["userId", "type"]), // Для поиска конкретного комплекса пользователя
  
  // Таблица рейтинга - для быстрого доступа к отсортированным данным
  leaderboard: defineTable({
    userId: v.id("users"), // ID пользователя
    telegramId: v.number(), // ID пользователя в Telegram
    username: v.optional(v.string()), // Имя пользователя в Telegram
    firstName: v.optional(v.string()), // Имя пользователя
    energons: v.number(), // Количество энергонов
    totalLevel: v.number(), // Общий уровень всех комплексов
    totalProduction: v.number(), // Общее производство в секунду
    createdAt: v.number(), // Время создания записи
    updatedAt: v.number(), // Время обновления записи
  })
  .index("by_userId", ["userId"]) // Для поиска записи конкретного пользователя
  .index("by_energons", ["energons"]) // Для сортировки по энергонам
  .index("by_totalProduction", ["totalProduction"]), // Для сортировки по производству
  
  // Таблица статистики - для отслеживания активности пользователей
  statistics: defineTable({
    userId: v.id("users"), // ID пользователя
    event: v.string(), // Тип события (manual_click, complex_upgrade, etc.)
    value: v.number(), // Числовое значение события
    timestamp: v.number(), // Время события
    metadata: v.optional(v.string()), // Дополнительные данные в JSON
  })
  .index("by_userId", ["userId"]) // Для поиска всех событий пользователя
  .index("by_timestamp", ["timestamp"]), // Для сортировки по времени
  
  // Таблица сессий - для хранения состояния диалога с ботом
  sessions: defineTable({
    userId: v.id("users"), // ID пользователя
    chatId: v.number(), // ID чата в Telegram
    state: v.string(), // Текущее состояние сессии
    data: v.optional(v.string()), // Данные сессии в JSON
    updatedAt: v.number(), // Время обновления
  })
  .index("by_userId", ["userId"]) // Для поиска сессии пользователя
  .index("by_chatId", ["chatId"]), // Для поиска по ID чата
  
  // Таблица промокодов
  promoCodes: defineTable({
    code: v.string(), // Код промокода
    reward: v.object({
      energons: v.optional(v.number()),
      neutrons: v.optional(v.number()),
      particles: v.optional(v.number())
    }), // Награда (ресурсы)
    usageLimit: v.number(), // Лимит использований
    usedCount: v.number(), // Количество использований
    expiresAt: v.optional(v.number()), // Время истечения
    createdAt: v.number(), // Время создания
  })
  .index("by_code", ["code"]), // Для быстрого поиска по коду

  // Таблица использованных промокодов
  promoUsage: defineTable({
    userId: v.id("users"),
    promoId: v.id("promoCodes"),
    usedAt: v.number(),
  })
  .index("by_user_and_promo", ["userId", "promoId"]), // Для проверки использования
}); 