'use client';

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { LoaderCircle, Move, RotateCcw } from 'lucide-react';
import { catalog, type Category, type Characters } from '@/lib/domain';
import { stageTints } from './site';

const Viewport = dynamic(() => import('./three-viewport').then((module) => module.ThreeViewport), { ssr: false });
type State = 'loading' | 'ready' | 'unsupported' | 'error';
class SceneBoundary extends Component<{ fail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.fail(); }
  render() { return this.state.failed ? null : this.props.children; }
}
const playfulPhrases = { sofa: 'Подушки ждут спа!', armchair: 'Пусть пятна сдадутся первыми!', mattress: 'Перевернём страницу!', chair: 'Спинка готова к спа!', other: 'Пятна, вас заметили!' };
type GameOptions = { cleaning: boolean; progress: (value: number) => void; keyboardStroke: number; availability?: (ready: boolean) => void };
export function FurnitureStage({ category, characters, label, game }: { category: Category; characters: Characters; label: string; game?: GameOptions }) {
  const [state, setState] = useState<State>('loading');
  const [canRender, setCanRender] = useState(false);
  const [reset, setReset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const bubble = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<Category>(category);
  useEffect(() => {
    try {
      const probe = document.createElement('canvas');
      const context = probe.getContext('webgl2');
      if (!context) { setState('unsupported'); return; }
      context.getExtension('WEBGL_lose_context')?.loseContext();
      setState('loading');
      setCanRender(true);
    } catch { setState('unsupported'); }
  }, [attempt]);
  const availability = game?.availability;
  useEffect(() => { availability?.(state === 'ready'); }, [availability, state]);
  const fail = useCallback(() => setState('error'), []);
  const loading = useCallback(() => setState('loading'), []);
  const ready = useCallback((next: Category) => { setShown(next); setState('ready'); }, []);
  const hasView = canRender && state !== 'error' && state !== 'unsupported';
  const showPoster = !hasView || (state === 'loading' && !reset && shown === category);
  const phrase = characters.mood === 'friendly' ? catalog[shown].phrase : characters.mood === 'playful' ? playfulPhrases[shown] : 'Посмотрите на мебель с разных сторон.';
  return <div className={'furniture-stage ' + stageTints[category] + (game ? ' game-stage' : '')} data-3d={state} aria-label={label}>
    <div className="studio-rings" aria-hidden="true"><i/><i/><i/></div>
    <div className={'stage-poster' + (showPoster ? '' : ' poster-hidden')} aria-hidden={hasView && state === 'ready'}>
      <img src={'/posters/' + category + (characters.faces ? '' : '-plain') + '.webp'} alt={label} fetchPriority={category === 'sofa' && !game ? 'high' : 'auto'} draggable={false}/>
    </div>
    {hasView && <div className="stage-canvas"><SceneBoundary key={attempt} fail={fail}>
      <Viewport category={category} characters={characters} onReady={ready} onLoading={loading} onFailure={fail} reset={reset} game={game} bubble={bubble}/>
    </SceneBoundary></div>}
    {hasView && !game && characters.phrases && <div className={'phrase-anchor' + (state === 'ready' ? ' visible' : '')} ref={bubble} aria-hidden={state !== 'ready'}>
      <span className="character-phrase">{phrase}</span>
    </div>}
    <div className="stage-top"><span className="stage-indicator"><i/>{state === 'ready' ? '3D-просмотр' : 'Модель мебели'}</span>
      {state === 'ready' && <button className="icon-button reset-view" type="button" aria-label="Сбросить ракурс" title="Сбросить ракурс" onClick={() => setReset((v) => v + 1)}><RotateCcw size={18}/></button>}
    </div>
    <div className="stage-caption" role="status">
      {state === 'ready' ? <><Move size={16}/>{game?.cleaning ? 'Проведите по пятнам' : 'Тяните, чтобы повернуть'}</> :
        state === 'loading' ? <><LoaderCircle className="spin" size={16}/> Загружаем 3D…</> :
        <>{state === 'error' ? '3D не загрузилось' : '3D недоступно в этом браузере'}
          <button type="button" className="text-button" onClick={() => { setCanRender(false); setState('loading'); setAttempt((v) => v + 1); }}>Повторить</button></>}
    </div>
  </div>;
}
