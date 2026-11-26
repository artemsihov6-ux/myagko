import {
  CanvasTexture, Mesh, MeshBasicMaterial, Raycaster, SRGBColorSpace, Vector3, type Object3D,
} from 'three';

const resolution = 256;
const brushRadius = .055 * resolution;
type Spot = { x: number; y: number };
type Layer = { ctx: CanvasRenderingContext2D; map: CanvasTexture; mesh: Mesh; overlay: Mesh<Mesh["geometry"], MeshBasicMaterial>; marks: Spot[]; start: number; current: number };

const rays = [
  { from: [-.67, 1.38, 3], toward: [0, 0, -1] },
  { from: [.68, 1.22, 3], toward: [0, 0, -1] },
  { from: [-.72, 3.1, .43], toward: [0, -1, 0] },
  { from: [.67, 3.1, .43], toward: [0, -1, 0] },
  { from: [-1.31, .49, 3], toward: [0, 0, -1] },
  { from: [1.40, 1.12, 3], toward: [0, 0, -1] },
] as const;

function alpha(ctx: CanvasRenderingContext2D) {
  const data = ctx.getImageData(0, 0, resolution, resolution).data;
  let sum = 0;
  for (let i = 3; i < data.length; i += 4) sum += data[i];
  return sum;
}
function blotch(ctx: CanvasRenderingContext2D, x: number, y: number, index: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((index - 2) * .38);
  ctx.scale(1, .76);
  const radius = 15 + index % 3;
  const gradient = ctx.createRadialGradient(0, 0, 1, 0, 0, radius);
  gradient.addColorStop(0, 'rgba(94,52,27,.88)');
  gradient.addColorStop(.52, 'rgba(116,70,35,.81)');
  gradient.addColorStop(.82, 'rgba(129,77,37,.47)');
  gradient.addColorStop(1, 'rgba(100,58,22,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  for (let i = 0; i < 30; i++) {
    const angle = i / 30 * Math.PI * 2;
    const r = radius * (.85 + .13 * Math.cos(angle * 5 + index));
    const xx = Math.cos(angle) * r;
    const yy = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export type Masks = ReturnType<typeof createMasks>;
export function createMasks(root: Object3D) {
  const originals: Mesh[] = [];
  root.traverse((node) => { if (node instanceof Mesh) originals.push(node); });
  const targets = originals.filter((node) => node.name.startsWith('Clean'));
  const layers = new Map<Mesh, Layer>();
  for (const [index, { from, toward }] of rays.entries()) {
    const ray = new Raycaster(new Vector3(...from), new Vector3(...toward));
    const hit = ray.intersectObjects(targets, false)[0];
    if (!hit?.uv) continue;
    const mesh = hit.object as Mesh;
    if (!layers.has(mesh)) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = resolution;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas mask unavailable');
      const map = new CanvasTexture(canvas);
      map.flipY = false; // GLB UV origin matches the canvas when upload isn't flipped.
      map.colorSpace = SRGBColorSpace;
      const overlay = new Mesh(mesh.geometry, new MeshBasicMaterial({
        map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        alphaTest: .016, toneMapped: false,
      }));
      overlay.raycast = () => {};
      mesh.add(overlay);
      layers.set(mesh, { ctx, map, mesh, overlay, marks: [], start: 0, current: 0 });
    }
    const layer = layers.get(mesh)!;
    const spot = { x: hit.uv.x * resolution, y: hit.uv.y * resolution };
    layer.marks.push(spot);
    blotch(layer.ctx, spot.x, spot.y, index);
  }
  for (const layer of layers.values()) {
    layer.map.needsUpdate = true;
    layer.current = layer.start = alpha(layer.ctx);
  }
  const baseline = [...layers.values()].reduce((sum, layer) => sum + layer.start, 0);
  if (!baseline) throw new Error('No visible UV marks');
  function paint(layer: Layer, x: number, y: number, radius: number) {
    const { ctx } = layer;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    layer.map.needsUpdate = true;
    layer.current = alpha(ctx);
    const left = [...layers.values()].reduce((sum, item) => sum + item.current, 0);
    return left < baseline * .025 ? 100 : Math.floor(100 * (1 - left / baseline));
  }
  return {
    brush(ray: Raycaster) {
      const hit = ray.intersectObjects(originals.filter((node) => node.visible), false)[0];
      const layer = hit && layers.get(hit.object as Mesh);
      if (!layer || !hit.uv) return;
      return paint(layer, hit.uv.x * resolution, hit.uv.y * resolution, brushRadius);
    },
    keyboardBrush() {
      for (const layer of layers.values()) {
        const mark = layer.marks.shift();
        if (mark) return paint(layer, mark.x, mark.y, 19);
      }
    },
    dispose() {
      for (const layer of layers.values()) {
        layer.mesh.remove(layer.overlay);
        layer.overlay.material.dispose();
        layer.map.dispose();
      }
    },
  };
}
