import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

const password = process.env.TEST_OWNER_PASSWORD ?? 'StudioDemo-2026!';
const origin = process.env.TEST_BASE_URL ?? 'http://localhost:3037';
const phone = '+1 202 555 0104';
const png = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#83a189' } }).png().toBuffer();
const mockPhoto = { name: 'Тестовая мебель.png', mimeType: 'image/png', buffer: png };
const ownerLogin = async (page: Page) => {
  await page.goto('/cabinet');
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Управление' })).toBeVisible();
};
const quoteText = (page: Page) => page.getByRole('region', { name: 'Предварительный расчёт' });

test('client, attachments, offline retry, idempotency and owner agreement', async ({ page, browser }) => {
  const name = 'Тест Лавров ' + Date.now().toString().slice(-7);
  const context = await browser.newContext({ baseURL: origin });
  const owner = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Стул', exact: true }).click();
  await page.getByRole('button', { name: 'В заказ', exact: true }).click();
  await page.getByRole('button', { name: 'В заказ', exact: true }).click();
  await page.getByRole('button', { name: 'Заказ, 2 шт.' }).click();
  await expect(page.locator('.cart-line')).toHaveCount(1);
  await expect(quoteText(page)).toContainText(/1[\s\u00a0]800/);
  await page.getByRole('button', { name: 'Изменить: Стул' }).click();
  await page.getByRole('button', { name: 'Сиденье и спинка' }).click();
  await page.getByRole('button', { name: 'Уменьшить количество' }).click();
  await page.getByRole('button', { name: 'Сохранить позицию' }).click();
  await page.getByRole('button', { name: 'Удалить: Стул' }).click();
  await expect(page.getByText('Заказ пока пуст')).toBeVisible();
  await page.getByRole('button', { name: 'Отменить удаление' }).click();
  await expect(page.getByText('Сиденье и спинка', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Добавить мебель' }).click();
  await page.getByRole('button', { name: 'Другое', exact: true }).click();
  await page.getByLabel('Что нужно почистить').fill('Вымышленная зелёная банкетка');
  await page.getByRole('button', { name: 'В заказ', exact: true }).click();
  await page.getByRole('button', { name: 'Заказ, 2 шт.' }).click();
  await expect(quoteText(page)).toContainText('Известная часть');
  await expect(quoteText(page)).toContainText('По фото');
  await page.getByRole('button', { name: 'Оформить заявку' }).click();
  await page.getByLabel('Имя', { exact: true }).fill(name);
  await page.getByLabel('Телефон', { exact: true }).fill(phone);
  await page.getByLabel('Адрес', { exact: true }).fill('Вымышленная улица, 42');
  await page.getByLabel('Желаемое время').fill('15:30');
  await page.getByLabel('Выезд за город').check();
  await page.getByRole('checkbox', { name: /Согласен/ }).check();
  await page.getByRole('button', { name: 'Отправить заявку' }).click();
  await expect(page.getByText('Выберите дату для указанного времени.')).toBeVisible();
  await expect(page.getByText('Приложите хотя бы одно фото')).toBeVisible();
  await expect(quoteText(page)).toContainText(/2[\s\u00a0]500/);
  await page.getByLabel('Желаемая дата').fill('2030-12-03');

  const tampered = await page.request.put('/api/photos/' + crypto.randomUUID(), {
    headers: { origin, 'x-draft-key': crypto.randomUUID(), 'content-type': 'image/png' }, data: Buffer.from('fake png'),
  });
  expect(tampered.status()).toBe(422);
  await page.route('**/api/photos/*', (route) => route.abort('internetdisconnected'), { times: 1 });
  await page.getByLabel('Добавить фото').setInputFiles(mockPhoto);
  await expect(page.getByRole('button', { name: /Повторить загрузку/ })).toBeVisible();
  await expect(page.getByText('Нет связи с сервером.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /Повторить загрузку/ }).click();
  await expect(page.getByLabel('Фото загружено')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Имя', { exact: true })).toHaveValue(name);
  await expect(page.getByLabel('Желаемое время')).toHaveValue('15:30');
  await expect(page.getByLabel('Фото загружено')).toBeVisible();

  let posted: Record<string, unknown> | undefined;
  let recordedStatus: number | undefined, recordedPath: string | undefined;
  await page.route('**/api/orders', async (route) => {
    posted = route.request().postDataJSON();
    const response = await route.fetch({ postData: { ...posted, total: 1 } });
    recordedStatus = response.status();
    recordedPath = (await response.json()).path;
    await route.abort('connectionreset');
  }, { times: 1 });
  await page.getByRole('button', { name: 'Отправить заявку' }).click();
  await expect(page.getByText('Нет связи с сервером.', { exact: false })).toBeVisible();
  expect(recordedStatus).toBe(201);
  expect(recordedPath).toMatch(/^\/zayavka\/[\w-]{43}$/);
  await page.getByRole('button', { name: 'Отправить заявку' }).click();
  await expect(page).toHaveURL(origin + recordedPath);
  await expect(page.getByRole('heading', { name: 'Заявка принята' })).toBeVisible();
  await expect(quoteText(page)).toContainText(/2[\s\u00a0]500/);
  await page.getByRole('button', { name: 'Скопировать' }).click();
  await expect(page.getByText(/Ссылка скопирована|Ссылка выделена/)).toBeVisible();
  const token = recordedPath!.split('/').pop()!;
  const publicApi = await page.request.get('/api/orders/' + token);
  expect(publicApi.headers()['cache-control']).toContain('no-store');
  expect(await publicApi.json()).not.toHaveProperty('contact');
  expect(await publicApi.json()).not.toHaveProperty('photos');
  expect((await page.request.get('/api/orders/0001')).status()).toBe(404);
  expect((await page.request.get('/api/owner/orders')).status()).toBe(401);
  expect((await page.request.get('/api/photos/' + (posted!.photos as string[])[0])).status()).toBe(401);
  expect((await page.request.post('/api/orders', { headers: { origin: 'https://example.invalid' }, data: posted })).status()).toBe(403);
  await ownerLogin(owner);
  await owner.getByRole('searchbox', { name: 'Поиск заявок' }).fill(name);
  await owner.getByRole('button', { name: 'Найти' }).click();
  await expect(owner.locator('.admin-list-row')).toHaveCount(1);
  await owner.locator('.admin-list-row').click();
  await expect(owner.getByAltText('Фото мебели 1')).toBeVisible();
  const photoResponse = await owner.request.get('/api/photos/' + (posted!.photos as string[])[0]);
  expect(photoResponse.headers()['content-type']).toBe('image/webp');
  expect(photoResponse.headers()['cache-control']).toContain('no-store');
  expect((await sharp(await photoResponse.body()).metadata()).format).toBe('webp');
  await owner.getByLabel('Статус', { exact: true }).selectOption('agreed');
  await owner.getByRole('button', { name: 'Сохранить заявку' }).click();
  await expect(owner.getByText('Укажите итоговую цену.')).toBeVisible();
  await owner.getByLabel('Итоговая цена, ₽').fill('3700');
  await owner.getByLabel('Согласованная дата').fill('2030-12-04');
  await owner.getByLabel('Согласованное время').fill('16:45');
  await owner.getByLabel('Приватная заметка').fill('Приватная заметка теста');
  await owner.getByRole('button', { name: 'Сохранить заявку' }).click();
  await expect(owner.getByText('Изменения сохранены.')).toBeVisible();
  await page.getByRole('button', { name: 'Обновить статус' }).click();
  await expect(page.getByText('Согласована', { exact: true })).toBeVisible();
  await expect(page.getByText(/3[\s\u00a0]700/)).toBeVisible();
  await expect(page.getByText(/16:45/)).toBeVisible();
  expect(JSON.stringify(await (await page.request.get('/api/orders/' + token)).json())).not.toContain('Приватная заметка');
  await owner.getByRole('button', { name: 'Тарифы', exact: true }).click();
  await owner.getByLabel('Минимальный заказ на чистку, ₽').fill('1960');
  await owner.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(owner.getByText('Настройки сохранены.')).toBeVisible();
  await page.reload();
  await expect(quoteText(page)).toContainText(/2[\s\u00a0]500/);
  await owner.getByLabel('Минимальный заказ на чистку, ₽').fill('1800');
  await owner.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(owner.getByText('Настройки сохранены.')).toBeVisible();
  await context.close();
});

test('mobile sizing, theme, GLB retry and no WebGL checkout', async ({ browser }) => {
  const mobile = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, reducedMotion: 'reduce' });
  const page = await mobile.newPage();
  await page.route('**/models/sofa.glb', (route) => route.abort(), { times: 1 });
  await page.goto('/');
  await expect(page.getByText('3D не загрузилось')).toBeVisible();
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.locator('[data-3d="ready"]')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  const sofa = page.locator('canvas');
  const bounds = (await sofa.boundingBox())!;
  const before = await sofa.screenshot();
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const cdp = await mobile.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [center] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center.x + 85, y: center.y + 10 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await sofa.screenshot()).not.toEqual(before);
  await page.getByRole('button', { name: 'Сбросить ракурс' }).click();
  const overlap = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overlap).toBe(false);
  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.evaluate(() => {
    for (const name of ['Кресло', 'Стул', 'Другое', 'Матрас']) {
      Array.from(document.querySelectorAll<HTMLButtonElement>('.category-tabs button')).find((button) => button.textContent === name)?.click();
    }
  });
  await expect(page.getByRole('heading', { name: 'Матрас', exact: true })).toBeVisible();
  await expect(page.locator('[data-3d="ready"]')).toBeVisible();
  await expect(page.getByText('Займёмся обеими сторонами?')).toBeVisible();
  await page.getByRole('button', { name: 'Стул', exact: true }).click();
  await expect(page.getByText('Спинка готова!', { exact: true })).toBeVisible();
  await mobile.close();

  const off = await browser.newContext({ baseURL: origin, viewport: { width: 360, height: 800 }, hasTouch: true });
  await off.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, requested: string, ...args: unknown[]) {
      if (/webgl/.test(requested)) return null;
      return Reflect.apply(original, this, [requested, ...args]);
    } as typeof original;
  });
  const fallback = await off.newPage();
  await fallback.goto('/');
  await expect(fallback.getByText('3D недоступно в этом браузере')).toBeVisible();
  await expect(fallback.getByAltText('Диван с мягкими подушками')).toBeVisible();
  await fallback.getByRole('button', { name: 'В заказ', exact: true }).click();
  await fallback.getByRole('button', { name: 'Заказ, 1 шт.' }).click();
  await fallback.getByRole('button', { name: 'Оформить заявку' }).click();
  await expect(fallback.getByRole('heading', { name: 'Оформление заявки' })).toBeVisible();
  await off.close();
});

