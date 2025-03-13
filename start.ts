/**
 * Точка входа в приложение
 * Загружает переменные окружения и запускает бота
 */
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем переменные окружения из файла .env.local или .env
function loadEnvironmentVariables() {
  // Определяем путь к локальному файлу .env
  const localEnvPath = path.resolve(process.cwd(), '.env.local');
  const envPath = path.resolve(process.cwd(), '.env');
  
  try {
    // Сначала пробуем .env.local как приоритетный
    if (fs.existsSync(localEnvPath)) {
      const envConfig = dotenv.parse(fs.readFileSync(localEnvPath));
      for (const key in envConfig) {
        process.env[key] = envConfig[key];
      }
      console.log('Файл .env.local успешно загружен');
    }
    // Если .env.local не существует, используем .env
    else if (fs.existsSync(envPath)) {
      dotenv.config();
      console.log('Файл .env успешно загружен');
    } 
    // Если ни один файл не найден, используем системные переменные
    else {
      console.log('Файлы .env не найдены, используются системные переменные окружения');
    }
    
    // Проверяем обязательные переменные окружения
    validateEnvironment();
  } catch (err) {
    console.error('Ошибка при загрузке переменных окружения:', err);
    process.exit(1);
  }
}

// Проверка обязательных переменных окружения
function validateEnvironment() {
  const requiredVars = ['BOT_TOKEN', 'CONVEX_URL'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error(`Отсутствуют обязательные переменные окружения: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// Загружаем переменные окружения
loadEnvironmentVariables();

// Импортируем бота только после загрузки переменных окружения
const bot = await import('./bot.js');

// Обработка завершения процесса
process.on('SIGINT', () => {
  console.log('Завершение работы бота...');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  console.error('Необработанное отклонение промиса:', reason);
});

// Запускаем бота
console.log('Запуск бота...');
bot.default.start();