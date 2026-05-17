import "./style.css";

type Point = {
  x: number;
  y: number;
};

type Box = Point & {
  width: number;
  height: number;
};

type ZombieStart = Point;

type Zombie = ZombieStart & {
  id: string;
  alive: boolean;
};

type Level = {
  shots: number;
  boxes: Box[];
  zombies: ZombieStart[];
};

type GameStatus = "playing" | "level-complete" | "failed" | "won";

type GameState = {
  shotsLeft: number;
  boxes: Box[];
  zombies: Zombie[];
  status: GameStatus;
};

type HitType = "wall" | "box" | "zombie";

type Hit = {
  t: number;
  point: Point;
  normal: Point;
  type: HitType;
  zombie?: Zombie;
};

type TraceResult = {
  path: Point[];
  hitZombie: Zombie | null;
};

const canvas = getElement<HTMLCanvasElement>("gameCanvas");
const context = canvas.getContext("2d");

if (!context) {
  throw new Error("Canvas 2D context is not available.");
}

const ctx: CanvasRenderingContext2D = context;
const levelLabel = getElement<HTMLSpanElement>("levelLabel");
const shotsLabel = getElement<HTMLSpanElement>("shotsLabel");
const zombiesLabel = getElement<HTMLSpanElement>("zombiesLabel");
const messagePanel = getElement<HTMLDivElement>("messagePanel");
const messageTitle = getElement<HTMLHeadingElement>("messageTitle");
const messageText = getElement<HTMLParagraphElement>("messageText");
const primaryButton = getElement<HTMLButtonElement>("primaryButton");
const restartButton = getElement<HTMLButtonElement>("restartButton");
const resetButton = getElement<HTMLButtonElement>("resetButton");

const FIELD = { width: 960, height: 600 } as const;
const HERO = { x: 86, y: 500, radius: 24 } as const;
const HEAD_RADIUS = 22;
const MAX_BOUNCES = 8;
const EPSILON = 0.001;

const levels: Level[] = [
  {
    shots: 3,
    boxes: [],
    zombies: [{ x: 805, y: 480 }],
  },
  {
    shots: 4,
    boxes: [{ x: 408, y: 365, width: 118, height: 120 }],
    zombies: [{ x: 805, y: 480 }],
  },
  {
    shots: 4,
    boxes: [
      { x: 310, y: 290, width: 120, height: 105 },
      { x: 585, y: 405, width: 115, height: 92 },
    ],
    zombies: [{ x: 805, y: 480 }],
  },
  {
    shots: 5,
    boxes: [
      { x: 245, y: 390, width: 120, height: 98 },
      { x: 455, y: 250, width: 110, height: 140 },
      { x: 660, y: 410, width: 104, height: 82 },
    ],
    zombies: [
      { x: 835, y: 482 },
      { x: 720, y: 318 },
    ],
  },
  {
    shots: 6,
    boxes: [
      { x: 245, y: 258, width: 92, height: 185 },
      { x: 410, y: 405, width: 126, height: 92 },
      { x: 590, y: 190, width: 96, height: 165 },
      { x: 728, y: 420, width: 80, height: 78 },
    ],
    zombies: [
      { x: 846, y: 490 },
      { x: 780, y: 225 },
    ],
  },
  {
    shots: 7,
    boxes: [
      { x: 210, y: 245, width: 98, height: 148 },
      { x: 370, y: 110, width: 102, height: 170 },
      { x: 422, y: 420, width: 128, height: 84 },
      { x: 610, y: 285, width: 118, height: 92 },
      { x: 760, y: 120, width: 74, height: 160 },
    ],
    zombies: [
      { x: 842, y: 505 },
      { x: 850, y: 318 },
      { x: 620, y: 145 },
    ],
  },
];

let currentLevelIndex = 0;
let state = createLevelState(currentLevelIndex);
let pointer: Point = { x: 760, y: 240 };
let previewPath: Point[] = [];
let lastShotPath: Point[] = [];
let lastShotTimer = 0;
let animationFrameId = 0;
let activePointerId: number | null = null;

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing element: #${id}`);
  }

  return element as T;
}