test('UV brush, bonus issuance, mode off, deletion and session revocation', async ({ browser }) => {
  const headers = { origin };
  const ownerContext = await browser.newContext({ baseURL: origin });
  const priorContext = await browser.newContext({ baseURL: origin });
  const owner = await ownerContext.newPage();
  const prior = await priorContext.newPage();
  await ownerLogin(owner);
  await ownerLogin(prior);
  const settings = await (await owner.request.get('/api/owner/settings')).json();
  const changed = (await owner.request.post('/api/owner/settings/game', {
    headers, data: { mode: 'bonus', amount: 350, days: 30, minimum: 2500 },
  })).ok();
  expect(changed).toBe(true);
  const clientContext = await browser.newContext({ baseURL: origin, viewport: { width: 1200, height: 1000 }, reducedMotion: 'reduce' });
  const client = await clientContext.newPage();
  const key = crypto.randomUUID();
  const photoId = crypto.randomUUID();
  const draftHeaders = { ...headers, 'x-draft-key': key, 'content-type': 'image/png' };
  const upload = await client.request.put('/api/photos/' + photoId, { headers: draftHeaders, data: png });
  expect(upload.status()).toBe(201);
  const extra = crypto.randomUUID();
  const extraUpload = await client.request.put('/api/photos/' + extra, { headers: draftHeaders, data: png });
  expect(extraUpload.status()).toBe(201);
  expect((await client.request.delete('/api/photos/' + extra, { headers: draftHeaders })).ok()).toBe(true);
  const name = 'Тест Игры ' + Date.now().toString().slice(-7);
  const input = { key, items: [{ category: 'sofa', qty: 1, heavy: false, second: false, variant: 0 }],
    contact: { name, phone, address: 'Вымышленная улица, 31', outside: false, date: '', time: '', consent: true }, photos: [photoId] };
  let resetPassword = false;
  try {
    const submitted = await client.request.post('/api/orders', { headers, data: input });
    expect(submitted.status()).toBe(201);
    const { path } = await submitted.json();
    const token = path.split('/').pop();
    await client.goto(path);
    await client.getByRole('button', { name: 'Сыграть' }).click();
    const stage = client.locator('.game-stage[data-3d="ready"]');
    await expect(stage).toBeVisible();
    await stage.scrollIntoViewIfNeeded();
    const bounds = (await stage.boundingBox())!;
    const spot = { x: bounds.x + bounds.width * .404, y: bounds.y + bounds.height * .339 };
    await client.mouse.move(spot.x - 12, spot.y - 4);
    await client.mouse.down();
    await client.mouse.move(spot.x + 12, spot.y + 4, { steps: 7 });
    await client.mouse.up();
    await expect.poll(async () => Number(await client.locator('#game-progress').getAttribute('value'))).toBeGreaterThan(0);
    await client.getByRole('button', { name: 'Поворачивать' }).click();
    const beforeRotate = await client.locator('#game-progress').getAttribute('value');
    await client.mouse.move(spot.x, spot.y);
    await client.mouse.down();
    await client.mouse.move(spot.x + 40, spot.y + 5, { steps: 4 });
    await client.mouse.up();
    await expect(client.locator('#game-progress')).toHaveAttribute('value', beforeRotate!);
    await client.getByRole('button', { name: 'Чистить', exact: true }).click();
    const keyboard = client.getByRole('button', { name: 'Очистить одно пятно кнопкой' });
    for (let i = 0; i < 6 && await keyboard.isVisible(); i += 1) await keyboard.click();
    await expect(client.getByText('Диван чистый!')).toBeVisible();
    await client.getByRole('button', { name: 'Получить код' }).click();
    await expect(client.getByText(/Код МЯГКО-/)).toBeVisible();
    const firstBonus = await (await client.request.post('/api/orders/' + token + '/bonus', { headers, data: {} })).json();
    const repeatBonus = await (await client.request.post('/api/orders/' + token + '/bonus', { headers, data: {} })).json();
    expect(firstBonus).toEqual(repeatBonus);
    expect(firstBonus.amount).toBe(350);
    await expect(client.getByText('Уточняет мастер')).toBeVisible();
    await expect(quoteText(client)).toContainText(/2[\s\u00a0]400/);
    const list = await (await owner.request.get('/api/owner/orders?q=' + encodeURIComponent(firstBonus.code))).json();
    expect(list.orders).toHaveLength(1);
    expect(list.orders[0].name).toBe(name);
    const noGame = await owner.request.post('/api/owner/settings/game', { headers, data: { ...settings.game, mode: 'off' } });
    expect(noGame.ok()).toBe(true);
    const later = await (await client.request.get('/api/orders/' + token)).json();
    expect(later.game.mode).toBe('off');
    expect(later.bonus.code).toBe(firstBonus.code);

    await owner.getByRole('searchbox', { name: 'Поиск заявок' }).fill(firstBonus.code);
    await owner.getByRole('button', { name: 'Найти' }).click();
    await owner.locator('.admin-list-row').click();
    await owner.getByRole('button', { name: 'Удалить заявку' }).click();
    await expect(owner.getByRole('heading', { name: 'Удалить заявку и фото?' })).toBeVisible();
    await owner.getByRole('button', { name: 'Удалить навсегда' }).click();
    await expect(owner.getByRole('heading', { name: 'Заявки', exact: true })).toBeVisible();
    expect((await owner.request.get('/api/photos/' + photoId)).status()).toBe(404);
    expect((await client.request.get('/api/orders/' + token)).status()).toBe(404);
    expect((await client.request.post('/api/orders', { headers, data: input })).status()).toBe(410);

    await owner.getByRole('button', { name: 'Доступ', exact: true }).click();
    await owner.getByLabel('Текущий пароль').fill(password);
    await owner.getByLabel('Новый пароль').fill(password + '-temp');
    await owner.getByRole('button', { name: 'Сменить пароль' }).click();
    await expect(owner.getByText('Пароль изменён.')).toBeVisible();
    resetPassword = true;
    expect((await prior.request.get('/api/owner/orders')).status()).toBe(401);
    expect((await owner.request.get('/api/owner/orders')).status()).toBe(200);
  } finally {
    if (resetPassword) {
      expect((await owner.request.post('/api/owner/password', { headers, data: { current: password + '-temp', password } })).ok()).toBe(true);
    }
    expect((await owner.request.post('/api/owner/settings/game', { headers, data: settings.game })).ok()).toBe(true);
    await Promise.all([ownerContext.close(), clientContext.close(), priorContext.close()]);
  }
});

test('PWA caches the offline page and keeps private routes online-only', async ({ page, context }) => {
  test.skip(process.env.TEST_PWA !== '1', 'Run against next start with TEST_PWA=1.');
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toContain('512x512');
  expect((await page.request.get('/robots.txt')).ok()).toBe(true);
  expect((await page.request.get('/sitemap.xml')).ok()).toBe(true);
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.goto('/cabinet');
  await expect(page.getByRole('heading', { name: 'Вход владельца' })).toBeVisible();
  const cache = await page.evaluate(async () => {
    const names = await caches.keys();
    const requests = await Promise.all(names.map(async (name) => (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname)));
    return requests.flat();
  });
  expect(cache).toEqual(['/offline.html']);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Нет соединения' })).toBeVisible();
  await context.setOffline(false);
});
