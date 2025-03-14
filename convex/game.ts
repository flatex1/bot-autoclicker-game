/**
 * Основной файл, реэкспортирующий все функции игры
 */
import { getUserStatus } from "./userStatus.js";
import { getComplexUpgradeCost, getUserComplexes, buyComplex, upgradeComplex } from "./complexes.js";
import { getAvailableBoosters, activateBooster } from "./boosters.js";
import { updateLeaderboard, getUsersLeaderboard, getUserLeaderboardPosition } from "./leaderboard.js";
import { resetDailyBonuses } from "./production.js";
import { processSatelliteBonus } from "./satellites.js";

// Реэкспортируем все функции
export {
  // userStatus
  getUserStatus,
  
  // complexes
  getComplexUpgradeCost,
  getUserComplexes,
  buyComplex,
  upgradeComplex,
  
  // boosters
  getAvailableBoosters,
  activateBooster,
  
  // leaderboard
  updateLeaderboard,
  getUsersLeaderboard,
  getUserLeaderboardPosition,
  
  // production
  resetDailyBonuses,
  
  // satellites
  processSatelliteBonus,
};