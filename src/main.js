// ============================================================
// main.js — Main Simulation Entry Point
// ============================================================
import { Game } from './core/Game.js';

window.addEventListener('DOMContentLoaded', () => {
  // Expose game instance globally for debugging and UI event bindings
  window.game = new Game();
});