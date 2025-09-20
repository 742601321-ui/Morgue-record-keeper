"use strict";

// 画布与上下文
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// 背景图片
const backgroundImage = new Image();
backgroundImage.src = "picturepicture/beijing.png";

// 背景音乐
const bgm = new Audio();
bgm.src = "picturepicture/bgm.mp3";
bgm.loop = true;
bgm.volume = 0.5; // 设置音量为50%

// 尸体图片
const corpseImage = new Image();
corpseImage.src = "picturepicture/shiti1.png";

// 电闪雷鸣效果
const lightningEffect = {
    active: false,
    intensity: 0,
    duration: 0,
    maxDuration: 0.3, // 闪电持续时间（秒）
    cooldown: 0,
    maxCooldown: 3 + Math.random() * 5, // 闪电间隔（3-8秒）
    lastFlash: 0
};

// 音频事件监听
bgm.addEventListener('canplaythrough', () => {
    console.log('背景音乐加载完成，可以播放');
});

bgm.addEventListener('error', (e) => {
    console.error('背景音乐加载失败:', e);
});

bgm.addEventListener('loadstart', () => {
    console.log('开始加载背景音乐...');
});

// 玩家图片配置
const playerConfig = {
    idle: new Image(),
    walkLeft: [],
    walkRight: [],
    size: 52, // 玩家图片尺寸（像素）
    animationSpeed: 0.15, // 动画播放速度（秒/帧）
    currentFrame: 0,
    lastFrameTime: 0,
    isMoving: false,
    facing: 'right' // 'left' 或 'right'
};

// 加载玩家图片
playerConfig.idle.src = "picturepicture/player_idle.png";

// 加载走路动画图片
for (let i = 1; i <= 6; i++) {
    const leftImg = new Image();
    leftImg.src = `picturepicture/player_walk_left${i}.png`;
    playerConfig.walkLeft.push(leftImg);
    
    const rightImg = new Image();
    rightImg.src = `picturepicture/player_walk_right${i}.png`;
    playerConfig.walkRight.push(rightImg);
}

// HUD 引用
const clockEl = document.getElementById("clock");
const anomalyCountEl = document.getElementById("anomalyCount");
const batteryEl = document.getElementById("battery");
const staminaEl = document.getElementById("stamina");
const healthHearts = document.getElementById("healthHearts");
const pauseOverlay = document.getElementById("pauseOverlay");
const interactHint = document.getElementById("interactHint");
const workbenchOverlay = document.getElementById("workbenchOverlay");
const narrativeBar = document.getElementById("narrativeBar");
const btnCloseWorkbench = document.getElementById("btnCloseWorkbench");
const recordForm = document.getElementById("recordForm");
const formLocker = document.getElementById("formLocker");
const formType = document.getElementById("formType");
const formNote = document.getElementById("formNote");
const btnRestart = document.getElementById("btnRestart");

const observeOverlay = document.getElementById("observeOverlay");
const btnConfirmAnomaly = document.getElementById("btnConfirmAnomaly");
const btnCloseObserve = document.getElementById("btnCloseObserve");
const obsLocker = document.getElementById("obsLocker");
const obsType = document.getElementById("obsType");

// 适配尺寸
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// 输入
const input = { up: false, down: false, left: false, right: false, sprint: false, toggleFlash: false, paused: false };
window.addEventListener("keydown", (e) => {
    if (e.key === "w" || e.key === "ArrowUp") input.up = true;
    if (e.key === "s" || e.key === "ArrowDown") input.down = true;
    if (e.key === "a" || e.key === "ArrowLeft") input.left = true;
    if (e.key === "d" || e.key === "ArrowRight") input.right = true;
    if (e.key === "Shift") input.sprint = true;
    if (e.key === "f" || e.key === "F") toggleFlashlight();
    if (e.key === "Escape") togglePause();
});
window.addEventListener("keyup", (e) => {
    if (e.key === "w" || e.key === "ArrowUp") input.up = false;
    if (e.key === "s" || e.key === "ArrowDown") input.down = false;
    if (e.key === "a" || e.key === "ArrowLeft") input.left = false;
    if (e.key === "d" || e.key === "ArrowRight") input.right = false;
    if (e.key === "Shift") input.sprint = false;
});

// 世界参数
const world = {
    tile: 48,
    width: 28, // 列
    height: 16, // 行
};

// 地图: 简化为通道与房间矩形，用 0/1 表示是否可走
const grid = (() => {
    const w = world.width, h = world.height;
    const g = Array.from({ length: h }, () => Array.from({ length: w }, () => 0));
    // 构造走廊（仅指定走廊为可走，其余保持不可走）
    // 主水平走廊：y = 6, 7（两格宽）
    for (let x = 1; x < w - 1; x++) {
        g[6][x] = 1;
        g[7][x] = 1;
        g[8][x] = 1;
        g[9][x] = 1;
    }
    // 垂直走廊：连接上下房间列，x = 12, 20, 28
    const corridorXs = [12, 20, 28];
    for (const cx of corridorXs) {
        for (let y = 2; y < h - 2; y++) {
            g[y][cx] = 1;
        }
    }
    // 房间块（停尸间）：设为不可走（保持为0），仅走廊可走
    const rooms = [
        { x: 6, y: 4, w: 6, h: 4 },
        { x: 14, y: 4, w: 6, h: 4 },
        { x: 22, y: 4, w: 6, h: 4 },
        { x: 6, y: 10, w: 6, h: 4 },
        { x: 14, y: 10, w: 6, h: 4 },
        { x: 22, y: 10, w: 6, h: 4 },
    ];
    
    // 工作台区域：设为可行走
    const workbenchGrid = { x: 27, y: 7, w: 3, h: 2 };
    for (let y = workbenchGrid.y; y < workbenchGrid.y + workbenchGrid.h; y++) {
        for (let x = workbenchGrid.x; x < workbenchGrid.x + workbenchGrid.w; x++) {
            if (y >= 0 && y < h && x >= 0 && x < w) {
                g[y][x] = 1; // 工作台区域可行走
            }
        }
    }
    
    
    // 不再把房间设置为1，保持为0 即不可走
    return g;
})();