function createLevelState(index: number): GameState {
  const source = levels[index];

  if (!source) {
    throw new Error(`Missing level at index ${index}`);
  }

  return {
    shotsLeft: source.shots,
    boxes: source.boxes.map((box) => ({ ...box })),
    zombies: source.zombies.map((zombie, zombieIndex) => ({
      ...zombie,
      id: `${index}-${zombieIndex}`,
      alive: true,
    })),
    status: "playing",
  };
}

function normalize(vector: Point): Point {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function headCenter(zombie: Zombie): Point {
  return { x: zombie.x, y: zombie.y - 66 };
}

function traceLightning(start: Point, direction: Point, gameState: GameState, ignoreZombies = false): TraceResult {
  const path: Point[] = [{ ...start }];
  let origin = { ...start };
  let ray = normalize(direction);
  let hitZombie: Zombie | null = null;

  for (let bounce = 0; bounce <= MAX_BOUNCES; bounce += 1) {
    const hit = findClosestHit(origin, ray, gameState, ignoreZombies);
    path.push(hit.point);

    if (hit.type === "zombie") {
      hitZombie = hit.zombie ?? null;
      break;
    }

    const dot = ray.x * hit.normal.x + ray.y * hit.normal.y;
    ray = normalize({
      x: ray.x - 2 * dot * hit.normal.x,
      y: ray.y - 2 * dot * hit.normal.y,
    });
    origin = {
      x: hit.point.x + ray.x * EPSILON,
      y: hit.point.y + ray.y * EPSILON,
    };
  }

  return { path, hitZombie };
}

function findClosestHit(origin: Point, direction: Point, gameState: GameState, ignoreZombies: boolean): Hit {
  const hits: Hit[] = [
    intersectVerticalWall(origin, direction, 0, { x: 1, y: 0 }),
    intersectVerticalWall(origin, direction, FIELD.width, { x: -1, y: 0 }),
    intersectHorizontalWall(origin, direction, 0, { x: 0, y: 1 }),
    intersectHorizontalWall(origin, direction, FIELD.height, { x: 0, y: -1 }),
    ...gameState.boxes.flatMap((box) => intersectBox(origin, direction, box)),
  ].filter(isHit);

  if (!ignoreZombies) {
    for (const zombie of gameState.zombies.filter((item) => item.alive)) {
      const hit = intersectCircle(origin, direction, headCenter(zombie), HEAD_RADIUS);

      if (hit) {
        hits.push({ ...hit, type: "zombie", zombie });
      }
    }
  }

  const closest = hits.filter((hit) => hit.t > EPSILON).sort((a, b) => a.t - b.t)[0];

  if (!closest) {
    throw new Error("No ray collision found.");
  }

  return closest;
}

function isHit(hit: Hit | null): hit is Hit {
  return hit !== null;
}

function intersectVerticalWall(origin: Point, direction: Point, x: number, normal: Point): Hit | null {
  if (Math.abs(direction.x) < EPSILON) {
    return null;
  }

  const t = (x - origin.x) / direction.x;
  const y = origin.y + direction.y * t;

  if (t <= EPSILON || y < 0 || y > FIELD.height) {
    return null;
  }

  return { t, point: { x, y }, normal, type: "wall" };
}

function intersectHorizontalWall(origin: Point, direction: Point, y: number, normal: Point): Hit | null {
  if (Math.abs(direction.y) < EPSILON) {
    return null;
  }

  const t = (y - origin.y) / direction.y;
  const x = origin.x + direction.x * t;

  if (t <= EPSILON || x < 0 || x > FIELD.width) {
    return null;
  }

  return { t, point: { x, y }, normal, type: "wall" };
}

function intersectBox(origin: Point, direction: Point, box: Box): Array<Hit | null> {
  return [
    intersectSegment(origin, direction, box.x, box.y, box.x, box.y + box.height, { x: -1, y: 0 }),
    intersectSegment(origin, direction, box.x + box.width, box.y, box.x + box.width, box.y + box.height, { x: 1, y: 0 }),
    intersectSegment(origin, direction, box.x, box.y, box.x + box.width, box.y, { x: 0, y: -1 }),
    intersectSegment(origin, direction, box.x, box.y + box.height, box.x + box.width, box.y + box.height, { x: 0, y: 1 }),
  ];
}

function intersectSegment(
  origin: Point,
  direction: Point,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  normal: Point,
): Hit | null {
  const vertical = x1 === x2;
  const hit = vertical
    ? intersectVerticalWall(origin, direction, x1, normal)
    : intersectHorizontalWall(origin, direction, y1, normal);

  if (!hit) {
    return null;
  }

  const withinSegment = vertical
    ? hit.point.y >= Math.min(y1, y2) && hit.point.y <= Math.max(y1, y2)
    : hit.point.x >= Math.min(x1, x2) && hit.point.x <= Math.max(x1, x2);

  return withinSegment ? { ...hit, type: "box" } : null;
}

function intersectCircle(origin: Point, direction: Point, center: Point, radius: number): Omit<Hit, "type"> | null {
  const toCircle = { x: center.x - origin.x, y: center.y - origin.y };
  const projection = toCircle.x * direction.x + toCircle.y * direction.y;
  const closestDistanceSq = toCircle.x * toCircle.x + toCircle.y * toCircle.y - projection * projection;
  const radiusSq = radius * radius;

  if (projection <= EPSILON || closestDistanceSq > radiusSq) {
    return null;
  }

  const offset = Math.sqrt(radiusSq - closestDistanceSq);
  const t = projection - offset;
  const point = { x: origin.x + direction.x * t, y: origin.y + direction.y * t };
  const normal = normalize({ x: point.x - center.x, y: point.y - center.y });

  return { t, point, normal };
}

function updateHud(): void {
  levelLabel.textContent = `Level ${currentLevelIndex + 1}`;
  shotsLabel.textContent = `Bliksem: ${state.shotsLeft}`;
  zombiesLabel.textContent = `Zombies: ${state.zombies.filter((zombie) => zombie.alive).length}`;
}

function showMessage(title: string, text: string, buttonText: string): void {
  messageTitle.textContent = title;
  messageText.textContent = text;
  primaryButton.textContent = buttonText;
  messagePanel.classList.remove("hidden");
}

function hideMessage(): void {
  messagePanel.classList.add("hidden");
}

function nextLevel(): void {
  if (currentLevelIndex === levels.length - 1) {
    state.status = "won";
    showMessage("Gewonnen!", "Tyano heeft alle zombies verslagen.", "Opnieuw spelen");
    return;
  }

  currentLevelIndex += 1;
  state = createLevelState(currentLevelIndex);
  lastShotPath = [];
  hideMessage();
  updateHud();
}

function restartLevel(): void {
  state = createLevelState(currentLevelIndex);
  lastShotPath = [];
  hideMessage();
  updateHud();
}

function resetGame(): void {
  currentLevelIndex = 0;
  restartLevel();
}

function shoot(): void {
  if (state.status !== "playing" || state.shotsLeft <= 0) {
    return;
  }

  const start = getLightningStart();
  const direction = normalize({ x: pointer.x - start.x, y: pointer.y - start.y });
  const result = traceLightning(start, direction, state);

  state.shotsLeft -= 1;
  lastShotPath = result.path;
  lastShotTimer = 0.55;

  if (result.hitZombie) {
    result.hitZombie.alive = false;
  }

  const livingZombies = state.zombies.filter((zombie) => zombie.alive).length;

  if (livingZombies === 0) {
    state.status = "level-complete";
    showMessage("Level gehaald!", "De bliksem raakte elk zombiehoofd.", currentLevelIndex === levels.length - 1 ? "Finish" : "Volgend level");
  } else if (state.shotsLeft === 0) {
    state.status = "failed";
    showMessage("Geen bliksem meer", "Probeer een andere hoek en laat de straal terugkaatsen.", "Opnieuw proberen");
  }

  updateHud();
}

function getLightningStart(): Point {
  return { x: HERO.x + HERO.radius + 5, y: HERO.y - 18 };
}

function getCanvasPoint(event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * FIELD.width,
    y: ((event.clientY - rect.top) / rect.height) * FIELD.height,
  };
}

