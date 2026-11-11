import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const htmlPath = path.join(distDir, 'index.html');
const jsPath = path.join(distDir, 'index.js');
const cssPath = path.join(distDir, 'index.css');

if (fs.existsSync(htmlPath) && fs.existsSync(jsPath) && fs.existsSync(cssPath)) {
  const jsContent = fs.readFileSync(jsPath, 'utf-8').replace(/<\/script/gi, '<\\/script');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  const inlinedHtml = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cyber Survivor // Antivirus Protocol</title>
    <style>${cssContent}</style>
  </head>
  <body>
    <canvas id="gameCanvas"></canvas>
    <script type="module">${jsContent}</script>
  </body>
</html>`;

  fs.writeFileSync(htmlPath, inlinedHtml, 'utf-8');
  fs.unlinkSync(jsPath);
  fs.unlinkSync(cssPath);
  console.log('✓ Single-file build generated in dist/index.html');
}