// 实体：冷柜与工作台
const lockers = []; // 冷柜数组（矩形）
const workbench = { x: world.tile * 25, y: world.tile * 7, w: world.tile * 3, h: world.tile * 2 };

// 在每个房间里放置几组冷柜（简单矩形）
function populateLockers() {
    // 调整冷柜位置以适配背景中央区域
    const roomDefs = [
        { x: 6, y: 4, w: 6, h: 4 },
        { x: 14, y: 4, w: 6, h: 4 },
        { x: 22, y: 4, w: 6, h: 4 },
        { x: 6, y: 11, w: 6, h: 4 },
        { x: 14, y: 11, w: 6, h: 4 },
        { x: 22, y: 11, w: 6, h: 4 },
    ];
    for (const r of roomDefs) {
        const baseX = r.x * world.tile + 10;
        const baseY = r.y * world.tile + 10;
        for (let i = 0; i < 3; i++) {
            lockers.push({
                x: baseX + i * (world.tile * 1.7),
                y: baseY,
                w: world.tile * 1.4,
                h: world.tile * 1.8,
                label: `R${r.x}-${r.y}-L${i+1}`,
            });
        }
    }
}
populateLockers();

// 玩家
const player = {
    x: world.tile * 4,
    y: world.tile * 8,
    radius: 12,
    speed: 140, // px/s
    stamina: 100,
    battery: 100,
    flashlightOn: true,
    dir: { x: 1, y: 0 },
    health: 2,
};

// 时间系统（24 小时制），时间流速：1 分钟 = 30 秒
const timeSystem = {
    minutePerRealSecond: 5 / 60, // 1 game min = 3 real sec => 20 game min per real minute => 20/60 per real second
    minutes: 0, // 从 00:00 开始
    totalDays: 5, // 游戏总天数
};

// 开场剧情与引导
let introState = {
    active: true,               // 是否处于剧情阶段
    reachedSpot: false,         // 是否到达光点
    startedTyping: false,       // 是否已开始逐行播放文本
    finished: false,            // 是否剧情结束
};
const introLines = [
    "河畔镇综合医院。你是艾利克斯，这里是停尸馆。你的新办公室。",
    "你的前任，卡尔，一周前死在了这里。他们说，是心脏病。现在，这是你的问题了。祝你好运。"
];
let introLineIndex = 0;
let lastTypeTime = 0;
let currentShown = "";
const TYPE_INTERVAL = 40; // 毫秒/字符
const LINE_DELAY = 700;   // 毫秒/行间停顿
let nextLineAt = 0;

