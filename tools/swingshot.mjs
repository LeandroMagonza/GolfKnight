// Capturas de cerca del swing (cámara de depuración), para revisar la pose y el palo en cada fase
// del clip: address, tope e impacto, con cada tipo de swing. Salen en logs/s-<palo>-<fase>.png.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('logs', { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 5197, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('[browser]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5197/');
await page.waitForFunction(() => !document.getElementById('skip').disabled, null, { timeout: 90000 });
await page.click('#skip');
await page.waitForFunction(() => document.getElementById('overlay').hidden);
await page.evaluate(() => { window.__gk.director.timer = 9999; window.__gk.unlockAll(); window.__gk.player.position.set(0, 0, 20); });
const p = await page.evaluate(() => window.__gk.screenOf(0, 50));
await page.mouse.move(p.x, p.y);
await page.waitForTimeout(500);
await page.evaluate(() => { window.__gk.closeup = true; });

for (const [key, club, clip] of [['Digit1', 'driver', 'Golf Drive'], ['Digit2', 'iron', 'Golf Drive'], ['Digit3', 'wedge', 'Golf Chip']]) {
  await page.keyboard.press(key);
  await page.keyboard.down('KeyF');
  for (const phase of ['address', 'top', 'impact']) {
    const info = await page.evaluate(([clip, phase]) => {
      const c = window.__gk.player.swingClips.get(clip);
      if (!c) return null;
      window.__gk.player.debugPoseTime = c[phase];
      return c[phase];
    }, [clip, phase]);
    if (info === null) { console.log(`sin clip ${clip}`); break; }
    await page.waitForTimeout(600);
    await page.screenshot({ path: `logs/s-${club}-${phase}.png` });
  }
  // distancia entre la cabeza del palo y la pelota en la pose de impacto
  console.log(club, 'cabeza-pelota en el impacto (m):', await page.evaluate(() => {
    const g = window.__gk;
    const head = g.player.rig.headWorld(g.player.position.clone());
    const tee = g.player.teePosition(g.player.position.clone());
    return +Math.hypot(head.x - tee.x, head.y - 0.04, head.z - tee.z).toFixed(3);
  }));
  await page.evaluate(() => { window.__gk.player.debugPoseTime = null; });
  await page.keyboard.press('KeyX');
  await page.keyboard.up('KeyF');
  await page.waitForTimeout(300);
}
await browser.close();
await server.close();
console.log('listo');
