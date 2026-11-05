import { Game } from './core/Game';

function showError(msg: string) {
  const container = document.body;
  if (!container) return;
  const errDiv = document.createElement('div');
  errDiv.style.position = 'fixed';
  errDiv.style.top = '20px';
  errDiv.style.left = '20px';
  errDiv.style.right = '20px';
  errDiv.style.backgroundColor = 'rgba(255, 0, 50, 0.9)';
  errDiv.style.color = '#fff';
  errDiv.style.fontFamily = 'monospace';
  errDiv.style.padding = '16px';
  errDiv.style.borderRadius = '8px';
  errDiv.style.zIndex = '99999';
  errDiv.style.whiteSpace = 'pre-wrap';
  errDiv.innerText = `[ERROR DE INICIALIZACIÓN]:\n${msg}`;
  container.appendChild(errDiv);
}

window.addEventListener('error', (e) => {
  console.error('Cyber Survivor Error:', e.error || e.message);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Cyber Survivor Promise Error:', e.reason);
});

function initGame(): void {
  try {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
    if (!canvas) {
      throw new Error('Elemento #gameCanvas no encontrado en el DOM.');
    }

    const game = new Game(canvas);
    game.start();
  } catch (err: unknown) {
    console.error('Fatal initialization error:', err);
    showError(err instanceof Error ? err.stack || err.message : String(err));
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}

