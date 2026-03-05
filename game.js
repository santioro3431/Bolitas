const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// UI elements
const healthFill = document.getElementById('health-fill');
const killDisplay = document.getElementById('kill-count');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const finalKills = document.getElementById('final-kills');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

const ability1 = document.getElementById('ability-1');
const ability2 = document.getElementById('ability-2');
const ability3 = document.getElementById('ability-3');
const inventoryUI = document.getElementById('inventory-ui');
const interactPrompt = document.getElementById('interact-prompt');
const promptText = document.getElementById('prompt-text');
const invSlots = document.querySelectorAll('.inv-slot');
const uiLayer = document.getElementById('ui-layer');

const helmetCanvas = document.getElementById('helmet-canvas');
const vestCanvas = document.getElementById('vest-canvas');
const helmetCtx = helmetCanvas ? helmetCanvas.getContext('2d') : null;
const vestCtx = vestCanvas ? vestCanvas.getContext('2d') : null;

document.body.classList.add('in-menu');

let gameState = 'start';
let lastTime = 0;
let kills = 0;
let killPoints = 0;
let showInventory = false;
let draggedSlotIndex = null;

// Input
const keys = { w: false, a: false, s: false, d: false, f: false, e: false, r: false, tab: false };
const mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };

window.addEventListener('keydown', e => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;

    if (gameState === 'playing') {
        if (e.key.toLowerCase() === 'e') {
            player.tryOpenDoor();
        }
        if (e.key.toLowerCase() === 't' && killPoints >= 2) {
            killPoints -= 2;
            player.health = Math.min(player.maxHealth, player.health + player.maxHealth * 0.3);
            createParticles(player.x, player.y, '#00ff00', 30);
            updateUI();
        }
        if (e.key.toLowerCase() === 'y' && killPoints >= 5) {
            killPoints -= 5;
            player.speedMultiplier = 1.8;
            player.staminaTimer = 6000;
            createParticles(player.x, player.y, '#00ffff', 40);
            updateUI();
        }
        if (e.key.toLowerCase() === 'u' && killPoints >= 10) {
            killPoints -= 10;
            for (let i = 0; i < 10; i++) {
                bombs.push(new Bomb(
                    player.x + (Math.random() - 0.5) * 1500,
                    player.y + (Math.random() - 0.5) * 1500
                ));
            }
            updateUI();
        }
        if (e.key.toLowerCase() === 'f') {
            player.tryPickupWeapon();
        }
        if (e.key.toLowerCase() === 'r') {
            player.tryManualReload();
        }
        if (e.key.toLowerCase() === 'tab') {
            e.preventDefault(); // Don't do browser focus cycle
        }
        // Slot selection keys
        if (['1', '2', '3', '4', '5'].includes(e.key)) {
            player.equipSlot(parseInt(e.key) - 1);
        }
    }
});
window.addEventListener('keyup', e => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false });
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', () => { mouse.down = true; });
window.addEventListener('mouseup', () => { mouse.down = false; });

// Inventory Drag and Drop Logic
invSlots.forEach(slot => {
    slot.addEventListener('dragstart', (e) => {
        draggedSlotIndex = parseInt(slot.dataset.index);
        e.dataTransfer.effectAllowed = 'move';
        // Hack to make empty elements draggable: need to pass some data
        e.dataTransfer.setData('text/plain', draggedSlotIndex);
    });
    slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        slot.classList.add('drag-over');
    });
    slot.addEventListener('dragleave', () => {
        slot.classList.remove('drag-over');
    });
    slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('drag-over');
        const targetIndex = parseInt(slot.dataset.index);
        if (draggedSlotIndex !== null && draggedSlotIndex !== targetIndex) {
            player.swapInventorySlots(draggedSlotIndex, targetIndex);
        }
        draggedSlotIndex = null;
    });
    // Fallback click to swap
    slot.addEventListener('click', () => {
        if (draggedSlotIndex === null) {
            player.equipSlot(parseInt(slot.dataset.index));
        }
    });
});

window.addEventListener('dragover', (e) => {
    e.preventDefault(); // allow drop anywhere on window
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (draggedSlotIndex !== null) {
        if (!e.target.closest('.inv-slot')) {
            // Dropped outside, drop the weapon
            const item = player.inventory[draggedSlotIndex];
            if (item) {
                // Drop it near player (staggered slightly)
                const dropX = player.x + (Math.random() - 0.5) * 60;
                const dropY = player.y + (Math.random() - 0.5) * 60;
                droppedWeapons.push(new DroppedWeapon(dropX, dropY, item.type, item.ammo));
                player.inventory[draggedSlotIndex] = null;

                // Auto-switch away if dropped active slot
                if (player.activeSlotIndex === draggedSlotIndex) {
                    player.equipSlot(player.inventory.findIndex(i => i !== null));
                }

                updateUI();
            }
        }
    }
    draggedSlotIndex = null;
    invSlots.forEach(s => s.classList.remove('drag-over'));
});

// Weapon Definitions
const WEAPONS = {
    Pistol: { name: 'Pistol 9mm', rarityClass: 'rarity-orange', rarityName: 'Orange', damage: 22, fireRate: 300, magSize: 15, reloadTime: 1200, speed: 1000, spread: 0.05, len: 40, icon: 'pistol' },
    Revolver: { name: 'Revolver', rarityClass: 'rarity-orange', rarityName: 'Orange', damage: 55, fireRate: 500, magSize: 6, reloadTime: 1800, speed: 1200, spread: 0.02, len: 45, icon: 'pistol' },
    SMG: { name: 'SMG', rarityClass: 'rarity-blue', rarityName: 'Blue', damage: 18, fireRate: 80, magSize: 30, reloadTime: 1500, speed: 1300, spread: 0.1, len: 55, icon: 'rifle' },
    AssaultRifle: { name: 'Assault Rifle', rarityClass: 'rarity-blue', rarityName: 'Blue', damage: 30, fireRate: 150, magSize: 30, reloadTime: 2000, speed: 1500, spread: 0.04, len: 65, icon: 'rifle' },
    LMG: { name: 'LMG', rarityClass: 'rarity-green', rarityName: 'Green', damage: 26, fireRate: 120, magSize: 100, reloadTime: 4000, speed: 1400, spread: 0.08, len: 70, icon: 'rifle' },
    BurstRifle: { name: 'Burst Rifle', rarityClass: 'rarity-green', rarityName: 'Green', damage: 24, fireRate: 400, burst: 3, burstDelay: 80, magSize: 30, reloadTime: 2000, speed: 1600, spread: 0.02, len: 65, icon: 'rifle' },
    AWP: { name: 'AWP', rarityClass: 'rarity-darkgreen', rarityName: 'Ugly Green', damage: 1000, fireRate: 1500, magSize: 5, reloadTime: 3500, speed: 3000, spread: 0.0, len: 90, icon: 'sniper' },
    BoltSniper: { name: 'Bolt Sniper', rarityClass: 'rarity-darkgreen', rarityName: 'Ugly Green', damage: 85, fireRate: 400, magSize: 10, reloadTime: 2500, speed: 2500, spread: 0.01, len: 85, icon: 'sniper' },
    PumpShotgun: { name: 'Pump Shotgun', rarityClass: 'rarity-red', rarityName: 'Red', damage: 14, fireRate: 1000, pellets: 8, magSize: 5, shellByShellReload: true, reloadTime: 500, speed: 1000, spread: 0.25, len: 75, icon: 'shotgun' },
    AutoShotgun: { name: 'Auto Shotgun', rarityClass: 'rarity-red', rarityName: 'Red', damage: 13, fireRate: 350, pellets: 6, magSize: 8, reloadTime: 2500, speed: 900, spread: 0.3, len: 70, icon: 'shotgun' },
};

function getRandomWeapon() {
    const r = Math.random();
    let typeKeys = [];
    if (r < 0.4) typeKeys = ['Pistol', 'Revolver'];
    else if (r < 0.7) typeKeys = ['SMG', 'AssaultRifle'];
    else if (r < 0.85) typeKeys = ['LMG', 'BurstRifle'];
    else if (r < 0.95) typeKeys = ['PumpShotgun', 'AutoShotgun'];
    else typeKeys = ['AWP', 'BoltSniper'];

    return WEAPONS[typeKeys[Math.floor(Math.random() * typeKeys.length)]];
}

