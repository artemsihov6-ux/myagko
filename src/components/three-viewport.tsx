'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  CanvasTexture, Group, Mesh, MeshStandardMaterial, Object3D, PCFShadowMap, Raycaster, RepeatWrapping,
  Vector2, Vector3, type PerspectiveCamera, type Texture,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { catalog, type Category, type Characters } from '@/lib/domain';
import { createMasks, type Masks } from './stains';

const cache = new Map<Category, Promise<Object3D>>();
function load(category: Category) {
  const known = cache.get(category);
  if (known) return known;
  const promise = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/' + category + '.glb').then((gltf) => gltf.scene);
  cache.set(category, promise);
  promise.catch(() => { if (cache.get(category) === promise) cache.delete(category); });
  return promise;
}

const framing = {
  sofa: { center: .82, distance: 6.05 }, armchair: { center: .96, distance: 5.25 },
  mattress: { center: .51, distance: 5.75 }, chair: { center: 1.08, distance: 4.95 },
  other: { center: .59, distance: 4.65 },
};
type GameSettings = { cleaning: boolean; progress: (value: number) => void; keyboardStroke: number };

export function ThreeViewport({ category, characters, onReady, onLoading, onFailure, reset, game, bubble }: {
  category: Category; characters: Characters; onReady: (category: Category) => void;
  onLoading: () => void; onFailure: () => void; reset: number; game?: GameSettings; bubble: RefObject<HTMLDivElement | null>;
}) {
  const [active, setActive] = useState<{ category: Category; scene: Object3D } | null>(null);
  const reduced = useReducedMotion() ?? false;
  useEffect(() => {
    let current = true;
    onLoading();
    load(category).then((scene) => {
      if (!current) return;
      setActive({ category, scene });
    }).catch(() => { if (current) onFailure(); });
    return () => { current = false; };
  }, [category, onLoading, onFailure]);
  useEffect(() => {
    if (!active || game) return;
    let timer: number | undefined;
    let id: number | undefined;
    const warm = () => {
      const candidates = (Object.keys(catalog) as Category[]).filter((next) => next !== active.category);
      // Sequential background prefetch avoids making the first view compete with all downloads.
      void candidates.reduce((sequence, next) => sequence.then(() => load(next).then(() => undefined).catch(() => {})), Promise.resolve());
    };
    if (window.requestIdleCallback) id = window.requestIdleCallback(warm, { timeout: 3000 });
    else timer = window.setTimeout(warm, 1500);
    return () => { if (id !== undefined) window.cancelIdleCallback(id); if (timer !== undefined) clearTimeout(timer); };
  }, [active, game]);
  return <Canvas
    shadows={{ type: PCFShadowMap }} dpr={[1, 1.45]} frameloop="demand"
    gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
    camera={{ fov: 35, near: .1, far: 32, position: [3.4, 2.6, 6] }}
  >
    <ContextEvents fail={onFailure}/>
    <hemisphereLight args={['#fcfbe7', '#a9ad9b', 2.15]}/>
    <directionalLight position={[-3.6, 7, 4]} intensity={2.25} castShadow color="#fff3d9"
      shadow-mapSize={[1024, 1024]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4}
      shadow-camera-bottom={-4} shadow-normalBias={0.023} shadow-bias={-0.00014} shadow-radius={3}/>
    <directionalLight position={[3, 3, -5]} intensity={1.55} color="#f1ebe4"/>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.022, 0]} receiveShadow>
      <planeGeometry args={[30, 30]}/><shadowMaterial opacity={.145} depthWrite={false}/>
    </mesh>
    {active && <Model key={active.category} active={active} characters={characters} reduced={reduced} reset={reset} onReady={onReady} onFailure={onFailure} game={game} bubble={bubble}/>}
  </Canvas>;
}

function ContextEvents({ fail }: { fail: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); fail(); };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, fail]);
  return null;
}

