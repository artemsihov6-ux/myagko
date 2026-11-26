import { getPublicOrder } from '@/lib/orders';
import { limit, reply, route } from '@/lib/http';

export const GET = route(async (request: Request, context: { params: Promise<{ token: string }> }) => {
  await limit('order-read', request, 240, 60);
  const order = await getPublicOrder((await context.params).token);
  return order ? reply(order) : reply({ error: 'Заявка недоступна.' }, 404);
});