function handlePointerMove(event: PointerEvent): void {
  if (activePointerId !== null && event.pointerId !== activePointerId) {
    return;
  }

  pointer = getCanvasPoint(event);
}

function handlePointerDown(event: PointerEvent): void {
  pointer = getCanvasPoint(event);
  activePointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
}

function handlePointerUp(event: PointerEvent): void {
  if (activePointerId !== event.pointerId) {
    return;
  }

  pointer = getCanvasPoint(event);
  activePointerId = null;
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
  shoot();
}

function handlePointerCancel(event: PointerEvent): void {
  if (activePointerId !== event.pointerId) {
    return;
  }

  activePointerId = null;
}

function drawScene(deltaTime: number): void {
  const start = getLightningStart();
  previewPath = traceLightning(start, normalize({ x: pointer.x - start.x, y: pointer.y - start.y }), state).path;
  lastShotTimer = Math.max(0, lastShotTimer - deltaTime);

  drawBackground();
  drawPath(previewPath, "rgba(79, 195, 255, 0.32)", 4);
  drawBoxes();
  drawHero();

  for (const zombie of state.zombies) {
    if (zombie.alive) {
      drawZombie(zombie);
    }
  }

  drawAimLine(start);

  if (lastShotTimer > 0) {
    drawPath(lastShotPath, "rgba(255, 230, 109, 0.95)", 8);
    drawPath(lastShotPath, "rgba(255, 255, 255, 0.85)", 3);
  }
}

