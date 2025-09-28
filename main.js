

import { Worldsmith } from './worldsmith.js';

let game;

async function init() {
  try {
    game = new Worldsmith();
    await game.init();
    game.start();
  } catch (error) {
    console.error('Failed to initialize Worldsmith:', error);
  }
}

// Handle page visibility for performance
document.addEventListener('visibilitychange', () => {
  if (game) {
    if (document.hidden) {
      game.pause();
    } else {
      game.resume();
    }
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