function formatClock(m) {
    const hh = Math.floor(m / 60) % 24;
    const mm = Math.floor(m % 60);
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

function getCurrentDay() {
    return Math.floor(timeSystem.minutes / (24 * 60)) + 1;
}

function getCurrentDayProgress() {
    return (timeSystem.minutes % (24 * 60)) / (24 * 60);
}

// 暂停
function togglePause() {
    input.paused = !input.paused;
    pauseOverlay.classList.toggle("hidden", !input.paused);
    
    // 控制背景音乐播放/暂停
    if (input.paused) {
        stopBGM();
    } else {
        playBGM();
    }
}

// 手电
function toggleFlashlight() {
    player.flashlightOn = !player.flashlightOn;
}

// 简易碰撞
function isWalkable(nx, ny) {
    const tx = Math.floor(nx / world.tile);
    const ty = Math.floor(ny / world.tile);
    if (ty < 0 || ty >= world.height || tx < 0 || tx >= world.width) return false;
    return grid[ty][tx] === 1;
}

// 更新
let last = performance.now();
function update(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (input.paused) return;

    // 剧情未结束前不推进游戏时间
    if (!introState.active) {
        timeSystem.minutes += (timeSystem.minutePerRealSecond * dt * 60);
        clockEl.textContent = formatClock(timeSystem.minutes);
    }

    // 玩家移动
    let vx = 0, vy = 0;
    if (input.up) vy -= 1;
    if (input.down) vy += 1;
    if (input.left) vx -= 1;
    if (input.right) vx += 1;
    let len = Math.hypot(vx, vy);
    if (len > 0) { 
        vx /= len; 
        vy /= len; 
        player.dir.x = vx; 
        player.dir.y = vy;
        
        // 更新玩家朝向和移动状态
        playerConfig.isMoving = true;
        if (vx < 0) {
            playerConfig.facing = 'left';
        } else if (vx > 0) {
            playerConfig.facing = 'right';
        }
    } else {
        playerConfig.isMoving = false;
    }

    let spd = player.speed;
    if (input.sprint && player.stamina > 0) {
        spd *= 1.5;
        player.stamina -= 25 * dt;
    } else {
        player.stamina += 12 * dt;
    }
    player.stamina = Math.max(0, Math.min(100, player.stamina));

    const nx = player.x + vx * spd * dt;
    const ny = player.y + vy * spd * dt;
    if (isWalkable(nx, player.y)) player.x = nx;
    if (isWalkable(player.x, ny)) player.y = ny;

    // 手电电池消耗
    if (player.flashlightOn) player.battery -= 4 * dt; else player.battery += 8 * dt;
    player.battery = Math.max(0, Math.min(100, player.battery));
    if (player.battery <= 0) player.flashlightOn = false;
    
    // 更新玩家动画
    updatePlayerAnimation(now);
    
    // 更新电闪雷鸣效果
    updateLightningEffect(now);

    // HUD
    staminaEl.textContent = `${Math.round(player.stamina)}%`;
    batteryEl.textContent = `${Math.round(player.battery)}%`;
    anomalyCountEl.textContent = `0 / 3`; // 占位，后续接入异常系统
    if (healthHearts) healthHearts.textContent = "❤".repeat(player.health);
    // 显示当前天数
    const day = getCurrentDay();
    if (day <= timeSystem.totalDays) {
        clockEl.textContent = `第${day}天 ${formatClock(timeSystem.minutes)}`;
    } else {
        clockEl.textContent = "游戏结束";
    }
}

// 渲染
function drawGrid() {
    // 绘制背景图片
    if (backgroundImage.complete) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
        // 如果图片未加载完成，使用默认背景色
        ctx.fillStyle = "#0e1116";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawLockers() {
    for (const l of lockers) {
        // 根据是否有尸体/异常改变颜色
        let fill = "#2a323c";
        if (l.bodyId != null) fill = "#303a45";
        // 异常渲染策略：
        // - 已确认异常：始终红色显示
        // - 未确认异常：仅在手电光锥内才红色显示
        if (l.activeAnomaly) {
            const anomaly = anomalies.find(a => a.lockerIndex === lockers.indexOf(l));
            const cx = l.x + l.w / 2;
            const cy = l.y + l.h / 2;
            const showRed = anomaly && (anomaly.confirmed || isPointInFlashlight(cx, cy));
            if (showRed) fill = "#3a3131";
        }
        ctx.fillStyle = fill;
        ctx.fillRect(l.x, l.y, l.w, l.h);
        
        // 如果有尸体，绘制尸体图片
        if (l.bodyId != null && corpseImage.complete) {
            // 计算尸体图片的位置和大小，保持纵横比缩放
            const maxWidth = l.w * 0.8;
            const maxHeight = l.h * 0.8;
            
            // 计算缩放比例，保持纵横比
            const scaleX = maxWidth / corpseImage.width;
            const scaleY = maxHeight / corpseImage.height;
            const scale = Math.min(scaleX, scaleY); // 使用较小的缩放比例确保图片完全适合
            
            const corpseWidth = corpseImage.width * scale;
            const corpseHeight = corpseImage.height * scale;
            
            // 居中显示
            const corpseX = l.x + (l.w - corpseWidth) / 2;
            const corpseY = l.y + (l.h - corpseHeight) / 2;
            
            ctx.drawImage(corpseImage, corpseX, corpseY, corpseWidth, corpseHeight);
        }
        
        // 标签/编号
        ctx.fillStyle = "#a7b3c3";
        ctx.font = "12px system-ui";
        ctx.fillText(l.label, l.x + 6, l.y + l.h - 8);

        // 手电照射时显示异常类型
        if (l.activeAnomaly) {
            const idx = lockers.indexOf(l);
            const anomaly = anomalies.find(a => a.lockerIndex === idx);
            if (anomaly) {
                const visible = anomaly.confirmed || isPointInFlashlight(l.x + l.w / 2, l.y + l.h / 2);
                if (visible) {
                    ctx.fillStyle = "#ff8b8b";
                    ctx.fillText(`${getAnomalyChineseName(anomaly.type)}`, l.x + 8, l.y + 16);
                }
            }
        }
    }

    // 工作台
    ctx.fillStyle = "#243041";
    ctx.fillRect(workbench.x, workbench.y, workbench.w, workbench.h);
    ctx.strokeStyle = "#3b4b63";
    ctx.strokeRect(workbench.x, workbench.y, workbench.w, workbench.h);
}

function drawPlayer() {
    const imageSize = playerConfig.size;
    let currentImage = null;
    
    // 根据移动状态和朝向选择图片
    if (playerConfig.isMoving) {
        // 移动时使用走路动画
        const walkFrames = playerConfig.facing === 'left' ? playerConfig.walkLeft : playerConfig.walkRight;
        if (walkFrames.length > 0 && walkFrames[playerConfig.currentFrame] && walkFrames[playerConfig.currentFrame].complete) {
            currentImage = walkFrames[playerConfig.currentFrame];
        }
    } else {
        // 静止时使用待机图片
        if (playerConfig.idle.complete) {
            currentImage = playerConfig.idle;
        }
    }
    
    // 绘制玩家图片
    if (currentImage) {
        ctx.drawImage(currentImage, 
            player.x - imageSize / 2, 
            player.y - imageSize / 2, 
            imageSize, 
            imageSize
        );
    } else {
        // 如果图片未加载完成，使用默认圆形
        ctx.fillStyle = "#c7d2fe";
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // 朝向小箭头
    ctx.strokeStyle = "#9aa6ff";
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + player.dir.x * 20, player.y + player.dir.y * 20);
    ctx.stroke();
}

// 更新电闪雷鸣效果
function updateLightningEffect(now) {
    const dt = (now - lightningEffect.lastFlash) / 1000;
    lightningEffect.lastFlash = now;
    
    if (lightningEffect.active) {
        // 闪电进行中
        lightningEffect.duration += dt;
        if (lightningEffect.duration >= lightningEffect.maxDuration) {
            lightningEffect.active = false;
            lightningEffect.duration = 0;
            lightningEffect.cooldown = 0;
            lightningEffect.maxCooldown = 3 + Math.random() * 5; // 下次闪电间隔
        } else {
            // 计算闪电强度（快速闪烁效果）
            const progress = lightningEffect.duration / lightningEffect.maxDuration;
            lightningEffect.intensity = Math.sin(progress * Math.PI * 8) * (1 - progress);
        }
    } else {
        // 冷却中
        lightningEffect.cooldown += dt;
        if (lightningEffect.cooldown >= lightningEffect.maxCooldown) {
            // 触发闪电
            lightningEffect.active = true;
            lightningEffect.intensity = 1;
            lightningEffect.duration = 0;
            lightningEffect.maxDuration = 0.1 + Math.random() * 0.4; // 0.1-0.5秒
        }
    }
}

// 绘制电闪雷鸣效果
function drawLightningEffect() {
    if (lightningEffect.active && lightningEffect.intensity > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = lightningEffect.intensity * 0.3;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
}

// 绘制暗化覆盖层
function drawDarknessOverlay() {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.4; // 暗化程度（从0.7降低到0.4）
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

// 更新玩家动画
function updatePlayerAnimation(now) {
    if (playerConfig.isMoving) {
        // 移动时更新动画帧
        if (now - playerConfig.lastFrameTime >= playerConfig.animationSpeed * 1000) {
            playerConfig.currentFrame = (playerConfig.currentFrame + 1) % 6; // 6帧循环
            playerConfig.lastFrameTime = now;
        }
    } else {
        // 静止时重置到第一帧
        playerConfig.currentFrame = 0;
    }
}

function drawFlashlight() {
    if (!player.flashlightOn) return;
    const angle = Math.atan2(player.dir.y, player.dir.x);
    const fov = Math.PI / 3; // 60 度圆锥
    const dist = 220 + (player.battery * 1.2);

    const gradient = ctx.createRadialGradient(player.x, player.y, 8, player.x, player.y, dist);
    gradient.addColorStop(0, "rgba(255,255,255,0.4)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.2)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.arc(player.x, player.y, dist, angle - fov / 2, angle + fov / 2);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
}

// 判断点是否在手电光锥内
function isPointInFlashlight(px, py) {
    if (!player.flashlightOn) return false;
    const angle = Math.atan2(player.dir.y, player.dir.x);
    const fov = Math.PI / 3; // 与 drawFlashlight 一致
    const dist = 220 + (player.battery * 1.2);
    const dx = px - player.x;
    const dy = py - player.y;
    const d = Math.hypot(dx, dy);
    if (d > dist) return false;
    const a = Math.atan2(dy, dx);
    let da = Math.abs(a - angle);
    // 角度归约到 [0, PI]
    da = Math.min(da, Math.abs(2 * Math.PI - da));
    return da <= fov / 2;
}

function render() {
    drawGrid();
    drawLockers();
    drawLockerTemps();
    drawPlayer();
    drawFlashlight();
    drawIntroSpot();
    drawLightningEffect();
    drawDarknessOverlay();
}

// 主循环
function loop(now) {
    update(now);
    render();
    requestAnimationFrame(loop);
}

// 交互：靠近工作台显示提示，按 E 打开/关闭
function isNearWorkbench(px, py) {
    const margin = 24;
    return (
        px > workbench.x - margin && px < workbench.x + workbench.w + margin &&
        py > workbench.y - margin && py < workbench.y + workbench.h + margin
    );
}

let workbenchOpen = false;
function openWorkbench() {
    workbenchOpen = true;
    workbenchOverlay.classList.remove("hidden");
    // 暂停游戏时间
    input.paused = true;
    // 填充异常类型下拉
    rebuildTypeSelectOptions();
    // 填充柜位下拉（显示所有柜位序列）
    rebuildLockerSelectOptions();
}
function closeWorkbench() {
    workbenchOpen = false;
    workbenchOverlay.classList.add("hidden");
    // 恢复游戏时间
    input.paused = false;
}

window.addEventListener("keydown", (e) => {
    if (e.key === "e" || e.key === "E") {
        if (workbenchOpen) closeWorkbench();
        else if (isNearWorkbench(player.x, player.y)) openWorkbench();
    }
});
btnCloseWorkbench.addEventListener("click", () => closeWorkbench());
window.addEventListener("keydown", (e) => { if (e.key === "Escape" && workbenchOpen) closeWorkbench(); });

// 每帧更新交互提示
const originalUpdate = update;
update = function(now) {
    originalUpdate(now);
    if (input.paused) {
        interactHint.classList.add("hidden");
        return;
    }
    const near = isNearWorkbench(player.x, player.y);
    interactHint.classList.toggle("hidden", introState.active || !near || workbenchOpen);
    // 进度系统更新
    if (!introState.active) updateBodiesAndAnomalies(now);
    updateIntro(now);
};

// -----------------------------
// 尸体接收与异常系统（并发上限 3）
// -----------------------------

let bodies = []; // { id, lockerIndex, lastAnomalyAt }
let anomalies = []; // 活跃异常 { id, lockerIndex, type, spawnAt, state, confirmed, timeoutAt }
const MAX_ACTIVE_ANOMALIES = 3;
const ANOMALY_TIMEOUT_MINUTES = 120; // 异常超时时间：5游戏分钟

// 随机权重的异常类型
const anomalyTypes = [
    { type: "TempRise", weight: 1.0, chineseName: "温度上升" },
    { type: "LividityShift", weight: 0.9, chineseName: "尸斑移位" },
    { type: "LimbShift", weight: 1.1, chineseName: "肢体移位" },
    { type: "GasRelease", weight: 0.8, chineseName: "气体释放" },
    { type: "TempDrop", weight: 0.7, chineseName: "温度下降" },
];

function pickAnomalyTypeByTimeOfDay() {
    const hh = Math.floor(timeSystem.minutes / 60) % 24;
    // 夜间 0-4 点提升高危类型权重
    const boosted = anomalyTypes.map(a => ({ ...a }));
    if (hh >= 0 && hh < 4) {
        for (const a of boosted) {
            if (a.type === "GasRelease") a.weight *= 1.3;
        }
    }
    const sum = boosted.reduce((s, a) => s + a.weight, 0);
    let r = Math.random() * sum;
    for (const a of boosted) { if ((r -= a.weight) <= 0) return a.type; }
    return boosted[0].type;
}

// 获取异常类型的中文名称
function getAnomalyChineseName(type) {
    const anomaly = anomalyTypes.find(a => a.type === type);
    return anomaly ? anomaly.chineseName : type;
}

// 选择一个有尸体且没有活跃异常的冷柜
function pickLockerForAnomaly() {
    const candidates = lockers
        .map((l, i) => ({ i, l }))
        .filter(({ l }) => l.bodyId != null && !l.activeAnomaly);
    if (candidates.length === 0) return -1;
    const k = Math.floor(Math.random() * candidates.length);
    return candidates[k].i;
}

// 接收尸体：将尸体分配到空冷柜
let nextBodyId = 1;
function receiveBody() {
    const empty = lockers.map((l, i) => ({ i, l })).filter(({ l }) => l.bodyId == null);
    if (empty.length === 0) {
        console.log("没有空冷柜，无法接收尸体");
        return false;
    }
    const { i } = empty[Math.floor(Math.random() * empty.length)];
    const body = { id: `B-${String(nextBodyId++).padStart(3, "0")}`, lockerIndex: i, lastAnomalyAt: -9999 };
    bodies.push(body);
    lockers[i].bodyId = body.id;
    // 初始化柜位温度（摄氏℃）
    lockers[i].temp = 4 + (Math.random() * 1 - 0.5); // 正常 3.5~4.5℃
    console.log(`接收尸体: ${body.id} 在柜位 ${lockers[i].label}, 当前尸体总数: ${bodies.length}`);
    return true;
}

// 定时接收：每隔 1-2 游戏分钟尝试接收 1 具
let nextReceiveAtMin = 0.5;
function scheduleNextReceive() {
    nextReceiveAtMin = timeSystem.minutes + (1 + Math.random() * 1);
    console.log(`下次尸体接收时间: ${nextReceiveAtMin.toFixed(2)}`);
}
scheduleNextReceive();

// 异常生成：按天数固定次数，23-24点不出现
let dailyAnomalyCount = 0; // 当天已生成异常次数
let dailyAnomalyTarget = 0; // 当天目标异常次数
let nextAnomalyTime = 0; // 下次异常生成时间

function initDailyAnomalies() {
    const day = getCurrentDay();
    if (day > timeSystem.totalDays) return;
    
    // 每天异常次数：第1天3次，第2天6次，以此类推
    dailyAnomalyTarget = day * 3;
    dailyAnomalyCount = 0;
    
    // 设置第一次异常时间（避开23-24点）
    scheduleNextAnomalyTime();
}

function scheduleNextAnomalyTime() {
    const day = getCurrentDay();
    if (day > timeSystem.totalDays || dailyAnomalyCount >= dailyAnomalyTarget) return;
    
    // 在一天内均匀分布异常时间，避开23-24点
    const totalMinutes = 24 * 60; // 一天总分钟数
    const availableMinutes = 23 * 60; // 可用时间（0-23点）
    const progress = dailyAnomalyCount / dailyAnomalyTarget;
    
    // 在可用时间内均匀分布，但第一个异常要更早出现
    let targetMinute;
    if (dailyAnomalyCount === 0) {
        // 第一个异常在游戏开始后5-7分钟内出现
        targetMinute = 5 + Math.random() * 2;
    } else {
        targetMinute = Math.floor(progress * availableMinutes);
    }
    
    const currentDayMinute = timeSystem.minutes % totalMinutes;
    
    // 如果目标时间已过，安排到明天
    if (targetMinute <= currentDayMinute) {
        nextAnomalyTime = timeSystem.minutes + (totalMinutes - currentDayMinute) + targetMinute;
    } else {
        nextAnomalyTime = timeSystem.minutes + (targetMinute - currentDayMinute);
    }
    
    // 调试信息
    console.log(`第${day}天异常安排: 进度=${progress.toFixed(2)}, 目标分钟=${targetMinute}, 当前分钟=${currentDayMinute}, 下次异常时间=${nextAnomalyTime.toFixed(2)}`);
}

initDailyAnomalies();

function spawnAnomalyIfPossible() {
    if (anomalies.length >= MAX_ACTIVE_ANOMALIES) {
        console.log("异常数量已达上限，跳过生成");
        return;
    }
    const day = getCurrentDay();
    if (day > timeSystem.totalDays) return; // 游戏结束，不再生成异常
    
    // 检查是否到了异常生成时间
    if (timeSystem.minutes < nextAnomalyTime) {
        console.log(`等待异常生成时间: 当前=${timeSystem.minutes.toFixed(2)}, 目标=${nextAnomalyTime.toFixed(2)}`);
        return;
    }
    
    // 检查当天是否已达到目标次数
    if (dailyAnomalyCount >= dailyAnomalyTarget) {
        console.log(`当天异常已达目标: ${dailyAnomalyCount}/${dailyAnomalyTarget}`);
        return;
    }
    
    // 检查当前时间是否在23-24点之间
    const currentHour = Math.floor((timeSystem.minutes % (24 * 60)) / 60);
    if (currentHour === 23) {
        console.log("当前时间在23-24点，跳过异常生成");
        return; // 23-24点不出现异常
    }
    
    // 检查是否有任何冷柜内有尸体
    const hasBodies = lockers.some(l => l.bodyId != null);
    if (!hasBodies) {
        console.log("没有冷柜内有尸体，跳过异常生成");
        return;
    }
    
    const lockerIndex = pickLockerForAnomaly();
    if (lockerIndex < 0) {
        console.log("没有可用的冷柜用于异常生成");
        return;
    }
    
    let type = pickAnomalyTypeByTimeOfDay();
    // 增加一个新的"温度下降"异常类型（TempDrop）
    if (Math.random() < 0.25) type = "TempDrop";
    const anomaly = {
        id: `A-${Math.random().toString(36).slice(2, 7)}`,
        lockerIndex,
        type,
        spawnAt: timeSystem.minutes,
        state: "WaitingConfirm",
        confirmed: false,
        timeoutAt: timeSystem.minutes + ANOMALY_TIMEOUT_MINUTES,
    };
    anomalies.push(anomaly);
    lockers[lockerIndex].activeAnomaly = true;
    if (type === "TempDrop") {
        // 让该柜位温度缓慢下降，用于近距观察识别
        lockers[lockerIndex].temp = (lockers[lockerIndex].temp ?? 4) - (0.5 + Math.random());
    }
    
    // 更新计数并安排下次异常
    dailyAnomalyCount++;
    console.log(`成功生成异常: ${getAnomalyChineseName(type)} 在柜位 ${lockers[lockerIndex].label}, 第${dailyAnomalyCount}个异常`);
    scheduleNextAnomalyTime();
}

// 检查异常超时
function checkAnomalyTimeouts() {
    const currentTime = timeSystem.minutes;
    const timedOutAnomalies = [];
    
    for (let i = anomalies.length - 1; i >= 0; i--) {
        const anomaly = anomalies[i];
        if (currentTime >= anomaly.timeoutAt) {
            // 异常超时，移除异常并减少血量
            timedOutAnomalies.push(anomaly);
            anomalies.splice(i, 1);
            lockers[anomaly.lockerIndex].activeAnomaly = false;
            
            // 减少四分之一血量（向上取整）
            const healthLoss = Math.ceil(player.health / 4);
            player.health = Math.max(0, player.health - healthLoss);
            
            // 如果血量归零，游戏结束
            if (player.health === 0) {
                togglePause();
                alert("值守失败：异常超时导致血量归零");
            }
        }
    }
    
    // 如果有超时的异常，显示提示
    if (timedOutAnomalies.length > 0) {
        showAnomalyTimeoutNotification(timedOutAnomalies.length);
    }
}

// 显示异常超时通知
function showAnomalyTimeoutNotification(count) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 107, 107, 0.95);
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        border: 2px solid #ff4444;
        font-size: 16px;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        text-align: center;
    `;
    notification.textContent = `⚠️ ${count} 个异常超时！血量减少 ${Math.ceil(player.health / 4)} 点`;
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除通知
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// 更新异常剩余时间显示
function updateAnomalyTimeDisplay() {
    if (anomalies.length === 0) return;
    
    const currentTime = timeSystem.minutes;
    let minTimeLeft = Infinity;
    
    for (const anomaly of anomalies) {
        const timeLeft = anomaly.timeoutAt - currentTime;
        if (timeLeft < minTimeLeft) {
            minTimeLeft = timeLeft;
        }
    }
    
    if (minTimeLeft < Infinity) {
        const minutes = Math.floor(minTimeLeft);
        const seconds = Math.floor((minTimeLeft - minutes) * 60);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // 在异常计数旁边显示剩余时间
        const originalText = anomalyCountEl.textContent;
        anomalyCountEl.textContent = `${originalText} (${timeStr})`;
        
        // 如果时间不足1分钟，用红色警告
        if (minTimeLeft < 1) {
            anomalyCountEl.style.color = '#ff6b6b';
        } else if (minTimeLeft < 2) {
            anomalyCountEl.style.color = '#ffa726';
        } else {
            anomalyCountEl.style.color = '#a7d0ff';
        }
    }
}

function updateBodiesAndAnomalies(now) {
    // 接收尸体时间到
    if (timeSystem.minutes >= nextReceiveAtMin) {
        receiveBody();
        scheduleNextReceive();
    }
    
    // 检查是否需要初始化新一天的异常
    const day = getCurrentDay();
    const currentDayMinute = timeSystem.minutes % (24 * 60);
    if (currentDayMinute === 0 && dailyAnomalyCount === 0) {
        initDailyAnomalies();
    }
    
    // 检查异常生成
    spawnAnomalyIfPossible();
    
    // 检查异常超时
    checkAnomalyTimeouts();
    
    // 更新异常计数显示
    anomalyCountEl.textContent = `${anomalies.length} / ${MAX_ACTIVE_ANOMALIES}`;
    
    // 更新异常剩余时间显示（如果有异常的话）
    updateAnomalyTimeDisplay();
    
    // 检查游戏结束条件
    if (day > timeSystem.totalDays) {
        // 游戏结束，可以显示结算界面
        if (anomalies.length === 0) {
            alert("恭喜！你成功完成了5天的值守任务！");
        }
    }
}

// -----------------------------
// 观察交互：靠近有异常的冷柜按 E 进入观察
// -----------------------------

function findNearbyAnomaly(px, py) {
    // 区域检测：距离某冷柜中心 < 阈值且该柜有异常
    const threshold = 60;
    for (let i = 0; i < lockers.length; i++) {
        const l = lockers[i];
        if (!l.activeAnomaly) continue;
        const cx = l.x + l.w / 2;
        const cy = l.y + l.h / 2;
        if (Math.hypot(px - cx, py - cy) < threshold) {
            const anomaly = anomalies.find(a => a.lockerIndex === i);
            if (anomaly) return { i, l, anomaly };
        }
    }
    return null;
}

let observing = null; // { i, l, anomaly }
function openObservePanel(target) {
    observing = target;
    const { l, anomaly } = target;
    obsLocker.value = l.label;
    obsType.value = getAnomalyChineseName(anomaly.type);
    observeOverlay.classList.remove("hidden");
    // 暂停游戏时间
    input.paused = true;
}
function closeObservePanel() {
    observing = null;
    observeOverlay.classList.add("hidden");
    // 恢复游戏时间
    input.paused = false;
}

window.addEventListener("keydown", (e) => {
    if (e.key === "e" || e.key === "E") {
        if (workbenchOpen) return; // 与工作台互斥
        // 必须开启手电才能观察异常
        if (!player.flashlightOn) return;
        const near = findNearbyAnomaly(player.x, player.y);
        if (near) {
            openObservePanel(near);
        }
    }
});
btnCloseObserve.addEventListener("click", () => closeObservePanel());
window.addEventListener("keydown", (e) => { if (e.key === "Escape" && observing) closeObservePanel(); });

// 确认异常：标记为已确认，随后在工作台完成记录
btnConfirmAnomaly.addEventListener("click", () => {
    if (!observing) return;
    observing.anomaly.confirmed = true;
    // 预填表单（柜位改下拉列表，仅列出已确认的异常柜位）
    rebuildLockerSelectOptions(); // 但保持"显示所有柜位"的增强在构建函数中处理
    // 默认选中当前柜位
    formLocker.value = observing.l.label;
    formType.value = observing.anomaly.type;
    closeObservePanel();
    // 注意：这里不需要调用 openWorkbench()，因为 closeObservePanel() 已经恢复了时间
    // 直接打开工作台，工作台会重新暂停时间
    openWorkbench();
});

// 提交记录：从活跃异常中清除，并恢复冷柜状态
recordForm.addEventListener("submit", (e) => {
    e.preventDefault();
    // 根据柜位查到对应异常
    const label = formLocker.value;
    const idx = lockers.findIndex(l => l.label === label);
    if (idx >= 0) {
        const ai = anomalies.findIndex(a => a.lockerIndex === idx);
        if (ai >= 0) {
            const selectedType = formType.value;
            if (selectedType === anomalies[ai].type) {
                anomalies.splice(ai, 1);
                lockers[idx].activeAnomaly = false;
            } else {
                player.health = Math.max(0, player.health - 1);
                if (player.health === 0) {
                    togglePause();
                    alert("值守失败：血量归零");
                }
            }
        }
    }
    formNote.value = "";
    closeWorkbench();
});

// 下拉选项：列出已确认的异常柜位
function rebuildLockerSelectOptions() {
    formLocker.innerHTML = "";
    // 1) 所有柜位均展示
    const allLabels = lockers.map(l => l.label);
    for (const label of allLabels) {
        const opt = document.createElement("option");
        opt.value = label;
        opt.textContent = label;
        formLocker.appendChild(opt);
    }
    // 2) 如果存在已确认异常，默认选中第一个已确认异常的柜位
    const firstConfirmed = anomalies.find(a => a.confirmed);
    if (firstConfirmed) formLocker.value = lockers[firstConfirmed.lockerIndex].label;
}

function rebuildTypeSelectOptions() {
    formType.innerHTML = "";
    for (const a of anomalyTypes) {
        const opt = document.createElement("option");
        opt.value = a.type;
        opt.textContent = a.chineseName;
        formType.appendChild(opt);
    }
}

// 重新开始：重置世界状态（不重建布局）
btnRestart.addEventListener("click", () => restartGame());
function restartGame() {
    // 重置玩家
    player.x = world.tile * 4;
    player.y = world.tile * 8;
    player.stamina = 100;
    player.battery = 100;
    player.flashlightOn = true;
    player.health = 2;
    // 重置时间
    timeSystem.minutes = 0;
    scheduleNextReceive();
    nextBodyId = 1;
    // 重置异常系统
    dailyAnomalyCount = 0;
    dailyAnomalyTarget = 0;
    nextAnomalyTime = 0;
    initDailyAnomalies();
    // 清空尸体与异常
    bodies = [];
    anomalies = [];
    for (const l of lockers) {
        delete l.bodyId;
        delete l.activeAnomaly;
        l.temp = 4 + (Math.random() * 1 - 0.5);
    }
    // UI 清理
    interactHint.classList.add("hidden");
    closeWorkbench();
    closeObservePanel();
    rebuildLockerSelectOptions();
    // 确保游戏时间恢复
    input.paused = false;
    
    // 恢复背景音乐播放
    playBGM();

    // 重置剧情
    introState = { active: true, reachedSpot: false, startedTyping: false, finished: false };
    introLineIndex = 0;
    currentShown = "";
    nextLineAt = 0;
    if (narrativeBar) { narrativeBar.style.display = "none"; narrativeBar.textContent = ""; }
}

// 在冷柜上显示温度（靠近时）
function drawLockerTemps() {
    for (let i = 0; i < lockers.length; i++) {
        const l = lockers[i];
        if (l.temp == null) continue;
        const cx = l.x + l.w / 2;
        const cy = l.y - 6;
        // 近距离才显示温度
        if (Math.hypot(player.x - cx, player.y - (l.y + l.h / 2)) < 120) {
            ctx.fillStyle = (l.temp < 3.0) ? "#ff6b6b" : "#9ad1ff";
            ctx.font = "12px system-ui";
            ctx.fillText(`${l.temp.toFixed(1)}℃`, cx - 16, cy);
        }
    }
}

// =============================
// 开场光点与剧情
// =============================
const introSpot = { x: workbench.x + workbench.w / 2, y: workbench.y + workbench.h / 2 };

function drawIntroSpot() {
    if (!introState.active || introState.reachedSpot) return;
    // 脉动光点
    const t = performance.now() / 1000;
    const r = 8 + Math.sin(t * 3) * 3;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createRadialGradient(introSpot.x, introSpot.y, 2, introSpot.x, introSpot.y, 24);
    grad.addColorStop(0, "rgba(120,200,255,0.9)");
    grad.addColorStop(1, "rgba(120,200,255,0.0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(introSpot.x, introSpot.y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#bfe1ff";
    ctx.beginPath();
    ctx.arc(introSpot.x, introSpot.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function updateIntro(now) {
    if (!introState.active) return;
    // 检测靠近光点
    if (!introState.reachedSpot) {
        const d = Math.hypot(player.x - introSpot.x, player.y - introSpot.y);
        if (d < 28) {
            introState.reachedSpot = true;
            introState.startedTyping = false;
            introLineIndex = 0;
            currentShown = "";
            nextLineAt = now + LINE_DELAY;
            if (narrativeBar) { narrativeBar.style.display = "block"; narrativeBar.textContent = ""; }
        }
        return;
    }
    // 逐行打字显示
    if (!introState.startedTyping) {
        if (now >= nextLineAt) {
            introState.startedTyping = true;
            lastTypeTime = now;
            currentShown = "";
        } else {
            return;
        }
    }

    const fullLine = introLines[introLineIndex] || "";
    if (currentShown.length < fullLine.length) {
        if (now - lastTypeTime >= TYPE_INTERVAL) {
            const nextLen = Math.min(fullLine.length, currentShown.length + Math.max(1, Math.floor((now - lastTypeTime) / TYPE_INTERVAL)));
            currentShown = fullLine.slice(0, nextLen);
            lastTypeTime = now;
            if (narrativeBar) narrativeBar.textContent = currentShown;
        }
        return;
    }

    // 当前行已完成，准备下一行
    if (introLineIndex < introLines.length - 1) {
        if (now >= (nextLineAt || 0)) {
            // 在行结束后等待 LINE_DELAY 再进入下一行
            if (!nextLineAt || now - lastTypeTime > LINE_DELAY) {
                introLineIndex++;
                introState.startedTyping = false;
                nextLineAt = now + LINE_DELAY;
            }
        }
    } else {
        // 所有行完成，结束剧情
        introState.active = false;
        introState.finished = true;
        if (narrativeBar) narrativeBar.style.display = "none";
    }
}

// 播放背景音乐
function playBGM() {
    // 如果音乐已暂停或停止，则尝试播放
    if (bgm.paused || bgm.ended) {
        // 确保音频已加载
        if (bgm.readyState >= 2) { // HAVE_CURRENT_DATA
            bgm.play().catch(e => {
                console.log("BGM播放失败，可能需要用户交互后才能播放:", e);
            });
        } else {
            console.log("背景音乐尚未加载完成，等待加载...");
            bgm.addEventListener('canplaythrough', () => {
                bgm.play().catch(e => {
                    console.log("BGM播放失败，可能需要用户交互后才能播放:", e);
                });
            }, { once: true });
        }
    }
}

// 停止背景音乐
function stopBGM() {
    if (!bgm.paused) {
        bgm.pause();
        // 不重置播放时间，这样恢复时可以从暂停位置继续
    }
}

// 游戏初始化
function initGame() {
    // 开始播放背景音乐
    playBGM();
    
    // 启动游戏循环
    requestAnimationFrame(loop);
}

// 启动游戏
initGame();

// 添加用户交互事件来确保音频可以播放
document.addEventListener('click', () => {
    console.log('用户点击，尝试播放背景音乐');
    playBGM();
}, { once: true });

document.addEventListener('keydown', () => {
    console.log('用户按键，尝试播放背景音乐');
    playBGM();
}, { once: true });

// 页面加载完成后也尝试播放
window.addEventListener('load', () => {
    console.log('页面加载完成，尝试播放背景音乐');
    playBGM();
});

