import { Game } from './core/Game';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Elemento #gameCanvas no encontrado en el DOM.');
  }

  const game = new Game(canvas);
  game.start();
});
