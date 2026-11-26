/* Figma Plugin API. This source is concatenated with the project data. */
(async () => {
  const available = (await figma.listAvailableFontsAsync()).map(({ fontName }) => fontName);
  const choose = (weights) => {
    for (const family of ['Onest', 'Inter']) {
      for (const style of weights) {
        const matching = available.find((font) => font.family === family && font.style === style);
        if (matching) return matching;
      }
    }
    return { family: 'Inter', style: 'Regular' };
  };
  const fonts = {
    regular: choose(['Regular']), medium: choose(['Medium', 'Regular']),
    semibold: choose(['SemiBold', 'Semibold', 'Medium']), bold: choose(['Bold', 'SemiBold']),
  };
  await Promise.all(Object.values(fonts).map((font) => figma.loadFontAsync(font)));
  const font = (weight) => weight >= 690 ? fonts.bold : weight >= 590 ? fonts.semibold : weight >= 500 ? fonts.medium : fonts.regular;
  const rgb = (hex) => ({
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  });
  let themeVars, light, dark;
  let activeTheme = 'light';
  const variables = {};
  try {
    themeVars = figma.variables.createVariableCollection('Мягко · темы');
    light = themeVars.modes[0].modeId;
    dark = themeVars.addMode('Тёмная');
    themeVars.renameMode(light, 'Светлая');
    for (const key of Object.keys(project.themes.light)) {
      const variable = figma.variables.createVariable(key, themeVars, 'COLOR');
      variable.setValueForMode(light, rgb(project.themes.light[key]));
      variable.setValueForMode(dark, rgb(project.themes.dark[key]));
      variables[key] = variable;
    }
  } catch {
    // Plans with a single variable mode still get editable light and dark screens.
    themeVars?.remove();
    themeVars = undefined;
  }
  const fill = (key) => {
    if (!key) return [];
    const paint = { type:'SOLID', color:rgb(project.themes[activeTheme][key]) };
    return [themeVars ? figma.variables.setBoundVariableForPaint(paint, 'color', variables[key]) : paint];
  };
  const attach = (parent, node, x, y) => {
    parent.appendChild(node);
    node.x = x;
    node.y = y;
    return node;
  };
  function paint(node, color, border) {
    node.fills = fill(color);
    node.strokes = fill(border);
    if (border) node.strokeAlign = 'INSIDE';
  }
  function group(parent, name, x, y, w, h, color, border, rounding, clips) {
    const frame = attach(parent, figma.createFrame(), x, y);
    frame.name = name;
    frame.resize(w,h);
    frame.cornerRadius = rounding;
    frame.clipsContent = clips;
    paint(frame, color, border);
    return frame;
  }
  function text(parent, data) {
    const n = attach(parent, figma.createText(), data.x, data.y);
    n.fontName = font(data.weight);
    n.fontSize = data.size;
    n.characters = data.s;
    n.fills = fill(data.fill);
    n.lineHeight = { unit:'PERCENT', value:117 };
    if (data.size >= 25) n.letterSpacing = { unit:'PERCENT', value:-3.5 };
    if (data.w) { n.resize(data.w,n.height); n.textAutoResize = 'HEIGHT'; }
    else n.textAutoResize = 'WIDTH_AND_HEIGHT';
    n.name = data.name;
    return n;
  }
  const page = figma.createPage();
  page.name = 'Мягко · основные экраны';
  await figma.setCurrentPageAsync(page);
  const componentThemes = themeVars ? ['light'] : ['light','dark'];
  const collection = group(page, 'Компоненты · кнопки', -280, 0, 235, 25 + 224 * componentThemes.length, 'bg', 'line', 12, false);
  const components = {};
  for (const [j,theme] of componentThemes.entries()) {
    activeTheme = theme;
    for (const [i,[style,key,border,foreground]] of [
      ['primary','action',null,'actionText'], ['secondary','paper','line','ink'],
      ['selected','soft','line','action'], ['ghost',null,null,'ink'],
    ].entries()) {
      const c = attach(collection, figma.createComponent(), 15, 13+(j*4+i)*56);
      c.name = 'Кнопка / ' + theme + ' / ' + style;
      c.layoutMode = 'HORIZONTAL';
      c.primaryAxisAlignItems = 'CENTER';
      c.counterAxisAlignItems = 'CENTER';
      c.resize(195,44);
      c.cornerRadius = 10;
      paint(c,key,border);
      const label = text(c,{name:'Подпись',s:'Подпись',x:0,y:0,size:14,weight:650,fill:foreground});
      const property = c.addComponentProperty('Подпись','TEXT','Подпись');
      label.componentPropertyReferences = { characters:property };
      components[theme+'/'+style] = { c, property };
    }
  }
  const image = figma.createImage(figma.base64Decode(project.sofa));
  function mount(parent,n) {
    if (n.type==='text') return text(parent,n);
    if (n.type==='button') {
      const { c,property } = components[(themeVars ? 'light' : activeTheme) + '/' + n.style];
      const node = attach(parent,c.createInstance(),n.x,n.y);
      node.resize(n.w,n.h);
      node.setProperties({ [property]:n.s });
      node.name=n.name;
      return;
    }
    if (n.type==='icon') {
      const node = attach(parent,figma.createNodeFromSvg(n.svg),n.x,n.y);
      node.name=n.name;
      node.rescale(n.size/24);
      return;
    }
    if (n.type==='clip') {
      const node=group(parent,n.name,n.x,n.y,n.w,n.h,null,null,n.r,true);
      n.nodes.forEach((child)=>mount(node,child));
      return;
    }
    const node = attach(parent,n.type==='ellipse'?figma.createEllipse():figma.createRectangle(),n.x,n.y);
    node.name=n.name;
    node.resize(n.w,n.h);
    if (n.type==='image') node.fills=[{type:'IMAGE',imageHash:image.hash,scaleMode:'FIT'}];
    else {
      if (n.type==='rect') node.cornerRadius=n.r;
      if (n.op) node.opacity=n.op;
      paint(node,n.fill,n.stroke);
    }
  }
  const first = [];
  let y=0;
  for (const row of [project.frames.slice(0,3),project.frames.slice(3,5),project.frames.slice(5,7),project.frames.slice(7,9)]) {
    let x=0;
    for (const layout of row) {
      activeTheme=layout.theme;
      const frame=group(page,layout.name,x,y,layout.w,layout.h,'bg',null,0,true);
      // Explicit modes keep mixed light and dark screens together on the same page.
      if(themeVars) frame.setExplicitVariableModeForCollection(themeVars,layout.theme==='dark'?dark:light);
      layout.nodes.forEach((node)=>mount(frame,node));
      if (!y) first.push(frame);
      x+=layout.w+28;
    }
    y+=Math.max(...row.map((frame)=>frame.h))+45;
  }
  figma.viewport.scrollAndZoomIntoView(first);
  figma.closePlugin('Создано 9 редактируемых экранов.');
})().catch((error) => figma.closePlugin('Не удалось создать экраны: '+error.message));