// Assets
const woodImg = new Image();
woodImg.src = 'assets/wood_floor_texture_1772215927376.png';

let woodPattern = null;
woodImg.onload = () => { woodPattern = ctx.createPattern(woodImg, 'repeat'); };

const armorImgs = {
    helmet: [null, new Image(), new Image(), new Image(), new Image()],
    vest: [null, new Image(), new Image(), new Image(), new Image()]
};
armorImgs.helmet[1].src = 'assets/helmet_1.png';
armorImgs.helmet[2].src = 'assets/helmet_2.png';
armorImgs.helmet[3].src = 'assets/helmet_3.png';
armorImgs.helmet[4].src = 'assets/helmet_4.png';
armorImgs.vest[1].src = 'assets/vest_1.png';
armorImgs.vest[2].src = 'assets/vest_2.png';
armorImgs.vest[3].src = 'assets/vest_3.png';
armorImgs.vest[4].src = 'assets/vest_4.png';

// Camera
const camera = { x: 0, y: 0 };
const mapSize = 4000;

// Advanced Procedural Gun Drawer
function drawProceduralGun(ctx, weaponDef, glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10;

    // Draw the weapon horizontally pointing right
    if (weaponDef.icon === 'pistol') {
        ctx.fillStyle = glowColor; ctx.fillRect(-5, -6, 20, 12);
        ctx.fillStyle = '#222'; ctx.fillRect(15, -4, 10, 8); // barrel
    } else if (weaponDef.icon === 'shotgun') {
        ctx.fillStyle = glowColor; ctx.fillRect(-10, -8, 30, 16);
        ctx.fillStyle = '#222'; ctx.fillRect(20, -5, 30, 10); // barrel
        ctx.fillStyle = '#444'; ctx.fillRect(10, -7, 15, 14); // pump
    } else if (weaponDef.icon === 'sniper') {
        ctx.fillStyle = glowColor; ctx.fillRect(-10, -7, 30, 14);
        ctx.fillStyle = '#222'; ctx.fillRect(20, -3, 40, 6); // long barrel
        ctx.fillStyle = '#111'; ctx.fillRect(0, -12, 15, 8); // scope
    } else { // rifle and SMG
        ctx.fillStyle = glowColor; ctx.fillRect(-10, -8, 30, 16);
        ctx.fillStyle = '#222'; ctx.fillRect(20, -4, 25, 8); // barrel
        ctx.fillStyle = '#111'; ctx.fillRect(5, -10, 10, 6); // sight
    }
    ctx.shadowBlur = 0;
}

class Bolita {
    constructor(x, y, color, isPlayer, name = "") {
        this.x = x;
        this.y = y;
        this.radius = 35;
        this.color = color;
        this.isPlayer = isPlayer;
        this.name = name;
        this.angle = 0;
        this.baseSpeed = isPlayer ? 250 : 150; // Nerfed AI speed (was 200)
        this.speedMultiplier = 1;
        this.staminaTimer = 0;

        this.health = 100; // Both player and enemies have 100 base HP
        this.maxHealth = 100;
        this.helmetLevel = 0;
        this.vestLevel = 0;

        // Weapon and Inventory
        this.inventory = [
            { type: WEAPONS.Pistol, ammo: WEAPONS.Pistol.magSize },
            null, null, null, null
        ];
        this.activeSlotIndex = 0;

        if (!isPlayer) {
            this.inventory[0] = { type: getRandomWeapon(), ammo: 999 };
        }

        this.reloading = false;
        this.reloadTimer = 0;
        this.lastShot = 0;

        // Burst vars
        this.bursting = 0;
        this.burstTimer = 0;

        this.markedForDeletion = false;

        // For AI
        this.stateTimer = 0;
        this.wanderAngle = Math.random() * Math.PI * 2;
    }

    update(dt) {
        if (this.isPlayer) {
            this.handlePlayerMovement(dt);
            if (this.staminaTimer > 0) {
                this.staminaTimer -= dt;
                if (this.staminaTimer <= 0) this.speedMultiplier = 1;
                else {
                    // Trail effect
                    if (Math.random() > 0.5) createParticles(this.x, this.y, '#00ffff', 1);
                }
            }
        } else {
            this.handleAIMovement(dt);
        }

        // Boundaries
        this.x = Math.max(this.radius, Math.min(mapSize - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(mapSize - this.radius, this.y));

        this.handleCollisions();
        this.handleWeapon(dt);
    }

    handlePlayerMovement(dt) {
        let dx = 0; let dy = 0;
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;

        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length; dy /= length;
        }

        this.x += dx * this.baseSpeed * this.speedMultiplier * (dt / 1000);
        this.y += dy * this.baseSpeed * this.speedMultiplier * (dt / 1000);

        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;
        this.angle = Math.atan2(mouse.y - screenY, mouse.x - screenX);
    }

    handleAIMovement(dt) {
        if (!this.markedForDeletion) {
            let distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
            if (distToPlayer < 600) {
                this.angle = Math.atan2(player.y - this.y, player.x - this.x);
                // Check if a house is in the way
                houses.forEach(h => {
                    if (this.x > h.x - 50 && this.x < h.x + h.w + 50 && this.y > h.y - 50 && this.y < h.y + h.h + 50) {
                        // Try to walk around it if too close
                        this.angle += Math.PI / 2; // Strafe
                    }
                });

                if (distToPlayer > 250) {
                    this.x += Math.cos(this.angle) * this.baseSpeed * (dt / 1000);
                    this.y += Math.sin(this.angle) * this.baseSpeed * (dt / 1000);
                } else if (distToPlayer < 150) {
                    this.x -= Math.cos(this.angle) * this.baseSpeed * (dt / 1000);
                    this.y -= Math.sin(this.angle) * this.baseSpeed * (dt / 1000);
                }
                this.handleWeapon(dt);
            } else { // Wander if player is far
                this.stateTimer += dt;
                if (this.stateTimer > 2000) {
                    this.wanderAngle = Math.random() * Math.PI * 2;
                    this.stateTimer = 0;
                }
                this.x += Math.cos(this.wanderAngle) * this.baseSpeed * (dt / 1000);
                this.y += Math.sin(this.wanderAngle) * this.baseSpeed * (dt / 1000);
                this.angle = this.wanderAngle;
            }
        }
    }

    handleCollisions() {
        const checkRectCollision = (rectX, rectY, rectW, rectH) => {
            let testX = this.x; let testY = this.y;
            if (this.x < rectX) testX = rectX; else if (this.x > rectX + rectW) testX = rectX + rectW;
            if (this.y < rectY) testY = rectY; else if (this.y > rectY + rectH) testY = rectY + rectH;

            let dist = Math.hypot(this.x - testX, this.y - testY);
            if (dist <= this.radius) {
                const overlap = this.radius - dist;
                const nx = (this.x - testX) / dist || 1;
                const ny = (this.y - testY) / dist || 0;
                this.x += nx * overlap;
                this.y += ny * overlap;
            }
        };

        const checkCircleCollision = (cx, cy, cRadius) => {
            const dist = Math.hypot(this.x - cx, this.y - cy);
            if (dist < this.radius + cRadius) {
                const overlap = (this.radius + cRadius) - dist;
                const nx = (this.x - cx) / dist;
                const ny = (this.y - cy) / dist;
                this.x += nx * overlap;
                this.y += ny * overlap;
            }
        };

        crates.forEach(c => checkRectCollision(c.x, c.y, c.size, c.size));
        trees.forEach(t => checkCircleCollision(t.x, t.y, t.radius * 0.15));

        houses.forEach(h => {
            h.walls.forEach(w => checkRectCollision(w.x, w.y, w.w, w.h));
            h.doors.forEach(d => {
                if (!d.isOpen) checkRectCollision(d.x, d.y, d.w, d.h);
            });
        });
    }

