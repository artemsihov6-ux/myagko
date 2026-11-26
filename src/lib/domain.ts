import { z } from 'zod';

export const catalog = {
  sofa: { title: 'Диван', variants: ['2 места', '3 места', 'Угловой'], model: 'Диван с мягкими подушками', phrase: 'Привет! Я диван.' },
  armchair: { title: 'Кресло', variants: ['Обычное', 'Реклайнер'], model: 'Кресло с округлыми подлокотниками', phrase: 'Устраивайся поудобнее!' },
  mattress: { title: 'Матрас', variants: ['Односпальный', 'Двуспальный'], model: 'Матрас со стёжкой и боковыми ручками', phrase: 'Займёмся обеими сторонами?' },
  chair: { title: 'Стул', variants: ['Сиденье', 'Сиденье и спинка'], model: 'Стул с мягкой спинкой', phrase: 'Спинка готова!' },
  other: { title: 'Другое', variants: [], model: 'Пуф как пример нестандартной мебели', phrase: 'Покажи мебель на фото!' },
} as const;

export const categories = ['sofa', 'armchair', 'mattress', 'chair', 'other'] as const;
export const statuses = { new: 'Новая', agreed: 'Согласована', done: 'Завершена', canceled: 'Отменена' } as const;
export const statusKeys = ['new', 'agreed', 'done', 'canceled'] as const;
export const gameModes = { off: 'Выключена', play: 'Без скидки', bonus: 'Бонус на следующий заказ' } as const;
export const moods = { friendly: 'Дружелюбный', calm: 'Спокойный', playful: 'Игривый' } as const;
export type Category = keyof typeof catalog;
export type Status = keyof typeof statuses;

const rubles = z.number().int().min(0).max(1_000_000);
const base = rubles.min(1);
const percent = z.number().int().min(0).max(300);
const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => trimmed(max).default('');
export const phoneFormat = /^\+?[\d\s().-]+$/;
const validPhone = (value: string) => phoneFormat.test(value) && value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15;
const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value: string) => {
  if (!dateFormat.test(value) || value.startsWith('0000')) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
};
const dateValue = z.string().refine((value) => !value || validDate(value), 'Проверьте дату.');
const timeValue = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/, 'Проверьте время.');
export const tariffSchema = z.object({
  prices: z.object({
    sofa: z.tuple([base, base, base]), armchair: z.tuple([base, base]),
    mattress: z.tuple([base, base]), chair: z.tuple([base, base]),
  }),
  minimum: rubles,
  heavyPercent: percent,
  secondSidePercent: percent,
  travel: rubles,
});
export const companySchema = z.object({
  name: trimmed(60).min(2),
  city: trimmed(90).min(2),
  territory: trimmed(400).min(2),
  operator: optionalText(240),
  phone: optionalText(35).refine((s) => !s || validPhone(s), 'Проверьте телефон.'),
  email: optionalText(120).refine((s) => !s || z.email().safeParse(s).success, 'Проверьте почту.'),
  telegram: optionalText(40).refine((s) => !s || /^@[a-zA-Z0-9_]{5,32}$/.test(s), 'Укажите имя в формате @username.'),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i, 'Укажите цвет в формате HEX.'),
});
export const gameSchema = z.object({
  mode: z.enum(['off', 'play', 'bonus']), amount: base,
  days: z.number().int().min(1).max(365), minimum: rubles,
});
export const charactersSchema = z.object({
  mood: z.enum(['friendly', 'calm', 'playful']), faces: z.boolean(), phrases: z.boolean(),
});
export const settingsSchemas = { tariffs: tariffSchema, company: companySchema, game: gameSchema, characters: charactersSchema };
export const settingsSchema = z.object(settingsSchemas);
export type Settings = z.infer<typeof settingsSchema>;
export type Tariffs = Settings['tariffs'];
export type Company = Settings['company'];
export type Characters = Settings['characters'];
export type SettingSection = keyof Settings;

export const defaults: Settings = {
  tariffs: { prices: { sofa: [2400, 3200, 4500], armchair: [1600, 2200], mattress: [1900, 2800], chair: [650, 950] }, minimum: 1800, heavyPercent: 25, secondSidePercent: 60, travel: 700 },
  company: { name: 'Мягко', city: 'Омск', territory: 'Омск и ближайшие населённые пункты. Адрес за городом мастер уточнит по заявке.', operator: '', phone: '', email: '', telegram: '', accent: '#345744' },
  game: { mode: 'play', amount: 350, days: 30, minimum: 2500 },
  characters: { mood: 'friendly', faces: true, phrases: true },
};

export const itemSchema = z.object({
  category: z.enum(categories),
  variant: z.number().int().min(0).max(2),
  qty: z.number().int().min(1).max(99),
  heavy: z.boolean(),
  second: z.boolean(),
  description: optionalText(500),
}).superRefine((item, ctx) => {
  if (item.variant >= (catalog[item.category].variants.length || 1)) ctx.addIssue({ code: 'custom', path: ['variant'], message: 'Выберите вариант мебели.' });
  if (item.second && item.category !== 'mattress') ctx.addIssue({ code: 'custom', path: ['second'], message: 'Вторая сторона доступна для матраса.' });
  if (item.category === 'other' && item.description.length < 3) ctx.addIssue({ code: 'custom', path: ['description'], message: 'Опишите мебель (минимум 3 символа).' });
}).transform((item) => ({
  ...item, heavy: item.category !== 'other' && item.heavy,
  description: item.category === 'other' ? item.description : '',
}));
export type Item = z.infer<typeof itemSchema>;
export const furniture = (category: Category, variant = 0): Item => ({ category, variant, qty: 1, heavy: false, second: false, description: '' });
export const maxLines = 30;

