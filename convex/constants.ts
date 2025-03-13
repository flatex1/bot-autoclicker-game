/**
 * Константы и конфигурации для игры
 */

// Конфигурация научных комплексов
export const COMPLEX_CONFIGS = {
  "KOLLEKTIV-1": {
    name: "КОЛЛЕКТИВ-1",
    description: "Базовый генератор энергии. Производит 1 Энергон в секунду.",
    baseProduction: 1,
    baseCost: {
      energons: 100,
    },
    costMultiplier: 1.5,
  },
  "ZARYA-M": {
    name: "ЗАРЯ-М",
    description: "Увеличивает производство Энергонов на 5% за уровень.",
    baseProduction: 0,
    baseCost: {
      energons: 500,
    },
    costMultiplier: 1.6,
    requiredComplex: "KOLLEKTIV-1",
    requiredLevel: 3,
  },
  "SOYUZ-ATOM": {
    name: "СОЮЗ-АТОМ",
    description:
      "Производит Нейтроны - вторичную валюту для продвинутых разработок.",
    baseProduction: 0.2,
    baseCost: {
      energons: 2000,
    },
    costMultiplier: 1.7,
    requiredComplex: "KOLLEKTIV-1",
    requiredLevel: 5,
  },
  "KRASNIY-CIKLOTRON": {
    name: "КРАСНЫЙ ЦИКЛОТРОН",
    description: "Увеличивает мощность клика на 10% за уровень.",
    baseProduction: 0,
    baseCost: {
      energons: 1500,
    },
    costMultiplier: 1.7,
    requiredComplex: "KOLLEKTIV-1",
    requiredLevel: 5,
  },
  "AKADEMGOROD-17": {
    name: "АКАДЕМГОРОД-17",
    description:
      "Обучает научных сотрудников, дающих пассивные бонусы ко всему производству.",
    baseProduction: 0,
    baseCost: {
      energons: 5000,
      neutrons: 100,
    },
    costMultiplier: 1.8,
    requiredComplex: "SOYUZ-ATOM",
    requiredLevel: 3,
  },
  "SPUTNIK-GAMMA": {
    name: "СПУТНИК-ГАММА",
    description: "Даёт бонусы ко всем ресурсам каждые 30 минут.",
    baseProduction: 0,
    baseCost: {
      energons: 10000,
      neutrons: 500,
    },
    costMultiplier: 2.0,
    requiredComplex: "AKADEMGOROD-17",
    requiredLevel: 2,
  },
  "KVANT-SIBIR": {
    name: "КВАНТ-СИБИРЬ",
    description: "Генерирует Квантовые Частицы для престижных улучшений.",
    baseProduction: 0.05,
    baseCost: {
      energons: 25000,
      neutrons: 1000,
    },
    costMultiplier: 2.2,
    requiredComplex: "SPUTNIK-GAMMA",
    requiredLevel: 2,
  },
  "MATERIYA-3": {
    name: "МАТЕРИЯ-3",
    description: "Создаёт редкие материалы для особых улучшений.",
    baseProduction: 0,
    baseCost: {
      energons: 50000,
      neutrons: 2500,
    },
    costMultiplier: 2.5,
    requiredComplex: "KVANT-SIBIR",
    requiredLevel: 3,
  },
  "MOZG-MACHINA": {
    name: "МОЗГ-МАШИНА",
    description: "Автоматизирует часть кликов (автокликер внутри игры).",
    baseProduction: 0,
    baseCost: {
      energons: 75000,
      neutrons: 5000,
      particles: 100,
    },
    costMultiplier: 3.0,
    requiredComplex: "MATERIYA-3",
    requiredLevel: 2,
  },
  "POLYUS-K88": {
    name: "ПОЛЮС-К88",
    description: "Открывает сезонные события с уникальными наградами.",
    baseProduction: 0,
    baseCost: {
      energons: 100000,
      neutrons: 10000,
      particles: 250,
    },
    costMultiplier: 3.5,
    requiredComplex: "MOZG-MACHINA",
    requiredLevel: 2,
  },
};

// Конфигурация временных бустеров
export const BOOSTER_CONFIGS = {
  "PROTON-M87": {
    name: "Протон-М87",
    description: "+200% к производству на 4 часа",
    duration: 4 * 60 * 60, // 4 часа в секундах
    multiplier: 3.0, // +200%
    cost: {
      energons: 5000,
    },
    requiredComplex: "ZARYA-M",
    requiredLevel: 2,
  },
  "RED-STAR": {
    name: "Красная Звезда",
    description: "Мгновенно добавляет 24 часа производства",
    duration: 1, // Мгновенный эффект
    multiplier: 1.0,
    cost: {
      energons: 10000,
      neutrons: 500,
    },
    requiredComplex: "SOYUZ-ATOM",
    requiredLevel: 5,
  },
  "ATOMIC-HEART-42": {
    name: "Атомное Сердце-42",
    description: "Удваивает скорость всех исследований на 12 часов",
    duration: 12 * 60 * 60, // 12 часов в секундах
    multiplier: 2.0,
    cost: {
      energons: 15000,
      neutrons: 1000,
    },
    requiredComplex: "AKADEMGOROD-17",
    requiredLevel: 3,
  },
  "IRON-COMRADE": {
    name: "Железный Товарищ",
    description: "Автоматически собирает бонусы на 8 часов",
    duration: 8 * 60 * 60, // 8 часов в секундах
    multiplier: 1.0,
    cost: {
      energons: 20000,
      neutrons: 2000,
    },
    requiredComplex: "SPUTNIK-GAMMA",
    requiredLevel: 3,
  },
  "T-POLYMER": {
    name: "Т-Полимер",
    description: "Увеличивает стоимость всех ресурсов на 150% на 6 часов",
    duration: 6 * 60 * 60, // 6 часов в секундах
    multiplier: 2.5, // +150%
    cost: {
      energons: 25000,
      neutrons: 3000,
      particles: 50,
    },
    requiredComplex: "KVANT-SIBIR",
    requiredLevel: 2,
  },
};