    handleWeapon(dt) {
        const weaponState = this.inventory[this.activeSlotIndex];
        if (!weaponState) return;
        const weaponDef = weaponState.type;

        if (this.reloading) {
            this.reloadTimer += dt;
            if (this.reloadTimer >= weaponDef.reloadTime) {
                if (weaponDef.shellByShellReload) {
                    weaponState.ammo++;
                    this.reloadTimer = 0;
                    if (this.isPlayer) updateUI();
                    if (weaponState.ammo >= weaponDef.magSize) {
                        this.reloading = false;
                        if (this.isPlayer) updateUI();
                    }
                } else {
                    weaponState.ammo = weaponDef.magSize;
                    this.reloading = false;
                    this.reloadTimer = 0;
                    if (this.isPlayer) updateUI();
                }
            }
            // Cancel reload if firing (for pump shotgun mostly, assuming 1 shell minimum)
            if (this.isPlayer && mouse.down && weaponState.ammo > 0 && performance.now() - this.lastShot > weaponDef.fireRate) {
                this.reloading = false;
                this.reloadTimer = 0;
            }
        }

        if (this.bursting > 0) {
            this.burstTimer += dt;
            if (this.burstTimer > weaponDef.burstDelay) {
                this.fireBullet(weaponDef);
                this.bursting--;
                this.burstTimer = 0;
                if (this.bursting === 0) this.lastShot = performance.now();
            }
        } else if (this.isPlayer) {
            if (mouse.down && !this.reloading && weaponState.ammo > 0 && performance.now() - this.lastShot > weaponDef.fireRate) {
                if (weaponDef.burst) {
                    this.bursting = weaponDef.burst;
                    this.burstTimer = weaponDef.burstDelay; // Fire first immediately
                } else if (weaponDef.pellets) {
                    this.fireShotgun(weaponDef);
                    this.lastShot = performance.now();
                } else {
                    this.fireBullet(weaponDef);
                    this.lastShot = performance.now();
                }
            } else if (mouse.down && weaponState.ammo <= 0 && !this.reloading) {
                this.reloading = true;
                this.reloadTimer = 0;
            }
        } else { // AI shooting logic
            // Add reaction delay and worse aim by multiplying fireRate delay and increasing spread temporarily 
            const aiFireRateDelay = weaponDef.fireRate * 3.5;

            if (!this.reloading && weaponState.ammo > 0 && performance.now() - this.lastShot > aiFireRateDelay) {
                // Determine inaccuracy
                const aimError = (Math.random() - 0.5) * 0.5; // Much wider spread for bots
                const originalAngle = this.angle;
                this.angle += aimError;

                if (weaponDef.burst) {
                    this.bursting = weaponDef.burst;
                    this.burstTimer = weaponDef.burstDelay;
                } else if (weaponDef.pellets) {
                    this.fireShotgun(weaponDef);
                    this.lastShot = performance.now();
                } else {
                    this.fireBullet(weaponDef);
                    this.lastShot = performance.now();
                }
                this.angle = originalAngle; // Restore intended angle
            } else if (weaponState.ammo <= 0 && !this.reloading) {
                this.reloading = true;
                this.reloadTimer = 0;
            }
        }
    }

    fireBullet(weaponDef) {
        const weaponState = this.inventory[this.activeSlotIndex];
        weaponState.ammo--;
        if (this.isPlayer) updateUI();

        const gunLen = weaponDef.len;
        let sx = this.x + Math.cos(this.angle) * gunLen;
        let sy = this.y + Math.sin(this.angle) * gunLen;

        // Prevent shooting through walls by raycasting the barrel
        const spawnPoint = getValidSpawnPoint(this.x, this.y, sx, sy);
        sx = spawnPoint.x;
        sy = spawnPoint.y;

        if (spawnPoint.hitWall) {
            createParticles(sx, sy, '#555', 5);
        } else {
            const spread = (Math.random() - 0.5) * weaponDef.spread;
            bullets.push(new Bullet(sx, sy, this.angle + spread, this.isPlayer, weaponDef.speed, weaponDef.damage));
        }

        // Recoil
        if (weaponDef.icon === 'sniper') {
            this.x -= Math.cos(this.angle) * 5;
            this.y -= Math.sin(this.angle) * 5;
        }
    }

    fireShotgun(weaponDef) {
        const weaponState = this.inventory[this.activeSlotIndex];
        weaponState.ammo--;
        if (this.isPlayer) updateUI();

        const gunLen = weaponDef.len;
        let sx = this.x + Math.cos(this.angle) * gunLen;
        let sy = this.y + Math.sin(this.angle) * gunLen;

        const spawnPoint = getValidSpawnPoint(this.x, this.y, sx, sy);
        sx = spawnPoint.x;
        sy = spawnPoint.y;

        if (spawnPoint.hitWall) {
            createParticles(sx, sy, '#555', 8);
        } else {
            for (let i = 0; i < weaponDef.pellets; i++) {
                const spread = (Math.random() - 0.5) * weaponDef.spread;
                bullets.push(new Bullet(sx, sy, this.angle + spread, this.isPlayer, weaponDef.speed * (0.8 + Math.random() * 0.4), weaponDef.damage));
            }
        }

        // Major Recoil only for bots/very specific instances, otherwise no shotgun recoil
        // Removed default 10px shotgun recoil based on user request
    }

    shoot() { // AI fallback - this function is no longer directly called by AI movement logic
        const weaponDef = this.inventory[0].type;
        if (weaponDef.pellets) this.fireShotgun(weaponDef);
        else this.fireBullet(weaponDef);
    }

    equipSlot(index) {
        if (index >= 0 && index < 5 && this.inventory[index]) {
            this.activeSlotIndex = index;
            this.reloading = false; // Cancel reload on swap
            updateUI();
        } else if (index >= 0 && index < 5 && !this.inventory[index]) {
            // Can select empty slot safely now (hands)
            this.activeSlotIndex = index;
            this.reloading = false;
            updateUI();
        }
    }

    swapInventorySlots(fromIdx, toIdx) {
        const temp = this.inventory[toIdx];
        this.inventory[toIdx] = this.inventory[fromIdx];
        this.inventory[fromIdx] = temp;
        // Adjust active slot if moved
        if (this.activeSlotIndex === fromIdx) this.activeSlotIndex = toIdx;
        else if (this.activeSlotIndex === toIdx) this.activeSlotIndex = fromIdx;
        updateUI();
    }

    tryManualReload() {
        const weaponState = this.inventory[this.activeSlotIndex];
        if (!weaponState) return;
        if (!this.reloading && weaponState.ammo < weaponState.type.magSize) {
            this.reloading = true;
            this.reloadTimer = 0;
            updateUI();
        }
    }

    tryPickupWeapon() {
        let pickedUp = false;
        for (let i = droppedWeapons.length - 1; i >= 0; i--) {
            const w = droppedWeapons[i];
            if (Math.hypot(this.x - w.x, this.y - w.y) < this.radius + 50) {
                // Find empty slot
                const emptySlot = this.inventory.findIndex(s => s === null);
                if (emptySlot !== -1) {
                    this.inventory[emptySlot] = { type: w.type, ammo: w.ammo };
                    if (emptySlot === this.activeSlotIndex) updateUI();
                    droppedWeapons.splice(i, 1);
                    pickedUp = true;
                    updateUI();
                    break;
                } else {
                    // Replace currently active if full
                    const oldWep = this.inventory[this.activeSlotIndex];
                    droppedWeapons.push(new DroppedWeapon(this.x, this.y, oldWep.type, oldWep.ammo));
                    this.inventory[this.activeSlotIndex] = { type: w.type, ammo: w.ammo };
                    droppedWeapons.splice(i, 1);
                    pickedUp = true;
                    updateUI();
                    break;
                }
            }
        }
    }

    tryOpenDoor() {
        houses.forEach(h => {
            h.doors.forEach(d => {
                // Check if player is near the door
                if (Math.hypot(this.x - (d.x + d.w / 2), this.y - (d.y + d.h / 2)) < this.radius + 60) {
                    d.isOpen = !d.isOpen; // Toggle door state
                }
            });
        });
    }

    drawWeaponSpriteTinted(ctx, weaponDef, x, y, angle, showHands = false) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Base styling for equipped weapon (Brighter colors, except sniper)
        const glowColor = weaponDef.rarityClass === 'rarity-orange' ? '#ffa500' :
            weaponDef.rarityClass === 'rarity-blue' ? '#33b5e5' :
                weaponDef.rarityClass === 'rarity-green' ? '#00e600' :
                    weaponDef.rarityClass === 'rarity-darkgreen' ? '#4b5320' : '#ff3333';

        // Translate to front of bolita body
        ctx.translate(this.radius - 5, 0);
        drawProceduralGun(ctx, weaponDef, glowColor);

