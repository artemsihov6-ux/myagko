'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeButton() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    function update() { setDark(document.documentElement.dataset.theme === 'dark'); }
    update();
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = () => {
      try { if (localStorage.getItem('myagko.theme')) return; } catch {}
      document.documentElement.dataset.theme = query.matches ? 'dark' : 'light';
      update();
    };
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, []);
  return <button type="button" className="icon-button theme-button" aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'} onClick={() => {
    const theme = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('myagko.theme', theme); } catch {}
    setDark(!dark);
  }}>{dark ? <Sun size={19}/> : <Moon size={19}/>}</button>;
}

export function ServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      void navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
