import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const base = new URL('./', import.meta.url);
const sofaPath = fileURLToPath(new URL('../public/posters/sofa.webp', base));
const sofa = (await sharp(sofaPath).resize(520).png().toBuffer()).toString('base64');
const themes = {
  light: { bg:'#f6f6f1', paper:'#fdfdf9', ink:'#212c25', muted:'#505e54', line:'#dfe3d9', action:'#2a4737', actionText:'#ffffff', soft:'#e4e9df', stage:'#e3e9d6', plate:'#f8faf0', accent:'#789769', lilac:'#ebe5ef', danger:'#9e3d35', dangerBg:'#faebe6' },
  dark: { bg:'#19231f', paper:'#202d26', ink:'#eff3e9', muted:'#b8c4b8', line:'#394b40', action:'#a7c3a4', actionText:'#18261d', soft:'#32453a', stage:'#344435', plate:'#29342b', accent:'#a3bd91', lilac:'#413849', danger:'#ffc3b9', dangerBg:'#482e2b' },
};
const frames = [];
const sofaIcon = '<path d="M5 13a2 2 0 1 1 4 0v2h6v-2a2 2 0 1 1 4 0v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zm2-2V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3M8 20v-2m8 2v-2"/>';
const icons = {
  sofa: sofaIcon,
  armchair: '<path d="M5 13a2 2 0 0 1 4 0v1h6v-1a2 2 0 0 1 4 0v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zm3-2V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4"/>',
  mattress: '<path d="M3 18V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9M3 14h18M7 14v-3h10v3M3 18v2m18-2v2"/>',
  chair: '<path d="M8 4h8l-1 9H9L8 4zm1 9-4 4h14l-4-4m-8 4-2 4m12-4 2 4"/>',
  other: '<path d="m12 3 4 2v5l-4 2-4-2V5zm-4 7-5 3v5l5 3 4-3v-6m4-2 5 3v5l-5 3-4-3"/><path d="m12 12 4 2 5-1M3 13l5 1 4-2m0-5 4-2m-8 0 4 2v5m-4 2v7m8-7v7"/>',
  bag: '<path d="M5 8h14l2 13H3L5 8zm4 0V6a3 3 0 0 1 6 0v2"/>',
  moon: '<path d="M20 16a8 8 0 0 1-12-11 8 8 0 1 0 12 11z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  pin: '<path d="M18 10c0 4-6 9-6 9s-6-5-6-9a6 6 0 1 1 12 0z"/><circle cx="12" cy="10" r="2"/>',
  check: '<path d="m5 12 4 4 10-10"/><circle cx="12" cy="12" r="10"/>',
  rotate: '<path d="M4 4v5h5M4 9a8 8 0 1 1 0 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/>',
  photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m4 17 4-4 3 3 4-5 5 7"/>',
};
const svgIcon = (name, color) => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round">' + icons[name] + '</svg>';
function art(name, w, h, theme='light') {
  const nodes=[];
  const color=themes[theme];
  frames.push({name,w,h,theme,nodes});
  const add=(type, n)=>nodes.push({type,...n});
  const rect=(x,y,w,h,fill='paper',stroke='line',r=13,name='Панель')=>add('rect',{name,x,y,w,h,fill,stroke,r});
  const txt=(s,x,y,size=16,weight=450,fill='ink',w)=>add('text',{name:s,s,x,y,size,weight,fill,w});
  const line=(x,y,w)=>rect(x,y,w,1,'line',null,0,'Разделитель');
  const btn=(s,x,y,w,style='primary',h=46)=>add('button',{name:s,s,x,y,w,h,style});
  const icon=(name,x,y,size=22,tint='action')=>add('icon',{name,x,y,size,svg:svgIcon(name,color[tint])});
  const circ=(x,y,w,stroke='line',op=.85)=>add('ellipse',{name:'Контур сцены',x,y,w,h:w,stroke,op});
  const img=(x,y,w,h)=>add('image',{name:'Диван · оригинальный Blender-постер',x,y,w,h});
  const label=(s,x,y,value,ww)=>{
    txt(s,x,y,14,630); rect(x,y+23,ww,42,'bg','line',9,'Поле · '+s);
    txt(value,x+10,y+33,15,435,'muted');
  };
  const desktop=w>700, pad=desktop?48:14;
  line(0,desktop?65:59,w);
  rect(pad,desktop?17:14,31,31,'action',null,9,'Знак Мягко'); icon('sofa',pad+4,desktop?21:18,23,'actionText');
  txt('Мягко',pad+40,desktop?17:14,24,750);
  if(desktop) ['Калькулятор','Услуги','Контакты'].forEach((s,i)=>txt(s,w/2-109+i*111,22,14,560,'muted'));
  rect(w-pad-126,desktop?13:8,40,43,'paper','line',11,'Тема'); icon(theme==='dark'?'sun':'moon',w-pad-115,desktop?25:20,18,'ink');
  rect(w-pad-79,desktop?13:8,79,43,'paper','line',11,'Заказ'); icon('bag',w-pad-71,desktop?25:20,17,'ink'); txt('Заказ',w-pad-49,desktop?24:19,13,600);
  return {nodes,w,h,pad,color,rect,txt,line,btn,icon,circ,img,label};
}
const products=[['sofa','Диван'],['armchair','Кресло'],['mattress','Матрас'],['chair','Стул'],['other','Другое']];
function studio(a,x,y,w,h,mode='ready') {
  a.rect(x,y,w,h,'stage','line',18,'3D-сцена');
  const rings=[];
  for (const k of [.70,.94,1.14]) {
    const width=w*k;
    rings.push({type:'ellipse',name:'Контур сцены',x:(w-width)/2,y:h*.61-width/2,w:width,h:width,stroke:'accent',op:.23});
  }
  a.nodes.push({type:'clip',name:'Фон 3D-сцены',x,y,w,h,r:18,nodes:rings});
  const iw=Math.min(w*.82,h*1.42), ih=iw*560/820;
  a.img(x+(w-iw)/2,y+(h-ih)*.55,iw,ih);
  a.rect(x+12,y+12,mode==='ready'?112:119,27,'plate','line',14,'Индикатор сцены');
  a.rect(x+21,y+23,6,6,'accent',null,3,'Индикатор');
  a.txt(mode==='ready'?'3D-просмотр':'Модель мебели',x+32,y+16,12,620);
  if(mode==='ready'){
    a.rect(x+w-53,y+10,41,41,'plate','line',10,'Сброс ракурса'); a.icon('rotate',x+w-41,y+22,17,'ink');
    const bw=145;
    a.rect(x+w/2-bw/2,y+Math.max(42,h*.16),bw,33,'plate','line',10,'Реплика персонажа');
    a.txt('Привет! Я диван.',x+w/2-55,y+Math.max(42,h*.16)+7,13,560);
  }
  const hint=mode==='ready'?'Тяните, чтобы повернуть':'3D недоступно в этом браузере';
  a.txt(hint,x+w/2-(mode==='ready'?85:113),y+h-31,13,590);
}
function config(a,x,y,w,small=false) {
  a.rect(x,y,w,small?371:425,'paper','line',17,'Параметры предмета');
  const p=x+18, end=x+w-18;
  a.txt('Диван',p,y+15,30,690); a.txt('За один предмет',end-111,y+27,13,450,'muted');
  a.line(p,y+59,w-36); a.txt('Размер дивана',p,y+72,15,650);
  for(const [i,variant] of ['2 места','3 места','Угловой'].entries()) a.btn(variant,p+i*83,y+100,78,i===0?'selected':'secondary',42);
  a.rect(p,y+159,17,17,'bg','muted',3,'Флажок'); a.txt('Сильные загрязнения',p+26,y+153,14,620); a.txt('К тарифу +25%',p+26,y+175,13,440,'muted');
  a.txt('Количество',p,y+208,15,630); a.btn('−    1    +',end-104,y+200,104,'secondary',38);
  const q=small?247:291;
  a.line(p,y+q,w-36); a.txt('2 400 ₽',p,y+q+9,36,690); a.txt('Предварительно',p,y+q+51,13,450,'muted');
  a.txt('Минимум 1 800 ₽',end-113,y+q+43,13,540,'muted');
  if (!small) a.btn('+  В заказ',p,y+q+78,w-36);
}
function choice(name, w, theme, mode='ready') {
  const mobile=w<500;
  const a=art(name,w,mobile?1110:795,theme);
  const p=a.pad;
  a.icon('pin',p, mobile?77:92,15);
  a.txt('Омск · Химчистка с выездом',p+21,mobile?76:92,14,620,'action');
  if(mobile){
    a.txt('Чистая мебель.\nУ вас дома.',p,105,41,700);
    a.txt('Выберите мебель и рассчитайте стоимость.\nМастер уточнит детали и согласует выезд.',p,201,15,450,'muted');
    a.txt('Демо · Используйте вымышленные данные.',p,254,13,450,'muted');
    studio(a,p,279,w-p*2,258,mode);
    const tw=(w-p*2)/5;
    a.rect(p,545,w-p*2,64,'paper','line',12,'Выбор мебели');
    products.forEach(([glyph,s],i)=>{ if(i===0) a.rect(p+4,550,tw-8,54,'soft','line',10,'Выбран диван'); a.icon(glyph,p+i*tw+tw/2-9,556,18); a.txt(s,p+i*tw+8,579,12,620,'muted'); });
    config(a,p,620,w-p*2,true); a.btn('+  В заказ',p+18,932,w-p*2-36); a.txt('Вариант меняет тариф. 3D показывает тип мебели.',p,1005,13,450,'muted');
  }else{
    a.txt('Чистая мебель. У вас дома.',p,113,59,700);
    a.txt('Выберите мебель и рассчитайте\nстоимость. Мастер уточнит\nдетали и согласует выезд.',w-310,116,16,450,'muted');
    a.txt('Демо · Для проверки используйте вымышленные данные.',p,198,13,450,'muted');
    const sw=650;
    studio(a,p,227,sw,365,mode);
    a.rect(p,601,sw,51,'paper','line',12,'Выбор мебели');
    products.forEach(([glyph,s],i)=>{ if(i===0) a.rect(p+4,606,sw/5-8,41,'soft','line',9,'Выбран диван'); a.icon(glyph,p+i*sw/5+20,615,20); a.txt(s,p+i*sw/5+47,616,14,620); });
    config(a,p+sw+14,227,w-p*2-sw-14);
    a.txt('3D-модель показывает тип мебели. Вариант меняет тариф.',p,665,13,450,'muted');
    a.txt('Что чистим',p,705,27,680);
    products.forEach(([glyph,s],i)=>{const px=p+i*209; a.rect(px,747,198,37,'paper','line',10); a.icon(glyph,px+11,756,18); a.txt(s,px+39,755,14,630);});
  }
}
choice('Калькулятор · светлая',1180,'light');
choice('Калькулятор · телефон и тёмная',390,'dark');
choice('Без WebGL · телефон',390,'light','fallback');

