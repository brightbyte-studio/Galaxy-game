let gameState = "menu";
let warp = false;
let paused = false;
let score = 0;
let health = 100;
let kills = 0;
let gameTime = 0;

// ---------------- AUDIO ----------------
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playShootSound() {
  const ctx = initAudio();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'square';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
}

function playExplosionSound() {
  const ctx = initAudio();
  if (!ctx) return;
  
  // Noise burst
  const bufferSize = ctx.sampleRate * 0.3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
  }
  
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
  
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  noise.start();
}

function playThrustSound() {
  const ctx = initAudio();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(200, ctx.currentTime);
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
  
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}

// ---------------- THREE SETUP ----------------
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000011, 0.012);

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 1000);
camera.position.z = 15;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000011);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.getElementById("threeContainer").appendChild(renderer.domElement);

// Hide the 2D canvas star background
document.getElementById("stars").style.display = "none";

window.addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ---------------- LIGHTING ----------------
const ambientLight = new THREE.AmbientLight(0x1a1a3a, 0.4);
scene.add(ambientLight);

const sunLight = new THREE.PointLight(0xffeedd, 1.5, 200);
sunLight.position.set(30, 20, 10);
scene.add(sunLight);

const rimLight = new THREE.DirectionalLight(0x4466ff, 0.4);
rimLight.position.set(-20, 0, -10);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0x6644aa, 0.2);
fillLight.position.set(0, -10, 10);
scene.add(fillLight);

// ---------------- NEBULA BACKGROUND ----------------
function createNebula() {
  const nebulaGroup = new THREE.Group();
  
  // Create multiple cloud layers
  for (let i = 0; i < 8; i++) {
    const size = 30 + Math.random() * 40;
    const geo = new THREE.PlaneGeometry(size, size);
    const color = new THREE.Color().setHSL(Math.random() * 0.2 + 0.5, 0.6, 0.15);
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.08 + Math.random() * 0.06,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const cloud = new THREE.Mesh(geo, mat);
    cloud.position.set(
      (Math.random() - 0.5) * 100,
      (Math.random() - 0.5) * 60,
      -80 - Math.random() * 40
    );
    cloud.rotation.z = Math.random() * Math.PI;
    nebulaGroup.add(cloud);
  }
  
  return nebulaGroup;
}

const nebula = createNebula();
scene.add(nebula);

// ---------------- SPACE DUST PARTICLES ----------------
function createSpaceDust() {
  const dustGeo = new THREE.BufferGeometry();
  const dustCount = 500;
  const positions = new Float32Array(dustCount * 3);
  const velocities = [];

  for (let i = 0; i < dustCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 60;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 80 - 20;
    velocities.push({
      x: (Math.random() - 0.5) * 0.02,
      y: (Math.random() - 0.5) * 0.02,
      z: Math.random() * 0.05 + 0.02
    });
  }

  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const dustMat = new THREE.PointsMaterial({
    size: 0.08,
    color: 0xaabbcc,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true
  });

  const dust = new THREE.Points(dustGeo, dustMat);
  dust.userData.velocities = velocities;
  return dust;
}

const spaceDust = createSpaceDust();
scene.add(spaceDust);

// ---------------- ENGINE TRAIL PARTICLES ----------------
const engineParticles = [];
const engineTrailGroup = new THREE.Group();
scene.add(engineTrailGroup);

function createEngineParticle() {
  const size = 0.1 + Math.random() * 0.15;
  const geo = new THREE.SphereGeometry(size, 8, 8);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color().setHSL(0.5 + Math.random() * 0.1, 1, 0.5 + Math.random() * 0.3),
    transparent: true,
    opacity: 0.8
  });
  const particle = new THREE.Mesh(geo, mat);
  
  particle.userData = {
    life: 1.0,
    decay: 0.02 + Math.random() * 0.03,
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.1,
      (Math.random() - 0.5) * 0.1,
      -0.3 - Math.random() * 0.2
    )
  };
  
  return particle;
}

function updateEngineTrail() {
  // Spawn new particles
  if (gameState === "playing" && !paused) {
    for (let i = 0; i < 3; i++) {
      const p = createEngineParticle();
      p.position.copy(shipGroup.position);
      p.position.z += 0.8;
      p.position.x += (Math.random() - 0.5) * 0.2;
      p.position.y += (Math.random() - 0.5) * 0.2;
      engineTrailGroup.add(p);
      engineParticles.push(p);
    }
  }

  // Update existing particles
  for (let i = engineParticles.length - 1; i >= 0; i--) {
    const p = engineParticles[i];
    p.position.add(p.userData.velocity);
    p.userData.life -= p.userData.decay;
    p.material.opacity = p.userData.life * 0.8;
    p.scale.setScalar(p.userData.life);

    if (p.userData.life <= 0) {
      engineTrailGroup.remove(p);
      p.geometry.dispose();
      p.material.dispose();
      engineParticles.splice(i, 1);
    }
  }
}