        if (showHands) {
            ctx.fillStyle = this.color;
            let handOffsetX = weaponDef.len > 60 ? 25 : 15;
            // Right Hand
            ctx.beginPath(); ctx.arc(handOffsetX, -12, 8, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke();
            // Left Hand
            ctx.beginPath(); ctx.arc(0, 12, 8, 0, Math.PI * 2); ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    }

    draw(ctx) {
        const weaponState = this.inventory[this.activeSlotIndex];
        const weaponDef = weaponState ? weaponState.type : WEAPONS.Pistol;

        this.drawWeaponSpriteTinted(ctx, weaponDef, this.x, this.y, this.angle, true);

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Backpack
        ctx.fillStyle = '#445';
        ctx.beginPath(); ctx.arc(-this.radius + 5, 0, 18, 0, Math.PI * 2); ctx.fill();

        // Body
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        const armorColors = ['rgba(0,0,0,0.5)', '#888888', '#444444', '#111111', '#bd0000'];

        // Body Outline 
        // Vest rendering
        if (this.vestLevel > 0) {
            ctx.lineWidth = 6;
            ctx.strokeStyle = armorColors[this.vestLevel];
        } else {
            ctx.lineWidth = 3;
            ctx.strokeStyle = armorColors[0];
        }
        ctx.stroke();

        // Helmet rendering
        if (this.helmetLevel > 0) {
            ctx.fillStyle = armorColors[this.helmetLevel];
            ctx.beginPath();
            ctx.arc(0, -5, this.radius * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = armorColors[0];
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();

        // Reload UI Circle and Text
        if (this.reloading && weaponDef) {
            const reloadProgress = this.reloadTimer / weaponDef.reloadTime;
            const remainingSec = ((weaponDef.reloadTime - this.reloadTimer) / 1000).toFixed(1);

            ctx.save();
            ctx.translate(this.x, this.y);

            const cx = this.radius + 15;
            const cy = this.radius + 15;
            const rRadius = 16;

            // Dark background ring
            ctx.beginPath();
            ctx.arc(cx, cy, rRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fill();

            // Progress ring
            ctx.beginPath();
            ctx.arc(cx, cy, rRadius, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * reloadProgress), true); // Draws counter-clockwise to simulate counting down
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Time inside
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Roboto';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 4;
            ctx.fillText(`${remainingSec}s`, cx, cy);

            // Reload Text underneath player
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 10px Roboto';
            ctx.textBaseline = 'top';
            ctx.fillText(`RELOADING`, cx, cy + rRadius + 5);

            ctx.restore();
        }

        // Draw Username label
        if (this.name) {
            ctx.fillStyle = this.isPlayer ? '#ffffff' : '#ffaaaa';
            ctx.font = 'bold 16px Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText(this.name, this.x, this.y + this.radius + 15);
            ctx.shadowBlur = 0; // Reset
        }
    }

    takeDamage(baseDamage) {
        // Base Mitigation
        let finalDamage = baseDamage;

        // AWP completely ignores armor calculations
        if (baseDamage < 1000) {
            // Stacked mitigation calculations. Combined Level 4 = ~50% damage reduction.
            const vestMultiplier = [1.0, 0.92, 0.85, 0.77, 0.70];
            const helmetMultiplier = [1.0, 0.92, 0.85, 0.77, 0.70];

            finalDamage = baseDamage * vestMultiplier[this.vestLevel] * helmetMultiplier[this.helmetLevel];
        }

        this.health -= finalDamage;

        if (this.isPlayer) updateUI();

        // Red flash
        const oldColor = this.color;
        this.color = '#fff';
        setTimeout(() => { if (!this.markedForDeletion) this.color = oldColor; }, 50);

        createParticles(this.x, this.y, '#ff0000', 5, true);

        if (this.health <= 0) {
            this.markedForDeletion = true;
            createParticles(this.x, this.y, '#990000', 40, true);
            if (this.isPlayer) {
                gameState = 'gameover';
                document.body.classList.add('in-menu'); // HUD escondido
                document.getElementById('final-kills').textContent = kills;
                document.getElementById('final-time').textContent = ((performance.now() - gameStartTime) / 1000).toFixed(1);
                setTimeout(() => {
                    if (gameState === 'gameover') {
                        gameOverScreen.classList.remove('hidden');
                    }
                }, 1000);
            } else {
                kills++;
                killPoints++;
                hordeEnemiesRemaining = Math.max(0, hordeEnemiesRemaining - 1);
                if (hordeEnemiesRemaining === 0 && isHordeActive) {
                    isHordeActive = false;
                    hordeCooldownTimer = 10000; // 10 seconds break
                }
                updateUI();
            }
        }
    }
}

class Bullet {
    constructor(x, y, angle, isPlayer, speed, damage) {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.radius = 4;
        this.isPlayer = isPlayer;
        this.life = 1000;
        this.markedForDeletion = false;
        this.color = isPlayer ? '#ffff00' : '#ff4444';
        this.damage = damage; // Fix bug: Inherit real weapon stats
    }
    update(dt) {
        this.x += this.vx * (dt / 1000);
        this.y += this.vy * (dt / 1000);
        this.life -= dt;
        if (this.life <= 0 || this.x < 0 || this.x > mapSize || this.y < 0 || this.y > mapSize) {
            this.markedForDeletion = true;
        }
        // Collide with Bolitas (Enemies/Player)
        if (!this.markedForDeletion) {
            const targets = this.isPlayer ? enemies : [player];
            targets.forEach(t => {
                if (!this.markedForDeletion && Math.hypot(this.x - t.x, this.y - t.y) < t.radius) {
                    this.markedForDeletion = true;

                    let finalHitDamage = this.damage;

                    // Positional hit detection for AWP (damage >= 1000)
                    if (this.damage >= 1000) {
                        const distToCenter = Math.hypot(this.x - t.x, this.y - t.y);
                        const isHeadshot = distToCenter < 15; // Inner 15px is considered the head

                        if (!isHeadshot) {
                            // Bodyshot logic: 87 damage regardless of armor, unless level 1 armor -> 100 damage
                            if ((t.helmetLevel === 1 && t.vestLevel === 1) || Math.max(t.helmetLevel, t.vestLevel) === 1) {
                                finalHitDamage = 100;
                            } else {
                                finalHitDamage = 87;
                            }
                        }
                    }

                    // Balance difficulty: NPCs deal 50% less damage than the player
                    if (!this.isPlayer) {
                        finalHitDamage = finalHitDamage * 0.5;
                    }

                    t.takeDamage(finalHitDamage);
                    createParticles(this.x, this.y, '#cc0000', 6, true);
                }
            });
        }
        // Collide with crates
        if (!this.markedForDeletion) {
            crates.forEach(c => {
                if (this.x > c.x && this.x < c.x + c.size && this.y > c.y && this.y < c.y + c.size) {
                    this.markedForDeletion = true;
                    c.takeDamage(this.damage);
                    createParticles(this.x, this.y, '#d2b48c', 4);
                }
            });
        }

        // Collide with Walls and closed doors
        if (!this.markedForDeletion) {
            houses.forEach(h => {
                h.walls.forEach(w => {
                    if (this.x > w.x && this.x < w.x + w.w && this.y > w.y && this.y < w.y + w.h) {
                        this.markedForDeletion = true;
                        createParticles(this.x, this.y, '#555', 3);
                    }
                });
                h.doors.forEach(d => {
                    if (!d.isOpen && this.x > d.x && this.x < d.x + d.w && this.y > d.y && this.y < d.y + d.h) {
                        this.markedForDeletion = true;
                        createParticles(this.x, this.y, '#5c3a21', 3);
                    }
                });
            });
        }
    }
    draw(ctx) {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.fill();
        ctx.beginPath(); ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.vx * 0.03, this.y - this.vy * 0.03);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = this.radius * 2; ctx.stroke();
    }
}

class Crate {
    constructor(x, y) {
        this.x = x; this.y = y; this.size = 140;
        this.health = 40;
        this.maxHealth = 40;
        this.markedForDeletion = false;
    }
    takeDamage(amt) {
        this.health -= amt;
        if (this.health <= 0) {
            this.markedForDeletion = true;
            createParticles(this.x + this.size / 2, this.y + this.size / 2, '#8b6f4e', 25);

            const r = Math.random();
            // Guaranteed Loot drops. 40% Weapon, 30% Armor, 30% Loot
            if (r < 0.4) {
                droppedWeapons.push(new DroppedWeapon(this.x + this.size / 2, this.y + this.size / 2, getRandomWeapon(), 0));
                droppedWeapons[droppedWeapons.length - 1].ammo = droppedWeapons[droppedWeapons.length - 1].type.magSize;
            } else if (r < 0.7) {
                // Determine armor level
                const lr = Math.random();
                let lvl = 1;
                if (lr > 0.95) lvl = 4;
                else if (lr > 0.8) lvl = 3;
                else if (lr > 0.5) lvl = 2;
                const isHelmet = Math.random() > 0.5;
                armors.push(new ArmorLoot(this.x + this.size / 2, this.y + this.size / 2, lvl, isHelmet));
            } else {
                loots.push(new Loot(this.x + this.size / 2, this.y + this.size / 2));
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.health < this.maxHealth) {
            ctx.globalAlpha = 0.5 + (this.health / this.maxHealth) * 0.5;
        }

        // Beautiful solid procedural crate
        ctx.fillStyle = '#8b6f4e'; ctx.fillRect(0, 0, this.size, this.size);
        ctx.strokeStyle = '#3e2a14'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, this.size, this.size);

        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(this.size, this.size);
        ctx.moveTo(this.size, 0); ctx.lineTo(0, this.size);
        ctx.stroke();

        ctx.strokeStyle = '#5a422a'; ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, this.size - 20, this.size - 20);

        ctx.restore();
    }
}

class DroppedWeapon {
    constructor(x, y, type, ammo) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.ammo = ammo;
        this.radius = 20;
        this.hoverOffset = 0;
        this.markedForDeletion = false;
        this.nearPlayer = false;
    }
    update(dt) {
        this.hoverOffset += dt * 0.005;
        this.nearPlayer = Math.hypot(this.x - player.x, this.y - player.y) < this.radius + 50;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y + Math.sin(this.hoverOffset) * 5);
        ctx.beginPath();

