import fs from 'node:fs';
import path from 'node:path';

let rawInput = '';
for await (const chunk of process.stdin) {
  rawInput += chunk;
}

let payload = {};
try {
  payload = rawInput ? JSON.parse(rawInput) : {};
} catch {
  payload = {};
}

// Never loop if a Stop hook already triggered continuation in this turn,
// or if the turn ended due to error/cancellation.
if (
  payload.continuationActive ||
  (payload.terminationReason && payload.terminationReason !== 'NO_TOOL_CALL')
) {
  process.stdout.write(JSON.stringify({ decision: 'stop' }));
  process.exit(0);
}

const repoRoot = path.resolve(process.cwd(), '..');
const pkgPath = path.join(repoRoot, 'package.json');
const gamePath = path.join(repoRoot, 'src', 'core', 'Game.ts');
const roadmapPath = path.join(repoRoot, 'ROADMAP.md');

const issues = [];

try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const pkgVersion = pkg.version;
  const expectedTag = `v${pkgVersion}`;

  const gameSrc = fs.readFileSync(gamePath, 'utf-8');
  const match = gameSrc.match(/const\s+GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
  const gameVersion = match ? match[1] : null;

  if (gameVersion !== expectedTag) {
    issues.push(
      `Desincronización de versión: package.json tiene "${pkgVersion}" pero src/core/Game.ts tiene "${gameVersion ?? 'no encontrado'}" (esperado "${expectedTag}").`
    );
  }

  const roadmap = fs.readFileSync(roadmapPath, 'utf-8');
  const hasActual = new RegExp(`\\b${expectedTag.replace(/\./g, '\\.')}\\b.*\\(ACTUAL\\)`).test(roadmap);
  if (!hasActual) {
    issues.push(
      `ROADMAP.md no marca "${expectedTag}" con "(ACTUAL)" en el árbol superior.`
    );
  }
} catch {
  // If any file cannot be read, don't block the agent.
}

if (issues.length > 0) {
  process.stdout.write(
    JSON.stringify({
      decision: 'continue',
      reason: `Antes de terminar, corrige la sincronización de versión del proyecto:\n- ${issues.join('\n- ')}`,
    })
  );
} else {
  process.stdout.write(JSON.stringify({ decision: 'stop' }));
}
