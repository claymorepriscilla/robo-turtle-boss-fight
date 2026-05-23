/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, RotateCcw, Play, Gamepad2, Award } from 'lucide-react';
import { audio } from './audio';
import { GAME_CONSTANTS, type Player, type Boss, type Laser, type BossFireball, type EnemyBug, type Particle, type FloatingText } from './types';

// Pixel heart arrays (9x8 block representation)
const HEART_PIXELS = [
  [0, 1, 1, 0, 0, 0, 1, 1, 0],
  [1, 1, 1, 1, 0, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0, 0, 0]
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // React state elements for syncing UI with active game ref loop easily
  const [gameState, setGameState] = useState<'START' | 'PLAY' | 'GAMEOVER' | 'VICTORY'>('START');
  const [score, setScore] = useState<number>(1250);
  const [playerHeartCount, setPlayerHeartCount] = useState<number>(3); // starts with 3 of 4 hearts
  const [bossHealthPercent, setBossHealthPercent] = useState<number>(100);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [highScore, setHighScore] = useState<number>(5000);

  // Dense reference mapping keeping all states for 60fps frame calculations perfectly isolated
  const gameRef = useRef<{
    player: Player;
    boss: Boss;
    lasers: Laser[];
    fireballs: BossFireball[];
    bugs: EnemyBug[];
    particles: Particle[];
    floatingTexts: FloatingText[];
    cameraShake: number;
    keys: Record<string, boolean>;
    frameCount: number;
    bossAttackTimer: number;
    qBlockHit: boolean;
    qBlockY: number;
    qBlockBounce: number;
    hasSpawnedMushroom: boolean;
    mushroomActive: boolean;
    mushroomX: number;
    mushroomY: number;
    mushroomVx: number;
  }>({
    player: {
      x: 120,
      y: 350,
      vx: 0,
      vy: 0,
      width: 44,
      height: 64,
      health: 3,
      maxHealth: 4,
      isGrounded: false,
      facing: 'right',
      shootCooldown: 0,
      muzzleFlashTime: 0,
      invulnerableTime: 0,
      score: 1250,
      isDead: false,
      onBridge: false,
      lastWalkSoundTime: 0,
    },
    boss: {
      x: 740,
      y: 220,
      width: 190,
      height: 240,
      health: 120,
      maxHealth: 120,
      state: 'idle',
      stateTimer: 0,
      phase: 1,
      hitFlashTime: 0,
      lastSlamTime: 0,
    },
    lasers: [],
    fireballs: [],
    bugs: [],
    particles: [],
    floatingTexts: [],
    cameraShake: 0,
    keys: {},
    frameCount: 0,
    bossAttackTimer: 180,
    qBlockHit: false,
    qBlockY: 280,
    qBlockBounce: 0,
    hasSpawnedMushroom: false,
    mushroomActive: false,
    mushroomX: 0,
    mushroomY: 0,
    mushroomVx: 0,
  });

  // Sound enablement toggle
  const toggleSound = () => {
    const nextState = audio.toggle();
    setSoundEnabled(nextState);
  };

  // Setup initial flying bugs and level details
  const resetGame = () => {
    const playCtx = gameRef.current;
    playCtx.player = {
      x: 120,
      y: 300,
      vx: 0,
      vy: 0,
      width: 44,
      height: 64,
      health: 3,
      maxHealth: 4,
      isGrounded: false,
      facing: 'right',
      shootCooldown: 0,
      muzzleFlashTime: 0,
      invulnerableTime: 60, // starts flash invulnerable for a sec
      score: 1250,
      isDead: false,
      onBridge: false,
      lastWalkSoundTime: 0,
    };
    playCtx.boss = {
      x: 740,
      y: 210, // Sits exactly on top of ground height level y=450 (boss height is 240, so bottom is at 450)
      width: 190,
      height: 240,
      health: 120,
      maxHealth: 120,
      state: 'idle',
      stateTimer: 0,
      phase: 1,
      hitFlashTime: 0,
      lastSlamTime: 0,
    };
    playCtx.lasers = [];
    playCtx.fireballs = [];
    playCtx.particles = [];
    playCtx.floatingTexts = [];
    playCtx.cameraShake = 0;
    playCtx.frameCount = 0;
    playCtx.bossAttackTimer = 150;
    playCtx.qBlockHit = false;
    playCtx.qBlockY = 280;
    playCtx.qBlockBounce = 0;
    playCtx.hasSpawnedMushroom = false;
    playCtx.mushroomActive = false;

    // Spawn 2 flying green bugs
    playCtx.bugs = [
      { id: 'bug-1', x: 300, y: 150, baseY: 150, vx: -1.5, width: 32, height: 26, health: 1, waveOffset: 0, wingAngle: 0, isDead: false, deathTimer: 0 },
      { id: 'bug-2', x: 550, y: 120, baseY: 120, vx: -1.2, width: 32, height: 26, health: 1, waveOffset: Math.PI, wingAngle: 0, isDead: false, deathTimer: 0 }
    ];

    setScore(1250);
    setPlayerHeartCount(3);
    setBossHealthPercent(100);
    setGameState('PLAY');

    // Trigger synthetic audio
    audio.playPowerup();
  };

  // Sync state helpers
  useEffect(() => {
    // Read local high scores if exist
    const saved = localStorage.getItem('robo_turtle_highscore');
    if (saved) {
      setHighScore(parseInt(saved, 10));
    }
  }, []);

  // Keyboard controls listener setup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // Record keys
      const keys = gameRef.current.keys;
      keys[k] = true;
      if (e.key === ' ') {
        keys['space'] = true;
        e.preventDefault(); // stop browser scrolling on space
      }

      // Quick start if pressed Enter in Start state
      if (gameState === 'START' && e.key === 'Enter') {
        audio.toggle(true);
        setSoundEnabled(true);
        resetGame();
      }
      if ((gameState === 'GAMEOVER' || gameState === 'VICTORY') && k === 'r') {
        resetGame();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const keys = gameRef.current.keys;
      keys[k] = false;
      if (e.key === ' ') {
        keys['space'] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Main high-perf loop containing physical mechanics, vector paths and animations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let localFrame = 0;

    const gameLoop = () => {
      localFrame++;
      const current = gameRef.current;
      current.frameCount = localFrame;

      // Draw and mechanics calculation only allowed in PLAY, but always render the ambient background
      if (gameState === 'PLAY') {
        updatePhysics(current);
      }

      renderCanvas(ctx, current);

      animId = requestAnimationFrame(gameLoop);
    };

    // Helper functions for updating coordinate objects
    const updatePhysics = (g: typeof gameRef.current) => {
      const player = g.player;
      const boss = g.boss;

      // 1. Invulnerability clock decay
      if (player.invulnerableTime > 0) player.invulnerableTime--;
      if (boss.hitFlashTime > 0) boss.hitFlashTime--;

      // 2. Camera shake decay
      if (g.cameraShake > 0) {
        g.cameraShake *= 0.9;
        if (g.cameraShake < 0.2) g.cameraShake = 0;
      }

      // 3. Player horizontal control
      let walkX = 0;
      if (g.keys['a'] || g.keys['arrowleft']) {
        walkX = -GAME_CONSTANTS.WALK_SPEED;
        player.facing = 'left';
      } else if (g.keys['d'] || g.keys['arrowright']) {
        walkX = GAME_CONSTANTS.WALK_SPEED;
        player.facing = 'right';
      }
      player.vx = walkX;

      // Jumping
      if ((g.keys['space'] || g.keys['w'] || g.keys['arrowup']) && player.isGrounded) {
        player.vy = GAME_CONSTANTS.JUMP_FORCE;
        player.isGrounded = false;
        audio.playJump();
        // Spawn jump dust particles
        for (let i = 0; i < 6; i++) {
          g.particles.push({
            id: Math.random().toString(),
            x: player.x + player.width / 2,
            y: player.y + player.height,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 1) * 2,
            width: 4 + Math.random() * 4,
            height: 4 + Math.random() * 4,
            color: 'rgba(255, 255, 255, 0.7)',
            alpha: 1,
            decay: 0.05,
            life: 0,
            maxLife: 20,
            type: 'dust',
          });
        }
      }

      // Apply Gravity
      player.vy += GAME_CONSTANTS.GRAVITY;
      player.x += player.vx;
      player.y += player.vy;

      // Horizontal arena boundaries (including blocking overlap with the boss)
      if (player.x < 0) {
        player.x = 0;
      }
      // Stop the player from intersecting the cybernetic boss boundaries
      if (player.x > boss.x - player.width + 30) {
        player.x = boss.x - player.width + 30;
      }

      // Play walking ambient sound
      if (player.vx !== 0 && player.isGrounded && localFrame % 22 === 0) {
        audio.playWalk();
      }

      // Define static platforms inside the canvas arena
      const groundY = 450; // Sits nicely with dirt line
      player.isGrounded = false;
      player.onBridge = false;

      // Platform check 1: Left Ground (x: 0 -> 280)
      if (player.x + player.width >= 0 && player.x <= 280) {
        if (player.y + player.height >= groundY && player.y + player.height - player.vy <= groundY + 12) {
          player.y = groundY - player.height;
          player.vy = 0;
          player.isGrounded = true;
        }
      }

      // Platform check 2: Wooden foot bridge across the gap (x: 280 -> 440)
      if (player.x + player.width >= 280 && player.x <= 440) {
        // Wooden bridge planks curve slightly, drawing surface height at 450
        if (player.y + player.height >= groundY && player.y + player.height - player.vy <= groundY + 14) {
          player.y = groundY - player.height;
          player.vy = 0;
          player.isGrounded = true;
          player.onBridge = true;
        }
      }

      // Platform check 3: Right Ground (x: 440 -> 960)
      if (player.x + player.width >= 440 && player.x <= 960) {
        if (player.y + player.height >= groundY && player.y + player.height - player.vy <= groundY + 12) {
          player.y = groundY - player.height;
          player.vy = 0;
          player.isGrounded = true;
        }
      }

      // Platform check 4: Giant Pipe (x: 680 to 744, top level at y: 360)
      const pipeLeft = 675;
      const pipeRight = 745;
      const pipeTop = 360;
      if (player.x + player.width >= pipeLeft && player.x <= pipeRight) {
        // Top land
        if (player.y + player.height >= pipeTop && player.y + player.height - player.vy <= pipeTop + 14) {
          player.y = pipeTop - player.height;
          player.vy = 0;
          player.isGrounded = true;
        }
        // Left side bump
        else if (player.x + player.width >= pipeLeft && player.x + player.width - player.vx <= pipeLeft + 6) {
          player.x = pipeLeft - player.width;
        }
      }

      // Platform check 5: Floating retro Bricks & Question Blocks
      const brickY = 280;
      const brickH = 40;
      const solidBlocks = [
        { x: 180, w: 46, id: 'brick1' },
        { x: 226, w: 46, id: 'qblock' },
        { x: 272, w: 46, id: 'brick2' }
      ];

      solidBlocks.forEach(blk => {
        // Horizontal overlap check
        if (player.x + player.width >= blk.x && player.x <= blk.x + blk.w) {
          // Standing on top
          if (player.y + player.height >= brickY && player.y + player.height - player.vy <= brickY + 12) {
            player.y = brickY - player.height;
            player.vy = 0;
            player.isGrounded = true;
          }
          // Striking collision from bottom
          else if (player.y >= brickY + brickH - 10 && player.y + player.vy <= brickY + brickH) {
            player.y = brickY + brickH;
            player.vy = 0.5; // stop upward impulse

            // Trigger yellow ? block punch response
            if (blk.id === 'qblock' && !g.qBlockHit) {
              g.qBlockHit = true;
              g.qBlockBounce = 12; // starts bouncing up animation offset
              audio.playCoin();

              // Update Score
              player.score += 200;
              setScore(player.score);

              // Spawn floating text +200
              g.floatingTexts.push({
                id: Math.random().toString(),
                x: blk.x + 10,
                y: brickY - 10,
                text: '+200',
                color: '#FFDE3B',
                life: 0,
                maxLife: 45,
                vy: -1.2,
              });

              // Trigger spawning red power-up mushroom item
              g.hasSpawnedMushroom = true;
              g.mushroomActive = true;
              g.mushroomX = blk.x + 8;
              g.mushroomY = brickY - 14;
              g.mushroomVx = 1.4; // slides rightwards standard arcade style

              // Generate shiny gold fire coins particle splash
              for (let i = 0; i < 8; i++) {
                g.particles.push({
                  id: Math.random().toString(),
                  x: blk.x + 23,
                  y: brickY,
                  vx: (Math.random() - 0.5) * 5,
                  vy: -1 * (2 + Math.random() * 4),
                  width: 5,
                  height: 5,
                  color: '#FFEA00',
                  alpha: 1,
                  decay: 0.04,
                  life: 0,
                  maxLife: 30,
                  type: 'spark',
                });
              }
            } else {
              // Standard solid brick bumpsound
              audio.playHit();
            }
          }
        }
      });

      // Walk particles spawned at soldier boots
      if (player.vx !== 0 && player.isGrounded && localFrame % 8 === 0) {
        g.particles.push({
          id: Math.random().toString(),
          x: player.x + (player.facing === 'right' ? 8 : player.width - 8),
          y: player.y + player.height - 4,
          vx: -player.vx * 0.3 + (Math.random() - 0.5),
          vy: -Math.random() * 0.8,
          width: 5,
          height: 5,
          color: 'rgba(255,255,255,0.45)',
          alpha: 0.8,
          decay: 0.04,
          life: 0,
          maxLife: 15,
          type: 'dust',
        });
      }

      // Pit Gravity Death / Reset
      if (player.y > GAME_CONSTANTS.GAME_HEIGHT + 35) {
        // Player falls in pit
        damagePlayer(g, 1);
        if (player.health > 0) {
          player.x = 100;
          player.y = 200;
          player.vx = 0;
          player.vy = 0;
          player.invulnerableTime = 120; // 2 seconds flash shielding
          // Float warning text
          g.floatingTexts.push({
            id: Math.random().toString(),
            x: 120,
            y: 260,
            text: 'PIT FALL! -1 HP',
            color: '#FF3B3B',
            life: 0,
            maxLife: 60,
            vy: -0.8
          });
        }
      }

      // 4. Update Red Power-up mushroom sliding physics
      if (g.mushroomActive) {
        g.mushroomY += 2; // gravity fall
        g.mushroomX += g.mushroomVx;

        // Land on top of platforms: Left, bridge and Right
        if (g.mushroomY + 20 >= groundY) {
          g.mushroomY = groundY - 20;
        }

        // Bounce back from obstacles (pipe, borders)
        if (g.mushroomX > pipeLeft - 22 && g.mushroomVx > 0) {
          g.mushroomVx = -g.mushroomVx;
        }
        if (g.mushroomX < 5) {
          g.mushroomX = 5;
          g.mushroomVx = -g.mushroomVx;
        }

        // Slide check floating boxes
        if (g.mushroomY + 20 >= brickY && g.mushroomY <= brickY + 6 && g.mushroomX >= 170 && g.mushroomX <= 320) {
          g.mushroomY = brickY - 20;
        }

        // Collides with player to heal 1 heart!
        if (
          player.x + player.width >= g.mushroomX &&
          player.x <= g.mushroomX + 22 &&
          player.y + player.height >= g.mushroomY &&
          player.y <= g.mushroomY + 20
        ) {
          g.mushroomActive = false;
          audio.playCoin();
          audio.playVictory();

          if (player.health < player.maxHealth) {
            player.health += 1;
            setPlayerHeartCount(player.health);
            g.floatingTexts.push({
              id: Math.random().toString(),
              x: player.x,
              y: player.y - 12,
              text: 'HEALTH RECOVERED!',
              color: '#3BFFAA',
              life: 0,
              maxLife: 60,
              vy: -1,
            });
          } else {
            // max health award bonus score
            player.score += 500;
            setScore(player.score);
            g.floatingTexts.push({
              id: Math.random().toString(),
              x: player.x,
              y: player.y - 12,
              text: 'MAX HEALTH BONUS! +500',
              color: '#FFF23B',
              life: 0,
              maxLife: 60,
              vy: -1,
            });
          }
        }
      }

      // 5. Blinking question block bounce decay
      if (g.qBlockBounce > 0) {
        g.qBlockBounce -= 1;
      }

      // 6. Laser Shooting Controls
      if (player.shootCooldown > 0) player.shootCooldown--;

      if ((g.keys['j'] || g.keys['f'] || g.keys['z']) && player.shootCooldown === 0 && !player.isDead) {
        player.shootCooldown = 12; // shoot interval
        player.muzzleFlashTime = 6; // flash visual frame count

        // Create player laser beam
        const laserX = player.facing === 'right' ? player.x + player.width + 5 : player.x - 30;
        const laserY = player.y + 26;
        const laserVx = player.facing === 'right' ? 14 : -14;

        g.lasers.push({
          id: Math.random().toString(),
          x: laserX,
          y: laserY,
          vx: laserVx,
          vy: 0,
          width: 30,
          height: 6,
          damage: 3,
        });

        audio.playShoot();

        // recoil kick player slightly
        player.x -= player.facing === 'right' ? 1.5 : -1.5;
      }

      // 7. Update Lasers
      g.lasers = g.lasers.filter(las => {
        las.x += las.vx;

        // Bounding box collision with flying bugs
        let bugHit = false;
        g.bugs.forEach(bug => {
          if (!bug.isDead && las.x + las.width >= bug.x && las.x <= bug.x + bug.width && las.y + las.height >= bug.y && las.y <= bug.y + bug.height) {
            bugHit = true;
            bug.health--;
            audio.playHit();

            if (bug.health <= 0) {
              bug.isDead = true;
              bug.deathTimer = 30; // dead splatter frame counter
              player.score += 150;
              setScore(player.score);

              g.floatingTexts.push({
                id: Math.random().toString(),
                x: bug.x,
                y: bug.y,
                text: '+150',
                color: '#44FF44',
                life: 0,
                maxLife: 40,
                vy: -1.2,
              });

              // bug green splat particle burst
              for (let i = 0; i < 15; i++) {
                g.particles.push({
                  id: Math.random().toString(),
                  x: bug.x + bug.width / 2,
                  y: bug.y + bug.height / 2,
                  vx: (Math.random() - 0.5) * 6,
                  vy: (Math.random() - 0.5) * 6,
                  width: 4,
                  height: 4,
                  color: '#4ADE80',
                  alpha: 1,
                  decay: 0.05,
                  life: 0,
                  maxLife: 20,
                  type: 'green-splat',
                });
              }
            }
          }
        });

        if (bugHit) return false;

        // Bounding box collision with Boss Robo-Turtle
        if (las.x + las.width >= boss.x + 30 && las.y + las.height >= boss.y + 20 && las.y <= boss.y + boss.height - 20) {
          // Determine if hit is close to critical glowing eye/reactor core
          const hitEye = las.y > boss.y + 40 && las.y < boss.y + 85 && las.x > boss.x + 10;
          const dmg = hitEye ? 5 : 3;

          boss.health -= dmg;
          boss.hitFlashTime = 8; // flash white

          if (boss.health < 0) boss.health = 0;
          setBossHealthPercent(Math.max(0, Math.round((boss.health / boss.maxHealth) * 100)));

          // floating damage number popping
          g.floatingTexts.push({
            id: Math.random().toString(),
            x: las.x - 20,
            y: las.y - 15,
            text: dmg.toString(),
            color: hitEye ? '#FFFA00' : '#FF2222',
            life: 0,
            maxLife: 35,
            vy: -1.8,
          });

          // spark metal debris burst
          audio.playExplode('light');
          for (let i = 0; i < 8; i++) {
            g.particles.push({
              id: Math.random().toString(),
              x: las.x,
              y: las.y,
              vx: -(3 + Math.random() * 4),
              vy: (Math.random() - 0.5) * 5,
              width: 3 + Math.random() * 3,
              height: 3 + Math.random() * 3,
              color: hitEye ? '#FFE81B' : '#C0C0C0',
              alpha: 1,
              decay: 0.04,
              life: 0,
              maxLife: 25,
              type: 'spark',
            });
          }

          // Trigger victory if boss health reaches 0
          if (boss.health <= 0) {
            handleBossDefeated(g);
          }

          return false; // delete this laser
        }

        // Screen boundary delete
        return las.x >= 0 && las.x <= GAME_CONSTANTS.GAME_WIDTH;
      });

      // 8. Boss Attack State Machine
      g.bossAttackTimer--;
      if (g.bossAttackTimer <= 0 && boss.health > 0) {
        g.bossAttackTimer = 160 + Math.random() * 100; // time until next attack trigger

        // Multi attack selection: Spit fire, Summon bug, Ground shockwave
        const attackRoll = Math.random();

        if (attackRoll < 0.35) {
          // Spits fireball stream
          boss.state = 'windup';
          boss.stateTimer = 40; // wind up duration
        } else if (attackRoll < 0.70) {
          // Giant shockwave stomp
          boss.state = 'slam';
          boss.stateTimer = 50;
        } else {
          // Roar & spawn flying hazard bugs
          boss.state = 'roar';
          boss.stateTimer = 45;
        }
      }

      // Update active Boss states
      if (boss.stateTimer > 0) {
        boss.stateTimer--;

        if (boss.state === 'windup' && boss.stateTimer === 0) {
          // Done winding up, execute Spit fireball pattern
          boss.state = 'shoot';
          boss.stateTimer = 75; // fire duration
          audio.playBossShoot();

          const fireCount = boss.health < 60 ? 4 : 3; // phase 2 shoots faster
          for (let f = 0; f < fireCount; f++) {
            setTimeout(() => {
              if (boss.health <= 0 || gameState !== 'PLAY') return;

              // Spits fire ball coordinate
              const fx = boss.x + 10;
              const fy = boss.y + 70 + (Math.random() - 0.5) * 20;
              const fType = Math.random() < 0.4 ? 'sine' : 'standard';

              g.fireballs.push({
                id: Math.random().toString(),
                x: fx,
                y: fy,
                vx: -5.5 - (Math.random() * 2),
                vy: fType === 'standard' ? (player.y - fy) / 90 : 0, // slight tracking angles on standard fireballs
                radius: 12 + Math.random() * 6,
                type: fType,
                wavePhase: 0,
                waveAmplitude: fType === 'sine' ? 45 + Math.random() * 25 : undefined,
                color: '#FF5E00',
                damage: 1,
              });

              audio.playBossShoot();

              // Flame particles out of jaw
              for (let i = 0; i < 10; i++) {
                g.particles.push({
                  id: Math.random().toString(),
                  x: fx,
                  y: fy,
                  vx: -(2 + Math.random() * 5),
                  vy: (Math.random() - 0.5) * 4,
                  width: 8,
                  height: 8,
                  color: '#FF8800',
                  alpha: 1,
                  decay: 0.05,
                  life: 0,
                  maxLife: 20,
                  type: 'fire',
                });
              }
            }, f * 320);
          }
        } else if (boss.state === 'shoot' && boss.stateTimer === 0) {
          boss.state = 'idle';
        }

        // Mechanical Slams
        else if (boss.state === 'slam' && boss.stateTimer === 18) {
          // The moment the boss foot hits the ground: trigger quake, screen shake and shockwave column!
          g.cameraShake = 22;
          audio.playExplode('heavy');

          // Generate ground shockwave travelling leftward
          // Fireballs with high-density flame particles
          for (let i = 0; i < 4; i++) {
            g.fireballs.push({
              id: Math.random().toString(),
              x: boss.x - (i * 90) - 20,
              y: groundY - 20,
              vx: -7.5,
              vy: 0,
              radius: 16,
              type: 'standard',
              color: '#FF2E2E',
              damage: 1,
            });
          }

          // Dirt/Debris rocks popping at stomping foot
          for (let i = 0; i < 18; i++) {
            g.particles.push({
              id: Math.random().toString(),
              x: boss.x + 30,
              y: groundY - 10,
              vx: -(2 + Math.random() * 6),
              vy: -(5 + Math.random() * 8),
              width: 8 + Math.random() * 8,
              height: 8 + Math.random() * 8,
              color: '#6B4A3A', // dirt-brown
              alpha: 1,
              decay: 0.03,
              life: 0,
              maxLife: 40,
              type: 'debris',
              gravity: true
            });
          }
        } else if (boss.state === 'slam' && boss.stateTimer === 0) {
          boss.state = 'idle';
        }

        // Mechanical Roar - Spawns environmental bugs and shield sparks
        else if (boss.state === 'roar' && boss.stateTimer === 25) {
          g.cameraShake = 12;
          audio.playExplode('light');

          // Summon 1 or 2 bugs
          if (g.bugs.filter(b => !b.isDead).length < 4) {
            const bx = GAME_CONSTANTS.GAME_WIDTH - 40;
            const by = 80 + Math.random() * 120;
            g.bugs.push({
              id: Math.random().toString(),
              x: bx,
              y: by,
              baseY: by,
              vx: -1.8 - Math.random() * 1.5,
              width: 32,
              height: 26,
              health: 1,
              waveOffset: Math.random() * Math.PI,
              wingAngle: 0,
              isDead: false,
              deathTimer: 0,
            });
            // Float alert text
            g.floatingTexts.push({
              id: Math.random().toString(),
              x: boss.x - 50,
              y: boss.y - 20,
              text: 'ALERT: BUG REINFORCEMENT!',
              color: '#FF4444',
              life: 0,
              maxLife: 50,
              vy: -1,
            });
          }
        } else if (boss.state === 'roar' && boss.stateTimer === 0) {
          boss.state = 'idle';
        }
      }

      // 9. Update Fireballs
      g.fireballs = g.fireballs.filter(fb => {
        fb.x += fb.vx;

        if (fb.type === 'sine' && fb.wavePhase !== undefined && fb.waveAmplitude !== undefined) {
          fb.wavePhase += 0.09;
          fb.y = (boss.y + 70) + Math.sin(fb.wavePhase) * fb.waveAmplitude;
        } else {
          fb.y += fb.vy;
        }

        // Spawn fire smoke tail trail particles
        if (localFrame % 3 === 0) {
          g.particles.push({
            id: Math.random().toString(),
            x: fb.x,
            y: fb.y,
            vx: 0.5,
            vy: -0.5,
            width: 6,
            height: 6,
            color: fb.color === '#FF2E2E' ? '#FF5E1E' : '#FFAE44',
            alpha: 0.8,
            decay: 0.05,
            life: 0,
            maxLife: 15,
            type: 'fire',
          });
        }

        // Collision with player
        if (!player.isDead && player.invulnerableTime === 0) {
          const px = player.x + player.width / 2;
          const py = player.y + player.height / 2;
          const dist = Math.hypot(fb.x - px, fb.y - py);

          if (dist < fb.radius + player.width * 0.4) {
            damagePlayer(g, fb.damage);
            return false; // remove fireball
          }
        }

        // Bound removal
        return fb.x >= -60 && fb.x <= GAME_CONSTANTS.GAME_WIDTH + 60;
      });

      // 10. Update Flying bug hazard bots
      g.bugs.forEach(bug => {
        if (bug.isDead) {
          if (bug.deathTimer > 0) bug.deathTimer--;
          return;
        }

        bug.x += bug.vx;
        bug.waveOffset += 0.05;
        bug.y = bug.baseY + Math.sin(bug.waveOffset) * 45; // wide altitude wave curve
        bug.wingAngle += 0.4; // rapid wings oscillation

        // Recycle flybug past left screen
        if (bug.x + bug.width < -10) {
          bug.x = GAME_CONSTANTS.GAME_WIDTH + 10;
          bug.baseY = 60 + Math.random() * 200;
        }

        // Collide with player
        if (!player.isDead && player.invulnerableTime === 0) {
          // Bounding rect overlap
          if (
            player.x + player.width >= bug.x + 4 &&
            player.x <= bug.x + bug.width - 4 &&
            player.y + player.height >= bug.y + 4 &&
            player.y <= bug.y + bug.height - 4
          ) {
            damagePlayer(g, 1);
          }
        }
      });

      // Cleanup dead bugs
      g.bugs = g.bugs.filter(b => !b.isDead || b.deathTimer > 0);

      // 11. Update active Particles
      g.particles = g.particles.filter(p => {
        if (p.gravity) {
          p.vy += 0.25; // gravity pulls rocks down
        }
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        p.life++;

        return p.alpha > 0 && p.life < p.maxLife;
      });

      // 12. Update Floating Texts
      g.floatingTexts = g.floatingTexts.filter(txt => {
        txt.y += txt.vy;
        txt.life++;
        return txt.life < txt.maxLife;
      });
    };

    const damagePlayer = (g: typeof gameRef.current, amt: number) => {
      const player = g.player;
      if (player.isDead || player.invulnerableTime > 0) return;

      player.health -= amt;
      player.invulnerableTime = 80; // flash invulnerability
      setPlayerHeartCount(Math.max(0, player.health));

      audio.playHit();
      g.cameraShake = 16;

      // Spawn bright blood/impact red pixels
      for (let i = 0; i < 14; i++) {
        g.particles.push({
          id: Math.random().toString(),
          x: player.x + player.width / 2,
          y: player.y + player.height / 2,
          vx: (Math.random() - 0.5) * 8,
          vy: -Math.random() * 4 - 1,
          width: 5,
          height: 5,
          color: '#FF2A2A',
          alpha: 1,
          decay: 0.04,
          life: 0,
          maxLife: 25,
          type: 'blood',
        });
      }

      if (player.health <= 0) {
        player.health = 0;
        player.isDead = true;
        setGameState('GAMEOVER');
        audio.playDefeat();
      }
    };

    const handleBossDefeated = (g: typeof gameRef.current) => {
      setGameState('VICTORY');
      audio.playVictory();

      // update local storage high score if current score is larger
      const player = g.player;
      player.score += 2500; // completion mega bonus
      setScore(player.score);

      // check personal high score achievement
      const historicalScore = localStorage.getItem('robo_turtle_highscore');
      const prev = historicalScore ? parseInt(historicalScore, 10) : 5000;
      if (player.score > prev) {
        localStorage.setItem('robo_turtle_highscore', player.score.toString());
        setHighScore(player.score);
      }

      // Generate spectacular cascading firework particle bursts!
      for (let burst = 0; f; burst++) {
        if (burst > 5) break;
        setTimeout(() => {
          if (canvasRef.current) {
            audio.playExplode('heavy');
            for (let i = 0; i < 40; i++) {
              const theta = (i / 40) * Math.PI * 2;
              const spd = 2 + Math.random() * 5;
              g.particles.push({
                id: Math.random().toString(),
                x: 740 + Math.random() * 100,
                y: 150 + Math.random() * 150,
                vx: Math.cos(theta) * spd,
                vy: Math.sin(theta) * spd,
                width: 6,
                height: 6,
                color: `hsl(${Math.random() * 360}, 100%, 60%)`,
                alpha: 1,
                decay: 0.03,
                life: 0,
                maxLife: 50,
                type: 'spark',
              });
            }
          }
        }, burst * 350);
      }
    };

    // Begin looping canvas
    gameLoop();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [gameState]);

  // Handle Boss Defeated looping flag shortcut check
  const f = true;

  // Render pixels dynamically to look 16-bit
  const renderCanvas = (ctx: CanvasRenderingContext2D, g: typeof gameRef.current) => {
    const W = GAME_CONSTANTS.GAME_WIDTH;
    const H = GAME_CONSTANTS.GAME_HEIGHT;

    ctx.save();

    // 1. Camera Shake screen rendering offset
    if (g.cameraShake > 0) {
      const shakeX = (Math.random() - 0.5) * g.cameraShake;
      const shakeY = (Math.random() - 0.5) * g.cameraShake;
      ctx.translate(shakeX, shakeY);
    }

    // 2. Bright Blue Sky with glowing sun gradient background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#00A2E8');
    skyGrad.addColorStop(0.3, '#3FA9F5');
    skyGrad.addColorStop(0.7, '#8CDEF6');
    skyGrad.addColorStop(1, '#BFF3F9');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // 3. Glowing retro Sun in the sky
    const animOffset = Math.sin(g.frameCount * 0.02) * 5;
    const sunRadius = 45 + animOffset;
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255, 225, 0, 0.4)';
    ctx.arc(420, 100, sunRadius + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = '#FFEE44';
    ctx.arc(420, 100, sunRadius, 0, Math.PI * 2);
    ctx.fill();

    // 4. Parallax Scrolling Cartoon Clouds
    const cloudTimer = g.frameCount * 0.12;
    const cloudCoords = [
      { x: (140 - cloudTimer) % (W + 160), y: 50, s: 0.7 },
      { x: (430 - cloudTimer) % (W + 160), y: 75, s: 1.1 },
      { x: (780 - cloudTimer) % (W + 160), y: 40, s: 0.8 },
      { x: (1080 - cloudTimer) % (W + 160), y: 65, s: 0.9 }
    ];

    cloudCoords.forEach(c => {
      let cx = c.x;
      if (cx < -160) cx += (W + 220); // wrap
      draw16BitCloud(ctx, cx, c.y, c.s);
    });

    // 5. Parallax Snow-capped Mountains
    const mtX1 = -(g.frameCount * 0.08) % 360;
    const mtX2 = -(g.frameCount * 0.16) % 360;

    // Distant Far Mountains
    for (let i = 0; i < 4; i++) {
      const mx = mtX1 + i * 320 - 40;
      drawMountain(ctx, mx, 350, 160, 230, '#586A8D', '#D0DCF2');
    }

    // Stadium Grandstandpixelated crowd cheering!
    ctx.fillStyle = '#2C3A4E';
    ctx.fillRect(0, 310, W, 140);
    // Bleachers steps
    ctx.strokeStyle = '#4A5B70';
    ctx.lineWidth = 3;
    for (let r = 0; r < 4; r++) {
      ctx.beginPath();
      ctx.moveTo(0, 310 + r * 20);
      ctx.lineTo(W, 310 + r * 20);
      ctx.stroke();
    }
    // pixelated colorful cheering spectators
    ctx.fillStyle = '#EBE9EE';
    for (let row = 0; row < 4; row++) {
      const ry = 300 + row * 20;
      const bounce = (Math.sin(g.frameCount * 0.18 + row) > 0) ? -2 : 0;
      for (let cx = 10; cx < W; cx += 22) {
        // change pixelated color depending on column/index
        const noiseCol = (cx + row) % 5;
        if (noiseCol === 0) ctx.fillStyle = '#FF5E00';
        else if (noiseCol === 1) ctx.fillStyle = '#FFEB00';
        else if (noiseCol === 2) ctx.fillStyle = '#00B7FF';
        else if (noiseCol === 3) ctx.fillStyle = '#FF00C4';
        else ctx.fillStyle = '#24E100';

        // draw small 16-bit cheer stick figures
        ctx.fillRect(cx, ry + bounce, 5, 8); // head-chest
        ctx.fillRect(cx - 2, ry + 2 + bounce, 9, 3); // shoulders
      }
    }

    // Mid Parallax forest evergreen pine trees
    for (let i = 0; i < 11; i++) {
      const px = (mtX2 + i * 110) % (W + 80) - 40;
      drawPineTree(ctx, px, 450, 48 + (i % 3) * 12);
    }

    // Foreground Grass / Ground lines
    const groundY = 450;

    // A. Left Ground (x: 0 -> 280)
    drawDirtGround(ctx, 0, 280, groundY);

    // B. Draw Wooden Rope Bridge (x: 280 -> 440 bridging the gap)
    drawRopeBridge(ctx, 280, 440, groundY, g.player);

    // C. Right Ground (x: 440 -> W)
    drawDirtGround(ctx, 440, W, groundY);

    // Draw the PIT gap elements
    // Lava glow elements or warning deep dark abyss in the gap
    ctx.fillStyle = '#0F0906';
    ctx.fillRect(280, groundY + 16, 160, H - groundY);
    // Draw rope support posts at borders
    ctx.fillStyle = '#5A4010';
    ctx.fillRect(274, groundY - 14, 8, 16);
    ctx.fillRect(438, groundY - 14, 8, 16);

    // 6. Mario props on soil ground
    // Red Mushroom props
    drawStageMushroom(ctx, 60, groundY - 14);
    drawStageMushroom(ctx, 510, groundY - 14);

    // Floating Brick Blocks
    const brickY = 280;
    // Box 1
    drawRetroBrick(ctx, 180, brickY, 46, 36, false);
    // Box 2 (Yellow blinking question block)
    const isLit = Math.floor(g.frameCount / 14) % 2 === 0;
    const yBncOffset = g.qBlockBounce > 0 ? -g.qBlockBounce : 0;
    drawQuestionBlock(ctx, 226, brickY + yBncOffset, 46, 36, g.qBlockHit, isLit);
    // Box 3
    drawRetroBrick(ctx, 272, brickY, 46, 36, false);

    // 7. Large Mario Green Pipe
    drawGreenPipe(ctx, 675, 360, 70, 90);

    // 8. Sliding Power-up Item Red Mushroom
    if (g.mushroomActive) {
      drawSlidingPowerMushroom(ctx, g.mushroomX, g.mushroomY);
    }

    // 9. Floating Green bug hazard bots
    g.bugs.forEach(bug => {
      if (bug.isDead) {
        // draw slime splatter
        ctx.save();
        ctx.fillStyle = '#4ADE80';
        ctx.fillRect(bug.x, bug.y + 10, 32, 6);
        ctx.fillRect(bug.x + 8, bug.y + 14, 16, 4);
        ctx.restore();
        return;
      }
      drawFlyingBug(ctx, bug);
    });

    // 10. Lasers projectiles
    g.lasers.forEach(las => {
      ctx.fillStyle = '#34D399';
      ctx.fillRect(las.x, las.y, las.width, las.height);
      // hot white internal bar
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(las.x + 2, las.y + 1.5, las.width - 4, las.height - 3);

      // tiny sparkly trailing sparks behind lasers
      ctx.fillStyle = 'rgba(52, 211, 153, 0.4)';
      ctx.fillRect(las.x - 8, las.y - 1, 6, las.height + 2);
    });

    // 11. Boss cybernetic fireballs
    g.fireballs.forEach(fb => {
      ctx.save();
      ctx.translate(fb.x, fb.y);
      const pulseSize = fb.radius + Math.sin(g.frameCount * 0.3) * 3;

      // Outer plasma ring glows
      const grad = ctx.createRadialGradient(0, 0, pulseSize * 0.2, 0, 0, pulseSize);
      grad.addColorStop(0, '#FFFFFF');
      if (fb.color === '#FF2E2E') {
        grad.addColorStop(0.4, '#FF4D4D');
        grad.addColorStop(1, 'rgba(255, 46, 46, 0)');
      } else {
        grad.addColorStop(0.4, '#FFAA00');
        grad.addColorStop(1, 'rgba(255, 110, 0, 0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
      ctx.fill();

      // Draw stylized pixelated sparks in fire cluster
      ctx.fillStyle = '#FFAA00';
      ctx.fillRect(-pulseSize * 0.5, -pulseSize * 0.5, pulseSize, pulseSize);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-pulseSize * 0.2, -pulseSize * 0.2, pulseSize * 0.4, pulseSize * 0.4);

      ctx.restore();
    });

    // 12. Particles (explosions, trails)
    g.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fillRect(p.x, p.y, p.width, p.height);
    });
    ctx.globalAlpha = 1; // restore fallback

    // 13. Draw Main Character: Humeman Soldier
    if (!g.player.isDead) {
      drawHumemanSoldier(ctx, g.player);
    }

    // 14. Draw Main Boss Monster: Cybernetic Robo-Turtle
    if (g.boss.health > 0 || gameState === 'PLAY' || gameState === 'GAMEOVER') {
      drawRoboTurtle(ctx, g.boss, g.frameCount);
    } else {
      // Exploded/Dead Boss smoke pile
      ctx.fillStyle = '#111827';
      ctx.fillRect(g.boss.x + 30, groundY - 20, 160, 20);
      drawDebrisPile(ctx, g.boss.x + 10, groundY);
    }

    // 15. Floating score alerts text
    g.floatingTexts.forEach(txt => {
      ctx.fillStyle = txt.color;
      ctx.font = "11px 'Press Start 2P', monospace";
      ctx.fillText(txt.text, txt.x, txt.y);
    });

    // 16. Draw HUD overlays directly onto the canvas mapping viewport requirements
    drawCanvasHUD(ctx, W, H, g);

    // 17. CRT Scanlines, screen glares & round edge vignette shaders
    applyCRTShaders(ctx, W, H);

    ctx.restore();
  };

  // UI - Render exact requested HUD elements on Canvas directly
  const drawCanvasHUD = (ctx: CanvasRenderingContext2D, W: number, H: number, g: typeof gameRef.current) => {
    ctx.save();
    ctx.font = "12px 'Press Start 2P', monospace";

    // Top-Left: SCORE: 001250 with drop-shadow effect
    const scStr = 'SCORE: ' + g.player.score.toString().padStart(6, '0');
    ctx.fillStyle = '#000000';
    ctx.fillText(scStr, 30 + 1.5, 36 + 1.5);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(scStr, 30, 36);

    ctx.fillStyle = '#000000';
    ctx.fillText('HEALTH:', 30 + 1.5, 56 + 1.5);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('HEALTH:', 30, 56);

    // Draw 4 hearts (starts with 3 filled red, 1 empty grey) using retro square blocks
    const heartsTotal = g.player.maxHealth;
    const heartsActive = g.player.health;

    for (let c = 0; c < heartsTotal; c++) {
      const hx = 120 + c * 24;
      const hy = 42;
      const filled = c < heartsActive;
      drawPixelHeart(ctx, hx, hy, filled);
    }

    // Top-Center: HUMEMAN SOLDIER
    ctx.textAlign = 'center';
    ctx.font = "bold 13px 'Press Start 2P', monospace";
    ctx.fillStyle = '#000000';
    ctx.fillText('HUMEMAN SOLDIER', W / 2 + 2, 36 + 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('HUMEMAN SOLDIER', W / 2, 36);

    // Top-Right: BOSS: ROBO-TURTLE with drop shadow
    ctx.textAlign = 'right';
    ctx.font = "12px 'Press Start 2P', monospace";
    ctx.fillStyle = '#000000';
    ctx.fillText('BOSS: ROBO-TURTLE', W - 30 + 1.5, 36 + 1.5);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('BOSS: ROBO-TURTLE', W - 30, 36);

    // Thick Red Boss health bar container
    const hBarWidth = 260;
    const hBarHeight = 22;
    const hBarX = W - 30 - hBarWidth;
    const hBarY = 44;

    // White health background backdrop
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(hBarX, hBarY, hBarWidth, hBarHeight);

    // Heavy black boundary border frame
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(hBarX + 1.75, hBarY + 1.75, hBarWidth - 3.5, hBarHeight - 3.5);

    // Solid inner health calculation (clamp to 0-1)
    const hpFrac = Math.max(0, Math.min(1, g.boss.health / g.boss.maxHealth));
    const pad = 4;
    const innerW = hBarWidth - (pad * 2);
    const innerH = hBarHeight - (pad * 2);
    const fillWidth = innerW * hpFrac;

    // Fills inner bar with vibrant red
    ctx.fillStyle = '#DC2626'; // Red-600
    if (fillWidth > 0) {
      ctx.fillRect(hBarX + pad, hBarY + pad, fillWidth, innerH);
    }

    // Bottom-Right instruction overlay
    ctx.textAlign = 'right';
    ctx.fillStyle = '#000000';
    ctx.font = "10px 'Press Start 2P', monospace";
    ctx.fillText('MOVE: A/D | JUMP: SPACE | SHOOT: J', W - 30 + 1.5, H - 24 + 1.5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText('MOVE: A/D | JUMP: SPACE | SHOOT: J', W - 30, H - 24);

    ctx.restore();
  };

  // Procedural Pixel Drawing Utilities
  const drawPixelHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, filled: boolean) => {
    ctx.save();
    const size = 18;

    // Draw outer white border frame
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, size, size);

    // Draw heavy black inner border frame
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 2, y + 2, size - 4, size - 4);

    // Draw colored square inner block representing life state
    ctx.fillStyle = filled ? '#DC2626' : '#374151'; // red-600 or dark active-grey
    ctx.fillRect(x + 4, y + 4, size - 8, size - 8);

    ctx.restore();
  };

  const draw16BitCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';

    // Rounded rectangle clusters
    ctx.fillRect(10, 10, 60, 20);
    ctx.fillRect(20, 0, 45, 14);
    ctx.fillRect(5, 15, 80, 16);

    // Add depth shade
    ctx.fillStyle = 'rgba(220, 230, 245, 0.9)';
    ctx.fillRect(10, 24, 65, 7);
    ctx.restore();
  };

  const drawMountain = (ctx: CanvasRenderingContext2D, x: number, y: number, baseW: number, h: number, baseColor: string, snowColor: string) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + baseW / 2, y - h);
    ctx.lineTo(x + baseW, y);
    ctx.closePath();
    ctx.fillStyle = baseColor;
    ctx.fill();

    // Snow peak
    ctx.beginPath();
    ctx.moveTo(x + baseW / 2 - 25, y - h + 50);
    ctx.lineTo(x + baseW / 2, y - h);
    ctx.lineTo(x + baseW / 2 + 25, y - h + 50);
    ctx.lineTo(x + baseW / 2 + 10, y - h + 34);
    ctx.lineTo(x + baseW / 2, y - h + 42);
    ctx.lineTo(x + baseW / 2 - 10, y - h + 34);
    ctx.closePath();
    ctx.fillStyle = snowColor;
    ctx.fill();
    ctx.restore();
  };

  const drawPineTree = (ctx: CanvasRenderingContext2D, x: number, y: number, height: number) => {
    ctx.save();
    const trunkW = 10;
    const trunkH = 16;

    // Brown trunk
    ctx.fillStyle = '#654321'; // brown
    ctx.fillRect(x - trunkW / 2, y - trunkH, trunkW, trunkH);

    // green spikes tiers (evergreen pine)
    ctx.fillStyle = '#135c34';
    ctx.beginPath();
    ctx.moveTo(x - 22, y - trunkH);
    ctx.lineTo(x + 22, y - trunkH);
    ctx.lineTo(x, y - trunkH - height * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1b7a46';
    ctx.beginPath();
    ctx.moveTo(x - 18, y - trunkH - height * 0.28);
    ctx.lineTo(x + 18, y - trunkH - height * 0.28);
    ctx.lineTo(x, y - trunkH - height * 0.72);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#26A25F';
    ctx.beginPath();
    ctx.moveTo(x - 12, y - trunkH - height * 0.55);
    ctx.lineTo(x + 12, y - trunkH - height * 0.55);
    ctx.lineTo(x, y - trunkH - height);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  const drawDirtGround = (ctx: CanvasRenderingContext2D, xStart: number, xEnd: number, y: number) => {
    ctx.save();
    // Green grass cap layer
    ctx.fillStyle = '#34D399'; // bright grass green
    ctx.fillRect(xStart, y, xEnd - xStart, 14);

    // Dirt blocks background base
    ctx.fillStyle = '#78350F'; // brick soil brown
    ctx.fillRect(xStart, y + 14, xEnd - xStart, GAME_CONSTANTS.GAME_HEIGHT - (y + 14));

    // Draw little details like hanging roots (green pixel drops)
    ctx.fillStyle = '#059669';
    for (let x = xStart + 8; x < xEnd; x += 16) {
      ctx.fillRect(x, y + 14, 4, 6);
      ctx.fillRect(x + 4, y + 14, 2, 3);
    }

    // Dirt textured cross lines
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 2.5;
    for (let x = xStart + 16; x < xEnd; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, y + 24);
      ctx.lineTo(x + 10, y + 36);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + 20, y + 54);
      ctx.lineTo(x + 14, y + 66);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawRopeBridge = (ctx: CanvasRenderingContext2D, xStart: number, xEnd: number, y: number, player: Player) => {
    ctx.save();
    ctx.strokeStyle = '#D97706'; // rope orange/yellow brown
    ctx.lineWidth = 3.5;

    // bridge hangs and curves slightly depending on if player is on it
    const plOnBr = player.onBridge;
    const midX = (xStart + xEnd) / 2;
    const deflect = plOnBr ? 14 : 6;

    // Draw main rope curve
    ctx.beginPath();
    ctx.moveTo(xStart, y + 7);
    ctx.quadraticCurveTo(midX, y + 7 + deflect, xEnd, y + 7);
    ctx.stroke();

    // Draw wooden planks hanging across
    ctx.fillStyle = '#F59E0B'; // wood gold planks
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2;

    const plankCount = 6;
    const segmentW = (xEnd - xStart) / plankCount;

    for (let p = 0; p < plankCount; p++) {
      const px = xStart + p * segmentW + 3;
      // calculate y offset using basic quadratic curve formula: y = d * (1 - x^2)
      const relativePercent = (p - plankCount / 2) / (plankCount / 2);
      const py = y + 7 + deflect * (1 - relativePercent * relativePercent);

      ctx.fillRect(px, py, segmentW - 4, 10);
      ctx.strokeRect(px, py, segmentW - 4, 10);
    }
    ctx.restore();
  };

  const drawStageMushroom = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    // Mushroom stem (White)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + 4, y + 6, 8, 8);

    // red cap with white dots
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(x, y, 16, 6);
    ctx.fillRect(x + 2, y - 3, 12, 3);

    // White polka dots
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + 3, y - 1, 2, 2);
    ctx.fillRect(x + 11, y, 2, 2);
    ctx.fillRect(x + 7, y - 2, 2, 2);
    ctx.restore();
  };

  const drawSlidingPowerMushroom = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    // Bigger glowing magical mushroom (powerup heal item)
    ctx.fillStyle = '#FFFFFF'; // stem
    ctx.fillRect(x + 5, y + 10, 12, 10);

    // glowing red hat
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(x, y + 3, 22, 7);
    ctx.fillRect(x + 3, y, 16, 3);

    // glowing eyes inside stem (classic arcade feel)
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 8, y + 12, 2, 4);
    ctx.fillRect(x + 12, y + 12, 2, 4);

    // White polka dots
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + 3, y + 4, 3, 3);
    ctx.fillRect(x + 16, y + 4, 3, 3);
    ctx.fillRect(x + 9, y + 1, 4, 2);
    ctx.restore();
  };

  const drawRetroBrick = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, hitState: boolean) => {
    ctx.save();
    if (hitState) {
      // standard exhausted flat block
      ctx.fillStyle = '#4B5563'; // dark grey
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x, y, w, h);
      return;
    }

    // Brick textured drawing
    ctx.fillStyle = '#D97706'; // bright orange/brown brick
    ctx.fillRect(x, y, w, h);

    // Draw little grout brick layers lines
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 2;

    // Horizontal split lines
    ctx.strokeRect(x, y, w, h);
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
    ctx.stroke();

    // Vertical splits
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y);
    ctx.lineTo(x + w * 0.3, y + h / 2);
    ctx.moveTo(x + w * 0.7, y);
    ctx.lineTo(x + w * 0.7, y + h / 2);

    ctx.moveTo(x + w * 0.15, y + h / 2);
    ctx.lineTo(x + w * 0.15, y + h);
    ctx.moveTo(x + w * 0.5, y + h / 2);
    ctx.lineTo(x + w * 0.5, y + h);
    ctx.moveTo(x + w * 0.85, y + h / 2);
    ctx.lineTo(x + w * 0.85, y + h);
    ctx.stroke();

    // gold highlights on bricks
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(x + 3, y + 2, 10, 4);
    ctx.fillRect(x + w * 0.4, y + 2, 10, 4);
    ctx.restore();
  };

  const drawQuestionBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, isHit: boolean, isLit: boolean) => {
    ctx.save();
    if (isHit) {
      // Flat hit box
      ctx.fillStyle = '#78350F'; // brick exhausted flat brown
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#451A03';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      // tiny screw rivets
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + 3, y + 3, 3, 3);
      ctx.fillRect(x + w - 6, y + 3, 3, 3);
      ctx.fillRect(x + 3, y + h - 6, 3, 3);
      ctx.fillRect(x + w - 6, y + h - 6, 3, 3);
      ctx.restore();
      return;
    }

    // Pulsing gold blink color values
    ctx.fillStyle = isLit ? '#FBBF24' : '#D97706'; // bright yellow-gold or dark gold
    ctx.fillRect(x, y, w, h);

    // Double borders
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, w, h);

    ctx.strokeStyle = isLit ? '#FFF' : '#FBBF24';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

    // Screws at corners
    ctx.fillStyle = '#451A03';
    ctx.fillRect(x + 4, y + 4, 3, 3);
    ctx.fillRect(x + w - 7, y + 4, 3, 3);
    ctx.fillRect(x + 4, y + h - 7, 3, 3);
    ctx.fillRect(x + w - 7, y + h - 7, 3, 3);

    // Huge detailed pixelated '?' glyph in the center
    ctx.fillStyle = '#000000';
    // Drawn blocky question symbol
    const cx = x + w / 2 - 3;
    const cy = y + h / 2 - 10;
    ctx.fillRect(cx - 3, cy, 10, 3); // top
    ctx.fillRect(cx - 3, cy + 3, 3, 3);
    ctx.fillRect(cx + 4, cy + 3, 3, 6);
    ctx.fillRect(cx + 1, cy + 9, 3, 3);
    ctx.fillRect(cx, cy + 12, 3, 3);
    ctx.fillRect(cx, cy + 18, 3, 3); // bottom dot
    ctx.restore();
  };

  const drawGreenPipe = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.save();
    // Main vertical pipe barrel
    const capH = 26;
    ctx.fillStyle = '#047857'; // emerald forest green
    ctx.fillRect(x + 4, y + capH, w - 8, h - capH);

    // Glowing highlight band on barrel
    ctx.fillStyle = '#10B981'; // bright green shine
    ctx.fillRect(x + 10, y + capH, 10, h - capH);
    ctx.fillStyle = '#34D399'; // lighter neon shine
    ctx.fillRect(x + 20, y + capH, 4, h - capH);

    // Dark shadow on barrel right
    ctx.fillStyle = '#065F46'; // dark green
    ctx.fillRect(x + w - 18, y + capH, 10, h - capH);

    // Classic wide Pipe Cap top collar
    ctx.fillStyle = '#047857';
    ctx.fillRect(x, y, w, capH);

    // Highlight and shadows on the collar
    ctx.fillStyle = '#10B981';
    ctx.fillRect(x + 6, y + 2, 12, capH - 4);
    ctx.fillStyle = '#34D399';
    ctx.fillRect(x + 18, y + 2, 4, capH - 4);

    ctx.fillStyle = '#065F46';
    ctx.fillRect(x + w - 14, y + 2, 8, capH - 4);

    // Black framing outlines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, capH);
    ctx.strokeRect(x + 4, y + capH, w - 8, h - capH);

    ctx.restore();
  };

  const drawFlyingBug = (ctx: CanvasRenderingContext2D, bug: EnemyBug) => {
    ctx.save();
    ctx.translate(bug.x, bug.y);

    // Bobbing wing oscillation
    const wingOffset = Math.sin(bug.wingAngle) * 12;

    // Wings (translucent light blue)
    ctx.fillStyle = 'rgba(180, 240, 255, 0.65)';
    ctx.beginPath();
    ctx.ellipse(6, -4 - wingOffset / 3, 14, 6, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(26, -4 - wingOffset / 3, 14, 6, Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();

    // Dark insect wings outer rim
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bug body: emerald toxic green
    ctx.fillStyle = '#10B981';
    ctx.fillRect(6, 4, 20, 16);
    ctx.fillRect(10, 0, 12, 4);

    // Red glowing insect compound eyes
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(4, 3, 3, 5);
    ctx.fillRect(25, 3, 3, 5);

    // Back stingers/feet
    ctx.fillStyle = '#374151';
    ctx.fillRect(12, 20, 2, 4);
    ctx.fillRect(18, 20, 2, 4);

    ctx.restore();
  };

  const drawHumemanSoldier = (ctx: CanvasRenderingContext2D, player: Player) => {
    ctx.save();
    ctx.translate(player.x, player.y);

    // Flip horizontal rendering if facing left
    if (player.facing === 'left') {
      ctx.translate(player.width, 0);
      ctx.scale(-1, 1);
    }

    // Toggle rapid transparency flashing if invulnerable/hit
    if (player.invulnerableTime > 0 && Math.floor(player.invulnerableTime / 4) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    // Walk animation body bobs
    const legSwing = Math.sin(player.vx !== 0 ? gameRef.current.frameCount * 0.24 : 0);

    // A. Hair: blocky spiky brown hair
    ctx.fillStyle = '#452205'; // dark outline hair
    ctx.fillRect(10, 0, 22, 14);
    ctx.fillStyle = '#9C6615'; // bright brown spikes
    ctx.fillRect(12, 1, 18, 11);
    // spiky bangs
    ctx.fillRect(8, 6, 4, 4);
    ctx.fillRect(30, 6, 4, 4);

    // B. Face: beige skin color
    ctx.fillStyle = '#FCD34D'; // warm pixel beige skin
    ctx.fillRect(12, 12, 20, 12);
    // visor eyes
    ctx.fillStyle = '#000000';
    ctx.fillRect(24, 16, 4, 3); // pupil/eye sensor

    // C. Blue metallic armor chestplate
    ctx.fillStyle = '#1E3A8A'; // heavy dark outline blue
    ctx.fillRect(10, 24, 24, 24);
    ctx.fillStyle = '#3B82F6'; // bright blue chestplate
    ctx.fillRect(12, 26, 20, 20);
    // cyber glowing cyan reactor strip
    ctx.fillStyle = '#06B6D4'; // neon cyan
    ctx.fillRect(18, 32, 8, 4);

    // D. Boots: blocky combat brown plates
    const leftLegY = legSwing * 5;
    const rightLegY = -legSwing * 5;

    ctx.fillStyle = '#451A03'; // left boot
    ctx.fillRect(11, 48 + leftLegY, 8, 16);
    ctx.fillStyle = '#F59E0B'; // boot orange highlight
    ctx.fillRect(13, 58 + leftLegY, 6, 6);

    ctx.fillStyle = '#451A03'; // right boot
    ctx.fillRect(25, 48 + rightLegY, 8, 16);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(25, 58 + rightLegY, 6, 6);

    // E. Sci-Fi oversized rifle launcher
    drawSciFiRifle(ctx, player);

    ctx.restore();
    ctx.globalAlpha = 1.0;
  };

  const drawSciFiRifle = (ctx: CanvasRenderingContext2D, player: Player) => {
    // oversized weapon pointing right
    ctx.save();
    // bob slightly when walking
    const wBob = Math.sin(gameRef.current.frameCount * 0.15) * 1.5;
    ctx.translate(22, 28 + wBob);

    // Silver and charcoal grey chassis
    ctx.fillStyle = '#374151'; // dark gun frame
    ctx.fillRect(0, 0, 26, 12);
    ctx.fillStyle = '#9CA3AF'; // metallic silver barrel
    ctx.fillRect(26, 2, 10, 6);

    // Glowing cyan plasma reactor vents
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(6, 4, 12, 3);

    // Heavy butt stock
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(-6, 0, 6, 16);

    // Massive orange-yellow muzzle flare flash when actively firing
    if (player.muzzleFlashTime > 0) {
      ctx.fillStyle = '#FF4500'; // dark red outer flare
      ctx.fillRect(36, -4, 12, 18);
      ctx.fillStyle = '#FFEB3B'; // blazing bright core
      ctx.fillRect(38, -1, 8, 12);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(41, 2, 4, 6);
    }

    ctx.restore();
  };

  const drawRoboTurtle = (ctx: CanvasRenderingContext2D, boss: Boss, frame: number) => {
    ctx.save();
    ctx.translate(boss.x, boss.y);

    // Flashing code representation on hit damage
    if (boss.hitFlashTime > 0 && Math.floor(boss.hitFlashTime / 2) % 2 === 0) {
      // standard canvas source-in or flat styling
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, boss.width, boss.height);
      ctx.restore();
      return;
    }

    // Slow organic idle breathing cycle
    const breathe = Math.sin(frame * 0.05) * 6;
    const isWindup = boss.state === 'windup';
    const isRoar = boss.state === 'roar';
    const isSlam = boss.state === 'slam';

    // A. Giant Green Hex-Patterned Turtle Shell
    // Deep green base
    ctx.fillStyle = '#064E3B'; // dark green background casing
    ctx.fillRect(30, 20 + breathe, 140, 190);

    // hexagon block details
    ctx.fillStyle = '#047857'; // forest green plates
    for (let c = 0; c < 3; c++) {
      for (let r = 0; r < 5; r++) {
        ctx.fillRect(40 + c * 40, 30 + r * 35 + breathe, 28, 25);
      }
    }

    // Grey metal riveted shell rim casing
    ctx.fillStyle = '#4B5563'; // metal steel border
    ctx.fillRect(20, 20 + breathe, 16, 190);
    ctx.fillRect(160, 20 + breathe, 16, 190);

    // Cybernetic Hexagonal shell matrix outlines (gives neon grids look)
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(30, 20 + breathe, 140, 190);

    // B. Grey Heavy Steel Spikes
    ctx.fillStyle = '#6B7280'; // medium steel grey
    // Spike 1 (Top)
    ctx.beginPath();
    ctx.moveTo(10, 45 + breathe);
    ctx.lineTo(26, 35 + breathe);
    ctx.lineTo(26, 55 + breathe);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9CA3AF'; // highlight
    ctx.fillRect(18, 43 + breathe, 8, 4);

    // Spike 2 (Middle)
    ctx.fillStyle = '#6B7280';
    ctx.beginPath();
    ctx.moveTo(10, 105 + breathe);
    ctx.lineTo(26, 95 + breathe);
    ctx.lineTo(26, 115 + breathe);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9CA3AF';
    ctx.fillRect(18, 103 + breathe, 8, 4);

    // Spike 3 (Bottom)
    ctx.fillStyle = '#6B7280';
    ctx.beginPath();
    ctx.moveTo(10, 165 + breathe);
    ctx.lineTo(26, 155 + breathe);
    ctx.lineTo(26, 175 + breathe);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9CA3AF';
    ctx.fillRect(18, 163 + breathe, 8, 4);

    // C. Glowing Cybernetic Chest Reactor Core
    ctx.fillStyle = breathe > 0 ? '#10B981' : '#34D399'; // breathing greens
    ctx.beginPath();
    ctx.arc(80, 120 + breathe, 22, 0, Math.PI * 2);
    ctx.fill();
    // hot cyber core
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(80, 120 + breathe, 10, 0, Math.PI * 2);
    ctx.fill();

    // D. Heavy robo jaw and face head shield (front facing leftward)
    const jawYOffset = isWindup ? 14 : isRoar ? 24 : 0;

    // Metallic head outline plate
    ctx.fillStyle = '#374151'; // steel armor plate
    ctx.fillRect(-22, 40, 52, 60);

    ctx.fillStyle = '#4B5563'; // bright accent plates
    ctx.fillRect(-18, 44, 44, 40);

    // Glowing electronic red monocle / Cyclops eye slit
    ctx.fillStyle = isWindup || isRoar ? '#FF0000' : '#DC2626'; // brilliant alarm red
    ctx.fillRect(-22, 54, 20, 10);
    // laser horizontal glare flares
    ctx.fillStyle = '#FFAAAA';
    ctx.fillRect(-22, 58, 6, 2);

    // Solid Mechanical lower claw base jaw
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(-22, 86 + jawYOffset, 42, 18);
    // Chrome grill teeth rivets
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-18, 86 + jawYOffset, 4, 3);
    ctx.fillRect(-10, 86 + jawYOffset, 4, 3);
    ctx.fillRect(-2,  86 + jawYOffset, 4, 3);

    // E. Left Hydraulic Slam Arm / Claw Claw
    // If in SLAM state, swing armor arm down dynamically!
    const armAngle = isSlam ? (boss.stateTimer < 18 ? 0.8 : -0.6) : 0;
    ctx.save();
    ctx.translate(15, 130);
    ctx.rotate(armAngle);

    // drawing interlocking tube joints and silver claws
    ctx.fillStyle = '#374151';
    ctx.fillRect(-35, -15, 45, 30); // arm
    ctx.fillStyle = '#9CA3AF'; // chrome gauntlets
    ctx.fillRect(-55, -20, 25, 40);

    // sharp clamp mechanical finger pincers
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(-65, -16, 12, 8);
    ctx.fillRect(-65,  8, 12, 8);

    ctx.restore();

    ctx.restore();
  };

  const drawDebrisPile = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    ctx.fillStyle = '#374151';
    ctx.fillRect(x, y - 10, 30, 10);
    ctx.fillRect(x + 12, y - 18, 45, 8);
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(x + 28, y - 24, 20, 6);
    ctx.restore();
  };

  const applyCRTShaders = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    ctx.save();

    // 1. Subtle horizontal scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let y = 0; y < H; y += 3) {
      ctx.fillRect(0, y, W, 1);
    }

    // 2. Diagonal glint reflecting CRT gliders
    const glGrad = ctx.createLinearGradient(0, 0, W, H);
    glGrad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    glGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.015)');
    glGrad.addColorStop(0.37, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glGrad;
    ctx.fillRect(0, 0, W, H);

    // 3. Black curved bezel vignette around margins
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.46, W / 2, H / 2, Math.max(W, H) * 0.72);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(0.7, 'rgba(0, 0, 0, 0.25)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.78)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#050505] p-4 md:p-6 select-none overflow-hidden font-mono text-white">
      
      {/* Outer Retro Wood & Metal Arcade Cabinet Structure Overlay */}
      <div id="arcade-cabinet" className="relative w-full max-w-5xl rounded-none border-8 border-yellow-500 bg-[#0c0c0e] shadow-2xl overflow-hidden flex flex-col ring-12 ring-black">
        
        {/* Glowing Top Marquee Banner - Real-Time Title */}
        <div className="bg-[#050505] p-4 border-b-6 border-black flex justify-between items-center px-6 shadow-inner tracking-wider">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-8 h-8 text-yellow-400 animate-bounce" />
            <h1 className="text-white text-base md:text-lg font-bold uppercase drop-shadow-[2px_2px_0_#000]">
              HUMEMAN V. TURTLE
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-black border-2 border-white/25 px-3 py-1.5 rounded-none">
            <Award className="w-5 h-5 text-yellow-400" />
            <span className="text-white text-[11px] uppercase tracking-widest font-mono">
              HI-SCORE: <span className="text-yellow-400 font-bold">{highScore.toString().padStart(6, '0')}</span>
            </span>
          </div>
        </div>

        {/* Central Display & Game Canvas wrapping CRT bezel */}
        <div className="relative flex justify-center bg-black p-2 md:p-4 border-b-6 border-black">
          
          <div className="relative aspect-[16/9] w-full max-w-4xl bg-black rounded-none overflow-hidden border-4 border-gray-950 shadow-[0_0_40px_rgba(0,0,0,0.85)]">
            
            {/* The Active Drawing Canvas */}
            <canvas
              id="game-canvas"
              ref={canvasRef}
              width={GAME_CONSTANTS.GAME_WIDTH}
              height={GAME_CONSTANTS.GAME_HEIGHT}
              className="w-full h-full object-contain cursor-crosshair image-rendering-pixelated block"
            />

            {/* Immersive UI Retro CRT Filter Scanlines & Vignette Mask */}
            <div className="absolute inset-0 pointer-events-none z-10">
              <div className="w-full h-full bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.4)_100%)]"></div>
              <div className="absolute inset-0 w-full h-full bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%]"></div>
            </div>

            {/* OVERLAY State Screens (START, GAMEOVER, VICTORY) */}
            {gameState === 'START' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xs p-6 text-center animate-fade-in z-20">
                <div className="max-w-md bg-black border-4 border-yellow-500 p-6 md:p-8 rounded-none shadow-[6px_6px_0_rgba(234,179,8,0.3)]">
                  <h2 className="text-yellow-400 text-lg md:text-2xl font-bold uppercase mb-4 animate-pulse leading-normal drop-shadow-[2px_2px_0_#000]">
                    ROBO-TURTLE
                    <br />
                    BOSS FIGHT
                  </h2>
                  <p className="text-gray-300 text-[11px] md:text-xs leading-relaxed mb-6 font-mono text-left bg-gray-950/80 p-4 border-2 border-gray-800 rounded-none">
                    The mechanical dread <strong className="text-green-400">ROBO-TURTLE</strong> has corrupted the forest! 
                    Fight back as <strong className="text-blue-400">HUMEMAN SOLDIER</strong> with your high-density energy laser. Avoid the fire blasts and toxic sub-bugs hovering around the arena.
                  </p>
                  
                  {/* Controls Info Graphic inside start screen */}
                  <div className="grid grid-cols-3 gap-3 mb-6 p-3 bg-gray-950 rounded-none border-2 border-gray-800">
                    <div className="text-center font-mono">
                      <div className="bg-gray-800 text-white text-[10px] px-2 py-1 rounded-none inline-block mb-1 border-2 border-black shadow-[1.5px_1.5px_0_#000]">A / D</div>
                      <div className="text-[9px] text-gray-400 font-bold">MOVE</div>
                    </div>
                    <div className="text-center font-mono">
                      <div className="bg-gray-800 text-white text-[10px] px-2 py-1 rounded-none inline-block mb-1 border-2 border-black shadow-[1.5px_1.5px_0_#000]">SPACE</div>
                      <div className="text-[9px] text-gray-400 font-bold">JUMP</div>
                    </div>
                    <div className="text-center font-mono">
                      <div className="bg-gray-800 text-white text-[10px] px-2 py-1 rounded-none inline-block mb-1 border-2 border-black shadow-[1.5px_1.5px_0_#000]">J</div>
                      <div className="text-[9px] text-gray-400 font-bold">SHOOT</div>
                    </div>
                  </div>
 
                  <button
                    id="btn-play-now"
                    onClick={() => {
                      audio.toggle(true);
                      setSoundEnabled(true);
                      resetGame();
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black py-3.5 px-6 rounded-none font-bold text-xs uppercase cursor-pointer border-4 border-black shadow-[3px_3px_0_#000] hover:shadow-[5px_5px_0_#000] active:translate-y-0.5 active:shadow-none transition-all"
                  >
                    <Play className="w-5 h-5 fill-black" />
                    START MISSION
                  </button>
                  <p className="text-gray-500 text-[9px] mt-3 font-mono">PRESS ENTER IN KEYBOARD AS SHORTCUT</p>
                </div>
              </div>
            )}
 
            {gameState === 'GAMEOVER' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 p-6 text-center z-20">
                <div className="max-w-md bg-black border-4 border-red-600 p-8 rounded-none shadow-[6px_6px_0_rgba(220,38,38,0.3)]">
                  <h2 className="text-red-500 text-xl font-bold uppercase mb-2 drop-shadow-[2px_2px_0_#000]">
                    MISSION FAILED
                  </h2>
                  <p className="text-gray-400 text-[11px] mb-6 font-mono">
                    HUMEMAN SOLDIER WAS SUBDUED BY ROBO-TURTLE.
                  </p>
                  
                  <div className="bg-gray-950 rounded-none p-4 border-2 border-gray-900 mb-6 font-mono text-left">
                    <div className="text-xs text-gray-400 flex justify-between pb-2 border-b border-gray-900">
                      <span>FINAL SCORE:</span>
                      <span className="text-yellow-400 font-bold text-sm">{score}</span>
                    </div>
                    <div className="text-[10px] text-gray-550 pt-2 flex justify-between">
                      <span>HI-SCORE RECORD:</span>
                      <span>{highScore}</span>
                    </div>
                  </div>
 
                  <button
                    id="btn-retry"
                    onClick={resetGame}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white py-3.5 px-6 rounded-none font-bold text-xs uppercase cursor-pointer border-4 border-black shadow-[3px_3px_0_#000] hover:shadow-[5px_5px_0_#000] active:translate-y-0.5 active:shadow-none transition-all"
                  >
                    <RotateCcw className="w-5 h-5" />
                    RETRY FIGHT (R)
                  </button>
                </div>
              </div>
            )}
 
            {gameState === 'VICTORY' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 p-6 text-center z-20">
                <div className="max-w-md bg-black border-4 border-green-500 p-8 rounded-none shadow-[6px_6px_0_rgba(34,197,94,0.3)]">
                  <h2 className="text-green-400 text-xl font-bold uppercase mb-2 animate-bounce drop-shadow-[2px_2px_0_#000]">
                    VICTORY!
                  </h2>
                  <p className="text-gray-300 text-[11px] mb-6 font-mono uppercase tracking-wider">
                    Robo-turtle Threat eliminated. Forest saved.
                  </p>
 
                  <div className="bg-gray-950 rounded-none p-4 border-2 border-gray-900 mb-6 font-mono text-left">
                    <div className="text-xs text-gray-400 flex justify-between pb-2 border-b border-gray-900">
                      <span>FIGHT CORE SCORE:</span>
                      <span className="text-yellow-400 font-bold text-sm">+{score - 2500}</span>
                    </div>
                    <div className="text-xs text-gray-400 flex justify-between py-2 border-b border-gray-900">
                      <span>COMPLETION BONUS:</span>
                      <span className="text-green-400 font-bold">+2500</span>
                    </div>
                    <div className="text-sm text-white flex justify-between pt-2">
                      <span>TOTAL HI-SCORE:</span>
                      <span className="text-yellow-400 font-bold">{score}</span>
                    </div>
                  </div>
 
                  <button
                    id="btn-victory-restart"
                    onClick={resetGame}
                    className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-black py-3.5 px-6 rounded-none font-bold text-xs uppercase cursor-pointer border-4 border-black shadow-[3px_3px_0_#000] hover:shadow-[5px_5px_0_#000] active:translate-y-0.5 active:shadow-none transition-all"
                  >
                    <RotateCcw className="w-5 h-5" />
                    PLAY AGAIN (R)
                  </button>
                </div>
              </div>
            )}
 
          </div>
 
        </div>
 
        {/* Lower Control Board of virtual console */}
        <div id="arcade-controls" className="bg-[#0f0f11] p-4 border-b-4 border-black flex flex-wrap justify-between items-center gap-4 px-6 select-none">
          <div className="flex items-center gap-3">
            <button
              id="btn-toggle-sound"
              onClick={toggleSound}
              className={`p-2 rounded-none border-2 border-black cursor-pointer transition shadow-[1.5px_1.5px_0_#000] active:translate-y-[1px] active:shadow-none ${soundEnabled ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-gray-800 text-gray-400 hover:bg-gray-750'}`}
              title={soundEnabled ? "Mute Game Sound" : "Enable Retro Chiptune Sfx"}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <span className="text-gray-400 text-[10px] uppercase font-mono tracking-widest hidden md:inline">
              SOUND: {soundEnabled ? "ENABLED" : "MUTED (CLICK BUTTON TO UNMUTE)"}
            </span>
          </div>
 
          <div className="flex items-center gap-2 font-mono">
            <span className="text-gray-500 text-[10px] uppercase">
              CONSOLE STATE:
            </span>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-none border-2 border-black font-bold uppercase shadow-[1px_1px_0_#000] ${gameState === 'PLAY' ? 'bg-green-950 text-green-400 border-green-800' : 'bg-yellow-950 text-yellow-500 border-yellow-700'}`}>
              {gameState}
            </span>
          </div>
          
          <button
            id="btn-cabinet-restart"
            onClick={resetGame}
            className="flex items-center gap-1.5 bg-gray-800 text-gray-300 hover:text-white px-3 py-1.5 rounded-none border-2 border-black hover:bg-gray-700 cursor-pointer text-[10px] uppercase font-mono shadow-[1.5px_1.5px_0_#000] active:translate-y-[1px] active:shadow-none"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Fight
          </button>
        </div>
 
        {/* Outer decorative bezel bottom speaker grill */}
        <div className="bg-[#050505] p-3 flex justify-center items-center border-t-2 border-black">
          <div className="w-2/3 h-2 flex justify-between gap-1">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="flex-1 bg-black h-full" />
            ))}
          </div>
        </div>
 
      </div>
 
    </div>
  );
}