// ---------------- SCREEN SHAKE ----------------
let screenShake = 0;
let shakeIntensity = 0;

function triggerShake(intensity = 0.5) {
  shakeIntensity = intensity;
  screenShake = 1.0;
}

function updateScreenShake() {
  if (screenShake > 0) {
    const shakeX = (Math.random() - 0.5) * shakeIntensity * 0.3;
    const shakeY = (Math.random() - 0.5) * shakeIntensity * 0.3;
    camera.position.x = 15 + shakeX;
    camera.position.y = shakeY;
    screenShake -= 0.05;
    if (screenShake < 0) {
      screenShake = 0;
      camera.position.x = 15;
      camera.position.y = 0;
    }
  }
}

// ---------------- AMBIENT SPACE SOUND ----------------
let ambientOsc = null;
let ambientGain = null;
let ambientLfo = null;

function startAmbientSound() {
  if (ambientOsc) return;
  
  const ctx = initAudio();
  if (!ctx) return;
  
  ambientOsc = ctx.createOscillator();
  ambientGain = ctx.createGain();
  
  ambientOsc.type = 'sine';
  ambientOsc.frequency.setValueAtTime(55, ctx.currentTime);
  
  // Add subtle modulation
  ambientLfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  ambientLfo.frequency.setValueAtTime(0.15, ctx.currentTime);
  lfoGain.gain.setValueAtTime(8, ctx.currentTime);
  ambientLfo.connect(lfoGain);
  lfoGain.connect(ambientOsc.frequency);
  ambientLfo.start();
  
  ambientGain.gain.setValueAtTime(0.06, ctx.currentTime);
  ambientOsc.connect(ambientGain);
  ambientGain.connect(ctx.destination);
  ambientOsc.start();
}

function stopAmbientSound() {
  if (ambientOsc) {
    ambientOsc.stop();
    ambientOsc = null;
  }
  if (ambientLfo) {
    ambientLfo.stop();
    ambientLfo = null;
  }
  ambientGain = null;
}

// ---------------- 3D STAR FIELD ----------------
function createStarField() {
  const starGeo = new THREE.BufferGeometry();
  const starCount = 2000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 200;
    positions[i3 + 1] = (Math.random() - 0.5) * 200;
    positions[i3 + 2] = (Math.random() - 0.5) * 200 - 50;

    const color = new THREE.Color();
    color.setHSL(Math.random() * 0.2 + 0.5, 0.5, 0.8 + Math.random() * 0.2);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;

    sizes[i] = Math.random() * 2 + 0.5;
  }

  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const starMat = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true
  });

  return new THREE.Points(starGeo, starMat);
}

const starField = createStarField();
scene.add(starField);

// ---------------- PLANETS ----------------
function createPlanet(size, color, x, y, z, hasRing = false, ringColor = 0xffffff) {
  const group = new THREE.Group();

  // Planet body
  const geo = new THREE.SphereGeometry(size, 64, 64);
  const mat = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.8,
    metalness: 0.1
  });
  const planet = new THREE.Mesh(geo, mat);
  group.add(planet);

  // Atmosphere glow
  const atmoGeo = new THREE.SphereGeometry(size * 1.15, 32, 32);
  const atmoMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide
  });
  const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
  group.add(atmosphere);

  // Ring
  if (hasRing) {
    const ringGeo = new THREE.RingGeometry(size * 1.4, size * 2.2, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.5;
    group.add(ring);
  }

  group.position.set(x, y, z);
  scene.add(group);
  return group;
}

// Create realistic planets
const earth = createPlanet(2.5, 0x2e5a88, -8, 0, -15, true, 0xaa8844);
const mars = createPlanet(1.8, 0xc1440e, 10, 2, -20);
const jupiter = createPlanet(4, 0xd4a574, 0, -5, -35, true, 0xccaa88);

// ---------------- ASTEROIDS ----------------
const asteroids = [];
const asteroidGroup = new THREE.Group();
scene.add(asteroidGroup);

function createAsteroid() {
  const size = Math.random() * 0.5 + 0.2;
  const geo = new THREE.DodecahedronGeometry(size, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x555555,
    roughness: 0.9,
    metalness: 0.2
  });
  const asteroid = new THREE.Mesh(geo, mat);

  // Random position in front of camera
  asteroid.position.set(
    (Math.random() - 0.5) * 40,
    (Math.random() - 0.5) * 20,
    -30 - Math.random() * 30
  );

  asteroid.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  );

  asteroid.userData = {
    rotSpeed: {
      x: (Math.random() - 0.5) * 0.02,
      y: (Math.random() - 0.5) * 0.02,
      z: (Math.random() - 0.5) * 0.02
    },
    speed: Math.random() * 0.05 + 0.02
  };

  asteroidGroup.add(asteroid);
  asteroids.push(asteroid);
}

// Spawn initial asteroids
for (let i = 0; i < 30; i++) {
  createAsteroid();
}

