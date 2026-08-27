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
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

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
            player.tryInteract();
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
    Pistol: { name: 'Pistol 9mm', rarityClass: 'rarity-orange', rarityName: 'Orange', damage: 18, fireRate: 280, magSize: 15, reloadTime: 1200, speed: 1100, spread: 0.04, len: 40, icon: 'pistol' },
    Revolver: { name: 'Revolver', rarityClass: 'rarity-orange', rarityName: 'Orange', damage: 42, fireRate: 450, magSize: 6, reloadTime: 1800, speed: 1300, spread: 0.02, len: 45, icon: 'pistol' },
    SMG: { name: 'SMG', rarityClass: 'rarity-blue', rarityName: 'Blue', damage: 25, fireRate: 85, magSize: 30, reloadTime: 1500, speed: 1300, spread: 0.08, len: 55, icon: 'rifle' },
    AssaultRifle: { name: 'Assault Rifle', rarityClass: 'rarity-blue', rarityName: 'Blue', damage: 24, fireRate: 140, magSize: 30, reloadTime: 2000, speed: 1500, spread: 0.035, len: 65, icon: 'rifle' },
    LMG: { name: 'LMG', rarityClass: 'rarity-green', rarityName: 'Green', damage: 22, fireRate: 110, magSize: 100, reloadTime: 4000, speed: 1400, spread: 0.07, len: 70, icon: 'rifle' },
    BurstRifle: { name: 'Burst Rifle', rarityClass: 'rarity-green', rarityName: 'Green', damage: 22, fireRate: 400, burst: 3, burstDelay: 80, magSize: 30, reloadTime: 2000, speed: 1600, spread: 0.02, len: 65, icon: 'rifle' },
    BoltSniper: { name: 'Bolt Sniper', rarityClass: 'rarity-darkgreen', rarityName: 'Ugly Green', damage: 60, fireRate: 700, magSize: 10, reloadTime: 2500, speed: 2500, spread: 0.01, len: 85, icon: 'sniper' },
    AWP: { name: 'AWP', rarityClass: 'rarity-darkgreen', rarityName: 'Ugly Green', damage: 150, fireRate: 1400, magSize: 5, reloadTime: 3500, speed: 3000, spread: 0.0, len: 90, icon: 'sniper' },
    PumpShotgun: { name: 'Pump Shotgun', rarityClass: 'rarity-red', rarityName: 'Red', damage: 12, fireRate: 900, pellets: 8, magSize: 5, shellByShellReload: true, reloadTime: 500, speed: 1100, spread: 0.22, len: 75, icon: 'shotgun' },
    AutoShotgun: { name: 'Auto Shotgun', rarityClass: 'rarity-red', rarityName: 'Red', damage: 9, fireRate: 320, pellets: 6, magSize: 8, reloadTime: 2500, speed: 1000, spread: 0.28, len: 70, icon: 'shotgun' },
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
const mapSize = 5000;

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
        this.baseSpeed = isPlayer ? 250 : 155; // Slightly faster AI (155)
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

            // Randomized Armor Assignment for Bots:
            // 50% No Armor, 30% Light Armor (lvl 1-2), 20% Heavy Armor (lvl 2-4)
            const armorRoll = Math.random();
            if (armorRoll < 0.50) {
                this.vestLevel = 0;
                this.helmetLevel = 0;
            } else if (armorRoll < 0.80) {
                this.vestLevel = Math.random() < 0.6 ? 1 : 2;
                this.helmetLevel = Math.random() < 0.6 ? 1 : 0;
            } else {
                this.vestLevel = Math.floor(Math.random() * 3) + 2;
                this.helmetLevel = Math.floor(Math.random() * 3) + 1;
            }
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
            // Increased detection range to 520px for slightly higher aggressiveness
            if (distToPlayer < 520) {
                let targetAngle = Math.atan2(player.y - this.y, player.x - this.x);

                // Smooth turning towards player
                this.angle = targetAngle;

                // Check if a house is in the way
                houses.forEach(h => {
                    if (this.x > h.x - 50 && this.x < h.x + h.w + 50 && this.y > h.y - 50 && this.y < h.y + h.h + 50) {
                        this.angle += Math.PI / 2; // Strafe around obstacle
                    }
                });

                // Tactical movement: Strafe & approach smoothly instead of blind rush
                const timeSec = performance.now() / 1000;
                const strafeFactor = Math.sin(timeSec * 2 + this.x) * 0.4;

                if (distToPlayer > 220) {
                    // Approach with tactical strafe
                    const moveAngle = this.angle + strafeFactor;
                    this.x += Math.cos(moveAngle) * this.baseSpeed * (dt / 1000);
                    this.y += Math.sin(moveAngle) * this.baseSpeed * (dt / 1000);
                } else if (distToPlayer < 140) {
                    // Retreat if player gets too close
                    this.x -= Math.cos(this.angle) * this.baseSpeed * (dt / 1000);
                    this.y -= Math.sin(this.angle) * this.baseSpeed * (dt / 1000);
                }
                this.handleWeapon(dt);
            } else { // Wander if player is out of detection range
                this.stateTimer += dt;
                if (this.stateTimer > 2500) {
                    this.wanderAngle = Math.random() * Math.PI * 2;
                    this.stateTimer = 0;
                }
                this.x += Math.cos(this.wanderAngle) * (this.baseSpeed * 0.6) * (dt / 1000);
                this.y += Math.sin(this.wanderAngle) * (this.baseSpeed * 0.6) * (dt / 1000);
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
            if (dist <= this.radius && dist > 0) {
                const overlap = this.radius - dist;
                const nx = (this.x - testX) / dist;
                const ny = (this.y - testY) / dist;
                this.x += nx * overlap;
                this.y += ny * overlap;
            }
        };

        const checkCircleCollision = (cx, cy, cRadius) => {
            const dist = Math.hypot(this.x - cx, this.y - cy);
            if (dist < this.radius + cRadius && dist > 0) {
                const overlap = (this.radius + cRadius) - dist;
                const nx = (this.x - cx) / dist;
                const ny = (this.y - cy) / dist;
                this.x += nx * overlap;
                this.y += ny * overlap;
            }
        };

        // Crates & Barrels
        crates.forEach(c => checkRectCollision(c.x, c.y, c.size, c.size));
        explosiveBarrels.forEach(b => {
            if (!b.markedForDeletion) checkCircleCollision(b.x, b.y, b.radius);
        });

        // Interactive Map Structures
        vendingMachines.forEach(v => checkRectCollision(v.x, v.y, v.w, v.h));
        vaultSafes.forEach(vs => checkRectCollision(vs.x - vs.size / 2, vs.y - vs.size / 2, vs.size, vs.size));
        radarTowers.forEach(rt => checkCircleCollision(rt.x, rt.y, rt.radius));
        turrets.forEach(tu => checkCircleCollision(tu.x, tu.y, tu.radius));
        contractLaptops.forEach(cl => checkCircleCollision(cl.x, cl.y, cl.radius));

        // Nature (Trees Trunk)
        trees.forEach(t => checkCircleCollision(t.x, t.y, t.radius * 0.25));

        // Houses (Walls and Closed Doors)
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
            // Boosted aggressiveness for Elite Contract Boss vs regular bots
            const aiFireRateDelay = this.isElite 
                ? weaponDef.fireRate * 1.5 + (Math.random() * 80)
                : weaponDef.fireRate * 3.2 + (Math.random() * 200);

            if (!this.reloading && weaponState.ammo > 0 && performance.now() - this.lastShot > aiFireRateDelay) {
                // Humanized inaccuracy (sharper aim for Elite Bot, slightly improved for normal bots)
                const aimError = this.isElite ? (Math.random() - 0.5) * 0.10 : (Math.random() - 0.5) * 0.32;
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

    tryInteract() {
        let interacted = false;

        // Radar Towers
        radarTowers.forEach(t => {
            if (!interacted && Math.hypot(this.x - t.x, this.y - t.y) < this.radius + t.radius + 25) {
                t.activate(); interacted = true;
            }
        });

        // Contract Laptops
        contractLaptops.forEach(l => {
            if (!interacted && Math.hypot(this.x - l.x, this.y - l.y) < this.radius + l.radius + 25) {
                l.activate(); interacted = true;
            }
        });

        // Vending Machines
        vendingMachines.forEach(v => {
            if (!interacted && Math.hypot(this.x - (v.x + v.w / 2), this.y - (v.y + v.h / 2)) < this.radius + v.radius + 25) {
                v.activate(); interacted = true;
            }
        });

        // Allied Turrets
        turrets.forEach(tu => {
            if (!interacted && Math.hypot(this.x - tu.x, this.y - tu.y) < this.radius + tu.radius + 25) {
                tu.activate(); interacted = true;
            }
        });

        // Doors
        if (!interacted) {
            houses.forEach(h => {
                h.doors.forEach(d => {
                    if (Math.hypot(this.x - (d.x + d.w / 2), this.y - (d.y + d.h / 2)) < this.radius + 60) {
                        d.isOpen = !d.isOpen; interacted = true;
                    }
                });
            });
        }
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

        // Draw Username label ONLY for player or Elite boss (no labels on normal bots)
        if (this.name && (this.isPlayer || this.isElite)) {
            ctx.fillStyle = this.isPlayer ? '#ffffff' : '#a855f7';
            ctx.font = 'bold 16px Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText(this.name, this.x, this.y + this.radius + 15);
            ctx.shadowBlur = 0; // Reset
        }

        // Overhead Health Bar for Enemy Bots when damaged
        if (!this.isPlayer && this.health < this.maxHealth && this.health > 0) {
            const barWidth = 36;
            const barHeight = 5;
            const bx = this.x - barWidth / 2;
            const by = this.y - this.radius - 12;
            const hpRatio = Math.max(0, this.health / this.maxHealth);

            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(bx - 1, by - 1, barWidth + 2, barHeight + 2);

            ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : (hpRatio > 0.25 ? '#f1c40f' : '#e74c3c');
            ctx.fillRect(bx, by, barWidth * hpRatio, barHeight);

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx - 1, by - 1, barWidth + 2, barHeight + 2);
            ctx.restore();
        }
    }

    takeDamage(baseDamage, hitType = 'body') {
        let finalDamage = baseDamage;

        // Armor mitigation calculations
        const vestMultiplier = [1.0, 0.90, 0.80, 0.70, 0.60];
        const helmetMultiplier = [1.0, 0.80, 0.65, 0.50, 0.35];

        let isHeadshot = (hitType === 'head');
        let textColor = '#ffffff';
        let fontSize = 16;

        if (baseDamage >= 200) {
            // AWP Insta-kill: Ignores armor and hit zones, guaranteed 1-shot kill
            finalDamage = baseDamage;
            textColor = '#ff2222';
            fontSize = 24;
            isHeadshot = true;
        } else if (isHeadshot) {
            const hMult = helmetMultiplier[this.helmetLevel || 0] || 1.0;
            finalDamage = baseDamage * hMult;
            textColor = '#ffcc00'; // Gold for headshots
            fontSize = 20;
        } else if (hitType === 'leg') {
            finalDamage = baseDamage * 0.85;
            textColor = '#dcdcdc';
            fontSize = 14;
        } else {
            const vMult = vestMultiplier[this.vestLevel || 0] || 1.0;
            finalDamage = baseDamage * vMult;
            textColor = (this.vestLevel > 0) ? '#33b5e5' : '#ffffff'; // Cyan if armor absorbed, White if flesh
        }

        finalDamage = Math.max(1, Math.round(finalDamage * 10) / 10);
        this.health -= finalDamage;

        // Visual floating damage text
        createFloatingText(this.x, this.y, `-${Math.round(finalDamage)}`, textColor, fontSize, isHeadshot);

        if (this.isPlayer) updateUI();

        createParticles(this.x, this.y, isHeadshot ? '#ffff00' : '#ff0000', 5, true);

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
                const remainingEnemies = enemies.filter(e => !e.markedForDeletion && e !== this).length;
                hordeEnemiesRemaining = remainingEnemies;
                if (remainingEnemies === 0 && isHordeActive) {
                    isHordeActive = false;
                    hordeCooldownTimer = 10000; // 10 seconds break
                    enemies = []; // Clear map completely during round transition
                    if (!player.markedForDeletion) {
                        createFloatingText(player.x, player.y - 40, "¡HORDA COMPLETADA!", "#00ff00", 26, true);
                    }
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
        this.damage = damage;
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

                    let baseDmg = this.damage;
                    // NPC scaling: NPCs deal 65% damage to player
                    if (!this.isPlayer) {
                        baseDmg = baseDmg * 0.65;
                    }

                    const distToCenter = Math.hypot(this.x - t.x, this.y - t.y);
                    let hitType = 'body';
                    let damageMult = 1.0;

                    if (distToCenter < t.radius * 0.35) {
                        hitType = 'head';
                        // Snipers get 2.0x headshot mult, others 1.5x
                        damageMult = (this.damage >= 60) ? 2.0 : 1.5;
                    } else if (distToCenter > t.radius * 0.75) {
                        hitType = 'leg';
                    }

                    t.takeDamage(baseDmg * damageMult, hitType);
                    createParticles(this.x, this.y, hitType === 'head' ? '#ffcc00' : '#cc0000', 6, true);
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

        // Collide with Explosive Barrels
        if (!this.markedForDeletion) {
            explosiveBarrels.forEach(b => {
                if (!b.markedForDeletion && Math.hypot(this.x - b.x, this.y - b.y) < this.radius + b.radius) {
                    this.markedForDeletion = true;
                    b.takeDamage(this.damage);
                    createParticles(this.x, this.y, '#ff4400', 4);
                }
            });
        }

        // Collide with Vending Machines
        if (!this.markedForDeletion) {
            vendingMachines.forEach(v => {
                if (this.x > v.x && this.x < v.x + v.w && this.y > v.y && this.y < v.y + v.h) {
                    this.markedForDeletion = true;
                    createParticles(this.x, this.y, '#0284c7', 4);
                }
            });
        }

        // Collide with Vault Safes
        if (!this.markedForDeletion) {
            vaultSafes.forEach(vs => {
                if (this.x > vs.x - vs.size / 2 && this.x < vs.x + vs.size / 2 && this.y > vs.y - vs.size / 2 && this.y < vs.y + vs.size / 2) {
                    this.markedForDeletion = true;
                    createParticles(this.x, this.y, '#636e72', 4);
                }
            });
        }

        // Collide with Radar Towers
        if (!this.markedForDeletion) {
            radarTowers.forEach(rt => {
                if (Math.hypot(this.x - rt.x, this.y - rt.y) < rt.radius) {
                    this.markedForDeletion = true;
                    createParticles(this.x, this.y, '#00ffff', 4);
                }
            });
        }

        // Collide with Turrets
        if (!this.markedForDeletion) {
            turrets.forEach(tu => {
                if (Math.hypot(this.x - tu.x, this.y - tu.y) < tu.radius) {
                    this.markedForDeletion = true;
                    createParticles(this.x, this.y, '#4b6584', 4);
                }
            });
        }

        // Collide with Contract Laptops
        if (!this.markedForDeletion) {
            contractLaptops.forEach(cl => {
                if (Math.hypot(this.x - cl.x, this.y - cl.y) < cl.radius) {
                    this.markedForDeletion = true;
                    createParticles(this.x, this.y, '#00ffcc', 4);
                }
            });
        }

        // Collide with Tree Trunks
        if (!this.markedForDeletion) {
            trees.forEach(t => {
                if (Math.hypot(this.x - t.x, this.y - t.y) < t.radius * 0.25) {
                    this.markedForDeletion = true;
                    createParticles(this.x, this.y, '#3e2723', 4);
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
        createFloatingText(this.x + this.size / 2, this.y + this.size / 2, `-${Math.round(amt)}`, '#d2b48c', 14);
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
            const dist = Math.hypot(this.x - e.x, this.y - e.y);
            if (dist < this.maxRadius) {
                const falloff = 1 - (dist / this.maxRadius);
                const explosionDmg = 30 + falloff * 70; // 30-100 damage depending on proximity
                e.takeDamage(explosionDmg, 'body');
            }
        });
        // Damage player
        const playerDist = Math.hypot(this.x - player.x, this.y - player.y);
        if (playerDist < this.maxRadius) {
            const falloff = 1 - (playerDist / this.maxRadius);
            const explosionDmg = 30 + falloff * 70;
            player.takeDamage(explosionDmg, 'body');
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

        // Dynamic alpha: If player is underneath tree canopy, fade to 0.4 so player is visible, otherwise solid vibrant 0.95!
        const distToPlayer = player ? Math.hypot(player.x - this.x, player.y - this.y) : 999;
        ctx.globalAlpha = distToPlayer < this.radius ? 0.45 : 0.95;

        // Shadow under tree
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        this.points.forEach(p => ctx.lineTo(p.x + 12, p.y + 12));
        ctx.closePath();
        ctx.fill();

        // Dark green base canopy border
        ctx.fillStyle = '#2d5016';
        ctx.beginPath();
        this.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fill();

        // Rich green middle foliage
        ctx.fillStyle = '#4c7a2d';
        ctx.beginPath();
        this.points.forEach(p => ctx.lineTo(p.x * 0.82, p.y * 0.82));
        ctx.closePath();
        ctx.fill();

        // Top bright highlight foliage
        ctx.fillStyle = '#5c9337';
        ctx.beginPath();
        this.points.forEach(p => ctx.lineTo(p.x * 0.6, p.y * 0.6));
        ctx.closePath();
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
let floatingTexts = [];
let houses = [];
let trees = [];
let bushes = [];
let radarTowers = [];
let contractLaptops = [];
let vendingMachines = [];
let vaultSafes = [];
let explosiveBarrels = [];
let turrets = [];
let activeRadarTimer = 0;
let activeContract = null;
let gameLoopId;

class RadarTower {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 35;
        this.cooldown = 0;
    }
    update(dt) {
        if (this.cooldown > 0) this.cooldown -= dt;
    }
    activate() {
        if (this.cooldown <= 0) {
            activeRadarTimer = 15000;
            this.cooldown = 35000;
            createFloatingText(this.x, this.y - 20, "📡 RADAR ACTIVADO (15s)", "#00ffff", 20, true);
            createParticles(this.x, this.y, "#00ffff", 25);
        } else {
            createFloatingText(this.x, this.y - 20, `⏳ EN RECARGA (${(this.cooldown/1000).toFixed(0)}s)`, "#ff4444", 16);
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = this.cooldown <= 0 ? '#00e5ff' : '#888';
        ctx.beginPath(); ctx.arc(0, -5, 18, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, -30); ctx.stroke();
        ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.arc(0, -32, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

class ContractLaptop {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 22;
        this.active = true;
    }
    activate() {
        if (!this.active) return;
        const liveBots = enemies.filter(e => !e.markedForDeletion);
        if (liveBots.length === 0) {
            createFloatingText(this.x, this.y - 20, "❌ NO HAY BOTS EN EL MAPA", "#ff4444", 16);
            return;
        }
        const target = liveBots[Math.floor(Math.random() * liveBots.length)];
        target.isElite = true;
        target.color = '#8b5cf6'; // Glowing purple
        target.health = 300; // High HP boss (300 HP)
        target.maxHealth = 300;
        target.vestLevel = 4; // Lv4 Vest
        target.helmetLevel = 4; // Lv4 Helmet
        target.baseSpeed = 175; // Fast tactical speed
        target.inventory[0] = { type: WEAPONS.AssaultRifle, ammo: 999 };
        target.name = "👑 ☠️ BOT ÉLITE SUPREMO";

        activeContract = { target: target, rewardKills: 5 };
        this.active = false;
        createFloatingText(player.x, player.y - 40, "☠️ CONTRATO ACTIVADO: BOT ÉLITE SUPREMO (300 HP)", "#a855f7", 22, true);
        createParticles(this.x, this.y, "#a855f7", 35);
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.active ? '#111' : '#444'; ctx.fillRect(-15, -10, 30, 20);
        ctx.fillStyle = this.active ? '#00ffcc' : '#666'; ctx.fillRect(-12, -22, 24, 14);
        ctx.restore();
    }
}

class VendingMachine {
    constructor(x, y) {
        this.x = x; this.y = y; this.w = 40; this.h = 55; this.radius = 30;
        this.selectedOption = 0;
        this.options = [
            { name: 'Medkit Full HP', cost: 2, type: 'heal' },
            { name: 'Chaleco & Casco Lv4', cost: 3, type: 'armor' },
            { name: 'Sniper AWP', cost: 4, type: 'awp' }
        ];
    }
    activate() {
        const opt = this.options[this.selectedOption];
        if (killPoints >= opt.cost) {
            killPoints -= opt.cost;
            if (opt.type === 'heal') {
                player.health = player.maxHealth;
                createParticles(player.x, player.y, '#00ff00', 30);
            } else if (opt.type === 'armor') {
                player.vestLevel = 4;
                player.helmetLevel = 4;
                createParticles(player.x, player.y, '#00ffff', 30);
            } else if (opt.type === 'awp') {
                player.inventory[player.activeSlotIndex] = { type: WEAPONS.AWP, ammo: WEAPONS.AWP.magSize };
                createParticles(player.x, player.y, '#ffff00', 30);
            }
            updateUI();
            createFloatingText(this.x + 20, this.y - 20, `🛒 COMPRADO: ${opt.name}`, '#00ff00', 18, true);
            this.selectedOption = (this.selectedOption + 1) % this.options.length;
        } else {
            createFloatingText(this.x + 20, this.y - 20, `❌ FALTAN KILLS (Requiere ${opt.cost})`, '#ff3333', 16);
            this.selectedOption = (this.selectedOption + 1) % this.options.length;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#1e272e'; ctx.fillRect(0, 0, this.w, this.h);
        ctx.strokeStyle = '#ffdd59'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, this.w, this.h);
        ctx.fillStyle = '#0284c7'; ctx.fillRect(5, 5, this.w - 10, 25);
        ctx.fillStyle = '#ffdd59'; ctx.font = 'bold 10px Roboto'; ctx.fillText("SHOP", 10, 20);
        ctx.restore();
    }
}

class VaultSafe {
    constructor(x, y) {
        this.x = x; this.y = y; this.size = 45; this.radius = 35;
        this.hackProgress = 0;
        this.isHacked = false;
    }
    hack(dt) {
        if (this.isHacked) return;
        this.hackProgress += (dt / 1000) * 45;
        if (this.hackProgress >= 100) {
            this.isHacked = true;
            this.hackProgress = 100;
            droppedWeapons.push(new DroppedWeapon(this.x + 20, this.y + 20, WEAPONS.AWP, 0));
            droppedWeapons.push(new DroppedWeapon(this.x - 20, this.y + 20, WEAPONS.AutoShotgun, 0));
            armors.push(new ArmorLoot(this.x, this.y + 30, 4, false));
            loots.push(new Loot(this.x + 30, this.y));
            createParticles(this.x, this.y, '#00ff00', 40);
            createFloatingText(this.x, this.y - 20, "🔓 BÚNKER HACKEADO", "#00ff00", 22, true);
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.isHacked ? '#2d3436' : '#636e72';
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        ctx.strokeStyle = this.isHacked ? '#00b894' : '#d63031';
        ctx.lineWidth = 3; ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);
        
        if (!this.isHacked && this.hackProgress > 0) {
            ctx.fillStyle = '#00b894';
            ctx.fillRect(-this.size/2, this.size/2 + 4, (this.size * this.hackProgress) / 100, 5);
        }
        ctx.restore();
    }
}

class ExplosiveBarrel {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 18;
        this.health = 25;
        this.markedForDeletion = false;
    }
    takeDamage(amt) {
        this.health -= amt;
        createFloatingText(this.x, this.y, `-${Math.round(amt)}`, '#ff4444', 14);
        if (this.health <= 0) {
            this.explode();
        }
    }
    explode() {
        if (this.markedForDeletion) return;
        this.markedForDeletion = true;
        createParticles(this.x, this.y, '#ff4400', 35);
        createParticles(this.x, this.y, '#ffff00', 25);
        createParticles(this.x, this.y, '#333333', 20);

        const expRadius = 170;
        enemies.forEach(e => {
            if (Math.hypot(this.x - e.x, this.y - e.y) < expRadius) {
                e.takeDamage(90, 'body');
            }
        });
        if (Math.hypot(this.x - player.x, this.y - player.y) < expRadius) {
            player.takeDamage(75, 'body');
        }
        crates.forEach(c => {
            if (Math.hypot(this.x - (c.x + c.size / 2), this.y - (c.y + c.size / 2)) < expRadius) {
                c.takeDamage(100);
            }
        });
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#d63031'; ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#ffdd59'; ctx.font = 'bold 12px Roboto'; ctx.fillText("🔥", -6, 4);
        ctx.restore();
    }
}

class Turret {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 28;
        this.isActive = false;
        this.angle = 0;
        this.lastShot = 0;
    }
    activate() {
        this.isActive = true;
        createFloatingText(this.x, this.y - 20, "🤖 TORRETA ALIADA ACTIVADA", "#00ff00", 20, true);
        createParticles(this.x, this.y, "#00ff00", 25);
    }
    update(dt) {
        if (!this.isActive) return;
        const liveEnemies = enemies.filter(e => !e.markedForDeletion);
        let nearest = null;
        let minDist = 420;
        liveEnemies.forEach(e => {
            const d = Math.hypot(e.x - this.x, e.y - this.y);
            if (d < minDist) { minDist = d; nearest = e; }
        });

        if (nearest) {
            this.angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
            if (performance.now() - this.lastShot > 220) {
                this.lastShot = performance.now();
                bullets.push(new Bullet(this.x, this.y, this.angle, true, 1400, 24));
                createParticles(this.x, this.y, '#ffff00', 3);
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#4b6584'; ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = this.isActive ? '#20bf6b' : '#eb3b5a'; ctx.lineWidth = 3; ctx.stroke();

        ctx.rotate(this.angle);
        ctx.fillStyle = '#26de81'; ctx.fillRect(0, -4, 26, 8);
        ctx.restore();
    }
}

class FloatingText {
    constructor(x, y, text, color = '#ffffff', fontSize = 16, isHeadshot = false) {
        this.x = x + (Math.random() * 16 - 8);
        this.y = y - 10;
        this.text = text;
        this.color = color;
        this.fontSize = fontSize;
        this.isHeadshot = isHeadshot;
        this.life = 750;
        this.maxLife = 750;
        this.vy = -35;
        this.vx = (Math.random() * 20 - 10);
        this.markedForDeletion = false;
    }
    update(dt) {
        this.life -= dt;
        const sec = dt / 1000;
        this.x += this.vx * sec;
        this.y += this.vy * sec;
        if (this.life <= 0) this.markedForDeletion = true;
    }
    draw(ctx) {
        ctx.save();
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.globalAlpha = alpha;
        ctx.font = `900 ${this.isHeadshot ? Math.round(this.fontSize * 1.3) : this.fontSize}px 'Roboto', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = this.color;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

function createFloatingText(x, y, text, color, fontSize, isHeadshot) {
    floatingTexts.push(new FloatingText(x, y, text, color, fontSize, isHeadshot));
}

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

    radarTowers.forEach(t => {
        if (Math.hypot(player.x - t.x, player.y - t.y) < player.radius + t.radius + 25) {
            promptMsg = t.cooldown <= 0 ? "Press [E] to Activate Radar Scan" : `Radar Cooling Down (${(t.cooldown/1000).toFixed(0)}s)`;
        }
    });

    contractLaptops.forEach(l => {
        if (l.active && Math.hypot(player.x - l.x, player.y - l.y) < player.radius + l.radius + 25) {
            promptMsg = "Press [E] Accept Bounty Contract (☠️)";
        }
    });

    vendingMachines.forEach(v => {
        if (Math.hypot(player.x - (v.x + v.w / 2), player.y - (v.y + v.h / 2)) < player.radius + v.radius + 25) {
            const opt = v.options[v.selectedOption];
            promptMsg = `Press [E] Buy: ${opt.name} (${opt.cost} Kills)`;
        }
    });

    vaultSafes.forEach(vs => {
        if (!vs.isHacked && Math.hypot(player.x - vs.x, player.y - vs.y) < player.radius + vs.radius + 25) {
            promptMsg = `Hold [E] Hack Vault Safe (${Math.round(vs.hackProgress)}%)`;
        }
    });

    turrets.forEach(tu => {
        if (!tu.isActive && Math.hypot(player.x - tu.x, player.y - tu.y) < player.radius + tu.radius + 25) {
            promptMsg = "Press [E] Power Up Allied Turret (🤖)";
        }
    });

    if (!promptMsg) {
        if (anyWeaponNear && anyDoorNear) promptMsg = "Press [F] Pick Up | [E] Door";
        else if (anyWeaponNear) promptMsg = "Press [F] to Pick Up";
        else if (anyDoorNear) promptMsg = "Press [E] to Toggle Door";
    }

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

function getValidSpawnPos(minDist = 140) {
    let px, py, valid;
    let attempts = 0;
    const margin = 350;

    do {
        px = margin + Math.random() * (mapSize - margin * 2);
        py = margin + Math.random() * (mapSize - margin * 2);
        valid = true;

        // Check distance to Houses (Generous 160px padding outside house walls)
        for (let h of houses) {
            if (px > h.x - 160 && px < h.x + h.w + 160 && py > h.y - 160 && py < h.y + h.h + 160) {
                valid = false; break;
            }
        }

        // Check distance to all existing objects (prevent overlaps between crates, barrels, machines, towers, etc.)
        if (valid) {
            const allEntities = [
                ...radarTowers, ...contractLaptops, ...vendingMachines, 
                ...vaultSafes, ...turrets, ...explosiveBarrels, 
                ...crates, ...trees
            ];
            for (let e of allEntities) {
                const ex = e.x + (e.w ? e.w / 2 : e.size ? e.size / 2 : 0);
                const ey = e.y + (e.h ? e.h / 2 : e.size ? e.size / 2 : 0);
                if (Math.hypot(px - ex, py - ey) < minDist) {
                    valid = false; break;
                }
            }
        }

        attempts++;
    } while (!valid && attempts < 150);

    return { x: px, y: py, valid };
}

function initGame(mode = 'solo') {
    const nameInput = document.getElementById('player-name').value.trim();
    const playerName = nameInput || "Player 1";

    player = new Bolita(mapSize / 2, mapSize / 2, '#f5d0b5', true, playerName);
    bullets = []; enemies = []; crates = []; loots = []; armors = []; bombs = []; droppedWeapons = []; particles = []; floatingTexts = []; houses = []; trees = []; bushes = [];
    radarTowers = []; contractLaptops = []; vendingMachines = []; vaultSafes = []; explosiveBarrels = []; turrets = [];
    activeRadarTimer = 0; activeContract = null;
    kills = 0; killPoints = 0;
    currentHorde = 1;
    hordeCooldownTimer = 0;
    crateDropTimer = 10000;
    gameStartTime = performance.now();
    showInventory = true;
    interactPrompt.classList.add('hidden');

    document.body.classList.remove('in-menu');

    // Procedural Houses Spawn with strict 550px minimum distance ratio
    const numHouses = 5 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numHouses; i++) {
        let hw = 450 + Math.random() * 200;
        let hh = 400 + Math.random() * 200;
        let valid = false;
        let attempts = 0;
        let hx, hy;

        while (!valid && attempts < 120) {
            hx = 400 + Math.random() * (mapSize - 1200);
            hy = 400 + Math.random() * (mapSize - 1200);
            valid = true;

            for (let existingH of houses) {
                // Ensure houses do not spawn close to each other (minimum 550px clearance)
                if (hx + hw + 550 > existingH.x && hx < existingH.x + existingH.w + 550 &&
                    hy + hh + 550 > existingH.y && hy < existingH.y + existingH.h + 550) {
                    valid = false; break;
                }
            }
            attempts++;
        }

        if (valid) {
            houses.push(new House(hx, hy, hw, hh));
        }
    }

    updateUI();

    // Procedural Interactive Objects Spawn (Guaranteed no overlaps)
    for (let i = 0; i < 3; i++) {
        let pos = getValidSpawnPos(200);
        if (pos.valid) radarTowers.push(new RadarTower(pos.x, pos.y));
    }

    for (let i = 0; i < 3; i++) {
        let pos = getValidSpawnPos(200);
        if (pos.valid) contractLaptops.push(new ContractLaptop(pos.x, pos.y));
    }

    for (let i = 0; i < 3; i++) {
        let pos = getValidSpawnPos(200);
        if (pos.valid) vendingMachines.push(new VendingMachine(pos.x, pos.y));
    }

    for (let i = 0; i < 3; i++) {
        let pos = getValidSpawnPos(200);
        if (pos.valid) vaultSafes.push(new VaultSafe(pos.x, pos.y));
    }

    for (let i = 0; i < 3; i++) {
        let pos = getValidSpawnPos(200);
        if (pos.valid) turrets.push(new Turret(pos.x, pos.y));
    }

    // Spawn crates cleanly separated first (minDist 150px)
    for (let i = 0; i < 60; i++) {
        let pos = getValidSpawnPos(150);
        if (pos.valid) crates.push(new Crate(pos.x, pos.y));
    }

    // Spawn explosive barrels after crates with strict 180px clearance (guarantees no barrels on crates)
    for (let i = 0; i < 25; i++) {
        let pos = getValidSpawnPos(180);
        if (pos.valid) explosiveBarrels.push(new ExplosiveBarrel(pos.x, pos.y));
    }

    // Spawn fewer, well-spaced trees (35 to 45 trees max)
    const numTrees = 35 + Math.floor(Math.random() * 10);
    for (let i = 0; i < numTrees; i++) {
        let pos = getValidSpawnPos(160);
        if (pos.valid) trees.push(new Tree(pos.x, pos.y));
    }

    // Spawn bushes
    for (let i = 0; i < 45; i++) {
        let pos = getValidSpawnPos(110);
        if (pos.valid) bushes.push(new Bush(pos.x, pos.y));
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
    enemies = []; // Clear any residual enemies
    const enemyCount = 25;
    hordeEnemiesRemaining = enemyCount;

    for (let i = 0; i < enemyCount; i++) {
        let ex, ey;
        do {
            ex = Math.random() * mapSize;
            ey = Math.random() * mapSize;
        } while (Math.hypot(ex - player.x, ey - player.y) < 600 ||
        ex < 200 || ex > mapSize - 200 || ey < 200 || ey > mapSize - 200);

        enemies.push(new Bolita(ex, ey, '#d44e4e', false, `Bot ${i + 1}`));
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
    floatingTexts.forEach(ft => ft.update(dt));
    radarTowers.forEach(rt => rt.update(dt));
    turrets.forEach(tu => tu.update(dt));
    if (activeRadarTimer > 0) activeRadarTimer -= dt;

    if (keys.e) {
        vaultSafes.forEach(vs => {
            if (Math.hypot(player.x - vs.x, player.y - vs.y) < player.radius + vs.radius + 25) {
                vs.hack(dt);
            }
        });
    }

    // Check Contract Target Status
    if (activeContract && activeContract.target && activeContract.target.markedForDeletion) {
        killPoints += activeContract.rewardKills;
        droppedWeapons.push(new DroppedWeapon(activeContract.target.x, activeContract.target.y, WEAPONS.AWP, 0));
        createFloatingText(player.x, player.y - 50, `✅ CONTRATO COMPLETADO (+${activeContract.rewardKills} KILLS)`, "#00ff00", 24, true);
        activeContract = null;
    }

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
        enemies = []; // Ensure 0 enemies roam during round transition break
        hordeEnemiesRemaining = 0;
        if (hordeCooldownTimer <= 0) {
            currentHorde++;
            startHorde();
        }
    } else {
        const activeBots = enemies.filter(e => !e.markedForDeletion);
        hordeEnemiesRemaining = activeBots.length;
        if (activeBots.length === 0) {
            isHordeActive = false;
            hordeCooldownTimer = 10000;
            enemies = [];
            if (!player.markedForDeletion) {
                createFloatingText(player.x, player.y - 40, "¡HORDA COMPLETADA!", "#00ff00", 26, true);
            }
        }
    }

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
    floatingTexts = floatingTexts.filter(ft => !ft.markedForDeletion);
    explosiveBarrels = explosiveBarrels.filter(eb => !eb.markedForDeletion);

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

    for (let y = 0; y <= mapSize; y += gs) {
        ctx.moveTo(0, y); ctx.lineTo(mapSize, y);
    }
    for (let x = 0; x <= mapSize; x += gs) {
        ctx.moveTo(x, 0); ctx.lineTo(x, mapSize);
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = '#222'; ctx.lineWidth = 15;
    ctx.strokeRect(0, 0, mapSize, mapSize);

    // Layers
    houses.forEach(h => h.drawFloor(ctx));
    particles.filter(p => p.isBlood).forEach(p => p.draw(ctx));
    crates.forEach(c => c.draw(ctx));
    explosiveBarrels.forEach(eb => eb.draw(ctx));
    vaultSafes.forEach(vs => vs.draw(ctx));
    vendingMachines.forEach(vm => vm.draw(ctx));
    contractLaptops.forEach(cl => cl.draw(ctx));
    radarTowers.forEach(rt => rt.draw(ctx));
    turrets.forEach(tu => tu.draw(ctx));
    droppedWeapons.forEach(w => w.draw(ctx));
    loots.forEach(l => l.draw(ctx));
    armors.forEach(a => a.draw(ctx));
    particles.filter(p => !p.isBlood).forEach(p => p.draw(ctx));
    bombs.forEach(b => b.draw(ctx));
    enemies.forEach(e => e.draw(ctx));
    bullets.forEach(b => b.draw(ctx));
    if (!player.markedForDeletion) player.draw(ctx);

    // Environment objects that can hide players
    bushes.forEach(b => b.draw(ctx));
    trees.forEach(t => t.draw(ctx));
    houses.forEach(h => h.drawWalls(ctx));
    floatingTexts.forEach(ft => ft.draw(ctx));

    // Draw Active Radar Overlay
    if (activeRadarTimer > 0) {
        ctx.strokeStyle = '#ff0033';
        ctx.lineWidth = 3;
        enemies.forEach(e => {
            if (!e.markedForDeletion) {
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.radius + 14 + Math.sin(performance.now() / 150) * 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = '#ff0033';
                ctx.font = 'bold 12px Roboto';
                ctx.textAlign = 'center';
                ctx.fillText("⚠️ BOT", e.x, e.y - e.radius - 20);
            }
        });
    }

    ctx.restore();

    // Draw Live Minimap on HUD
    drawMinimap();

    gameLoopId = requestAnimationFrame(gameLoop);
}

function drawMinimap() {
    if (!minimapCtx || !player || player.markedForDeletion) return;

    const mw = minimapCanvas.width;
    const mh = minimapCanvas.height;
    const scale = mw / mapSize;

    // Grass Background (Exact Surviv.io style)
    minimapCtx.fillStyle = '#7ab536';
    minimapCtx.fillRect(0, 0, mw, mh);

    // Subtle Grid Overlay
    minimapCtx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    minimapCtx.lineWidth = 1;
    minimapCtx.beginPath();
    const gs = 250;
    for (let y = 0; y <= mapSize; y += gs) {
        minimapCtx.moveTo(0, y * scale); minimapCtx.lineTo(mw, y * scale);
    }
    for (let x = 0; x <= mapSize; x += gs) {
        minimapCtx.moveTo(x * scale, 0); minimapCtx.lineTo(x * scale, mh);
    }
    minimapCtx.stroke();

    // Trees (Dark Olive Green Circles like Surviv.io)
    minimapCtx.fillStyle = '#2d4a1d';
    trees.forEach(t => {
        minimapCtx.beginPath();
        minimapCtx.arc(t.x * scale, t.y * scale, Math.max(2.5, t.radius * 0.08), 0, Math.PI * 2);
        minimapCtx.fill();
    });

    // Bushes
    minimapCtx.fillStyle = 'rgba(90, 160, 45, 0.45)';
    bushes.forEach(b => {
        minimapCtx.beginPath();
        minimapCtx.arc(b.x * scale, b.y * scale, Math.max(2, b.radius * 0.08), 0, Math.PI * 2);
        minimapCtx.fill();
    });

    // Houses (Dark Brown/Grey Buildings with Dark Border)
    houses.forEach(h => {
        minimapCtx.fillStyle = '#3d342b';
        minimapCtx.fillRect(h.x * scale, h.y * scale, h.w * scale, h.h * scale);
        minimapCtx.strokeStyle = '#211a14';
        minimapCtx.lineWidth = 1;
        minimapCtx.strokeRect(h.x * scale, h.y * scale, h.w * scale, h.h * scale);
    });

    // Crates (Tan Squares)
    minimapCtx.fillStyle = '#c49c5e';
    crates.forEach(c => {
        minimapCtx.fillRect(c.x * scale, c.y * scale, Math.max(2, c.size * scale), Math.max(2, c.size * scale));
    });

    // Explosive Barrels (Red Dots)
    minimapCtx.fillStyle = '#ef4444';
    explosiveBarrels.forEach(eb => {
        minimapCtx.fillRect(eb.x * scale - 1, eb.y * scale - 1, 3, 3);
    });

    // Vending Machines / Shops (Cyan Dots)
    minimapCtx.fillStyle = '#00e5ff';
    vendingMachines.forEach(vm => {
        minimapCtx.beginPath();
        minimapCtx.arc((vm.x + vm.w / 2) * scale, (vm.y + vm.h / 2) * scale, 3.5, 0, Math.PI * 2);
        minimapCtx.fill();
    });

    // Radar Towers & Vault Safes
    minimapCtx.fillStyle = '#ffc107';
    radarTowers.forEach(rt => {
        minimapCtx.beginPath();
        minimapCtx.arc(rt.x * scale, rt.y * scale, 3.5, 0, Math.PI * 2);
        minimapCtx.fill();
    });

    minimapCtx.fillStyle = '#8b5cf6';
    vaultSafes.forEach(vs => {
        minimapCtx.fillRect(vs.x * scale - 2, vs.y * scale - 2, 4, 4);
    });

    // Blinking Red Bot Radar Pings when activeRadarTimer > 0 (Fast Pulsing opacity like Surviv.io!)
    if (activeRadarTimer > 0) {
        const flashAlpha = 0.35 + Math.sin(performance.now() / 70) * 0.65;
        minimapCtx.fillStyle = `rgba(239, 68, 68, ${flashAlpha})`;
        enemies.forEach(e => {
            if (!e.markedForDeletion) {
                minimapCtx.beginPath();
                minimapCtx.arc(e.x * scale, e.y * scale, e.isElite ? 6 : 4, 0, Math.PI * 2);
                minimapCtx.fill();
            }
        });
    }

    // Highlight Bot Élite if contract is active
    if (activeContract && activeContract.target && !activeContract.target.markedForDeletion) {
        const elite = activeContract.target;
        const pulseAlpha = 0.5 + Math.sin(performance.now() / 100) * 0.5;
        minimapCtx.fillStyle = `rgba(168, 85, 247, ${pulseAlpha})`;
        minimapCtx.beginPath();
        minimapCtx.arc(elite.x * scale, elite.y * scale, 6, 0, Math.PI * 2);
        minimapCtx.fill();
        minimapCtx.strokeStyle = '#ffffff';
        minimapCtx.lineWidth = 1.5;
        minimapCtx.stroke();
    }

    // Player Icon (Exact Surviv.io style: Yellow circle with white & black outline ring!)
    const px = player.x * scale;
    const py = player.y * scale;

    // Direction line
    minimapCtx.beginPath();
    minimapCtx.moveTo(px, py);
    minimapCtx.lineTo((player.x + Math.cos(player.angle) * 160) * scale, (player.y + Math.sin(player.angle) * 160) * scale);
    minimapCtx.strokeStyle = '#22c55e';
    minimapCtx.lineWidth = 2;
    minimapCtx.stroke();

    // Outer black ring
    minimapCtx.fillStyle = '#000000';
    minimapCtx.beginPath();
    minimapCtx.arc(px, py, 6, 0, Math.PI * 2);
    minimapCtx.fill();

    // Inner white ring
    minimapCtx.fillStyle = '#ffffff';
    minimapCtx.beginPath();
    minimapCtx.arc(px, py, 4.5, 0, Math.PI * 2);
    minimapCtx.fill();

    // Center yellow dot
    minimapCtx.fillStyle = '#ffea00';
    minimapCtx.beginPath();
    minimapCtx.arc(px, py, 3.2, 0, Math.PI * 2);
    minimapCtx.fill();
}

// PeerJS Online Multiplayer Co-op System
let peer = null;
let peerConnections = [];
let roomCode = null;

function setupHostMultiplayer() {
    roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    const roomHud = document.getElementById('room-code-hud');
    const roomDisplay = document.getElementById('room-code-display');

    if (roomHud && roomDisplay) {
        roomDisplay.textContent = `#${roomCode}`;
        roomHud.classList.remove('hidden');
    }

    if (typeof Peer !== 'undefined') {
        if (peer) peer.destroy();
        peer = new Peer(`bolitas-room-${roomCode}`);

        peer.on('open', () => {
            createFloatingText(player.x, player.y - 40, `🌐 SALA CREADA: #${roomCode}`, '#00ffcc', 24, true);
        });

        peer.on('connection', (conn) => {
            peerConnections.push(conn);

            const allyName = conn.metadata && conn.metadata.name ? conn.metadata.name : `AMIGO ONLINE`;
            const onlineAlly = new Bolita(player.x + 60, player.y + 40, '#00e5ff', false, allyName);
            onlineAlly.isAlly = true;
            onlineAlly.isOnlinePlayer = true;
            onlineAlly.conn = conn;
            onlineAlly.inventory[0] = { type: WEAPONS.AssaultRifle, ammo: 999 };
            enemies.push(onlineAlly);

            createFloatingText(player.x, player.y - 60, `✅ ¡${allyName} SE UNIÓ A LA PARTIDA!`, '#00ff00', 24, true);

            conn.on('data', (data) => {
                if (data.type === 'move') {
                    onlineAlly.x = data.x;
                    onlineAlly.y = data.y;
                    onlineAlly.angle = data.angle;
                }
            });

            conn.on('close', () => {
                onlineAlly.markedForDeletion = true;
                createFloatingText(player.x, player.y - 60, `❌ ¡${allyName} SE DESCONECTÓ!`, '#ff4444', 20);
            });
        });
    }
}

function joinMultiplayerRoom(code) {
    const cleanCode = code.trim().replace('#', '');
    if (!cleanCode) return;

    if (typeof Peer === 'undefined') {
        alert('❌ Cargando sistema multijugador... Inténtalo de nuevo en 2 segundos.');
        return;
    }

    if (peer) peer.destroy();
    peer = new Peer();

    peer.on('open', () => {
        const playerName = document.getElementById('player-name').value.trim() || "Amigo Online";
        const conn = peer.connect(`bolitas-room-${cleanCode}`, { metadata: { name: playerName } });

        conn.on('open', () => {
            document.getElementById('join-room-modal').classList.add('hidden');
            document.getElementById('start-screen').classList.add('hidden');

            initGame('solo');

            createFloatingText(player.x, player.y - 40, `✅ ¡CONECTADO A LA SALA #${cleanCode}!`, '#00ff00', 24, true);

            // Send player movement to Host
            setInterval(() => {
                if (conn && player && !player.markedForDeletion) {
                    conn.send({
                        type: 'move',
                        x: player.x,
                        y: player.y,
                        angle: player.angle
                    });
                }
            }, 40);
        });

        conn.on('error', () => {
            alert(`❌ No se encontró la sala #${cleanCode}. Verifica que el anfitrión haya hecho clic en Play Duo o Play +3.`);
        });
    });
}

// Surviv.io GUI Menu Event Listeners
const btnSolo = document.getElementById('start-btn-solo');
const btnDuo = document.getElementById('start-btn-duo');
const btnPlus3 = document.getElementById('start-btn-plus3');
const btnJoinRoom = document.getElementById('join-room-btn');
const btnHowToPlay = document.getElementById('how-to-play-btn');
const btnCloseModal = document.getElementById('close-modal-btn');
const btnConnectRoom = document.getElementById('connect-room-btn');
const btnCancelJoin = document.getElementById('cancel-join-btn');

const modalHowToPlay = document.getElementById('how-to-play-modal');
const modalJoinRoom = document.getElementById('join-room-modal');

if (btnSolo) btnSolo.addEventListener('click', () => initGame('solo'));
if (btnDuo) btnDuo.addEventListener('click', () => {
    initGame('duo');
    setupHostMultiplayer();
});
if (btnPlus3) btnPlus3.addEventListener('click', () => {
    initGame('plus3');
    setupHostMultiplayer();
});

if (btnJoinRoom) {
    btnJoinRoom.addEventListener('click', () => {
        if (modalJoinRoom) modalJoinRoom.classList.remove('hidden');
    });
}

if (btnConnectRoom) {
    btnConnectRoom.addEventListener('click', () => {
        const inputCode = document.getElementById('room-code-input').value;
        joinMultiplayerRoom(inputCode);
    });
}

if (btnCancelJoin) {
    btnCancelJoin.addEventListener('click', () => {
        if (modalJoinRoom) modalJoinRoom.classList.add('hidden');
    });
}

if (btnHowToPlay) {
    btnHowToPlay.addEventListener('click', () => {
        if (modalHowToPlay) modalHowToPlay.classList.remove('hidden');
    });
}

if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
        if (modalHowToPlay) modalHowToPlay.classList.add('hidden');
    });
}
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
    particles.forEach(p => p.update(dt));
    floatingTexts.forEach(ft => ft.update(dt));
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

