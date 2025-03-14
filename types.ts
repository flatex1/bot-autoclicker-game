/**
 * Типы данных для телеграм-бота
 */
import { Context, SessionFlavor } from "grammy";
import { ConvexHttpClient } from "convex/browser";
import { Id } from "./convex/_generated/dataModel.js";

// Интерфейс для сессии пользователя
export interface SessionData {
  userId?: Id<"users">;
  state?: string;
  data?: any;
}

// Расширенный контекст бота, включая сессию и Convex клиент
export type BotContext = Context & 
  SessionFlavor<SessionData> & 
  {
    convex: ConvexHttpClient;
  };