function estimate(a,x,y,w) {
  a.rect(x,y,w,270,'paper','line',16,'Предварительный расчёт');
  a.txt('Предварительный расчёт',x+18,y+15,21,650);
  [['Чистка по тарифам','950 ₽'],['Доплата до минимума','850 ₽'],['Выезд за город','700 ₽']].forEach(([key,value],i)=>{
    a.txt(key,x+18,y+58+i*27,14,450,'muted');a.txt(value,x+w-74,y+58+i*27,14,650);
  });
  a.line(x+18,y+142,w-36);
  a.txt('Известная часть',x+18,y+159,15,600);a.txt('2 500 ₽',x+w-119,y+149,25,710);
  a.rect(x+18,y+193,w-36,42,'soft',null,9,'Ручная оценка');a.txt('По фото · 1 шт. Стоимость уточнит мастер.',x+29,y+205,13,570);
  a.txt('Итоговую цену подтвердит мастер.',x+18,y+244,13,455,'muted');
}
{
  const a=art('Заказ · смешанный расчёт и отмена удаления',1180,675);
  const x=48,y=243;
  a.txt('‹  К выбору мебели',x,87,15,625,'action');
  a.txt('Ваш заказ',x,116,56,690);a.txt('Проверьте состав и переходите к заявке.',x,187,17,450,'muted');
  a.rect(x,y,640,43,'soft',null,10,'Отмена удаления');
  a.txt('Кресло убрано из заказа.',x+13,y+11,15,500);
  a.txt('Отменить удаление',x+222,y+11,15,650,'action');
  a.rect(x,y+53,640,247,'paper','line',16,'Корзина');
  for(const [i,s,extra,price] of [[0,'Стул','Сиденье и спинка','950 ₽'],[1,'Другое','Мягкая банкетка','По фото']]){
    const r=y+71+i*72;a.icon(i?'other':'chair',x+22,r+8);a.txt(s,x+58,r,17,650);a.txt(extra,x+58,r+25,14,450,'muted');
    a.btn('−    1    +',x+340,r+4,94,'secondary',39);a.txt(price,x+452,r+13,16,650);a.txt('Изменить',x+539,r+14,14,550,'action');a.line(x+18,r+57,604);
  }
  a.btn('+ Добавить мебель',x+19,y+238,194,'secondary');
  estimate(a,x+654,y,430);a.btn('Оформить заявку',x+654,y+282,430);
}
{
  const a=art('Оформление · черновик и ошибка фото',1180,1004);
  const x=48,y=226;
  a.txt('‹  К заказу',x,86,15,620,'action');a.txt('Оформление заявки',x,117,55,690);a.txt('Оставьте контакты. Мастер свяжется с вами перед выездом.',x,182,17,450,'muted');
  a.rect(x,y,640,725,'paper','line',16,'Форма');
  a.txt('Контактные данные',x+18,y+16,22,680);
  a.label('Имя',x+18,y+57,'Алексей Примеров',292);a.label('Телефон',x+320,y+57,'+1 202 555 0104',302);
  a.label('Адрес',x+18,y+137,'Вымышленная улица, 42',604);
  a.rect(x+18,y+220,17,17,'bg','muted',2,'Флажок');a.txt('Выезд за город',x+45,y+216,15,630);
  a.line(x+18,y+256,604);
  a.txt('Когда вам удобно',x+18,y+272,22,670);a.txt('Дата и время по желанию. Мастер подтвердит запись после разговора.',x+18,y+306,14,450,'muted');
  a.label('Желаемая дата',x+18,y+338,'03.12.2030',292);a.label('Желаемое время',x+320,y+338,'15:30',302);
  a.txt('Фотографии (обязательно)',x+18,y+422,15,650);
  a.rect(x+18,y+453,604,48,'bg','line',9,'Загрузка фото');a.icon('photo',x+28,y+465,21);a.txt('Добавить фото',x+61,y+465,15,570);
  a.rect(x+18,y+513,604,36,'dangerBg',null,8,'Ошибка сети');a.txt('Не удалось загрузить фото. Повторите загрузку.',x+29,y+522,14,530,'danger');
  a.label('Комментарий (по желанию)',x+18,y+559,'Например, как пройти к подъезду',604);
  a.rect(x+20,y+642,16,16,'soft','action',3,'Согласие');
  a.txt('Согласен на обработку данных',x+45,y+638,15,600);
  a.btn('Отправить заявку',x+438,y+664,184);
  estimate(a,x+654,y,430);
  a.rect(x+654,y+282,430,154,'paper','line',16,'Состав заказа');a.txt('Состав заказа',x+672,y+297,21,650);
  a.txt('Стул · 1 шт.  ·  Сиденье и спинка',x+672,y+345,14,580);
  a.txt('Другое · 1 шт.  ·  Мягкая банкетка',x+672,y+385,14,580);
}
function statusPage(agreed){
  const a=art(agreed?'Статус · цена и время согласованы':'Статус · заявка принята, игра',1180,705);
  const x=48,y=239;
  a.rect(x,97,51,51,'soft',null,12,'Успешная запись');a.icon('check',x+12,109,27);
  a.txt('Заявка #0042',x+63,91,15,500,'muted');a.txt(agreed?'Статус заявки':'Заявка принята',x+63,112,51,710);
  a.txt(agreed?'Мастер подтвердил цену и время выезда.':'Мастер свяжется с вами, чтобы уточнить цену и время выезда.',x,190,17,450,'muted');
  a.btn(agreed?'Согласована':'Новая',1002,115,128,'selected',34);
  a.rect(x,y,641,141,'paper','line',16,'Состав заказа');a.txt('Состав заказа',x+17,y+16,21,670);
  a.txt('Стул · 1 шт.',x+17,y+54,16,650);a.txt('950 ₽',x+565,y+54,16,650);a.line(x+17,y+83,607);a.txt('Другое · 1 шт.',x+17,y+96,16,650);a.txt('По фото',x+555,y+96,16,650);
  a.rect(x,y+153,641,132,'paper','line',16,'Приватная ссылка');a.txt('Приватная ссылка',x+17,y+167,21,670);
  a.rect(x+17,y+211,430,43,'bg','line',9,'Приватная ссылка');a.txt('…/zayavka/приватная-ссылка',x+26,y+223,14,450,'muted');a.btn('Скопировать',x+467,y+211,154,'secondary',43);
  a.rect(x+655,y,429,143,'paper','line',16,'Цена и выезд');a.txt('Цена и выезд',x+672,y+16,21,670);
  a.txt('Итоговая цена',x+672,y+53,14,450,'muted');a.txt(agreed?'3 700 ₽':'Уточняет мастер',x+912,y+53,15,640);
  a.txt('Согласованное время',x+672,y+86,14,450,'muted');a.txt(agreed?'4 декабря, 16:45':'Ожидает согласования',x+894,y+86,15,630);
  estimate(a,x+655,y+156,429);
  if(!agreed){a.rect(x,y+299,641,133,'paper','line',16,'Необязательная игра');a.txt('Почистите диван',x+17,y+314,23,655);a.txt('Короткая игра после заявки.',x+17,y+350,15,450,'muted');a.btn('Сыграть',x+17,y+377,123,'secondary',42);}
}
statusPage(false);
statusPage(true);
{
  const a=art('Кабинет · список заявок',1180,672);
  a.txt('Кабинет владельца',48,94,15,590,'action');a.txt('Управление',48,115,54,690);
  a.rect(48,199,1084,57,'paper','line',12,'Разделы кабинета');
  ['Заявки','Тарифы','Компания','Игра','Персонажи','Доступ'].forEach((s,i)=>a.btn(s,56+i*111,206,106,i===0?'selected':'ghost',42));
  a.rect(48,270,1084,348,'paper','line',16,'Заявки');
  a.txt('Заявки',68,284,26,690);a.txt('Откройте заявку, чтобы проверить фото и согласовать выезд.',68,322,14,450,'muted');
  a.rect(68,351,432,43,'bg','line',9,'Поиск');
  a.icon('search',78,362,18);a.txt('Имя, телефон, адрес, номер или бонус',111,361,15,450,'muted');a.btn('Все статусы',517,351,150,'secondary',43);a.btn('Обновить',1004,286,107,'secondary',42);
  a.line(68,410,1044); a.txt('Номер и клиент',76,422,14,560,'muted'); a.txt('Статус',621,422,14,560,'muted'); a.txt('Цена',905,422,14,560,'muted');
  for(const [i,name,status,price] of [[0,'#0042 · Алексей Примеров','Новая','от 2 500 ₽'],[1,'#0041 · Вера Тестова','Согласована','3 700 ₽']]){
    const y=458+i*68;a.line(68,y-9,1044);a.txt(name,76,y+3,17,645);a.txt('+1 202 555 0104 · 26 нояб.',76,y+28,13,450,'muted');a.btn(status,615,y+7,126,'selected',28);a.txt(price,905,y+11,16,620);
  }
}
{
  const a=art('Кабинет · карточка и согласование',1180,983);
  a.txt('Кабинет владельца',48,94,15,590,'action');a.txt('Управление',48,115,54,690);
  a.rect(48,189,1084,54,'paper','line',12,'Разделы кабинета');
  ['Заявки','Тарифы','Компания','Игра','Персонажи','Доступ'].forEach((s,i)=>a.btn(s,56+i*111,196,106,i===0?'selected':'ghost',40));
  a.txt('‹ К списку заявок',48,267,15,620,'action');a.txt('Заявка #0042',48,298,32,680);a.btn('Согласована',269,304,126,'selected',32);
  const x=48,y=359;
  a.rect(x,y,618,225,'paper','line',16,'Клиент и адрес');
  a.txt('Клиент и адрес',x+17,y+16,21,650);
  [['Имя','Алексей Примеров'],['Телефон','+1 202 555 0104'],['Адрес','Вымышленная улица, 42'],['Выезд за город','Да'],['Пожелание по времени','3 декабря, 15:30']].forEach(([s,v],i)=>{a.txt(s,x+17,y+55+i*29,15,450,'muted');a.txt(v,x+365,y+55+i*29,15,600);});
  a.rect(x,y+238,618,159,'paper','line',16,'Состав заказа');a.txt('Состав заказа',x+17,y+253,21,650);a.txt('Стул · 1 шт.  ·  Сиденье и спинка',x+17,y+296,15,595);a.txt('Другое · 1 шт.  ·  Мягкая банкетка',x+17,y+341,15,595);
  a.rect(x,y+408,618,143,'paper','line',16,'Фото');a.txt('Фото и история',x+17,y+423,21,650);a.rect(x+17,y+462,104,68,'stage','line',8,'Пример фото');a.icon('photo',x+57,y+481,23);
  const b=680;
  a.rect(b,y,452,402,'paper','line',16,'Согласование');a.txt('Согласование',b+17,y+16,21,650);
  a.label('Статус',b+17,y+55,'Согласована',418);a.label('Итоговая цена, ₽',b+17,y+128,'3700',418);
  a.label('Согласованная дата',b+17,y+200,'04.12.2030',205);a.label('Согласованное время',b+230,y+200,'16:45',205);
  a.label('Приватная заметка',b+17,y+272,'Вымышленная запись владельца',418);a.btn('Сохранить заявку',b+17,y+343,418);
  a.btn('Удалить заявку',b+17,y+432,190,'secondary');
}

