/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Vector2D {
  x: number;
  y: number;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  isGrounded: boolean;
  facing: 'right' | 'left';
  shootCooldown: number;
  muzzleFlashTime: number;
  invulnerableTime: number;
  score: number;
  isDead: boolean;
  onBridge: boolean;
  lastWalkSoundTime: number;
}

export interface Boss {
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  state: 'idle' | 'windup' | 'shoot' | 'roar' | 'slam' | 'hitted';
  stateTimer: number;
  phase: number;
  hitFlashTime: number;
  lastSlamTime: number;
}

export interface Laser {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  damage: number;
}

export interface BossFireball {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'standard' | 'sine' | 'heavy' | 'homing';
  wavePhase?: number;
  waveAmplitude?: number;
  color: string;
  damage: number;
}

export interface EnemyBug {
  id: string;
  x: number;
  y: number;
  baseY: number;
  vx: number;
  width: number;
  height: number;
  health: number;
  waveOffset: number;
  wingAngle: number;
  isDead: boolean;
  deathTimer: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  alpha: number;
  decay: number;
  life: number;
  maxLife: number;
  type: 'dust' | 'spark' | 'smoke' | 'fire' | 'debris' | 'blood' | 'green-splat';
  gravity?: boolean;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
}

export interface GameConfig {
  GAME_WIDTH: number;
  GAME_HEIGHT: number;
  GRAVITY: number;
  WALK_SPEED: number;
  JUMP_FORCE: number;
}

export const GAME_CONSTANTS: GameConfig = {
  GAME_WIDTH: 960,
  GAME_HEIGHT: 540,
  GRAVITY: 0.7,
  WALK_SPEED: 4.8,
  JUMP_FORCE: -13.5,
};
