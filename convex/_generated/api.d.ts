/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as autoclick from "../autoclick.js";
import type * as autoclickQueries from "../autoclickQueries.js";
import type * as boosters from "../boosters.js";
import type * as complexes from "../complexes.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as game from "../game.js";
import type * as leaderboard from "../leaderboard.js";
import type * as production from "../production.js";
import type * as satellites from "../satellites.js";
import type * as users from "../users.js";
import type * as userStatus from "../userStatus.js";
import type * as utils from "../utils.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  autoclick: typeof autoclick;
  autoclickQueries: typeof autoclickQueries;
  boosters: typeof boosters;
  complexes: typeof complexes;
  constants: typeof constants;
  crons: typeof crons;
  game: typeof game;
  leaderboard: typeof leaderboard;
  production: typeof production;
  satellites: typeof satellites;
  users: typeof users;
  userStatus: typeof userStatus;
  utils: typeof utils;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
