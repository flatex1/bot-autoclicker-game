import dotenv from 'dotenv';
dotenv.config();

// Проверка наличия необходимых переменных окружения
if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN не определен в файле .env');
}

export const config = {
  botToken: process.env.BOT_TOKEN,
  autoClickInterval: 10000, // Интервал автоклика в миллисекундах
  upgradeBaseCost: 50, // Базовая стоимость улучшения
  upgradeMultiplier: 1.5, // Множитель стоимости улучшения
}; 