function drawBackground(): void {
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = "#111821";
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= FIELD.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FIELD.height);
    ctx.stroke();
  }

  for (let y = 0; y <= FIELD.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#435066";
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, FIELD.width - 10, FIELD.height - 10);
}

function drawBoxes(): void {
  for (const box of state.boxes) {
    ctx.fillStyle = "#a06a3d";
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.fillStyle = "#c08a55";
    ctx.fillRect(box.x + 8, box.y + 8, box.width - 16, 14);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.32)";
    ctx.lineWidth = 4;
    ctx.strokeRect(box.x + 2, box.y + 2, box.width - 4, box.height - 4);
  }
}

function drawHero(): void {
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.arc(HERO.x, HERO.y - 58, 23, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f2c48d";
  ctx.beginPath();
  ctx.arc(HERO.x, HERO.y - 82, 17, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffdf6f";
  ctx.beginPath();
  ctx.moveTo(HERO.x - 18, HERO.y - 100);
  ctx.lineTo(HERO.x + 18, HERO.y - 100);
  ctx.lineTo(HERO.x, HERO.y - 127);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#78d8ff";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(HERO.x + 17, HERO.y - 63);
  ctx.lineTo(HERO.x + 42, HERO.y - 22);
  ctx.stroke();
}

function drawZombie(zombie: Zombie): void {
  ctx.fillStyle = "#586b3a";
  ctx.fillRect(zombie.x - 18, zombie.y - 58, 36, 58);

  ctx.fillStyle = "#7dd665";
  ctx.beginPath();
  ctx.arc(zombie.x, zombie.y - 66, HEAD_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1f2b1f";
  ctx.beginPath();
  ctx.arc(zombie.x - 7, zombie.y - 70, 3.5, 0, Math.PI * 2);
  ctx.arc(zombie.x + 8, zombie.y - 70, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#1f2b1f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(zombie.x - 8, zombie.y - 57);
  ctx.lineTo(zombie.x + 9, zombie.y - 57);
  ctx.stroke();
}

function drawAimLine(start: Point): void {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(pointer.x, pointer.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPath(path: Point[], color: string, width: number): void {
  if (path.length < 2) {
    return;
  }

  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);

  for (let i = 1; i < path.length; i += 1) {
    const point = path[i];
    ctx.lineTo(point.x, point.y);
  }

  ctx.stroke();
}

let lastFrameTime = performance.now();

function loop(now: number): void {
  const deltaTime = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  drawScene(deltaTime);
  animationFrameId = requestAnimationFrame(loop);
}

canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerCancel);
restartButton.addEventListener("click", restartLevel);
resetButton.addEventListener("click", resetGame);
primaryButton.addEventListener("click", () => {
  if (state.status === "level-complete") {
    nextLevel();
  } else if (state.status === "won") {
    resetGame();
  } else {
    restartLevel();
  }
});

updateHud();
animationFrameId = requestAnimationFrame(loop);

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(animationFrameId);
});