        // Brighter colors for better visibility, except for ugly green sniper
        const rarityColor = this.type.rarityClass === 'rarity-orange' ? '#ffa500' :
            this.type.rarityClass === 'rarity-blue' ? '#33b5e5' :
                this.type.rarityClass === 'rarity-green' ? '#00e600' :
                    this.type.rarityClass === 'rarity-darkgreen' ? '#4b5320' : '#ff3333';

        // Draw Circular Base (No fill, just shadow/prep for stroke)
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);

        // Draw Colored Ring
        ctx.lineWidth = 4;
        ctx.strokeStyle = rarityColor;
        ctx.stroke();

        // Draw Procedural Weapon Centered
        ctx.scale(0.8, 0.8); // Make it fit in the circle
        ctx.translate(-5, 0); // Center it visually inside the circle
        drawProceduralGun(ctx, this.type, rarityColor);
        ctx.translate(5, 0);
        ctx.scale(1.25, 1.25);

        if (this.nearPlayer) {
            ctx.fillStyle = '#fff';
            ctx.font = '12px Roboto';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 4;
            ctx.fillText(this.type.name, 0, -this.radius - 12);
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }
}

class Loot {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 20;
        this.type = 'health'; // Changed: Always health, ammo is obsolete
        this.markedForDeletion = false;
        this.hoverOffset = 0;
    }
    update(dt) {
        this.hoverOffset += dt * 0.005;

        // Pick up by player
        if (Math.hypot(this.x - player.x, this.y - player.y) < this.radius + player.radius) {
            this.markedForDeletion = true;
            if (this.type === 'health') {
                player.health = Math.min(player.maxHealth, player.health + 30);
                createParticles(this.x, this.y, '#00ff00', 10);
            } else {
                player.maxAmmo += 15;
                player.ammo += 15;
                createParticles(this.x, this.y, '#ffff00', 10);
            }
            updateUI();
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y + Math.sin(this.hoverOffset) * 5);
        ctx.beginPath();
        if (this.type === 'health') {
            ctx.fillStyle = '#fff';
            ctx.fillRect(-15, -15, 30, 30);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(-10, -3, 20, 6);
            ctx.fillRect(-3, -10, 6, 20);
        }
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -15, 30, 30);
        ctx.restore();
    }
}