function texture(): Texture | undefined {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 64;
  const ctx = tile.getContext('2d');
  if (!ctx) return;
  const pixels = ctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const index = (y * 64 + x) * 4;
    const value = 128 + 32 * Math.sin(y * Math.PI / 2) * Math.cos(x * Math.PI / 2) + (x * 57 + y * 31) % 37;
    pixels.data.set([value, value, value, 255], index);
  }
  ctx.putImageData(pixels, 0, 0);
  const map = new CanvasTexture(tile);
  map.wrapS = map.wrapT = RepeatWrapping;
  map.repeat.set(11, 11);
  map.anisotropy = 4;
  return map;
}

function Model({ active, characters, reduced, onReady, onFailure, reset, game, bubble }: {
  active: { category: Category; scene: Object3D }; characters: Characters; reduced: boolean; reset: number;
  onReady: (category: Category) => void; onFailure: () => void; game?: GameSettings; bubble: RefObject<HTMLDivElement | null>;
}) {
  const { camera, gl, invalidate, size } = useThree();
  const orbit = useRef<OrbitControlsType>(null);
  const wrap = useRef<Group>(null);
  const masks = useRef<Masks | null>(null);
  const keyboard = useRef(game?.keyboardStroke ?? 0);
  const entrance = useRef(0);
  const blink = useRef(0);
  const projected = useMemo(() => new Vector3(), []);
  const category = active.category;
  const model = useMemo(() => {
    const scene = active.scene.clone(true);
    const fabric = texture();
    const materials = new Set<MeshStandardMaterial>();
    const face: Object3D[] = [];
    const eyes: { node: Object3D; scaleY: number }[] = [];
    scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.castShadow = !/^(Eye|Glint|Cheek|Smile)/.test(node.name);
      node.receiveShadow = true;
      if (/^(Eye|Glint|Cheek|Smile)/.test(node.name)) face.push(node);
      if (/^(Eye|Glint)/.test(node.name)) eyes.push({ node, scaleY: node.scale.y });
      if (node.name.startsWith('Clean') && node.material instanceof MeshStandardMaterial && fabric) {
        const material = node.material.clone();
        material.bumpMap = fabric;
        material.bumpScale = .009;
        node.material = material;
        materials.add(material);
      }
    });
    return { scene, face, eyes, anchorEye: eyes.find(({ node }) => node.name.startsWith('Eye'))?.node,
      arm: scene.getObjectByName('Wave'), fabric, materials };
  }, [active.scene]);
  useEffect(() => () => {
    model.fabric?.dispose();
    model.materials.forEach((material) => material.dispose());
  }, [model]);
  useLayoutEffect(() => {
    model.face.forEach((node) => { node.visible = characters.faces; });
    invalidate();
  }, [model, characters.faces, invalidate]);

  const frame = framing[category];
  useLayoutEffect(() => {
    const controls = orbit.current;
    if (!controls) return;
    const aspect = size.width / Math.max(1, size.height);
    const fit = Math.max(1, 1.28 / aspect);
    const distance = frame.distance * fit;
    const direction = new Vector3(.32, game ? .44 : .30, .90).normalize();
    controls.target.set(0, frame.center + (category === 'chair' && size.width < 520 ? .15 : 0), 0);
    camera.position.copy(controls.target).addScaledVector(direction, distance);
    (camera as PerspectiveCamera).updateProjectionMatrix();
    controls.minDistance = distance * .79;
    controls.maxDistance = distance * 1.7;
    controls.update();
    invalidate();
  }, [camera, category, frame, game !== undefined, invalidate, reset, size.width, size.height]);

  useLayoutEffect(() => {
    let disposed = false;
    const key = requestAnimationFrame(() => { if (!disposed) onReady(category); });
    if (game) {
      try {
        model.scene.updateMatrixWorld(true);
        masks.current = createMasks(model.scene);
        invalidate();
      } catch { onFailure(); }
    }
    return () => { disposed = true; cancelAnimationFrame(key); masks.current?.dispose(); masks.current = null; };
  }, [model, category, game !== undefined, invalidate, onFailure, onReady]);

  useEffect(() => {
    if (reduced || game || !characters.faces || characters.mood === 'calm') return;
    const timer = window.setInterval(() => { blink.current = performance.now(); invalidate(); }, 7100);
    return () => clearInterval(timer);
  }, [reduced, game !== undefined, characters.faces, characters.mood, invalidate]);
  useFrame(() => {
    if (!wrap.current) return;
    const now = performance.now();
    if (!entrance.current) entrance.current = now;
    const time = (now - entrance.current) / 1000;
    const motion = !reduced && !game;
    if (motion && time < .28) {
      const size = .91 + .09 * (1 - (1 - time / .28) ** 3);
      wrap.current.scale.setScalar(size);
      invalidate();
    } else if (wrap.current.scale.x !== 1) wrap.current.scale.setScalar(1);
    if (model.arm) {
      if (motion && characters.faces && characters.mood !== 'calm' && time < 1.26) {
        model.arm.rotation.z = Math.sin(time * 12) * .25 * Math.sin(Math.PI * time / 1.26);
        invalidate();
      } else model.arm.rotation.z = 0;
    }
    const elapsed = blink.current ? (now - blink.current) / 1000 : Infinity;
    const eyes = motion && elapsed < .17 ? 1 - .85 * Math.sin(elapsed * Math.PI / .17) : 1;
    model.eyes.forEach(({ node, scaleY }) => { node.scale.y = scaleY * eyes; });
    if (elapsed < .17) invalidate();
    const label = bubble.current;
    if (label && size.width > 0) {
      camera.updateMatrixWorld();
      projected.set(.04, frame.center * 1.6 + .55, .12).project(camera);
      const inset = Math.min(size.width * .34, label.offsetWidth / 2 + 10);
      const x = Math.max(inset, Math.min(size.width - inset, (projected.x * .5 + .5) * size.width));
      const bodyAnchor = (.5 - projected.y * .5) * size.height;
      const height = label.offsetHeight;
      const clearance = size.width < 520 ? 7 : 9;
      const eyeY = model.anchorEye
        ? (.5 - model.anchorEye.getWorldPosition(projected).project(camera).y * .5) * size.height
        : size.height;
      const preferred = Math.max(43, bodyAnchor - height * .3);
      const y = Math.min(preferred, eyeY - clearance - height);
      label.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translateX(-50%)';
      label.style.visibility = camera.position.z >= -.1 && y >= (size.width < 520 ? 36 : 39) ? 'visible' : 'hidden';
    }
  });

  const progress = game?.progress;
  const cleaning = game?.cleaning;
  useEffect(() => {
    if (!cleaning || !progress) return;
    const element = gl.domElement;
    const ray = new Raycaster();
    const pointer = new Vector2();
    let last = 0;
    function brush(event: PointerEvent) {
      const rect = element.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
      ray.setFromCamera(pointer, camera);
      const value = masks.current?.brush(ray);
      if (value !== undefined) { progress?.(value); invalidate(); }
    }
    function down(event: PointerEvent) {
      if (!event.isPrimary || event.button !== 0) return;
      element.setPointerCapture(event.pointerId);
      brush(event);
    }
    function move(event: PointerEvent) {
      if (!event.isPrimary || !element.hasPointerCapture(event.pointerId) || performance.now() - last < 12) return;
      last = performance.now();
      brush(event);
    }
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    return () => { element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move); };
  }, [camera, cleaning, gl, invalidate, progress]);
  useEffect(() => {
    const next = game?.keyboardStroke ?? 0;
    if (next !== keyboard.current) {
      keyboard.current = next;
      const value = masks.current?.keyboardBrush();
      if (value !== undefined) { progress?.(value); invalidate(); }
    }
  }, [game?.keyboardStroke, invalidate, progress]);

  return <>
    <group ref={wrap}><primitive object={model.scene} dispose={null}/></group>
    <OrbitControls ref={orbit} makeDefault enabled={!game?.cleaning} enableDamping={!reduced} dampingFactor={.16}
      enablePan={false} minPolarAngle={.48} maxPolarAngle={1.54} rotateSpeed={.76} zoomSpeed={.62}/>
  </>;
}