// ---------------- ENEMY SHIPS ----------------
const enemies = [];
const enemyGroup = new THREE.Group();
scene.add(enemyGroup);

function createEnemy(type = 'scout') {
  const group = new THREE.Group();
  
  let size, color, health, speed, points;
  
  switch(type) {
    case 'tank':
      size = 0.8;
      color = 0x884400;
      health = 3;
      speed = 0.02;
      points = 50;
      break;
    case 'bomber':
      size = 0.6;
      color = 0x440044;
      health = 1;
      speed = 0.04;
      points = 30;
      break;
    default: // scout
      size = 0.4;
      color = 0xff4444;
      health = 1;
      speed = 0.06;
      points = 20;
  }
  
  // Enemy body
  const body = new THREE.Mesh(
    new THREE.OctahedronGeometry(size, 0),
    new THREE.MeshStandardMaterial({ 
      color: color, 
      roughness: 0.5, 
      metalness: 0.6,
      emissive: color,
      emissiveIntensity: 0.3
    })
  );
  group.add(body);
  
  // Engine glow
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(size * 0.4, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.6 })
  );
  glow.position.z = size;
  group.add(glow);
  
  group.position.set(
    (Math.random() - 0.5) * 30,
    (Math.random() - 0.5) * 15,
    -40 - Math.random() * 20
  );
  
  group.userData = { type, health, speed, points, maxHealth: health };
  enemyGroup.add(group);
  enemies.push(group);
  return group;
}

// Spawn initial enemies (called from start button)
function spawnInitialEnemies() {
  for (let i = 0; i < 5; i++) {
    createEnemy(['scout', 'scout', 'tank', 'bomber'][Math.floor(Math.random() * 4)]);
  }
}

// ---------------- POWER-UPS ----------------
const powerups = [];
const powerupGroup = new THREE.Group();
scene.add(powerupGroup);

const POWERUP_TYPES = {
  shield: { color: 0x00ff88, icon: '🛡️', duration: 10000 },
  rapidfire: { color: 0xff8800, icon: '⚡', duration: 8000 },
  speed: { color: 0x00aaff, icon: '🚀', duration: 8000 },
  triple: { color: 0xff00ff, icon: '🔱', duration: 10000 }
};

let activePowerups = {};

function createPowerup() {
  const types = Object.keys(POWERUP_TYPES);
  const type = types[Math.floor(Math.random() * types.length)];
  const config = POWERUP_TYPES[type];
  
  const geo = new THREE.OctahedronGeometry(0.4, 0);
  const mat = new THREE.MeshBasicMaterial({ 
    color: config.color, 
    transparent: true, 
    opacity: 0.8 
  });
  const powerup = new THREE.Mesh(geo, mat);
  
  // Glow
  const glowGeo = new THREE.SphereGeometry(0.6, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ 
    color: config.color, 
    transparent: true, 
    opacity: 0.3 
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  powerup.add(glow);
  
  powerup.position.set(
    (Math.random() - 0.5) * 25,
    (Math.random() - 0.5) * 12,
    -30 - Math.random() * 20
  );
  
  powerup.userData = { type, config };
  powerupGroup.add(powerup);
  powerups.push(powerup);
}

// Spawn powerups periodically
setInterval(() => {
  if (gameState === "playing" && powerups.length < 3) {
    createPowerup();
  }
}, 8000);

function activatePowerup(type) {
  const config = POWERUP_TYPES[type];
  activePowerups[type] = Date.now() + config.duration;
  
  // Visual feedback
  showPopup(config.icon + ' ' + type.toUpperCase() + '!', '#' + config.color.toString(16));
  
  // Apply effect
  if (type === 'rapidfire') {
    shipGroup.userData.fireRate = 150;
  } else if (type === 'speed') {
    shipGroup.userData.speedBoost = 1.5;
  } else if (type === 'shield') {
    shipGroup.userData.shielded = true;
  } else if (type === 'triple') {
    shipGroup.userData.tripleShot = true;
  }
  
  playPowerupSound();
}

function updatePowerups() {
  const now = Date.now();
  
  for (const type in activePowerups) {
    if (now > activePowerups[type]) {
      // Deactivate
      if (type === 'rapidfire') {
        shipGroup.userData.fireRate = 400;
      } else if (type === 'speed') {
        shipGroup.userData.speedBoost = 1;
      } else if (type === 'shield') {
        shipGroup.userData.shielded = false;
      } else if (type === 'triple') {
        shipGroup.userData.tripleShot = false;
      }
      delete activePowerups[type];
    }
  }
  
  // Update powerup visuals
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.rotation.y += 0.03;
    p.rotation.x += 0.02;
    p.position.z += 0.03;
    
    // Pulse glow
    p.children[0].scale.setScalar(1 + Math.sin(Date.now() * 0.005) * 0.2);
    
    // Check collision with ship
    if (p.position.distanceTo(shipGroup.position) < 1.5) {
      activatePowerup(p.userData.type);
      powerupGroup.remove(p);
      powerups.splice(i, 1);
      continue;
    }
    
    // Remove if past camera
    if (p.position.z > 10) {
      powerupGroup.remove(p);
      powerups.splice(i, 1);
    }
  }
}