class ArmorLoot {
    constructor(x, y, level, isHelmet) {
        this.x = x; this.y = y; this.level = level; this.isHelmet = isHelmet;
        this.radius = 20;
        this.hoverOffset = 0;
        this.markedForDeletion = false;
        this.nearPlayer = false;
    }
    update(dt) {
        this.hoverOffset += dt * 0.005;
        this.nearPlayer = Math.hypot(this.x - player.x, this.y - player.y) < this.radius + 50;

        // Auto pickup mechanics
        if (Math.hypot(this.x - player.x, this.y - player.y) < this.radius + player.radius) {
            if (this.isHelmet && player.helmetLevel < this.level) {
                player.helmetLevel = this.level;
                this.markedForDeletion = true;
                createParticles(this.x, this.y, '#ffffff', 10);
            } else if (!this.isHelmet && player.vestLevel < this.level) {
                player.vestLevel = this.level;
                this.markedForDeletion = true;
                createParticles(this.x, this.y, '#ffffff', 10);
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y + Math.sin(this.hoverOffset) * 5);
        ctx.beginPath();

        ctx.scale(1.2, 1.2);

        // Dark offset drop shadow
        ctx.beginPath();
        ctx.arc(3, 3, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fill();

        // Level Colors: 1:Gray, 2:Dark Gray, 3:Black, 4:Dark Red
        const outlineColors = ['#000', '#888888', '#444444', '#111111', '#bd0000'];

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = outlineColors[this.level];
        ctx.stroke();

        // Draw PNG image with Multiply to make white background invisible
        const imgList = this.isHelmet ? armorImgs.helmet : armorImgs.vest;
        const img = imgList[this.level];
        if (img && img.complete) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.drawImage(img, -14, -14, 28, 28);
            ctx.globalCompositeOperation = 'source-over'; // Reset
        }

        if (this.nearPlayer) {
            ctx.fillStyle = '#fff';
            ctx.font = '10px Roboto';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 4;
            const name = (this.isHelmet ? "Casco" : "Chaleco") + " nivel " + this.level;
            ctx.fillText(name, 0, -this.radius - 10);
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }
}

class Bomb {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.timer = 1500;
        this.maxRadius = 300;
        this.markedForDeletion = false;
    }
    update(dt) {
        this.timer -= dt;
        if (this.timer <= 0) {
            this.explode();
        }
    }
    explode() {
        this.markedForDeletion = true;
        createParticles(this.x, this.y, '#ff8800', 30);
        createParticles(this.x, this.y, '#ff0000', 30);
        createParticles(this.x, this.y, '#333333', 20);

        // Damage enemies
        enemies.forEach(e => {
            if (Math.hypot(this.x - e.x, this.y - e.y) < this.maxRadius) {
                e.takeDamage(1000); // Nuke insta-kills
            }
        });
        // Damage player
        if (Math.hypot(this.x - player.x, this.y - player.y) < this.maxRadius) {
            player.takeDamage(1000); // Nuke insta-kills
        }
        // Destroy crates
        crates.forEach(c => {
            if (Math.hypot(this.x - (c.x + c.size / 2), this.y - (c.y + c.size / 2)) < this.maxRadius) {
                c.takeDamage(100);
            }
        });
    }
    draw(ctx) {
        if (this.timer > 0) {
            // center dot blinking
            ctx.beginPath();
            ctx.arc(this.x, this.y, 10 + Math.sin(this.timer / 50) * 5, 0, Math.PI * 2);
            ctx.fillStyle = '#ff0000';
            ctx.fill();
            // indicator ring
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.maxRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 0, 0, ${0.1 + (1500 - this.timer) / 1500 * 0.4})`;
            ctx.lineWidth = 4;
            ctx.stroke();
        } else {
            // Explosion flash frame
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.maxRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 100, 0, 0.8)';
            ctx.fill();
        }
    }
}

class Particle {
    constructor(x, y, color, isBlood) {
        this.x = x; this.y = y; this.color = color;
        const speed = isBlood ? Math.random() * 200 : Math.random() * 80 + 40;
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
        this.radius = Math.random() * 5 + 2;
        this.life = isBlood ? 5000 : 300;
        this.maxLife = this.life;
        this.markedForDeletion = false;
        this.isBlood = isBlood;
    }
    update(dt) {
        this.x += this.vx * (dt / 1000); this.y += this.vy * (dt / 1000);
        this.vx *= 0.92; this.vy *= 0.92; // Friction
        if (!this.isBlood) this.life -= dt;
        if (this.life <= 0) this.markedForDeletion = true;
    }
    draw(ctx) {
        ctx.globalAlpha = this.isBlood && this.life < this.maxLife - 1000 ? 1 : Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class House {
    constructor(x, y, width, height) {
        this.x = x; this.y = y; this.w = width; this.h = height;
        const wt = 25; // Wall thickness

        // Create 4 walls leaving a gap for a door
        this.walls = [
            { x: x, y: y, w: width, h: wt }, // Top
            { x: x, y: y + height - wt, w: width, h: wt }, // Bottom
            { x: x, y: y, w: wt, h: height }, // Left
            { x: x + width - wt, y: y, w: wt, h: height / 2 - 50 }, // Right top half
            { x: x + width - wt, y: y + height / 2 + 50, w: wt, h: height / 2 - 50 } // Right bottom half
        ];

        // Door in the right gap
        this.doors = [
            { x: x + width - wt, y: y + height / 2 - 50, w: wt, h: 100, isOpen: false, ox: x + width - wt, oy: y + height / 2 - 50, isVertical: true }
        ];

        // Spawn crates inside securely avoiding walls
        // Wall thickness is 25, so inset them by 50 minimum from the edges
        let numHouseCrates = 2 + Math.floor(Math.random() * 2); // 2 or 3
        let houseCrates = [];
        for (let i = 0; i < numHouseCrates; i++) {
            let cx, cy;
            let valid = false;
            let attempts = 0;
            while (!valid && attempts < 20) {
                valid = true;
                cx = x + 30 + Math.random() * (width - 200);
                cy = y + 30 + Math.random() * (height - 200);
                // Check against other house crates
                houseCrates.forEach(hc => {
                    if (cx < hc.x + 140 && cx + 140 > hc.x && cy < hc.y + 140 && cy + 140 > hc.y) {
                        valid = false;
                    }
                });
                attempts++;
            }
            if (valid) {
                let newCrate = new Crate(cx, cy);
                houseCrates.push(newCrate);
                crates.push(newCrate);
            }
        }
    }

    drawFloor(ctx) {
        if (woodPattern) {
            ctx.save();
            ctx.fillStyle = woodPattern;
            ctx.fillRect(this.x, this.y, this.w, this.h);
            ctx.restore();
        } else {
            ctx.fillStyle = '#654321';
            ctx.fillRect(this.x, this.y, this.w, this.h);
        }
    }

    drawWalls(ctx) {
        ctx.fillStyle = '#333';
        this.walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

        // Draw Doors
        ctx.fillStyle = '#5c3a21'; // Brown door
        this.doors.forEach(d => {
            if (d.isOpen) {
                // Draw opened door (swung 90 degrees)
                if (d.isVertical) ctx.fillRect(d.ox, d.oy, 100, 25);
                else ctx.fillRect(d.ox, d.oy, 25, 100);
            } else {
                ctx.fillRect(d.x, d.y, d.w, d.h);
            }
        });
    }
}

class Tree {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 120 + Math.random() * 60; // Large canopy

        // Generate jagged edges
        this.points = [];
        const numPoints = 15 + Math.floor(Math.random() * 10);
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const variance = 0.85 + Math.random() * 0.15;
            this.points.push({
                x: Math.cos(angle) * this.radius * variance,
                y: Math.sin(angle) * this.radius * variance
            });
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Shadow under tree
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        this.points.forEach(p => ctx.lineTo(p.x + 10, p.y + 10)); // Offset shadow
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 0.5; // Highly transparent so we can see under

        // Dark green base border
        ctx.fillStyle = '#3a5f22';
        ctx.beginPath();
        this.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fill();

        // Lighter green top foliage
        ctx.fillStyle = '#4c7a2d';
        ctx.beginPath();
        this.points.forEach(p => ctx.lineTo(p.x * 0.8, p.y * 0.8));
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 1.0; // Reset alpha for solid trunk

        // Central trunk highlight (optional but adds depth)
        ctx.fillStyle = '#3E2723';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class Bush {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 50 + Math.random() * 30; // Smaller canopy

        this.points = [];
        const numPoints = 10 + Math.floor(Math.random() * 5);
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const variance = 0.8 + Math.random() * 0.2;
            this.points.push({
                x: Math.cos(angle) * this.radius * variance,
                y: Math.sin(angle) * this.radius * variance
            });
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.fillStyle = '#375721';
        ctx.beginPath();
        this.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#48702b';
        ctx.beginPath();
        this.points.forEach(p => ctx.lineTo(p.x * 0.7, p.y * 0.7));
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

let player;
let bullets = [];
let enemies = [];
let crates = [];
let loots = [];
let armors = [];
let bombs = [];
let droppedWeapons = [];
let particles = [];
let houses = [];
let trees = [];
let bushes = [];
let gameLoopId;

// Horde Variables
let currentHorde = 1;
let hordeEnemiesRemaining = 0;
let isHordeActive = false;
let hordeCooldownTimer = 0;
let crateDropTimer = 10000; // Drops 2 crates every 10s

function getValidSpawnPoint(x1, y1, x2, y2) {
    const steps = 15;
    const dx = (x2 - x1) / steps;
    const dy = (y2 - y1) / steps;

    let currentX = x1;
    let currentY = y1;

    for (let i = 0; i < steps; i++) {
        let testX = currentX + dx;
        let testY = currentY + dy;
        let hit = false;

        for (let h of houses) {
            for (let w of h.walls) {
                if (testX > w.x && testX < w.x + w.w && testY > w.y && testY < w.y + w.h) {
                    hit = true; break;
                }
            }
            if (hit) break;
            for (let d of h.doors) {
                if (!d.isOpen && testX > d.x && testX < d.x + d.w && testY > d.y && testY < d.y + d.h) {
                    hit = true; break;
                }
            }
            if (hit) break;
        }

        if (hit) {
            return { x: currentX, y: currentY, hitWall: true };
        }
        currentX = testX;
        currentY = testY;
    }
    return { x: x2, y: y2, hitWall: false };
}

function createParticles(x, y, color, count, isBlood = false) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color, isBlood));
}

function drawArmorIcon(ctx, isHelmet, level) {
    if (!ctx) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw Dark Slate Background Check
    ctx.beginPath();
    ctx.arc(w / 2, 25, w / 2 - 2, 0, Math.PI * 2); // Shift background circle up to y=25
    ctx.fillStyle = '#222831'; // Slate dark grey
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    if (level === 0) {
        // Draw dimmed silhouette to indicate empty
        ctx.globalAlpha = 0.2;
    } else {
        ctx.globalAlpha = 1.0;
    }

    // Draw PNG image if we have it
    const imgList = isHelmet ? armorImgs.helmet : armorImgs.vest;
    const img = imgList[level];
    if (img && img.complete) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(img, w / 2 - 20, 5, 40, 40); // Shifted slightly up to leave room for text
        ctx.globalCompositeOperation = 'source-over'; // Reset
    } else if (level === 0) {
        // Fallback for empty slot - generic white shape silhouette
        ctx.fillStyle = '#ffffff';
        if (isHelmet) {
            ctx.beginPath(); ctx.arc(w / 2, 25, 14, Math.PI, 0); ctx.lineTo(w / 2 + 10, 39); ctx.lineTo(w / 2 - 14, 35); ctx.fill();
        } else {
            ctx.beginPath(); ctx.moveTo(w / 2 - 10, 13); ctx.lineTo(w / 2 - 15, 13); ctx.lineTo(w / 2 - 20, 25); ctx.lineTo(w / 2 - 15, 43); ctx.lineTo(w / 2 + 15, 43); ctx.lineTo(w / 2 + 20, 25); ctx.lineTo(w / 2 + 15, 13); ctx.lineTo(w / 2 + 10, 13); ctx.lineTo(w / 2 + 5, 23); ctx.lineTo(w / 2 - 5, 23); ctx.fill();
        }
    }

    ctx.globalAlpha = 1.0; // Reset

    // Draw text underneath
    ctx.fillStyle = level > 0 ? '#ffffff' : '#888888';
    ctx.font = 'bold 12px Roboto';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv ${level}`, w / 2, h - 5);
}

function updateUI() {
    // Determine interaction prompts globally
    let promptMsg = null;
    let anyWeaponNear = false;
    let anyDoorNear = false;

    droppedWeapons.forEach(w => { if (w.nearPlayer) anyWeaponNear = true; });

    houses.forEach(h => {
        h.doors.forEach(d => {
            if (Math.hypot(player.x - (d.x + d.w / 2), player.y - (d.y + d.h / 2)) < player.radius + 60) {
                anyDoorNear = true;
            }
        });
    });

    if (anyWeaponNear && anyDoorNear) promptMsg = "Press [F] Pick Up | [E] Door";
    else if (anyWeaponNear) promptMsg = "Press [F] to Pick Up";
    else if (anyDoorNear) promptMsg = "Press [E] to Toggle Door";

    if (promptMsg) {
        promptText.textContent = promptMsg;
        interactPrompt.classList.remove('hidden');
    } else {
        interactPrompt.classList.add('hidden');
    }

    const weaponState = player.inventory[player.activeSlotIndex];

    // Update graphical canvases
    drawArmorIcon(helmetCtx, true, player.helmetLevel);
    drawArmorIcon(vestCtx, false, player.vestLevel);

    healthFill.style.width = Math.max(0, (player.health / player.maxHealth) * 100) + '%';
    killDisplay.textContent = kills;
    document.getElementById('horde-number').textContent = currentHorde;
    document.getElementById('horde-remaining').textContent = hordeEnemiesRemaining;

    const timerUI = document.getElementById('horde-timer');
    if (!isHordeActive && hordeCooldownTimer > 0) {
        timerUI.classList.remove('hidden');
        document.getElementById('horde-countdown').textContent = (hordeCooldownTimer / 1000).toFixed(1);
    } else {
        timerUI.classList.add('hidden');
    }

    // Update abilities
    if (killPoints >= 2) ability1.classList.add('ready'); else ability1.classList.remove('ready');
    if (killPoints >= 5) ability2.classList.add('ready'); else ability2.classList.remove('ready');
    if (killPoints >= 10) ability3.classList.add('ready'); else ability3.classList.remove('ready');

    // Update Inventory UI
    invSlots.forEach((slot, index) => {
        const item = player.inventory[index];
        const contentDiv = slot.querySelector('.slot-content');
        contentDiv.innerHTML = ''; // clear

        slot.className = 'inv-slot';
        if (index === player.activeSlotIndex) {
            slot.classList.add('active-slot');
        }

        if (item) {
            // Apply Fortnite rarity background
            slot.classList.add('bg-' + item.type.rarityClass);
            contentDiv.innerHTML = `
                <div class="weapon-name">${item.type.name}</div>
                <div class="ammo-text">${item.ammo}/${item.type.magSize}</div>
            `;
        }
    });
}

function initGame() {
    const nameInput = document.getElementById('player-name').value.trim();
    const playerName = nameInput || "Player 1";

    player = new Bolita(mapSize / 2, mapSize / 2, '#f5d0b5', true, playerName); // Skin tone
    bullets = []; enemies = []; crates = []; loots = []; armors = []; bombs = []; droppedWeapons = []; particles = []; houses = []; trees = []; bushes = [];
    kills = 0; killPoints = 0;
    currentHorde = 1;
    hordeCooldownTimer = 0;
    crateDropTimer = 10000;
    gameStartTime = performance.now();
    showInventory = true;
    interactPrompt.classList.add('hidden');

    // Show HUD
    document.body.classList.remove('in-menu');

    // Spawn houses (need to be before UI update and crate spawn)
    houses.push(new House(mapSize / 2 + 300, mapSize / 2 - 200, 600, 400));
    houses.push(new House(mapSize / 2 - 800, mapSize / 2 + 300, 500, 500));
    houses.push(new House(400, 400, 600, 500));
    houses.push(new House(mapSize - 1000, mapSize - 1000, 700, 600));

    updateUI();

    // Spawn crates outside
    for (let i = 0; i < 80; i++) {
        let cx, cy;
        let valid = false;
        let attempts = 0;

        while (!valid && attempts < 50) {
            valid = true;
            cx = Math.random() * (mapSize - 200);
            cy = Math.random() * (mapSize - 200);

            // House check
            houses.forEach(h => {
                if (cx < h.x + h.w + 50 && cx + 140 > h.x - 50 && cy < h.y + h.h + 50 && cy + 140 > h.y - 50) {
                    valid = false;
                }
            });

            // Distance check from other crates
            if (valid) {
                crates.forEach(c => {
                    if (cx < c.x + 140 && cx + 140 > c.x && cy < c.y + 140 && cy + 140 > c.y) {
                        valid = false;
                    }
                });
            }
            attempts++;
        }

        if (valid) crates.push(new Crate(cx, cy));
    }

    // Spawn environment details
    for (let i = 0; i < 40; i++) {
        let tx, ty;
        let valid = false;
        while (!valid) {
            tx = Math.random() * mapSize;
            ty = Math.random() * mapSize;
            valid = true;
            houses.forEach(h => {
                if (tx > h.x - 180 && tx < h.x + h.w + 180 && ty > h.y - 180 && ty < h.y + h.h + 180) {
                    valid = false;
                }
            });
        }
        trees.push(new Tree(tx, ty));
    }
    for (let i = 0; i < 60; i++) {
        let bx, by;
        let valid = false;
        while (!valid) {
            bx = Math.random() * mapSize;
            by = Math.random() * mapSize;
            valid = true;
            houses.forEach(h => {
                if (bx > h.x - 80 && bx < h.x + h.w + 80 && by > h.y - 80 && by < h.y + h.h + 80) {
                    valid = false;
                }
            });
        }
        bushes.push(new Bush(bx, by));
    }

    // Spawn initial enemies
    startHorde();

    gameState = 'playing';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');

    lastTime = performance.now();
    cancelAnimationFrame(gameLoopId);
    gameLoopId = requestAnimationFrame(gameLoop);
}

function startHorde() {
    isHordeActive = true;
    hordeEnemiesRemaining = 30; // 30 enemies per horde

    for (let i = 0; i < 30; i++) {
        let ex, ey;
        do {
            ex = Math.random() * mapSize;
            ey = Math.random() * mapSize;
        } while (Math.hypot(ex - (mapSize / 2), ey - (mapSize / 2)) < 800 ||
        ex < 200 || ex > mapSize - 200 || ey < 200 || ey > mapSize - 200); // Try to spawn towards the edges somewhat

        enemies.push(new Bolita(ex, ey, '#d44e4e', false, ""));
    }
    updateUI();
}

function spawnGlobalCrate() {
    let cx, cy;
    let valid = false;
    let attempts = 0;

    while (!valid && attempts < 50) {
        valid = true;
        cx = Math.random() * (mapSize - 200);
        cy = Math.random() * (mapSize - 200);

        houses.forEach(h => {
            if (cx < h.x + h.w + 50 && cx + 140 > h.x - 50 && cy < h.y + h.h + 50 && cy + 140 > h.y - 50) {
                valid = false;
            }
        });

        if (valid) {
            crates.forEach(c => {
                if (cx < c.x + 140 && cx + 140 > c.x && cy < c.y + 140 && cy + 140 > c.y) {
                    valid = false;
                }
            });
        }
        attempts++;
    }
    if (valid) crates.push(new Crate(cx, cy));
}

function checkHits() {
    bullets.forEach(b => {
        if (b.markedForDeletion) return;

        let hitTree = false;
        trees.forEach(t => {
            if (Math.hypot(b.x - t.x, b.y - t.y) < b.radius + (t.radius * 0.15)) {
                b.markedForDeletion = true;
                hitTree = true;
            }
        });
        if (hitTree) return;

        if (b.isPlayer) {
            enemies.forEach(e => {
                if (!e.markedForDeletion && Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
                    b.markedForDeletion = true; e.takeDamage(b.damage);
                }
            });
        } else {
            if (Math.hypot(b.x - player.x, b.y - player.y) < b.radius + player.radius) {
                b.markedForDeletion = true;
                player.takeDamage(b.damage);
            }
        }
    });
}

function gameLoop(time) {
    if (gameState !== 'playing') return;
    const dt = time - lastTime; lastTime = time;

    player.update(dt);
    camera.x = Math.max(0, Math.min(mapSize - canvas.width, player.x - canvas.width / 2));
    camera.y = Math.max(0, Math.min(mapSize - canvas.height, player.y - canvas.height / 2));

    bullets.forEach(b => b.update(dt));
    enemies.forEach(e => e.update(dt));
    loots.forEach(l => l.update(dt));
    armors.forEach(a => a.update(dt));
    bombs.forEach(b => b.update(dt));
    droppedWeapons.forEach(w => w.update(dt));
    particles.forEach(p => p.update(dt));

    // Crate Drop Logic (Every 10s)
    crateDropTimer -= dt;
    if (crateDropTimer <= 0) {
        crateDropTimer = 10000;
        for (let i = 0; i < 2; i++) {
            spawnGlobalCrate();
        }
    }

    // Horde Logic
    if (!isHordeActive) {
        hordeCooldownTimer -= dt;
        if (hordeCooldownTimer <= 0) {
            currentHorde++;
            startHorde();
        }
    }

    checkHits();

    // Separate dropped items (Loot, Weapons, Armor)
    let allDrops = [...loots, ...armors, ...droppedWeapons];
    for (let i = 0; i < allDrops.length; i++) {
        for (let j = i + 1; j < allDrops.length; j++) {
            let itemA = allDrops[i];
            let itemB = allDrops[j];
            let dx = itemA.x - itemB.x;
            let dy = itemA.y - itemB.y;
            let dist = Math.hypot(dx, dy);
            let minDist = itemA.radius + itemB.radius + 5;
            if (dist < minDist && dist > 0) {
                let overlap = minDist - dist;
                let nx = dx / dist;
                let ny = dy / dist;
                itemA.x += nx * overlap * 0.1;
                itemA.y += ny * overlap * 0.1;
                itemB.x -= nx * overlap * 0.1;
                itemB.y -= ny * overlap * 0.1;
            }
        }
    }

    // UI updates
    updateUI();

    bullets = bullets.filter(b => !b.markedForDeletion);
    enemies = enemies.filter(e => !e.markedForDeletion);
    crates = crates.filter(c => !c.markedForDeletion);
    loots = loots.filter(l => !l.markedForDeletion);
    armors = armors.filter(a => !a.markedForDeletion);
    bombs = bombs.filter(b => !b.markedForDeletion);
    droppedWeapons = droppedWeapons.filter(w => !w.markedForDeletion);
    particles = particles.filter(p => !p.markedForDeletion || p.isBlood);

    // Draw
    ctx.fillStyle = '#5d9945'; // Off map color
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Base Grass Color (Map Bounds)
    ctx.fillStyle = '#7ab536';
    ctx.fillRect(0, 0, mapSize, mapSize);

    // Surviv Grid Pattern
    ctx.beginPath();
    const gs = 150;

    // Draw horizontal grid lines
    for (let y = 0; y <= mapSize; y += gs) {
        ctx.moveTo(0, y);
        ctx.lineTo(mapSize, y);
    }
    // Draw vertical grid lines
    for (let x = 0; x <= mapSize; x += gs) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, mapSize);
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Map Limits
    ctx.strokeStyle = '#222'; ctx.lineWidth = 15;
    ctx.strokeRect(0, 0, mapSize, mapSize);