const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' })[char]);
function colors(st) {
  if (st==='primary') return ['action',null,'actionText'];
  if (st==='selected') return ['soft','line','action'];
  if (st==='ghost') return [null,null,'ink'];
  return ['paper','line','ink'];
}
function svgLayer(n,c){
  const color=(key)=>key ? c[key] : 'none';
  const name=escape(n.name);
  const x=n.x,y=n.y;
  if(n.type==='rect') return `<rect aria-label="${name}" x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="${n.r}" fill="${color(n.fill)}" stroke="${color(n.stroke)}"/>`;
  if(n.type==='ellipse') return `<ellipse aria-label="${name}" cx="${x+n.w/2}" cy="${y+n.h/2}" rx="${n.w/2}" ry="${n.h/2}" fill="none" stroke="${color(n.stroke)}" opacity="${n.op}"/>`;
  if(n.type==='clip') return `<svg aria-label="${name}" x="${x}" y="${y}" width="${n.w}" height="${n.h}" style="overflow:hidden;border-radius:${n.r}px">${n.nodes.map((child)=>svgLayer(child,c)).join('')}</svg>`;
  if(n.type==='icon') return `<g aria-label="${name}" transform="translate(${x},${y}) scale(${n.size/24})">${n.svg}</g>`;
  if(n.type==='image') return `<image aria-label="${name}" x="${x}" y="${y}" width="${n.w}" height="${n.h}" href="data:image/png;base64,${sofa}"/>`;
  if(n.type==='text'){
    const lines=n.s.split('\n');
    return `<text x="${x}" y="${y+n.size}" font-size="${n.size}" font-weight="${n.weight}" fill="${color(n.fill)}">${lines.map((s,i)=>`<tspan x="${x}" dy="${i?n.size*1.17:0}">${escape(s)}</tspan>`).join('')}</text>`;
  }
  if(n.type==='button'){
    const [fill,stroke,ink]=colors(n.style);
    return `<g aria-label="${name}"><rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="10" fill="${color(fill)}" stroke="${color(stroke)}"/><text text-anchor="middle" x="${x+n.w/2}" y="${y+n.h/2+5}" fill="${color(ink)}" font-size="14" font-weight="650">${escape(n.s)}</text></g>`;
  }
}
const board = [];
let rowY=49;
for (const row of [frames.slice(0,3), frames.slice(3,5), frames.slice(5,7), frames.slice(7,9)]) {
  let x=28;
  let rowH=0;
  for (const frame of row) {
    const t=themes[frame.theme];
    const slug=escape(frame.name);
    board.push(`<g transform="translate(${x},${rowY})" role="group" aria-label="${slug}"><text y="-10" fill="#43504a" font-size="19" font-weight="620">${slug}</text><rect width="${frame.w}" height="${frame.h}" rx="3" fill="${t.bg}" stroke="#d7dcd5"/>${frame.nodes.map((n)=>svgLayer(n,t)).join('')}</g>`);
    x+=frame.w+29; rowH=Math.max(rowH,frame.h);
  }
  rowY+=rowH+52;
}
const file = '<svg xmlns="http://www.w3.org/2000/svg" width="2445" height="'+rowY+'" viewBox="0 0 2445 '+rowY+'" font-family="Onest, system-ui, sans-serif"><title>Мягко · экраны MVP</title><rect width="100%" height="100%" fill="#e1e5df"/>'+board.join('')+'</svg>';
await writeFile(new URL('myagko-screens.svg',base),file);
const runtime=await readFile(new URL('figma-runtime.js',base),'utf8');
const data=JSON.stringify({frames,themes,sofa});
await writeFile(new URL('figma-import.js',base),'const project = '+data+';\n'+runtime);
console.log('Редактируемых экранов:',frames.length);