function playPowerupSound() {
  const ctx = initAudio();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(523, ctx.currentTime);
  osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
  osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

// ---------------- EXPLOSION PARTICLES ----------------
const explosions = [];

function createExplosion(position, color = 0xff6600, size = 1) {
  const particles = [];
  const count = 20;
  
  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(0.1 * size, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ 
      color: color,
      transparent: true,
      opacity: 1
    });
    const particle = new THREE.Mesh(geo, mat);
    particle.position.copy(position);
    
    particle.userData = {
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.3 * size,
        (Math.random() - 0.5) * 0.3 * size,
        (Math.random() - 0.5) * 0.3 * size
      ),
      life: 1.0,
      decay: 0.02 + Math.random() * 0.02
    };
    
    scene.add(particle);
    particles.push(particle);
  }
  
  explosions.push({ particles, startTime: Date.now() });
}

function updateExplosions() {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const exp = explosions[i];
    let allDead = true;
    
    for (const p of exp.particles) {
      if (p.userData.life > 0) {
        p.position.add(p.userData.velocity);
        p.userData.life -= p.userData.decay;
        p.material.opacity = p.userData.life;
        p.scale.setScalar(p.userData.life);
        allDead = false;
      }
    }
    
    if (allDead) {
      for (const p of exp.particles) {
        scene.remove(p);
        p.geometry.dispose();
        p.material.dispose();
      }
      explosions.splice(i, 1);
    }
  }
}

// ---------------- SCORE POPUPS ----------------
const popups = [];

function showPopup(text, color) {
  const popup = document.createElement('div');
  popup.textContent = text;
  popup.style.cssText = `
    position: fixed;
    left: 50%;
    top: 40%;
    transform: translateX(-50%);
    color: ${color};
    font-size: 24px;
    font-weight: bold;
    text-shadow: 0 0 10px ${color};
    pointer-events: none;
    z-index: 50;
    animation: popupAnim 1s ease-out forwards;
  `;
  document.body.appendChild(popup);
  
  setTimeout(() => popup.remove(), 1000);
}

// Add popup animation
const style = document.createElement('style');
style.textContent = `
  @keyframes popupAnim {
    0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-50px) scale(1.5); }
  }
`;
document.head.appendChild(style);

// ---------------- ROCKET SHIP ----------------
const shipGroup = new THREE.Group();
scene.add(shipGroup);

// Main body - cylindrical rocket
const bodyGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.8, 16);
const bodyMat = new THREE.MeshStandardMaterial({
  color: 0xcccccc,
  roughness: 0.4,
  metalness: 0.7
});
const rocketBody = new THREE.Mesh(bodyGeo, bodyMat);
rocketBody.rotation.x = Math.PI / 2;
shipGroup.add(rocketBody);

// Nose cone
const noseGeo = new THREE.ConeGeometry(0.25, 0.6, 16);
const noseMat = new THREE.MeshStandardMaterial({
  color: 0xff3333,
  roughness: 0.3,
  metalness: 0.5
});
const nose = new THREE.Mesh(noseGeo, noseMat);
nose.rotation.x = -Math.PI / 2;
nose.position.z = -1.2;
shipGroup.add(nose);

// Fins
const finShape = new THREE.Shape();
finShape.moveTo(0, 0);
finShape.lineTo(0.5, 0);
finShape.lineTo(0.2, 0.8);
finShape.lineTo(0, 0.5);

const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.03, bevelEnabled: false });
const finMat = new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.4, metalness: 0.5 });

for (let i = 0; i < 4; i++) {
  const fin = new THREE.Mesh(finGeo, finMat);
  fin.rotation.z = (Math.PI / 2) * i;
  fin.position.z = 0.7;
  shipGroup.add(fin);
}

// Window
const windowGeo = new THREE.CircleGeometry(0.12, 16);
const windowMat = new THREE.MeshBasicMaterial({ color: 0x88ddff });
const rocketWindow = new THREE.Mesh(windowGeo, windowMat);
rocketWindow.position.set(0, 0.2, -0.5);
rocketWindow.rotation.x = -Math.PI / 2;
shipGroup.add(rocketWindow);

// ---------------- ALIEN PILOT ----------------
const alienGroup = new THREE.Group();
shipGroup.add(alienGroup);

// Alien body (green sphere)
const alienBodyGeo = new THREE.SphereGeometry(0.15, 16, 16);
const alienBodyMat = new THREE.MeshStandardMaterial({ 
  color: 0x33ff33, 
  roughness: 0.6, 
  metalness: 0.2 
});
const alienBody = new THREE.Mesh(alienBodyGeo, alienBodyMat);
alienBody.position.set(0, 0.35, -0.3);
alienGroup.add(alienBody);

