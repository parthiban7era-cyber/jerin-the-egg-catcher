/* ==========================================================================
   🥚 JERIN THE EGG CATCHER — GAME ENGINE
   Complete State Machine, Canvas Engine, Web Audio Synthesizer,
   Photo 2 Character Rendering (Clean Cutout & Mobile Button Alignment),
   Beta Welcome Screen, Physics & Mobile Touch/Keyboard Controls
   ========================================================================== */

(function() {
  'use strict';

  // ==========================================================================
  // 1. SOUND SYNTHESIZER ENGINE (Cluck & Catch Chimes)
  // ==========================================================================
  const SoundEngine = {
    ctx: null,

    init() {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    },

    resumeCtx() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    playHenSound() {
      this.resumeCtx();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.14);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.14);

        // Second cluck burst
        setTimeout(() => {
          if (!this.ctx) return;
          const t2 = this.ctx.currentTime;
          const osc2 = this.ctx.createOscillator();
          const gain2 = this.ctx.createGain();
          osc2.type = 'sawtooth';
          osc2.frequency.setValueAtTime(390, t2);
          osc2.frequency.exponentialRampToValueAtTime(170, t2 + 0.12);
          gain2.gain.setValueAtTime(0.4, t2);
          gain2.gain.exponentialRampToValueAtTime(0.01, t2 + 0.12);
          osc2.connect(gain2);
          gain2.connect(this.ctx.destination);
          osc2.start(t2);
          osc2.stop(t2 + 0.12);
        }, 130);
      } catch(err) {
        console.warn('Audio synth error:', err);
      }
    },

    playEggCatchSound() {
      this.resumeCtx();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';

        osc1.frequency.setValueAtTime(880, now); // A5
        osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.15); // A6

        osc2.frequency.setValueAtTime(1174.66, now); // D6
        osc2.frequency.exponentialRampToValueAtTime(2349.32, now + 0.15);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.22);
        osc2.stop(now + 0.22);
      } catch(err) {
        console.warn('Audio synth error:', err);
      }
    }
  };

  // ==========================================================================
  // 2. CANVAS GAME ENGINE
  // ==========================================================================
  class GameEngine {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');

      this.score = 0;
      this.active = false;
      this.animId = null;

      // Photo 2: Transparent Character Cutout Preload
      this.imgPhoto2 = new Image();
      this.photo2Loaded = false;
      this.imgPhoto2.onload = () => {
        this.photo2Loaded = true;
        this.updateCatcherDimensions();
      };
      this.imgPhoto2.src = 'photo2.png';

      // Character Catcher State
      this.catcher = {
        x: 0,
        y: 0,
        width: 130,
        height: 130,
        speed: 12
      };

      // Game Entities
      this.hens = [];
      this.eggs = [];
      this.particles = [];

      // Spawning
      this.lastSpawnTime = 0;
      this.spawnInterval = 2000;

      // Inputs
      this.keys = { left: false, right: false };

      this.setupInputListeners();
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resizeCanvas(), 200));
    }

    resizeCanvas() {
      if (!this.canvas) return;
      this.width = this.canvas.clientWidth || window.innerWidth;
      this.height = this.canvas.clientHeight || window.innerHeight;
      this.canvas.width = this.width;
      this.canvas.height = this.height;

      this.updateCatcherDimensions();

      // Position character RIGHT ABOVE the left & right touch control buttons on mobile
      const touchControlsBar = document.getElementById('touch-controls');
      let controlsOffset = 80; // Default height of touch buttons area
      if (touchControlsBar && touchControlsBar.offsetHeight > 0) {
        controlsOffset = touchControlsBar.offsetHeight + 18;
      } else if (this.width <= 768) {
        controlsOffset = 82;
      }
      
      this.catcher.y = this.height - controlsOffset - this.catcher.height + 5;

      if (!this.active) {
        this.catcher.x = (this.width - this.catcher.width) / 2;
      }

      this.initHens();
    }

    updateCatcherDimensions() {
      // Maintain exact aspect ratio of Photo 2 without distortion
      let aspect = 1.0;
      if (this.photo2Loaded && this.imgPhoto2.naturalWidth && this.imgPhoto2.naturalHeight) {
        aspect = this.imgPhoto2.naturalHeight / this.imgPhoto2.naturalWidth;
      }
      // Target width tuned for mobile & desktop screens
      const targetWidth = Math.max(95, Math.min(this.width * 0.25, 170));
      this.catcher.width = targetWidth;
      this.catcher.height = targetWidth * aspect;
      this.catcher.speed = Math.max(8, this.width * 0.024);
    }

    initHens() {
      this.hens = [];
      const henCount = this.width < 450 ? 3 : 4;
      const spacing = this.width / henCount;
      for (let i = 0; i < henCount; i++) {
        this.hens.push({
          x: spacing * i + spacing / 2,
          y: 65,
          bobPhase: Math.random() * Math.PI * 2,
          isLaying: false
        });
      }
    }

    setupInputListeners() {
      // Keyboard Controls (PC)
      window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = true;
      });

      window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = false;
      });

      // Mobile Touch Buttons (◀ LEFT and RIGHT ▶)
      const btnLeft = document.getElementById('btn-touch-left');
      const btnRight = document.getElementById('btn-touch-right');

      const bindTouch = (btn, dir) => {
        if (!btn) return;
        const start = (e) => {
          if (e.cancelable) e.preventDefault();
          this.keys[dir] = true;
          btn.classList.add('active-touch');
        };
        const end = (e) => {
          if (e.cancelable) e.preventDefault();
          this.keys[dir] = false;
          btn.classList.remove('active-touch');
        };
        btn.addEventListener('touchstart', start, { passive: false });
        btn.addEventListener('touchend', end, { passive: false });
        btn.addEventListener('mousedown', start);
        btn.addEventListener('mouseup', end);
        btn.addEventListener('mouseleave', end);
      };

      bindTouch(btnLeft, 'left');
      bindTouch(btnRight, 'right');

      // Touch Drag & Pointer Move anywhere on Canvas
      const handlePointer = (clientX) => {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = clientX - rect.left;
        this.catcher.x = canvasX - this.catcher.width / 2;
        this.catcher.x = Math.max(5, Math.min(this.width - this.catcher.width - 5, this.catcher.x));
      };

      this.canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
          handlePointer(e.touches[0].clientX);
        }
      }, { passive: true });

      this.canvas.addEventListener('mousemove', (e) => {
        if (e.buttons === 1) {
          handlePointer(e.clientX);
        }
      });
    }

    start() {
      this.score = 0;
      this.eggs = [];
      this.particles = [];
      this.active = true;
      this.lastSpawnTime = performance.now();
      this.resizeCanvas();
      this.catcher.x = (this.width - this.catcher.width) / 2;
      this.updateDifficulty();

      SoundEngine.playHenSound();

      if (this.animId) cancelAnimationFrame(this.animId);
      this.loop(performance.now());
    }

    stop() {
      this.active = false;
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
    }

    updateDifficulty() {
      const badge = document.getElementById('difficulty-badge');
      if (this.score <= 5) {
        this.spawnInterval = 1900;
        if (badge) { badge.textContent = 'EASY'; badge.className = 'badge easy'; }
      } else if (this.score <= 15) {
        this.spawnInterval = 1350;
        if (badge) { badge.textContent = 'MEDIUM'; badge.className = 'badge medium'; }
      } else {
        this.spawnInterval = 850;
        if (badge) { badge.textContent = 'HARD'; badge.className = 'badge hard'; }
      }
    }

    spawnEgg() {
      const activeHens = this.score <= 5 ? 2 : (this.score <= 15 ? 3 : this.hens.length);
      const henIndex = Math.floor(Math.random() * activeHens);
      const hen = this.hens[henIndex] || this.hens[0];

      hen.isLaying = true;
      setTimeout(() => hen.isLaying = false, 300);

      const baseSpeed = 3.5 + Math.min(this.score * 0.22, 6.8);
      const speedY = baseSpeed + (Math.random() * 1.5);
      const isGolden = Math.random() < 0.16;

      this.eggs.push({
        x: hen.x,
        y: hen.y + 20,
        radiusX: 13,
        radiusY: 18,
        speedY: speedY,
        rotation: (Math.random() - 0.5) * 0.3,
        isGolden: isGolden
      });
    }

    update(now) {
      // 1. Catcher Movement
      if (this.keys.left) {
        this.catcher.x -= this.catcher.speed;
      }
      if (this.keys.right) {
        this.catcher.x += this.catcher.speed;
      }
      this.catcher.x = Math.max(5, Math.min(this.width - this.catcher.width - 5, this.catcher.x));

      // 2. Spawn Eggs
      if (now - this.lastSpawnTime > this.spawnInterval) {
        this.spawnEgg();
        this.lastSpawnTime = now;
      }

      // 3. Update Eggs & Collision Detection
      for (let i = this.eggs.length - 1; i >= 0; i--) {
        const egg = this.eggs[i];
        egg.y += egg.speedY;

        // Collision Zone for Photo 2 character (Jerin mouth/head region right above buttons)
        const catchBoxTop = this.catcher.y - 6;
        const catchBoxBottom = this.catcher.y + this.catcher.height * 0.55;
        const catchBoxLeft = this.catcher.x - 6;
        const catchBoxRight = this.catcher.x + this.catcher.width + 6;

        if (
          egg.y + egg.radiusY >= catchBoxTop &&
          egg.y - egg.radiusY <= catchBoxBottom &&
          egg.x >= catchBoxLeft &&
          egg.x <= catchBoxRight
        ) {
          // EGG CAUGHT!
          this.score += egg.isGolden ? 2 : 1;
          document.getElementById('score-val').textContent = this.score;
          this.updateDifficulty();

          SoundEngine.playEggCatchSound();
          this.spawnSparkles(egg.x, egg.y, egg.isGolden);

          this.eggs.splice(i, 1);
          continue;
        }

        // Missed Egg (Hits Ground Level right above/at touch bar line)
        const missLine = this.catcher.y + this.catcher.height + 8;
        if (egg.y + egg.radiusY >= missLine) {
          this.stop();
          if (window.AppManager) {
            window.AppManager.onEggMissed(this.score);
          }
          return;
        }
      }

      // 4. Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.025;
        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
        }
      }

      // Hen Idle Animation
      this.hens.forEach(hen => {
        hen.bobPhase += 0.06;
      });
    }

    spawnSparkles(x, y, isGolden) {
      const count = isGolden ? 16 : 10;
      const color = isGolden ? '#ffd700' : '#ffffff';

      this.particles.push({
        x: x,
        y: y - 10,
        vx: 0,
        vy: -2,
        alpha: 1.0,
        text: isGolden ? '+2 GOLDEN!' : '+1 CAUGHT!',
        color: isGolden ? '#ffd700' : '#70e000'
      });

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 5,
          color: color,
          alpha: 1.0
        });
      }
    }

    render() {
      // Clear Screen with Farm Sky & Grass
      const skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.height);
      skyGrad.addColorStop(0, '#70d6ff');
      skyGrad.addColorStop(0.5, '#b5e2fa');
      skyGrad.addColorStop(1, '#38b000');
      this.ctx.fillStyle = skyGrad;
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Wooden Beam Top
      this.ctx.fillStyle = '#5c3317';
      this.ctx.fillRect(0, 0, this.width, 35);
      this.ctx.fillStyle = '#8b4513';
      this.ctx.fillRect(0, 35, this.width, 10);

      // Draw Hens
      this.hens.forEach(hen => this.drawHen(hen));

      // Ground Grass Layer
      this.ctx.fillStyle = '#2b9348';
      this.ctx.beginPath();
      this.ctx.ellipse(this.width / 2, this.height + 40, this.width * 0.65, 80, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw Catcher Character (PHOTO 2 - 100% Transparent Cutout floating cleanly)
      this.drawCatcher();

      // Draw Falling Eggs
      this.eggs.forEach(egg => this.drawEgg(egg));

      // Draw Particles
      this.particles.forEach(p => {
        if (p.text) {
          this.ctx.save();
          this.ctx.globalAlpha = p.alpha;
          this.ctx.font = '900 1.25rem Fredoka, sans-serif';
          this.ctx.fillStyle = p.color;
          this.ctx.strokeStyle = '#000';
          this.ctx.lineWidth = 3;
          this.ctx.strokeText(p.text, p.x - 30, p.y);
          this.ctx.fillText(p.text, p.x - 30, p.y);
          this.ctx.restore();
        } else {
          this.ctx.save();
          this.ctx.globalAlpha = p.alpha;
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.restore();
        }
      });
    }

    drawHen(hen) {
      this.ctx.save();
      const bobY = hen.y + Math.sin(hen.bobPhase) * 4;

      // Nest / Hay
      this.ctx.fillStyle = '#f4a261';
      this.ctx.beginPath();
      this.ctx.ellipse(hen.x, bobY + 20, 32, 14, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Feather Body
      this.ctx.fillStyle = hen.isLaying ? '#e71d36' : '#d2691e';
      this.ctx.beginPath();
      this.ctx.ellipse(hen.x, bobY, 26, 20, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Head
      this.ctx.beginPath();
      this.ctx.arc(hen.x, bobY - 16, 14, 0, Math.PI * 2);
      this.ctx.fill();

      // Beak
      this.ctx.fillStyle = '#ffa500';
      this.ctx.beginPath();
      this.ctx.moveTo(hen.x - 4, bobY - 14);
      this.ctx.lineTo(hen.x + 4, bobY - 14);
      this.ctx.lineTo(hen.x, bobY - 6);
      this.ctx.fill();

      // Comb
      this.ctx.fillStyle = '#e71d36';
      this.ctx.beginPath();
      this.ctx.arc(hen.x - 4, bobY - 28, 5, 0, Math.PI * 2);
      this.ctx.arc(hen.x, bobY - 30, 6, 0, Math.PI * 2);
      this.ctx.arc(hen.x + 4, bobY - 28, 5, 0, Math.PI * 2);
      this.ctx.fill();

      // Eyes
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(hen.x - 5, bobY - 18, 4, 0, Math.PI * 2);
      this.ctx.arc(hen.x + 5, bobY - 18, 4, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.arc(hen.x - 5, bobY - 17, 2, 0, Math.PI * 2);
      this.ctx.arc(hen.x + 5, bobY - 17, 2, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    }

    drawCatcher() {
      this.ctx.save();
      this.updateCatcherDimensions();

      if (this.photo2Loaded && this.imgPhoto2.complete && this.imgPhoto2.naturalWidth > 0) {
        // Draw PHOTO 2 transparent cutout image floating cleanly with NO background box/shape
        this.ctx.drawImage(
          this.imgPhoto2,
          this.catcher.x,
          this.catcher.y,
          this.catcher.width,
          this.catcher.height
        );
      }
      this.ctx.restore();
    }

    drawEgg(egg) {
      this.ctx.save();
      this.ctx.translate(egg.x, egg.y);
      this.ctx.rotate(egg.rotation);

      // Egg Shadow
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      this.ctx.beginPath();
      this.ctx.ellipse(2, 4, egg.radiusX, egg.radiusY, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Egg Gradient
      if (egg.isGolden) {
        const goldGrad = this.ctx.createRadialGradient(-3, -5, 2, 0, 0, egg.radiusY);
        goldGrad.addColorStop(0, '#ffffff');
        goldGrad.addColorStop(0.3, '#ffee55');
        goldGrad.addColorStop(1, '#ff9900');
        this.ctx.fillStyle = goldGrad;
      } else {
        const eggGrad = this.ctx.createRadialGradient(-3, -5, 2, 0, 0, egg.radiusY);
        eggGrad.addColorStop(0, '#ffffff');
        eggGrad.addColorStop(0.4, '#fff8dc');
        eggGrad.addColorStop(1, '#f4a261');
        this.ctx.fillStyle = eggGrad;
      }

      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, egg.radiusX, egg.radiusY, 0, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = egg.isGolden ? '#d4af37' : '#d2b48c';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      this.ctx.restore();
    }

    loop(timestamp) {
      if (!this.active) return;
      this.update(timestamp);
      this.render();
      this.animId = requestAnimationFrame((t) => this.loop(t));
    }
  }

  // ==========================================================================
  // 3. MAIN APP MANAGER & STATE MACHINE
  // ==========================================================================
  class AppManager {
    constructor() {
      this.game = new GameEngine();

      this.screenBeta = document.getElementById('beta-screen');
      this.screenHome = document.getElementById('home-screen');
      this.screenVideo1 = document.getElementById('video1-screen');
      this.screenGame = document.getElementById('game-screen');
      this.screenVideo2 = document.getElementById('video2-screen');

      this.overlayStart = document.getElementById('start-overlay');
      this.overlayRetry = document.getElementById('retry-overlay');

      this.videoIntro = document.getElementById('video-intro');
      this.videoGameOver = document.getElementById('video-gameover');

      this.setupEventListeners();
    }

    setupEventListeners() {
      // 0. BETA SCREEN -> Click ENTER GAME -> Go to HOME SCREEN
      document.getElementById('btn-beta-continue').addEventListener('click', () => {
        SoundEngine.resumeCtx();
        this.showScreen(this.screenHome);
      });

      // 1. HOME SCREEN -> Click BEGIN -> Play VIDEO 1
      document.getElementById('btn-begin').addEventListener('click', () => {
        SoundEngine.resumeCtx();
        this.showScreen(this.screenVideo1);
        this.playVideo1();
      });

      // 2. VIDEO 1 -> Skip / Ended -> Show START Overlay
      document.getElementById('btn-skip-video1').addEventListener('click', () => {
        this.videoIntro.pause();
        this.showStartOverlay();
      });

      this.videoIntro.addEventListener('ended', () => {
        this.showStartOverlay();
      });

      document.getElementById('btn-unmute-video1').addEventListener('click', () => {
        this.videoIntro.muted = false;
        this.videoIntro.play();
        document.getElementById('video1-unmute-prompt').classList.add('hidden');
      });

      // 3. START OVERLAY -> Click START -> Start Game & Play Hen Sound
      document.getElementById('btn-start').addEventListener('click', () => {
        this.overlayStart.classList.add('hidden');
        this.showScreen(this.screenGame);
        this.game.start();
      });

      // 4. VIDEO 2 -> Unmute & Ended -> Show RETRY Overlay
      document.getElementById('btn-unmute-video2').addEventListener('click', () => {
        this.videoGameOver.muted = false;
        this.videoGameOver.play();
        document.getElementById('video2-unmute-prompt').classList.add('hidden');
      });

      this.videoGameOver.addEventListener('ended', () => {
        this.showRetryOverlay();
      });

      // 5. RETRY BUTTON -> Click RETRY -> Restart Game directly
      document.getElementById('btn-retry').addEventListener('click', () => {
        this.overlayRetry.classList.add('hidden');
        this.showScreen(this.screenGame);
        this.game.start();
      });
    }

    showScreen(targetScreen) {
      [this.screenBeta, this.screenHome, this.screenVideo1, this.screenGame, this.screenVideo2].forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
      });
      targetScreen.classList.remove('hidden');
      targetScreen.classList.add('active');
    }

    playVideo1() {
      this.videoIntro.currentTime = 0;
      const promise = this.videoIntro.play();
      if (promise !== undefined) {
        promise.catch(() => {
          document.getElementById('video1-unmute-prompt').classList.remove('hidden');
        });
      }
    }

    showStartOverlay() {
      this.overlayStart.classList.remove('hidden');
    }

    onEggMissed(finalScore) {
      document.getElementById('final-score-val').textContent = finalScore;
      this.showScreen(this.screenVideo2);

      this.videoGameOver.currentTime = 0;
      const promise = this.videoGameOver.play();
      if (promise !== undefined) {
        promise.catch(() => {
          document.getElementById('video2-unmute-prompt').classList.remove('hidden');
          setTimeout(() => this.showRetryOverlay(), 3000);
        });
      }
    }

    showRetryOverlay() {
      this.overlayRetry.classList.remove('hidden');
    }
  }

  // Initialize App on DOM Ready
  window.addEventListener('DOMContentLoaded', () => {
    SoundEngine.init();
    window.AppManager = new AppManager();
  });

})();