export const contactSchema = z.object({
  name: trimmed(70).min(2, 'Укажите имя.'),
  phone: trimmed(35).refine(validPhone, 'Укажите номер, по которому с вами можно связаться.'),
  address: trimmed(240).min(5, 'Укажите улицу и номер дома.'),
  outside: z.boolean(),
  date: dateValue,
  time: timeValue,
  comment: optionalText(1000),
  consent: z.boolean().refine(Boolean, 'Нужно согласие на обработку данных.'),
}).superRefine((value, ctx) => {
  if (value.time && !value.date) ctx.addIssue({ code: 'custom', path: ['date'], message: 'Выберите дату для указанного времени.' });
});
export type Contact = z.infer<typeof contactSchema>;
export const emptyContact: Contact = { name: '', phone: '', address: '', outside: false, date: '', time: '', comment: '', consent: false };
export const requestSchema = z.object({
  key: z.uuidv4(),
  items: z.array(itemSchema).min(1, 'Добавьте хотя бы один предмет.').max(maxLines, 'В заказе может быть до 30 позиций.'),
  contact: contactSchema,
  photos: z.array(z.uuidv4()).max(3, 'Можно приложить до трёх фото.').refine((ids) => new Set(ids).size === ids.length, 'Повторяющиеся фото.'),
}).superRefine((value, ctx) => {
  if (value.items.some((item) => item.category === 'other') && !value.photos.length) {
    ctx.addIssue({ code: 'custom', path: ['photos'], message: 'Приложите хотя бы одно фото для позиции «Другое».' });
  }
});
export const ownerUpdateSchema = z.object({
  status: z.enum(statusKeys), finalPrice: rubles.nullable(),
  agreedDate: dateValue, agreedTime: timeValue, note: optionalText(2000),
}).superRefine((value, ctx) => {
  if (value.agreedTime && !value.agreedDate) ctx.addIssue({ code: 'custom', path: ['agreedDate'], message: 'Укажите дату согласованного выезда.' });
  if (value.status === 'agreed') {
    if (value.finalPrice === null) ctx.addIssue({ code: 'custom', path: ['finalPrice'], message: 'Укажите итоговую цену.' });
    if (!value.agreedDate) ctx.addIssue({ code: 'custom', path: ['agreedDate'], message: 'Укажите согласованную дату.' });
    if (!value.agreedTime) ctx.addIssue({ code: 'custom', path: ['agreedTime'], message: 'Укажите согласованное время.' });
  }
});
export type OwnerUpdate = z.infer<typeof ownerUpdateSchema>;
export type FieldErrors = Record<string, string>;
export function fields(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const [root, child] = issue.path;
    const key = String(root === 'contact' ? child ?? root : root ?? 'form');
    result[key] ??= issue.message;
  }
  return result;
}

export const itemKey = (item: Item) => JSON.stringify([item.category, item.variant, item.heavy, item.second, item.description.trim()]);
export function mergeItem(items: Item[], newItem: Item) {
  const key = itemKey(newItem);
  const present = items.find((item) => itemKey(item) === key);
  if (!present) return items.length < maxLines ? [...items, newItem] : null;
  const qty = present.qty + newItem.qty;
  if (qty > 99) return null;
  return items.map((item) => item === present ? { ...item, qty } : item);
}

export function itemTotal(item: Item, tariff: Tariffs) {
  if (item.category === 'other') return null;
  const basePrice = tariff.prices[item.category][item.variant];
  const sides = item.second ? 100 + tariff.secondSidePercent : 100;
  const heavy = item.heavy ? 100 + tariff.heavyPercent : 100;
  // Integer arithmetic. Apply both percentages before rounding half up per unit.
  return Math.floor((basePrice * sides * heavy + 5000) / 10000) * item.qty;
}
export function estimate(items: Item[], tariff: Tariffs, outside: boolean) {
  const lines = items.map((item) => itemTotal(item, tariff));
  const hasKnown = lines.some((line) => line !== null);
  const subtotal = lines.reduce<number>((total, line) => total + (line ?? 0), 0);
  const minimumAdjustment = hasKnown ? Math.max(0, tariff.minimum - subtotal) : 0;
  const travel = outside && items.length ? tariff.travel : 0;
  return {
    lines, subtotal, minimumAdjustment, travel,
    total: hasKnown ? subtotal + minimumAdjustment + travel : null,
    manualCount: items.reduce((count, item) => count + (item.category === 'other' ? item.qty : 0), 0),
  };
}
export type Estimate = ReturnType<typeof estimate>;
export type Snapshot = { version: 1; tariffs: Tariffs; estimate: Estimate; companyName: string; game: Settings['game'] };
export type Bonus = { code: string; amount: number; expires: string; minimum: number };
export type PublicOrder = {
  number: number; items: Item[]; estimate: Estimate; status: Status;
  finalPrice: number | null; agreedDate: string; agreedTime: string;
  date: string; time: string; createdAt: string; game: Settings['game']; bonus: Bonus | null;
  minimum: number; companyName: string;
};
export const money = (value: number) => new Intl.NumberFormat('ru-RU').format(value) + '\u00a0₽';
export const itemTitle = (item: Item) => catalog[item.category].title;
export const itemDetails = (item: Item) => [
  catalog[item.category].variants[item.variant] || item.description,
  item.second && 'две стороны', item.heavy && 'сильные загрязнения',
].filter(Boolean).join(' · ');
export const formatDay = (value: string) => value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z')) : '';
export const formatStamp = (value: string) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export const requestNumber = (value: number) => '#' + String(value).padStart(4, '0');
export const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];
export const photoLimit = 4 * 1024 * 1024;
