import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { FormationSelectScene } from './scenes/FormationSelectScene';
import { DraftScene } from './scenes/DraftScene';
import { MainScene } from './scenes/MainScene';


// Took a lot of time for me to understand but here is the flow:

// App() renders, returning the div. Because of useEffect, once that div is real,
// game gets created and the game runs — completely independently from that point on,
// driven entirely by Phaser's own scene lifecycle, with zero further involvement from React.
// game.destroy(true) is dormant the whole time, only called if and when App is ever
// removed from the page — a React-level event, not a gameplay-level one.
export function App() {
  const gameContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gameContainerRef.current) {
      return;
    }

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: gameContainerRef.current,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [FormationSelectScene, DraftScene, MainScene],
    });

    return () => {
      game.destroy(true);
    };
  }, []);

  return <div ref={gameContainerRef} />;
}