// Alien head (larger sphere on top)
const alienHeadGeo = new THREE.SphereGeometry(0.12, 16, 16);
const alienHeadMat = new THREE.MeshStandardMaterial({ 
  color: 0x22cc22, 
  roughness: 0.5, 
  metalness: 0.3 
});
const alienHead = new THREE.Mesh(alienHeadGeo, alienHeadMat);
alienHead.position.set(0, 0.55, -0.3);
alienGroup.add(alienHead);

// Alien eyes (two black spheres)
const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
leftEye.position.set(-0.05, 0.58, -0.38);
alienGroup.add(leftEye);

const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
rightEye.position.set(0.05, 0.58, -0.38);
alienGroup.add(rightEye);

// Alien antenna
const antennaGeo = new THREE.CylinderGeometry(0.01, 0.02, 0.15, 8);
const antennaMat = new THREE.MeshStandardMaterial({ color: 0x22cc22 });
const antenna = new THREE.Mesh(antennaGeo, antennaMat);
antenna.position.set(0, 0.72, -0.3);
alienGroup.add(antenna);

// Antenna ball
const antennaBallGeo = new THREE.SphereGeometry(0.03, 8, 8);
const antennaBallMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
const antennaBall = new THREE.Mesh(antennaBallGeo, antennaBallMat);
antennaBall.position.set(0, 0.8, -0.3);
alienGroup.add(antennaBall);

// Alien arms
const armGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8);
const armMat = new THREE.MeshStandardMaterial({ color: 0x33ff33 });

const leftArm = new THREE.Mesh(armGeo, armMat);
leftArm.position.set(-0.18, 0.35, -0.3);
leftArm.rotation.z = Math.PI / 4;
alienGroup.add(leftArm);

const rightArm = new THREE.Mesh(armGeo, armMat);
rightArm.position.set(0.18, 0.35, -0.3);
rightArm.rotation.z = -Math.PI / 4;
alienGroup.add(rightArm);

// Engine nozzle
const nozzleGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.3, 16);
const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
nozzle.rotation.x = Math.PI / 2;
nozzle.position.z = 1.0;
shipGroup.add(nozzle);

// Engine glow
const engineGlow = new THREE.Mesh(
  new THREE.ConeGeometry(0.25, 0.8, 16),
  new THREE.MeshBasicMaterial({ 
    color: 0xff6600, 
    transparent: true, 
    opacity: 0.7 
  })
);
engineGlow.rotation.x = -Math.PI / 2;
engineGlow.position.z = 1.4;
shipGroup.add(engineGlow);

// Inner glow
const innerGlow = new THREE.Mesh(
  new THREE.ConeGeometry(0.15, 0.5, 16),
  new THREE.MeshBasicMaterial({ 
    color: 0xffff00, 
    transparent: true, 
    opacity: 0.9 
  })
);
innerGlow.rotation.x = -Math.PI / 2;
innerGlow.position.z = 1.3;
shipGroup.add(innerGlow);

shipGroup.position.z = 5;

// Ship physics
const shipVelocity = { x: 0, y: 0 };
const shipAcceleration = 0.015;
const shipFriction = 0.98;
const maxSpeed = 0.3;

// ---------------- INPUT ----------------
let keys = {};
let lastThrustTime = 0;

window.addEventListener("keydown", e => {
  keys[e.key] = true;
  if (e.key === " " || e.code === "Space") {
    shoot();
  }
});
window.addEventListener("keyup", e => keys[e.key] = false);

// joystick
let joy = { x: 0, y: 0 };
const joystick = document.getElementById("joystick");
const stick = document.getElementById("stick");

function resetJoystick() {
  joy.x = 0;
  joy.y = 0;
  if (stick) stick.style.transform = "translate(0,0)";
}

if (joystick && stick) {
  // Touch events for mobile
  joystick.addEventListener("touchstart", e => {
    e.preventDefault();
    handleTouch(e.touches[0]);
  }, { passive: false });

  joystick.addEventListener("touchmove", e => {
    e.preventDefault();
    handleTouch(e.touches[0]);
  }, { passive: false });

  joystick.addEventListener("touchend", resetJoystick);
  joystick.addEventListener("touchcancel", resetJoystick);
  
  // Mouse events for laptop (click and drag)
  let isDragging = false;
  
  joystick.addEventListener("mousedown", e => {
    isDragging = true;
    handleMouseTouch(e);
  });
  
  window.addEventListener("mousemove", e => {
    if (isDragging) {
      e.preventDefault();
      handleMouseTouch(e);
    }
  });
  
  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      resetJoystick();
    }
  });
}

