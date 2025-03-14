/**
 * Интерфейсы и клавиатуры для телеграм-бота
 * Содержит функции для создания клавиатур и меню
 */
import { InlineKeyboard } from "grammy";

// Интерфейс для типа комплекса, используемого в клавиатуре
interface ComplexKeyboardItem {
  name: string;
  type: string;
  upgradeCost:
    | number
    | {
        energons: number;
        neutrons?: number;
        particles?: number;
      };
}

// Интерфейс для типа бустера, используемого в клавиатуре
interface BoosterKeyboardItem {
  name: string;
  type: string;
  cost: {
    energons: number;
    neutrons?: number;
    particles?: number;
  };
}

// Базовая клавиатура для основных действий
export function getMainKeyboard() {
  return new InlineKeyboard()
    .row()
    .text("⚛️ Расщепить атом", "click_atom")
    .row()
    .text("🏭 Комплексы", "show_complexes")
    .text("👤 Кабинет", "show_cabinet")
    .row()
    .text("🚀 Разработки", "show_boosters")
    .text("📊 Рейтинг", "show_leaderboard");
}

// Клавиатура для меню комплексов
export function getComplexesKeyboard(complexes: ComplexKeyboardItem[]) {
  const keyboard = new InlineKeyboard();

  // Добавляем кнопки улучшения для каждого комплекса
  complexes.forEach((complex) => {
    // Формируем текст стоимости в зависимости от типа
    let costText = "";

    if (typeof complex.upgradeCost === "number") {
      costText = `${complex.upgradeCost} Э`;
    } else {
      costText = `${complex.upgradeCost.energons} Э`;

      // Добавляем другие ресурсы, если они есть
      if (complex.upgradeCost.neutrons) {
        costText += ` + ${complex.upgradeCost.neutrons} Н`;
      }
      if (complex.upgradeCost.particles) {
        costText += ` + ${complex.upgradeCost.particles} КЧ`;
      }
    }

    keyboard
      .row()
      .text(
        `🔧 Улучшить ${complex.name} (${costText})`,
        `upgrade_complex:${complex.type}`
      );
  });

  // Кнопка возврата в главное меню
  keyboard.row().text("« Назад", "back_to_main");

  return keyboard;
}

// Клавиатура для меню бустеров
export function getBoostersKeyboard(boosters: BoosterKeyboardItem[]) {
  const keyboard = new InlineKeyboard();

  // Добавляем кнопки активации для каждого бустера
  boosters.forEach((booster) => {
    keyboard
      .row()
      .text(
        `🚀 ${booster.name} (${booster.cost.energons} Э)`,
        `activate_booster:${booster.type}`
      );
  });

  // Кнопка возврата в главное меню
  keyboard.row().text("« Назад", "back_to_main");

  return keyboard;
}

// Клавиатура для рейтинга
export function getLeaderboardKeyboard() {
  return new InlineKeyboard()
    .row()
    .text("По Энергонам", "leaderboard:energons")
    .text("По Производству", "leaderboard:production")
    .row()
    .text("« Назад", "back_to_main");
}
