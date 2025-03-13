/**
 * Схема базы данных приложения
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
    
    // Игровая статистика
    clicks: v.number(), // Текущее количество кликов (валюта)
    totalClicks: v.number(), // Общее количество кликов за все время
    
    // Улучшения
    autoClickLevel: v.number(), // Уровень автокликера
    autoClicksPerSecond: v.number(), // Количество кликов в секунду от автокликера
    
    // Метаданные
    lastActivity: v.number(), // Время последней активности (timestamp в мс)
    createdAt: v.optional(v.number()), // Время создания аккаунта
    banned: v.optional(v.boolean()), // Флаг блокировки пользователя
    
    // Сессия и безопасность
    sessionId: v.optional(v.string()), // Идентификатор сессии для авторизации
    lastIp: v.optional(v.string()), // Последний IP адрес
    
    // Новые поля для бонусов и бустеров
    lastBonusTime: v.optional(v.number()), // Время последнего полученного бонуса
    bonusStreak: v.optional(v.number()), // Серия ежедневных бонусов
    boosterEndTime: v.optional(v.number()), // Время окончания действия бустера
    clickMultiplier: v.optional(v.number()), // Текущий множитель кликов
    
    // Поля для достижений
    achievements: v.optional(v.array(v.string())), // Список полученных достижений
  })
  .index("by_telegramId", ["telegramId"]) // Для быстрого поиска по telegram ID
  .index("by_lastActivity", ["lastActivity"]) // Для поиска активных пользователей
  .index("by_autoClicksPerSecond", ["autoClicksPerSecond"]), // Для поиска пользователей с автокликом
  
  // Таблица обновлений и улучшений
  upgrades: defineTable({
    userId: v.id("users"), // Ссылка на пользователя
    type: v.string(), // Тип улучшения (например, "autoclick", "multiplier")
    level: v.number(), // Уровень улучшения
    cost: v.number(), // Стоимость улучшения
    effect: v.number(), // Эффект улучшения
    purchasedAt: v.number(), // Время покупки
  })
  .index("by_userId", ["userId"]) // Для быстрого поиска улучшений пользователя
  .index("by_userAndType", ["userId", "type"]), // Для поиска конкретных улучшений
  
  // Таблица для рейтинга игроков
  leaderboard: defineTable({
    userId: v.id("users"), // Ссылка на пользователя
    clicks: v.number(), // Количество кликов (для сортировки)
    updatedAt: v.number(), // Время последнего обновления
  })
  .index("by_clicks", ["clicks"]) // Для сортировки по кликам
  .index("by_userId", ["userId"]), // Для обновления записи конкретного пользователя
  
  // Таблица событий и статистики
  statistics: defineTable({
    userId: v.id("users"), // Ссылка на пользователя
    event: v.string(), // Тип события: "click", "upgrade", "autoclick" и т.д.
    value: v.number(), // Значение (кол-во кликов, уровень и т.д.)
    timestamp: v.number(), // Время события
    metadata: v.optional(v.string()), // Дополнительные данные в формате JSON
  })
  .index("by_userId", ["userId"]) // Для получения всех событий пользователя
  .index("by_userAndEvent", ["userId", "event"]) // Для фильтрации по типам событий
  .index("by_timestamp", ["timestamp"]), // Для анализа по времени

  // Новая таблица для промокодов
  promoCodes: defineTable({
    code: v.string(), // Код промокода
    reward: v.number(), // Награда (клики)
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