function handleMouseTouch(e) {
  const r = joystick.getBoundingClientRect();
  const centerX = r.left + r.width / 2;
  const centerY = r.top + r.height / 2;
  const maxDist = r.width / 2 - 25;

  let dx = e.clientX - centerX;
  let dy = e.clientY - centerY;

  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > maxDist) {
    dx = (dx / dist) * maxDist;
    dy = (dy / dist) * maxDist;
  }

  joy.x = dx / maxDist;
  joy.y = -dy / maxDist;

  stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function handleTouch(touch) {
  const r = joystick.getBoundingClientRect();
  const centerX = r.left + r.width / 2;
  const centerY = r.top + r.height / 2;
  const maxDist = r.width / 2 - 25; // Leave some margin

  let dx = touch.clientX - centerX;
  let dy = touch.clientY - centerY;

  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > maxDist) {
    dx = (dx / dist) * maxDist;
    dy = (dy / dist) * maxDist;
  }

  joy.x = dx / maxDist;
  joy.y = -dy / maxDist;

  // Centered transform with -50%, -50% baseline
  stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

// ---------------- LASERS ----------------
const lasers = [];
let lastShotTime = 0;
const baseFireRate = 400; // ms between shots
shipGroup.userData.fireRate = baseFireRate;
shipGroup.userData.speedBoost = 1;
shipGroup.userData.shielded = false;
shipGroup.userData.tripleShot = false;

function shoot() {
  if (gameState !== "playing" || paused) return;
  
  const now = Date.now();
  if (now - lastShotTime < shipGroup.userData.fireRate) return;
  lastShotTime = now;

  playShootSound();

  // Determine shot pattern
  const offsets = shipGroup.userData.tripleShot 
    ? [{ x: 0, z: 0 }, { x: -0.4, z: -0.3 }, { x: 0.4, z: -0.3 }]
    : [{ x: 0, z: 0 }];

  for (const offset of offsets) {
    // Rock projectile
    const rockGeo = new THREE.DodecahedronGeometry(0.15, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: shipGroup.userData.tripleShot ? 0xff00ff : 0x888888,
      roughness: 0.9,
      metalness: 0.3,
      emissive: shipGroup.userData.tripleShot ? 0x440044 : 0x222222
    });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.copy(shipGroup.position);
    rock.position.z -= 1.2 + offset.z;
    rock.position.x += offset.x;
    
    rock.userData = {
      rotSpeed: {
        x: (Math.random() - 0.5) * 0.3,
        y: (Math.random() - 0.5) * 0.3,
        z: (Math.random() - 0.5) * 0.3
      }
    };

    // Trail glow
    const trailGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const trailMat = new THREE.MeshBasicMaterial({ 
      color: shipGroup.userData.tripleShot ? 0xff00ff : 0xffaa00, 
      transparent: true, 
      opacity: 0.5 
    });
    const trail = new THREE.Mesh(trailGeo, trailMat);
    trail.position.copy(rock.position);

    scene.add(rock);
    scene.add(trail);
    lasers.push({ mesh: rock, glow: trail });
  }
}

// ---------------- BUTTONS ----------------
document.getElementById("shootBtn")?.addEventListener("click", shoot);
document.getElementById("warpBtn")?.addEventListener("click", () => warp = !warp);
document.getElementById("pauseBtn")?.addEventListener("click", () => paused = !paused);

document.getElementById("startBtn")?.addEventListener("click", () => {
  // Reset game state
  score = 0;
  health = 100;
  kills = 0;
  
  // Update HUD
  document.getElementById("score").innerText = "Score: 0";
  document.getElementById("kills").innerText = "Kills: 0";
  document.getElementById("health").innerText = "Health: 100";
  
  // Spawn enemies
  spawnInitialEnemies();
  
  gameState = "playing";
  document.getElementById("menu").style.display = "none";
  
  // Resume audio context on user interaction
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  startAmbientSound();
});

document.getElementById("restartBtn")?.addEventListener("click", () => location.reload());

// ---------------- GAME FUNCTIONS ----------------
function moveShip() {
  if (gameState !== "playing" || paused) return;

  const accel = shipAcceleration * shipGroup.userData.speedBoost;
  const maxSpd = maxSpeed * shipGroup.userData.speedBoost;

  // Keyboard input
  if (keys["ArrowUp"] || keys["w"] || keys["W"]) shipVelocity.y += accel;
  if (keys["ArrowDown"] || keys["s"] || keys["S"]) shipVelocity.y -= accel;
  if (keys["ArrowLeft"] || keys["a"] || keys["A"]) shipVelocity.x -= accel;
  if (keys["ArrowRight"] || keys["d"] || keys["D"]) shipVelocity.x += accel;

  // Joystick input
  shipVelocity.x += joy.x * accel;
  shipVelocity.y += joy.y * accel;

  // Apply friction
  shipVelocity.x *= shipFriction;
  shipVelocity.y *= shipFriction;

  // Clamp speed
  const speed = Math.sqrt(shipVelocity.x ** 2 + shipVelocity.y ** 2);
  if (speed > maxSpd) {
    shipVelocity.x = (shipVelocity.x / speed) * maxSpd;
    shipVelocity.y = (shipVelocity.y / speed) * maxSpd;
  }

  // Apply velocity
  shipGroup.position.x += shipVelocity.x;
  shipGroup.position.y += shipVelocity.y;

  // Tilt ship based on movement
  shipGroup.rotation.z = -shipVelocity.x * 2;
  
  // Play thrust sound when moving
  const now = Date.now();
  if (speed > 0.05 && now - lastThrustTime > 150) {
    playThrustSound();
    lastThrustTime = now;
  }
  
  // Animate engine based on speed
  const engineScale = 0.5 + speed * 2;
  engineGlow.scale.setScalar(engineScale);
  innerGlow.scale.setScalar(engineScale * 0.8);

  // Boundary limits
  shipGroup.position.x = Math.max(-15, Math.min(15, shipGroup.position.x));
  shipGroup.position.y = Math.max(-8, Math.min(8, shipGroup.position.y));
}

