/**
 * Вспомогательные функции
 */

// Обновление общего производства пользователя
export async function updateUserTotalProduction(ctx: any, userId: any) {
  // Получаем все комплексы пользователя
  const complexes = await ctx.db
    .query("complexes")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();

  // Считаем общее производство
  const totalProduction = complexes.reduce(
    (sum: number, complex: any) => sum + (complex.production || 0),
    0
  );

  // Обновляем пользователя
  await ctx.db.patch(userId, {
    totalProduction,
  });
}
