import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bot from './bot.js';

// Получаем путь к текущей директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем переменные окружения из .env.local
dotenv.config({ path: join(__dirname, '.env.local') });

console.log('Запуск бота...');
bot.start(); 