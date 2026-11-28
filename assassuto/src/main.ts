import './style.css';
import { Game } from './core/Game';

const root = document.getElementById('app')!;
const game = new Game(root);
game.init().catch((err) => {
  console.error(err);
  root.insertAdjacentHTML('beforeend', `<div class="fatal">Failed to start: ${String(err)}</div>`);
});
(window as unknown as { __fourfold: Game }).__fourfold = game;
