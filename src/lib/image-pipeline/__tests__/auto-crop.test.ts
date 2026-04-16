import sharp from 'sharp';
import { cropForHero } from '../auto-crop';

async function test() {
  const square = await sharp({
    create: { width: 2000, height: 2000, channels: 3, background: { r: 128, g: 128, b: 128 } }
  }).jpeg().toBuffer();
  const r1 = await cropForHero(square);
  console.log('Square → 16:9:', r1.croppedWidth, 'x', r1.croppedHeight, 'aspect:', (r1.croppedWidth / r1.croppedHeight).toFixed(2));

  const wide = await sharp({
    create: { width: 3000, height: 1000, channels: 3, background: { r: 200, g: 100, b: 100 } }
  }).jpeg().toBuffer();
  const r2 = await cropForHero(wide);
  console.log('Wide → 16:9:', r2.croppedWidth, 'x', r2.croppedHeight);

  const tall = await sharp({
    create: { width: 800, height: 1600, channels: 3, background: { r: 100, g: 100, b: 200 } }
  }).jpeg().toBuffer();
  const r3 = await cropForHero(tall);
  console.log('Tall → 16:9:', r3.croppedWidth, 'x', r3.croppedHeight);

  console.log('All crop tests passed!');
}
test().catch(console.error);