    // Layers
    houses.forEach(h => h.drawFloor(ctx));
    particles.filter(p => p.isBlood).forEach(p => p.draw(ctx));
    crates.forEach(c => c.draw(ctx));
    droppedWeapons.forEach(w => w.draw(ctx));
    loots.forEach(l => l.draw(ctx));
    armors.forEach(a => a.draw(ctx));
    particles.filter(p => !p.isBlood).forEach(p => p.draw(ctx));
    bombs.forEach(b => b.draw(ctx));
    enemies.forEach(e => e.draw(ctx));
    bullets.forEach(b => b.draw(ctx));
    if (!player.markedForDeletion) player.draw(ctx);

    // Environment objects that can hide players (Canopies drawn last)
    bushes.forEach(b => b.draw(ctx));
    trees.forEach(t => t.draw(ctx));
    houses.forEach(h => h.drawWalls(ctx)); // Draw walls on top of entities so they hide under roofs

    ctx.restore();

    gameLoopId = requestAnimationFrame(gameLoop);
}

startBtn.addEventListener('click', initGame);
restartBtn.addEventListener('click', () => {
    if (gameState === 'menu') return; // Evitar clicks dobles
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden'); // Ensure the UI menu comes back

    // Clear the previous game state fully so it doesn't bleed through
    player = null;
    bullets = []; enemies = []; crates = []; loots = []; armors = []; bombs = []; droppedWeapons = []; particles = []; houses = []; trees = []; bushes = [];

    // Regenerate menu scene
    generateMenuScene();

    gameState = 'menu';
    menuLastTime = performance.now();
    requestAnimationFrame(menuLoop);
});

