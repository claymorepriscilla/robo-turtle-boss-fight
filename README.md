<div align="center">
  <img width="1200" height="475" alt="Robo-Turtle Boss Fight" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
  
  # 🐢 ROBO-TURTLE BOSS FIGHT 🤖
  
  A premium, high-performance 2D retro action-platformer shooter built with React, TypeScript, and HTML5 Canvas.
  
  [Play on AI Studio](https://ai.studio/apps/173bae8a-ec0d-4bbe-86e7-21c15c7053fc) • [Local Setup](#-local-setup) • [Audio Engine](#-web-audio-api-chiptune-engine) • [Boss Mechanics](#-boss-ai-phases--state-machine)
</div>

---

## 🎮 Game Overview

Step into the boots of a cybernetic soldier tasked with defeating the ultimate mechanical menace: the giant **Robo-Turtle**. Traverse a perilous arena featuring floating platforms, a curved footbridge, and hazard pits, all while dodging sine-wave fireballs, flying robotic bugs, and ground-shaking shockwaves. Punch retro question blocks to unlock health power-ups, target the boss's critical reactor eye, and achieve the ultimate high score!

---

## 🛠️ Tech Stack & Features

- **Frontend Core**: [React 19](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/) for highly structured state management and interface coordination.
- **Physics & Render Engine**: Custom HTML5 Canvas rendering loop utilizing `requestAnimationFrame` running at a lock-step 60 FPS for responsive controls and collisions.
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with the **Press Start 2P** Google Font for authentic retro arcade typography.
- **Chiptune Audio**: Purely programmatic 8-bit sound synthesis utilizing the modern **Web Audio API**—no external audio files required!
- **Particle System**: Real-time visual physics engine managing dust, sparks, smoke, fire, mechanical debris, splatters, and floating text.
- **Local Persistence**: Save your high score across play sessions using `localStorage`.

---

## 🔊 Web Audio API Chiptune Engine

One of the most unique aspects of the game is its **RetroAudioEngine** (`src/audio.ts`). Rather than downloading heavy audio formats (`.mp3` or `.wav`), all sound effects are synthesized on-the-fly using browser oscillators, gain envelopes, and audio buffers:

| Sound Effect | Waveform / Method | Synthesis Logic |
| :--- | :--- | :--- |
| **Laser Shoot** | `sawtooth` | Rapid downward frequency sweep ($1200\text{Hz} \rightarrow 100\text{Hz}$) with an exponential gain decay over $0.15$ seconds. |
| **Jump** | `triangle` | Dynamic upward pitch sweep ($200\text{Hz} \rightarrow 800\text{Hz}$) lasting $0.12$ seconds. |
| **Footsteps** | `triangle` | Alternating cadenced frequencies ($90\text{Hz} \leftrightarrow 120\text{Hz}$) with high decay rates. |
| **Damage Recoil** | `sawtooth` | Sharp dual-pitch sweep ($180\text{Hz} \rightarrow 90\text{Hz}$) simulating heavy impact. |
| **Coin Power-up** | `square` + `triangle` | Classic two-tone arpeggio: $B_5$ ($987.77\text{Hz}$) immediately transitioning to $E_6$ ($1318.51\text{Hz}$). |
| **Explosion / Stomp**| White Noise Buffer | Generates raw random float values fed into a low-pass filter with sweeping cutoff frequencies ($400\text{Hz} \rightarrow 80\text{Hz}$) and dynamic envelope dampening. |
| **Victory Fanfare** | `square` | Harmonic ascending scale sweep through a C-Major progression ($C \rightarrow E \rightarrow G \rightarrow C \dots$). |
| **Defeat Dirge** | `sawtooth` | Descending minor chord cadence expressing mechanical failure. |

---

## 🕹️ Controls & Gameplay Mechanics

### Keyboard Layout
- **Move Left**: `A` or `Left Arrow`
- **Move Right**: `D` or `Right Arrow`
- **Jump / Double Jump**: `W`, `Spacebar`, or `Up Arrow`
- **Fire Laser Blaster**: `J`, `F`, or `Z`
- **Restart Game**: `R` (on Game Over / Victory screen)
- **Select / Fast Start**: `Enter` (on Start screen)

### Mobile Touch Layout
- **Move Left / Right**: Virtual `◀` and `▶` arrow buttons.
- **Jump**: Virtual `🦘 JUMP` button.
- **Fire Blaster**: Virtual `🔥 SHOOT` button.
- **Panel Visibility**: Toggle display using the **Touch Controls: ON/OFF (🎮)** button located in the lower cabinet control panel.
- **Auto-Detection**: The touch panel automatically opens when a touch device or screen width under `1024px` is detected.

### Core Physics & Mechanics
- **Weapon Recoil & Fire Rate**: Firing your blaster kicks you backward slightly and triggers a muzzle flash. The blaster has a short 12-frame cooldown.
- **Critical Hits**: Landing a shot directly on the Robo-Turtle’s **reactor core / glowing eye** (the front face region) deals **5 damage (Critical Yellow)** instead of the standard **3 damage (Standard Red)**.
- **The Question Block**: Striking the yellow blinking question block from below bounces the block, awards **+200 score**, and releases a **slither-slide Red Mushroom**:
  - The mushroom slides forward, drops with gravity, and bounces off boundaries/obstacles (classic arcade style).
  - Collecting the mushroom **heals 1 heart**.
  - If you are already at full health, collecting it awards a **+500 Max Health Bonus**!
- **Hazard Pits**: Falling into the pit drains **1 HP** and triggers an invulnerability shield, respawning you safely at the start.

---

## 🐢 Boss AI Phases & State Machine

The giant cybernetic Robo-Turtle operates using a sophisticated AI behavior tree and health-based phase transitions:

### Attack States
1. **Idle**: Ambient breathing state.
2. **Spit Fire (`windup` $\rightarrow$ `shoot`)**: Turns bright orange/red, opening its jaws to spit a sequence of fireballs:
   - **Standard Fireballs**: Move straight with slight directional tracking towards the player.
   - **Sine-wave Fireballs**: Travel in beautiful, high-amplitude sinusoidal waves, making them tricky to jump over!
3. **Mechanical Slam (`slam`)**: Rears back and stomps its cybernetic foot, triggering a high-intensity **Camera Shake (22 intensity)**, a screen flash, and **4 consecutive traveling ground shockwaves** moving across the dirt platforms.
4. **Summon Swarm (`roar`)**: Flashes green and lets out a sonic roar to summon flying mechanical drone bugs that swoop down and patrol the upper platform arena.

### AI Boss Phases
- **Phase 1 (100% - 50% HP)**: Standard attack cadence and speeds.
- **Phase 2 (Below 50% HP)**: Reactor core glows dynamically. The boss attacks much faster, fireballs travel with increased velocity, stomp shockwaves move rapidly, and summons are doubled!

---

## 🚀 Local Setup

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**

### Step-by-Step Installation

1. **Clone and Navigate into the Project**:
   ```bash
   cd robo-turtle-boss-fight
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a [.env.local](.env.local) file in the root directory (you can copy [.env.example](.env.example)):
   ```env
   # GEMINI_API_KEY: Required for Gemini AI API calls.
   GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

   # APP_URL: The local dev or hosted server URL
   APP_URL="http://localhost:3000"
   ```

4. **Launch Development Server**:
   ```bash
   npm run dev
   ```
    Open your browser and navigate to `http://localhost:3000` to start playing!

---

## 🌐 Production Deployment (Railway)

This repository is fully containerized and pre-configured for production hosting on platforms like **Railway** using the included `Dockerfile` and Express production web server (`server.js`).

### Deploying to Railway via GitHub

1. Log in to [Railway.app](https://railway.app/).
2. Click **New Project** $\rightarrow$ **Deploy from GitHub repo**.
3. Select your repository `robo-turtle-boss-fight`.
4. Go to the **Variables** tab in your Railway service dashboard and add your environment variables:
   - `GEMINI_API_KEY`: Add your official Gemini API Key.
   - `PORT`: By default, the application runs on port `3000`.
5. Railway will automatically find the `Dockerfile`, build your React/Vite assets, spin up the Express server, and deploy your game!
6. Click **Generate Domain** in the **Settings** tab to access your public URL.

---

<div align="center">
  <h3>👾 Good luck, soldier. Conquer the Robo-Turtle and claim your High Score! 👾</h3>
</div>
