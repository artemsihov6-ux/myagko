import sharp from 'sharp';
import { readdir, unlink } from 'node:fs/promises';
for (const file of await readdir('public/posters')) {
  if (!file.endsWith('.png')) continue;
  const source = 'public/posters/' + file;
  await sharp(source).webp({ quality: 86, alphaQuality: 95 }).toFile(source.replace(/\.png$/, '.webp'));
  await unlink(source);
}