// Start Menu Animated Background Scene
let menuTrees = [];
let menuPlayer;
let menuEnemies = [];
let menuBullets = [];
let menuLastTime = performance.now();

function generateMenuScene() {
    menuTrees = [];
    for (let i = 0; i < 20; i++) {
        menuTrees.push(new Tree(Math.random() * 2000, Math.random() * 2000));
    }

    menuPlayer = new Bolita(Math.random() * 1600 + 200, Math.random() * 1600 + 200, '#f5d0b5', true);
    menuPlayer.angle = Math.random() * Math.PI * 2;
    menuPlayer.inventory[0] = { type: WEAPONS.PumpShotgun, ammo: 999 };

    menuEnemies = [];
    for (let i = 0; i < 3; i++) {
        let ex, ey;
        do {
            ex = Math.random() * 2000;
            ey = Math.random() * 2000;
        } while (Math.hypot(ex - menuPlayer.x, ey - menuPlayer.y) < 300); // Keep some distance

        let enemy = new Bolita(ex, ey, '#d44e4e', false);
        enemy.inventory[0] = { type: WEAPONS.AssaultRifle, ammo: 999 };
        enemy.angle = Math.atan2(menuPlayer.y - enemy.y, menuPlayer.x - enemy.x);
        menuEnemies.push(enemy);
    }
    menuBullets = [];
}

function menuLoop(time) {
    if (gameState !== 'menu') return;
    const dt = time - menuLastTime;
    menuLastTime = time;

    // Make enemies randomly shoot towards the center
    menuEnemies.forEach(e => {
        if (time - e.lastShot > 800 + Math.random() * 1500) {
            e.lastShot = time;
            const w = e.inventory[0].type;
            const dx = Math.cos(e.angle);
            const dy = Math.sin(e.angle);
            menuBullets.push(new Bullet(
                e.x + dx * w.len,
                e.y + dy * w.len,
                dx, dy, w.speed, w.damage, false
            ));
        }
    });

    // Update menu bullets
    menuBullets.forEach(b => b.update(dt));
    menuBullets = menuBullets.filter(b => !b.markedForDeletion && b.x > 0 && b.x < 2000 && b.y > 0 && b.y < 2000);

    // Draw Background
    ctx.fillStyle = '#5d9945';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Center the dummy scene on the screen
    ctx.translate((canvas.width / 2) - 1000, (canvas.height / 2) - 1000);

    ctx.fillStyle = '#7ab536';
    ctx.fillRect(0, 0, 2000, 2000);

    ctx.beginPath();
    const gs = 150;
    for (let y = 0; y <= 2000; y += gs) { ctx.moveTo(0, y); ctx.lineTo(2000, y); }
    for (let x = 0; x <= 2000; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, 2000); }
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw entities
    menuPlayer.draw(ctx);
    menuEnemies.forEach(e => e.draw(ctx));
    menuBullets.forEach(b => b.draw(ctx));
    menuTrees.forEach(t => t.draw(ctx));

    ctx.restore();

    requestAnimationFrame(menuLoop);
}

// Start the menu loop immediately
gameState = 'menu';
generateMenuScene();
requestAnimationFrame(menuLoop);

