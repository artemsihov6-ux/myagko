import { randomBytes } from 'node:crypto';
import { getSettings, transaction } from '@/lib/db';
import { checkOrigin, HttpError, limit, reply, route, tokenPattern } from '@/lib/http';
import type { Bonus } from '@/lib/domain';
import type { OrderRow } from '@/lib/orders';

export const POST = route(async (request: Request, context: { params: Promise<{ token: string }> }) => {
  checkOrigin(request);
  const { token } = await context.params;
  if (!tokenPattern.test(token)) throw new HttpError(404, 'Заявка недоступна.');
  await limit("bonus-network", request, 100, 600);
  await limit('bonus', request, 10, 60, token);
  return transaction(async (client) => {
    const { rows: [order] } = await client.query<OrderRow>('SELECT * FROM orders WHERE token=$1 FOR UPDATE', [token]);
    if (!order) throw new HttpError(404, 'Заявка недоступна.');
    if (order.bonus) return reply(order.bonus);
    const game = order.snapshot.game;
    if (game.mode !== 'bonus' || (await getSettings(client)).game.mode === 'off' || order.status === 'canceled') throw new HttpError(409, 'Бонус для заявки недоступен.');
    const bonus: Bonus = {
      code: 'МЯГКО-' + randomBytes(6).toString('hex').toUpperCase(),
      amount: game.amount, minimum: game.minimum,
      expires: new Date(Date.now() + game.days * 86_400_000).toISOString(),
    };
    await client.query('UPDATE orders SET bonus=$2 WHERE id=$1', [order.id, JSON.stringify(bonus)]);
    return reply(bonus, 201);
  });
});
