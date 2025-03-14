/**
 * Функции для отображения различных меню бота
 * Содержит логику формирования и отображения интерфейсов
 */
import { api } from "./convex/_generated/api.js";
import { BotContext } from "./types.js";
import {
  getComplexesKeyboard,
  getBoostersKeyboard,
  getMainKeyboard,
  getLeaderboardKeyboard,
} from "./keyboards.js";
import { InlineKeyboard } from "grammy";
import { BOOSTER_CONFIGS, COMPLEX_CONFIGS } from "./convex/constants.js";

// Показать меню профиля пользователя
export async function showCabinet(ctx: BotContext) {
  try {
    if (!ctx.session.userId) {
      return ctx.reply("Пожалуйста, начните с команды /start");
    }

    const user = await ctx.convex.query(api.users.getUserByTelegramId, {
      telegramId: ctx.from?.id!,
    });

    if (!user) {
      return ctx.reply(
        "Ваш профиль не найден. Пожалуйста, используйте /start для регистрации."
      );
    }

    const userStatus = await ctx.convex.query(api.game.getUserStatus, {
      userId: ctx.session.userId,
    });

    let boosterInfo = "";
    if (userStatus.activeBooster) {
      const minutes = Math.floor(userStatus.activeBooster.timeLeft / 60);
      const seconds = userStatus.activeBooster.timeLeft % 60;

      const boosterName = userStatus.activeBooster.name || "Разработка неизвестного происхождения";

      boosterInfo =
        `\n\n🚀 *Активный бустер:* ${boosterName}\n` +
        `⏱ Осталось времени: ${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    await ctx.reply(
      `📊 *Кабинет научного сотрудника*\n\n` +
        `👤 *${user.firstName || "Товарищ"}*\n` +
        `💡 *Энергоны:* ${userStatus.energons}\n` +
        `🔬 *Нейтроны:* ${userStatus.neutrons}\n` +
        `✨ *Квантовые частицы:* ${userStatus.particles}\n\n` +
        `⚡ *Мощность клика:* ${userStatus.clickPower}\n` +
        `⚛️ *Производство:* ${userStatus.totalProduction} ед./сек${boosterInfo}`,
      {
        parse_mode: "Markdown",
        reply_markup: getMainKeyboard(),
      }
    );
  } catch (error) {
    console.error("Ошибка при получении профиля:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке профиля. Пожалуйста, попробуйте позже."
    );
  }
}

// Показать комплексы пользователя
export async function showComplexesMenu(ctx: BotContext) {
  try {
    if (!ctx.session.userId) {
      return ctx.reply("Пожалуйста, начните с команды /start");
    }

    // Получаем все комплексы пользователя
    const complexes = await ctx.convex.query(api.game.getUserComplexes, {
      userId: ctx.session.userId,
    });

    // Фильтруем только приобретенные комплексы
    const userComplexes = complexes.filter((c) => c.level > 0);

    let messageText = "🏭 *Ваши научные комплексы:*\n\n";

    if (userComplexes.length === 0) {
      messageText +=
        "У вас пока нет научных комплексов. Приобретите свой первый комплекс!\n\n";
    } else {
      messageText += `У вас ${userComplexes.length} комплекс(ов).\n\n`;
    }

    const keyboard = new InlineKeyboard();

    // Добавляем кнопки для комплексов пользователя
    userComplexes.forEach((complex) => {
      keyboard
        .row()
        .text(
          `${complex.name} (Ур. ${complex.level}) - ${complex.production} ед./сек`,
          `show_complex_details:${complex.type}`
        );
    });

    // Добавляем кнопку для приобретения новых комплексов
    keyboard
      .row()
      .text("🏗 Приобрести новый комплекс", "show_available_complexes");

    // Кнопка возврата в главное меню
    keyboard.row().text("⬅️ Назад", "back_to_main");

    await ctx.reply(messageText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("Ошибка при отображении комплексов:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке комплексов. Пожалуйста, попробуйте позже."
    );
  }
}

// Показать доступные для покупки комплексы
export async function showAvailableComplexes(ctx: BotContext) {
  try {
    // Получаем все комплексы
    const complexes = await ctx.convex.query(api.game.getUserComplexes, {
      userId: ctx.session.userId!,
    });

    // Фильтруем только доступные для покупки комплексы
    const availableComplexes = complexes.filter(
      (c) => c.level === 0 && c.isUnlocked
    );

    let messageText = "🏗 *Доступные для постройки комплексы:*\n\n";

    if (availableComplexes.length === 0) {
      messageText +=
        "В данный момент нет доступных для постройки комплексов.\nУлучшайте существующие комплексы для разблокировки новых!\n\n";
    }

    const keyboard = new InlineKeyboard();

    // Добавляем кнопки для доступных комплексов
    availableComplexes.forEach((complex) => {
      keyboard
        .row()
        .text(
          `${complex.name} - ${complex.upgradeCost.energons} Э`,
          `show_complex_buy_details:${complex.type}`
        );
    });

    // Кнопка возврата в меню комплексов
    keyboard.row().text("⬅️ Назад к комплексам", "show_complexes");

    await ctx.reply(messageText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("Ошибка при отображении доступных комплексов:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке доступных комплексов. Пожалуйста, попробуйте позже."
    );
  }
}

// Показать детали комплекса
export async function showComplexDetails(ctx: BotContext, complexType: string) {
  try {
    // Получаем информацию о комплексе
    const complex = await ctx.convex.query(
      api.complexes.getComplexUpgradeCost,
      {
        userId: ctx.session.userId!,
        complexType,
      }
    );

    const complexImage =
      COMPLEX_CONFIGS[complexType as keyof typeof COMPLEX_CONFIGS]?.image;

    let messageText = `🏭 *${complex.name} (Уровень ${complex.currentLevel})*\n\n`;
    messageText += `⚡ *Производство:* ${complex.production} ед./сек\n`;
    messageText += `📈 *После улучшения:* ${complex.nextProduction} ед./сек\n\n`;

    // Добавляем специфическую информацию в зависимости от типа комплекса
    if (complexType === "ZARYA-M") {
      messageText += `🔋 *Бонус к производству энергонов:* +${complex.currentLevel * 5}%\n`;
      messageText += `🔋 *После улучшения:* +${complex.nextLevel * 5}%\n\n`;
    } else if (complexType === "AKADEMGOROD-17") {
      messageText += `🔬 *Бонус к общему производству:* +${complex.currentLevel * 10}%\n`;
      messageText += `🔬 *После улучшения:* +${complex.nextLevel * 10}%\n\n`;
    }

    messageText += `💰 *Стоимость улучшения:* ${complex.energonCost} Энергонов`;
    if (complex.neutronCost)
      messageText += `, ${complex.neutronCost} Нейтронов`;
    if (complex.particleCost)
      messageText += `, ${complex.particleCost} Квантовых частиц`;

    const keyboard = new InlineKeyboard();

    // Кнопка улучшения
    keyboard
      .row()
      .text(
        `🔧 Улучшить до уровня ${complex.nextLevel}`,
        `upgrade_complex:${complexType}`
      );

    // Кнопка возврата
    keyboard.row().text("⬅️ Назад к комплексам", "show_complexes");

    // Если есть изображение для этого комплекса
    if (complexImage) {
      const { InputFile } = await import("grammy");
      await ctx.replyWithPhoto(new InputFile(complexImage), {
        caption: messageText,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await ctx.reply(messageText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  } catch (error) {
    console.error("Ошибка при отображении деталей комплекса:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке деталей комплекса. Пожалуйста, попробуйте позже."
    );
  }
}

// Показать детали комплекса для покупки
export async function showComplexBuyDetails(
  ctx: BotContext,
  complexType: string
) {
  try {
    // Получаем информацию о комплексе
    const complex = await ctx.convex.query(
      api.complexes.getComplexUpgradeCost,
      {
        userId: ctx.session.userId!,
        complexType,
      }
    );

    const complexConfig =
      COMPLEX_CONFIGS[complexType as keyof typeof COMPLEX_CONFIGS];
    const complexImage = complexConfig?.image;
    const complexDescription = complexConfig?.description;

    let messageText = `🏗 *${complex.name}*\n\n`;

    if (complexDescription) {
      messageText += `📝 *Описание:* ${complexDescription}\n\n`;
    }

    messageText += `⚡ *Базовое производство:* ${complex.nextProduction} ед./сек\n\n`;
    messageText += `💰 *Стоимость:* ${complex.energonCost} Энергонов`;
    if (complex.neutronCost)
      messageText += `, ${complex.neutronCost} Нейтронов`;
    if (complex.particleCost)
      messageText += `, ${complex.particleCost} Квантовых частиц`;

    const keyboard = new InlineKeyboard();

    // Кнопка покупки
    keyboard
      .row()
      .text(`🏗 Построить ${complex.name}`, `buy_complex:${complexType}`);

    // Кнопка возврата
    keyboard.row().text("⬅️ Назад к списку", "show_available_complexes");

    // Если есть изображение для этого комплекса
    if (complexImage) {
      const { InputFile } = await import("grammy");
      await ctx.replyWithPhoto(new InputFile(complexImage), {
        caption: messageText,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await ctx.reply(messageText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  } catch (error) {
    console.error(
      "Ошибка при отображении деталей комплекса для покупки:",
      error
    );
    await ctx.reply(
      "Произошла ошибка при загрузке деталей комплекса. Пожалуйста, попробуйте позже."
    );
  }
}

// Показать меню бустеров
export async function showBoostersMenu(ctx: BotContext) {
  try {
    // Получаем доступные бустеры и статус пользователя
    const userStatus = await ctx.convex.query(api.game.getUserStatus, {
      userId: ctx.session.userId!,
    });

    const boosters = await ctx.convex.query(api.game.getAvailableBoosters, {
      userId: ctx.session.userId!,
    });

    let messageText = "🚀 *Научные разработки*\n\n";

    // Добавляем информацию об активном бустере, если есть
    if (userStatus.activeBooster) {
      const activeBoosterConfig = BOOSTER_CONFIGS[
        userStatus.activeBooster.type as keyof typeof BOOSTER_CONFIGS
      ] || { name: "Бустер", description: "Активный бустер" };

      const minutes = Math.floor(userStatus.activeBooster.timeLeft / 60);
      const seconds = userStatus.activeBooster.timeLeft % 60;

      messageText += `🔬 *Активный бустер:*\n`;
      messageText += `${activeBoosterConfig.name}\n`;
      messageText += `⏱ Осталось: ${minutes}:${seconds.toString().padStart(2, "0")}\n\n`;
    } else {
      messageText += "*Нет активных разработок*\n\n";
    }

    messageText += "*Доступные бустеры:*\n\n";

    const keyboard = new InlineKeyboard();

    // Добавляем каждый доступный бустер
    for (const booster of boosters) {
      const boosterConfig = BOOSTER_CONFIGS[
        booster.type as keyof typeof BOOSTER_CONFIGS
      ] || { name: booster.name, description: booster.description };

      messageText += `*${boosterConfig.name}*\n`;
      messageText += `📝 ${boosterConfig.description}\n`;

      let costText = `${booster.cost.energons} Энергонов`;
      if (booster.cost.neutrons)
        costText += ` + ${booster.cost.neutrons} Нейтронов`;
      if (booster.cost.particles)
        costText += ` + ${booster.cost.particles} Частиц`;

      messageText += `💰 Стоимость: ${costText}\n\n`;

      // Проверяем, хватает ли ресурсов
      let canAfford = userStatus.energons >= booster.cost.energons;
      if (booster.cost.neutrons)
        canAfford = canAfford && userStatus.neutrons >= booster.cost.neutrons;
      if (booster.cost.particles)
        canAfford = canAfford && userStatus.particles >= booster.cost.particles;

      if (canAfford && !userStatus.activeBooster) {
        keyboard
          .row()
          .text(
            `Активировать ${boosterConfig.name}`,
            `activate_booster:${booster.type}`
          );
      }
    }

    // Кнопка возврата
    keyboard.row().text("⬅️ Назад", "back_to_main");

    await ctx.reply(messageText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("Ошибка при отображении бустеров:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке разработок. Пожалуйста, попробуйте позже."
    );
  }
}

// Показать рейтинг игроков
export async function showLeaderboard(ctx: BotContext, type = "energons") {
  try {
    if (!ctx.session.userId) {
      return ctx.reply("Пожалуйста, начните с команды /start");
    }

    const leaderboard = await ctx.convex.query(api.game.getUsersLeaderboard, {
      type,
      limit: 10,
    });

    if (leaderboard.length === 0) {
      return ctx.reply("Рейтинг пока формируется. Попробуйте позже.");
    }

    let titleMap: Record<string, string> = {
      energons: "ЭНЕРГОНАМ",
      production: "ПРОИЗВОДСТВУ",
      neutrons: "НЕЙТРОНАМ",
      particles: "КВАНТОВЫМ ЧАСТИЦАМ",
    };

    let leaderboardText = `🏆 *ТОП ПО ${titleMap[type] || "ЭНЕРГОНАМ"}* 🏆\n\n`;

    leaderboard.forEach((entry: any, index: number) => {
      const medal =
        index === 0
          ? "🥇"
          : index === 1
            ? "🥈"
            : index === 2
              ? "🥉"
              : `${index + 1}.`;
      const name = entry.firstName || entry.username || "Ученый";
      leaderboardText += `${medal} *${name}*\n`;

      if (type === "energons") {
        leaderboardText += `💡 ${entry.energons} энергонов | ⚛️ ${entry.totalProduction} ед/сек\n\n`;
      } else if (type === "production") {
        leaderboardText += `⚛️ ${entry.totalProduction} ед/сек | 💡 ${entry.energons} энергонов\n\n`;
      } else if (type === "neutrons") {
        leaderboardText += `🔬 ${entry.neutrons} нейтронов | 💡 ${entry.energons} энергонов\n\n`;
      } else if (type === "particles") {
        leaderboardText += `✨ ${entry.particles} частиц | 💡 ${entry.energons} энергонов\n\n`;
      }
    });

    const userPosition = await ctx.convex.query(
      api.game.getUserLeaderboardPosition,
      {
        userId: ctx.session.userId!,
        type,
      }
    );

    if (userPosition && userPosition.position > 10) {
      leaderboardText += `\n\n*Ваша позиция в рейтинге: ${userPosition.position}*`;

      if (type === "energons") {
        leaderboardText += `💡 ${userPosition.energons} энергонов | ⚛️ ${userPosition.totalProduction} ед/сек`;
      } else if (type === "production") {
        leaderboardText += `⚛️ ${userPosition.totalProduction} ед/сек | 💡 ${userPosition.energons} энергонов`;
      } else if (type === "neutrons") {
        leaderboardText += `🔬 ${userPosition.neutrons} нейтронов | 💡 ${userPosition.energons} энергонов`;
      } else if (type === "particles") {
        leaderboardText += `✨ ${userPosition.particles} частиц | 💡 ${userPosition.energons} энергонов`;
      }
    }

    await ctx.reply(leaderboardText, {
      parse_mode: "Markdown",
      reply_markup: getLeaderboardKeyboard(),
    });
  } catch (error) {
    console.error("Ошибка при загрузке рейтинга:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке рейтинга. Пожалуйста, попробуйте позже."
    );
  }
}