function updateLasers() {
  for (let i = lasers.length - 1; i >= 0; i--) {
    const laser = lasers[i];
    laser.mesh.position.z -= 0.8;
    laser.glow.position.z -= 0.8;
    
    // Rotate the rock
    if (laser.mesh.userData.rotSpeed) {
      laser.mesh.rotation.x += laser.mesh.userData.rotSpeed.x;
      laser.mesh.rotation.y += laser.mesh.userData.rotSpeed.y;
      laser.mesh.rotation.z += laser.mesh.userData.rotSpeed.z;
    }

    if (laser.mesh.position.z < -60) {
      scene.remove(laser.mesh);
      scene.remove(laser.glow);
      lasers.splice(i, 1);
    }
  }
}

function updateAsteroids() {
  for (let i = asteroids.length - 1; i >= 0; i--) {
    const a = asteroids[i];

    // Rotate
    a.rotation.x += a.userData.rotSpeed.x;
    a.rotation.y += a.userData.rotSpeed.y;
    a.rotation.z += a.userData.rotSpeed.z;

    // Move toward camera (warp effect)
    const speed = warp ? a.userData.speed * 5 : a.userData.speed;
    a.position.z += speed;

    // Reset when past camera
    if (a.position.z > 10) {
      a.position.z = -50 - Math.random() * 20;
      a.position.x = (Math.random() - 0.5) * 40;
      a.position.y = (Math.random() - 0.5) * 20;
    }

    // Collision with ship
    if (a.position.distanceTo(shipGroup.position) < 1.5) {
      if (shipGroup.userData.shielded) {
        // Shield blocks damage
        createExplosion(a.position, 0x00ff88, 0.5);
        showPopup('BLOCKED!', '#00ff88');
      } else {
        playExplosionSound();
        triggerShake(0.8);
        health -= 10;
        document.getElementById("health").innerText = "Health: " + health;
        document.body.style.backgroundColor = '#330000';
        setTimeout(() => document.body.style.backgroundColor = '#000011', 100);
      }

      // Reset asteroid
      a.position.z = -50 - Math.random() * 20;

      if (health <= 0) {
        gameState = "gameover";
        document.getElementById("gameover").style.display = "flex";
        stopAmbientSound();
      }
    }
  }
}

function checkLaserHits() {
  for (let i = lasers.length - 1; i >= 0; i--) {
    const laser = lasers[i];

    for (let j = asteroids.length - 1; j >= 0; j--) {
      const a = asteroids[j];

      if (laser.mesh.position.distanceTo(a.position) < 1.5) {
        playExplosionSound();

        // Remove laser
        scene.remove(laser.mesh);
        scene.remove(laser.glow);
        lasers.splice(i, 1);

        // Reset asteroid
        a.position.z = -50 - Math.random() * 20;
        a.position.x = (Math.random() - 0.5) * 40;
        a.position.y = (Math.random() - 0.5) * 20;

        score += 10;
        document.getElementById("score").innerText = "Score: " + score;
        
        // Explosion effect
        createExplosion(a.position, 0x888888, 0.8);
        break;
      }
    }
  }
}

function updateEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    
    // Move toward camera
    e.position.z += e.userData.speed;
    
    // Slight wobble
    e.position.x += Math.sin(Date.now() * 0.002 + i) * 0.01;
    
    // Reset when past camera
    if (e.position.z > 10) {
      e.position.z = -40 - Math.random() * 20;
      e.position.x = (Math.random() - 0.5) * 30;
      e.position.y = (Math.random() - 0.5) * 15;
    }
    
    // Collision with ship
    if (e.position.distanceTo(shipGroup.position) < 1.5) {
      if (shipGroup.userData.shielded) {
        createExplosion(e.position, 0x00ff88, 0.5);
        showPopup('BLOCKED!', '#00ff88');
      } else {
        playExplosionSound();
        triggerShake(1.0);
        health -= 15;
        document.getElementById("health").innerText = "Health: " + health;
        createExplosion(e.position, e.userData.type === 'tank' ? 0x884400 : 0xff4444, 1.2);
        document.body.style.backgroundColor = '#440000';
        setTimeout(() => document.body.style.backgroundColor = '#000011', 100);
      }
      
      // Reset enemy
      e.position.z = -40 - Math.random() * 20;
      e.userData.health = e.userData.maxHealth;
      
      if (health <= 0) {
        gameState = "gameover";
        document.getElementById("gameover").style.display = "flex";
        document.getElementById("finalScore").textContent = "Score: " + score;
        stopAmbientSound();
      }
    }
  }
  
  // Spawn more enemies over time
  if (enemies.length < 10 && Math.random() < 0.01) {
    createEnemy(['scout', 'scout', 'tank', 'bomber'][Math.floor(Math.random() * 4)]);
  }
}

function checkEnemyHits() {
  for (let i = lasers.length - 1; i >= 0; i--) {
    const laser = lasers[i];
    
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      
      if (laser.mesh.position.distanceTo(e.position) < 1.5) {
        playExplosionSound();
        
        // Remove laser
        scene.remove(laser.mesh);
        scene.remove(laser.glow);
        lasers.splice(i, 1);
        
        // Damage enemy
        e.userData.health--;
        
        // Flash enemy
        e.children[0].material.emissiveIntensity = 1;
        setTimeout(() => { if (e.children[0]) e.children[0].material.emissiveIntensity = 0.3; }, 100);
        
        if (e.userData.health <= 0) {
          // Enemy destroyed
          createExplosion(e.position, e.userData.type === 'tank' ? 0x884400 : 0xff4444, 1.5);
          showPopup('+' + e.userData.points + '!', '#ffaa00');
          
          score += e.userData.points;
          kills++;
          document.getElementById("score").innerText = "Score: " + score;
          document.getElementById("kills").innerText = "Kills: " + kills;
          
          // Reset enemy
          e.position.z = -40 - Math.random() * 20;
          e.userData.health = e.userData.maxHealth;
        }
        break;
      }
    }
  }
}

function updateStarField() {
  const positions = starField.geometry.attributes.position.array;

  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 2] += warp ? 0.5 : 0.05;

    if (positions[i + 2] > 50) {
      positions[i + 2] = -100;
    }
  }

  starField.geometry.attributes.position.needsUpdate = true;
}

function updateSpaceDust() {
  const positions = spaceDust.geometry.attributes.position.array;
  const velocities = spaceDust.userData.velocities;

  for (let i = 0; i < velocities.length; i++) {
    const i3 = i * 3;
    positions[i3] += velocities[i].x;
    positions[i3 + 1] += velocities[i].y;
    positions[i3 + 2] += warp ? velocities[i].z * 5 : velocities[i].z;

    // Reset when past camera
    if (positions[i3 + 2] > 20) {
      positions[i3 + 2] = -60 - Math.random() * 40;
      positions[i3] = (Math.random() - 0.5) * 60;
      positions[i3 + 1] = (Math.random() - 0.5) * 40;
    }
  }

  spaceDust.geometry.attributes.position.needsUpdate = true;
}

// ---------------- ANIMATION LOOP ----------------
function animate() {
  requestAnimationFrame(animate);
  
  gameTime += 16; // ms per frame

  if (gameState === "playing" && !paused) {
    moveShip();
    updateLasers();
    updateAsteroids();
    updateEnemies();
    checkLaserHits();
    checkEnemyHits();
    updateStarField();
    updateSpaceDust();
    updateEngineTrail();
    updateScreenShake();
    updatePowerups();
    updateExplosions();

    // Rotate planets
    earth.children[0].rotation.y += 0.001;
    mars.children[0].rotation.y += 0.002;
    jupiter.children[0].rotation.y += 0.0005;

    // Animate enemies
    for (const enemy of enemies) {
      enemy.children[0].rotation.y += 0.02;
      enemy.children[0].rotation.x += 0.01;
    }
    
    // Animate alien (bobbing head and waving arms)
    if (alienGroup && alienGroup.children.length >= 8) {
      alienGroup.children[1].position.y = 0.55 + Math.sin(Date.now() * 0.005) * 0.02; // head bob (alienHead)
      alienGroup.children[6].rotation.z = Math.sin(Date.now() * 0.003) * 0.3; // left arm wave (leftArm)
      alienGroup.children[7].rotation.z = -Math.sin(Date.now() * 0.003) * 0.3; // right arm wave (rightArm)
      alienGroup.children[5].scale.setScalar(1 + Math.sin(Date.now() * 0.008) * 0.2); // antenna pulse (antennaBall)
    }
  }

  // Always update dust for menu background effect
  if (gameState === "menu") {
    updateSpaceDust();
    nebula.rotation.z += 0.0002;
  }

  renderer.render(scene, camera);
}

animate();