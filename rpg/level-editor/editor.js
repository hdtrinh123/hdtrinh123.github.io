// ---------------------------------------------------------------------------
// Level editor for the stack-based level format (see ../js/levels.js).
//
// Data shape it produces (rpg/levels/levels.json):
//   {
//     start: { level, room },
//     levels: [ { id, rooms: [ { id, width, height, spawn:{x,y}, cells } ] } ]
//   }
// cells[y][x] is an array (stack) of objects, drawn bottom -> top:
//   { type: "floor" } | { type: "wall" }
//   { type: "door", id, target: { room, door } }
// ---------------------------------------------------------------------------

const TILE = 36;
const COLORS = { floor: "#d3d3d3", wall: "#a9a9a9", door: "gold", exit: "limegreen" };

const canvas = document.getElementById("editorCanvas");
const ctx = canvas.getContext("2d");

let data = emptyData();
let curLevelId = null;
let curRoomId = null;
let tool = "wall";
let painting = false;

// Selection / move tool state
let selection = null; // { x, y, w, h } in tile coords
let dragMode = null; // "select" | "move"
let dragStart = null; // { x, y }
let moveOffset = { dx: 0, dy: 0 };

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------
function emptyData() {
  return { start: { level: "level1", room: "room1" }, levels: [] };
}

function getLevel(id = curLevelId) {
  return data.levels.find((l) => l.id === id);
}
function getRoom(levelId = curLevelId, roomId = curRoomId) {
  return getLevel(levelId)?.rooms.find((r) => r.id === roomId);
}

function makeRoom(id, width, height) {
  const cells = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) row.push([]);
    cells.push(row);
  }
  return { id, width, height, spawn: { x: width / 2, y: height / 2 }, cells };
}

function resizeRoom(room, width, height) {
  const cells = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push(room.cells[y]?.[x] ?? []);
    }
    cells.push(row);
  }
  room.cells = cells;
  room.width = width;
  room.height = height;
  if (room.spawn.x > width) room.spawn.x = width / 2;
  if (room.spawn.y > height) room.spawn.y = height / 2;
}

function allDoors(room) {
  const doors = [];
  for (let y = 0; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) {
      for (const obj of room.cells[y][x]) {
        if (obj.type === "door") doors.push({ x, y, door: obj });
      }
    }
  }
  return doors;
}

function nextRoomId(level) {
  let n = 1;
  while (level.rooms.some((r) => r.id === `room${n}`)) n++;
  return `room${n}`;
}

function nextLevelId() {
  let n = 1;
  while (data.levels.some((l) => l.id === `level${n}`)) n++;
  return `level${n}`;
}

function nextDoorId(room) {
  const used = new Set(allDoors(room).map((d) => d.door.id));
  // a, b, c ... then door1, door2 ...
  for (let i = 0; i < 26; i++) {
    const id = String.fromCharCode(97 + i);
    if (!used.has(id)) return id;
  }
  let n = 1;
  while (used.has(`door${n}`)) n++;
  return `door${n}`;
}

// ---------------------------------------------------------------------------
// Selection / move
// ---------------------------------------------------------------------------
function clampTile(t, room) {
  return {
    x: Math.max(0, Math.min(room.width - 1, t.x)),
    y: Math.max(0, Math.min(room.height - 1, t.y)),
  };
}

function rectFrom(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x) + 1,
    h: Math.abs(a.y - b.y) + 1,
  };
}

function inSelection(t) {
  return (
    selection &&
    t.x >= selection.x &&
    t.x < selection.x + selection.w &&
    t.y >= selection.y &&
    t.y < selection.y + selection.h
  );
}

function clearSelection() {
  selection = null;
  dragMode = null;
  moveOffset = { dx: 0, dy: 0 };
}

// Move the cells inside the selection by the current offset (cut + paste).
function commitMove() {
  const room = getRoom();
  if (!room || (moveOffset.dx === 0 && moveOffset.dy === 0)) return;
  const { x, y, w, h } = selection;

  // 1. clone the source stacks
  const buf = [];
  for (let j = 0; j < h; j++) {
    const row = [];
    for (let i = 0; i < w; i++) {
      row.push(structuredClone(room.cells[y + j]?.[x + i] ?? []));
    }
    buf.push(row);
  }
  // 2. clear the source region
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (room.cells[y + j]?.[x + i]) room.cells[y + j][x + i] = [];
    }
  }
  // 3. write into the destination (anything off-grid is dropped)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const tx = x + i + moveOffset.dx;
      const ty = y + j + moveOffset.dy;
      if (tx >= 0 && tx < room.width && ty >= 0 && ty < room.height) {
        room.cells[ty][tx] = buf[j][i];
      }
    }
  }
  selection = { x: x + moveOffset.dx, y: y + moveOffset.dy, w, h };
}

// ---------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------
function setTerrain(cell, type) {
  // terrain is the base layer; remove any existing floor/wall, keep other
  // objects (doors, exits) only when the new terrain is floor
  const others = cell.filter((o) => o.type !== "floor" && o.type !== "wall");
  cell.length = 0;
  cell.push({ type });
  if (type === "floor") cell.push(...others); // walls drop whatever was on top
}

function paint(tx, ty) {
  const room = getRoom();
  if (!room || tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) return;
  const cell = room.cells[ty][tx];

  if (tool === "floor" || tool === "wall") {
    setTerrain(cell, tool);
  } else if (tool === "erase") {
    cell.length = 0;
  } else if (tool === "spawn") {
    room.spawn = { x: tx + 0.5, y: ty + 0.5 };
  } else if (tool === "exit") {
    if (cell.some((o) => o.type === "exit")) return; // one exit per cell
    if (!cell.some((o) => o.type === "floor")) setTerrain(cell, "floor");
    cell.push({ type: "exit" });
  } else if (tool === "door") {
    if (cell.some((o) => o.type === "door")) return; // one door per cell
    if (!cell.some((o) => o.type === "floor")) setTerrain(cell, "floor");
    const targetRoom = getLevel().rooms.find((r) => r.id !== room.id) ?? room;
    const targetDoor = allDoors(targetRoom).find((d) => d.door.id);
    cell.push({
      type: "door",
      id: nextDoorId(room),
      target: { room: targetRoom.id, door: targetDoor ? targetDoor.door.id : "" },
    });
    renderDoorList();
  }
  draw();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function draw() {
  const room = getRoom();
  if (!room) {
    canvas.width = 800;
    canvas.height = 600;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  canvas.width = room.width * TILE;
  canvas.height = room.height * TILE;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) {
      for (const obj of room.cells[y][x]) {
        ctx.fillStyle = COLORS[obj.type] ?? "magenta";
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        if (obj.type === "door") {
          ctx.fillStyle = "#000";
          ctx.font = "bold 16px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(obj.id, x * TILE + TILE / 2, y * TILE + TILE / 2);
        }
      }
    }
  }

  // spawn marker
  if (room.spawn) {
    ctx.fillStyle = "#4a6cf7";
    const r = TILE * 0.28;
    ctx.beginPath();
    ctx.arc(room.spawn.x * TILE, room.spawn.y * TILE, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= room.width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TILE, 0);
    ctx.lineTo(x * TILE, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= room.height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * TILE);
    ctx.lineTo(canvas.width, y * TILE);
    ctx.stroke();
  }

  drawSelectionOverlay(room);
}

function drawSelectionOverlay(room) {
  if (tool !== "select" || !selection) return;
  ctx.save();

  // current selection box
  ctx.fillStyle = "rgba(80,200,255,0.15)";
  ctx.strokeStyle = "rgba(80,200,255,0.9)";
  ctx.lineWidth = 2;
  ctx.fillRect(selection.x * TILE, selection.y * TILE, selection.w * TILE, selection.h * TILE);
  ctx.strokeRect(selection.x * TILE, selection.y * TILE, selection.w * TILE, selection.h * TILE);

  // live move preview
  if (dragMode === "move" && (moveOffset.dx !== 0 || moveOffset.dy !== 0)) {
    ctx.globalAlpha = 0.6;
    for (let j = 0; j < selection.h; j++) {
      for (let i = 0; i < selection.w; i++) {
        const cell = room.cells[selection.y + j]?.[selection.x + i] ?? [];
        const px = (selection.x + i + moveOffset.dx) * TILE;
        const py = (selection.y + j + moveOffset.dy) * TILE;
        for (const obj of cell) {
          ctx.fillStyle = COLORS[obj.type] ?? "magenta";
          ctx.fillRect(px, py, TILE, TILE);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,220,80,0.95)";
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(
      (selection.x + moveOffset.dx) * TILE,
      (selection.y + moveOffset.dy) * TILE,
      selection.w * TILE,
      selection.h * TILE
    );
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// UI: selectors
// ---------------------------------------------------------------------------
const levelSelect = document.getElementById("levelSelect");
const roomSelect = document.getElementById("roomSelect");
const roomWidthInput = document.getElementById("roomWidth");
const roomHeightInput = document.getElementById("roomHeight");
const doorList = document.getElementById("doorList");
const toolHint = document.getElementById("toolHint");

function renderLevelSelect() {
  levelSelect.innerHTML = "";
  for (const lvl of data.levels) {
    const opt = document.createElement("option");
    opt.value = lvl.id;
    opt.textContent = lvl.id;
    levelSelect.appendChild(opt);
  }
  levelSelect.value = curLevelId;
}

function renderRoomSelect() {
  roomSelect.innerHTML = "";
  for (const room of getLevel()?.rooms ?? []) {
    const opt = document.createElement("option");
    opt.value = room.id;
    opt.textContent = room.id;
    roomSelect.appendChild(opt);
  }
  roomSelect.value = curRoomId;
  const room = getRoom();
  if (room) {
    roomWidthInput.value = room.width;
    roomHeightInput.value = room.height;
  }
}

function renderDoorList() {
  const room = getRoom();
  doorList.innerHTML = "";
  if (!room) return;
  const doors = allDoors(room);
  if (doors.length === 0) {
    doorList.innerHTML = `<p class="hint">No doors yet. Pick the Door tool and click a tile.</p>`;
    return;
  }
  const roomsInLevel = getLevel().rooms;

  for (const { x, y, door } of doors) {
    const card = document.createElement("div");
    card.className = "door-card";

    // id row
    const idRow = document.createElement("div");
    idRow.className = "row";
    const idLabel = document.createElement("label");
    idLabel.textContent = "id";
    const idInput = document.createElement("input");
    idInput.type = "text";
    idInput.value = door.id;
    idInput.style.width = "70px";
    idInput.addEventListener("change", () => {
      door.id = idInput.value.trim() || door.id;
      renderDoorList();
      draw();
    });
    const pos = document.createElement("span");
    pos.className = "hint";
    pos.textContent = `@ ${x},${y}`;
    idRow.append(idLabel, idInput, pos);

    // target room row
    const trRow = document.createElement("div");
    trRow.className = "row";
    const trLabel = document.createElement("label");
    trLabel.textContent = "→ room";
    const trSelect = document.createElement("select");
    for (const r of roomsInLevel) {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = r.id;
      trSelect.appendChild(o);
    }
    trSelect.value = door.target.room;
    trRow.append(trLabel, trSelect);

    // target door row
    const tdRow = document.createElement("div");
    tdRow.className = "row";
    const tdLabel = document.createElement("label");
    tdLabel.textContent = "→ door";
    const tdSelect = document.createElement("select");
    function fillTargetDoors() {
      tdSelect.innerHTML = "";
      const tRoom = roomsInLevel.find((r) => r.id === door.target.room);
      const tDoors = tRoom ? allDoors(tRoom) : [];
      if (tDoors.length === 0) {
        const o = document.createElement("option");
        o.value = "";
        o.textContent = "(no doors)";
        tdSelect.appendChild(o);
      }
      for (const d of tDoors) {
        const o = document.createElement("option");
        o.value = d.door.id;
        o.textContent = d.door.id;
        tdSelect.appendChild(o);
      }
      tdSelect.value = door.target.door;
    }
    fillTargetDoors();
    tdRow.append(tdLabel, tdSelect);

    trSelect.addEventListener("change", () => {
      door.target.room = trSelect.value;
      fillTargetDoors();
      door.target.door = tdSelect.value;
    });
    tdSelect.addEventListener("change", () => {
      door.target.door = tdSelect.value;
    });

    // delete
    const delRow = document.createElement("div");
    delRow.className = "row";
    const del = document.createElement("button");
    del.textContent = "Delete door";
    del.className = "danger";
    del.addEventListener("click", () => {
      const cell = room.cells[y][x];
      const i = cell.indexOf(door);
      if (i >= 0) cell.splice(i, 1);
      renderDoorList();
      draw();
    });
    delRow.append(del);

    card.append(idRow, trRow, tdRow, delRow);
    doorList.appendChild(card);
  }
}

function refreshAll() {
  renderLevelSelect();
  renderRoomSelect();
  renderDoorList();
  draw();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
function canvasToTile(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((evt.clientX - rect.left) / TILE);
  const y = Math.floor((evt.clientY - rect.top) / TILE);
  return { x, y };
}

canvas.addEventListener("mousedown", (e) => {
  if (tool === "select") {
    const room = getRoom();
    if (!room) return;
    const t = clampTile(canvasToTile(e), room);
    if (inSelection(t)) {
      dragMode = "move";
      dragStart = t;
      moveOffset = { dx: 0, dy: 0 };
    } else {
      dragMode = "select";
      dragStart = t;
      selection = rectFrom(t, t);
    }
    draw();
    return;
  }
  painting = true;
  const { x, y } = canvasToTile(e);
  paint(x, y);
});
canvas.addEventListener("mousemove", (e) => {
  if (tool === "select") {
    const room = getRoom();
    if (!dragMode || !room) return;
    const t = clampTile(canvasToTile(e), room);
    if (dragMode === "select") {
      selection = rectFrom(dragStart, t);
    } else if (dragMode === "move") {
      moveOffset = { dx: t.x - dragStart.x, dy: t.y - dragStart.y };
    }
    draw();
    return;
  }
  if (!painting) return;
  if (tool === "door" || tool === "spawn" || tool === "exit") return; // single-shot tools
  const { x, y } = canvasToTile(e);
  paint(x, y);
});
window.addEventListener("mouseup", () => {
  if (dragMode === "move") {
    commitMove();
    moveOffset = { dx: 0, dy: 0 };
    renderDoorList(); // door positions may have changed
    draw();
  }
  dragMode = null;
  painting = false;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// Esc clears the current selection
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && selection) {
    clearSelection();
    draw();
  }
});

document.querySelectorAll(".tool").forEach((btn) => {
  btn.addEventListener("click", () => {
    tool = btn.dataset.tool;
    if (tool !== "select") clearSelection();
    document.querySelectorAll(".tool").forEach((b) => b.classList.toggle("active", b === btn));
    const hints = {
      floor: "Walkable ground.",
      wall: "Solid; blocks movement.",
      door: "Click a tile to add a door, then set its target below.",
      exit: "Final exit — stepping on it completes the level (or wins on the last level).",
      erase: "Clears everything in a tile.",
      spawn: "Click a tile to set where the player starts in this room.",
      select: "Drag to select tiles, then drag inside the selection to move them. Esc to clear.",
    };
    toolHint.textContent = hints[tool] ?? "";
    draw();
  });
});

levelSelect.addEventListener("change", () => {
  curLevelId = levelSelect.value;
  curRoomId = getLevel().rooms[0]?.id ?? null;
  clearSelection();
  refreshAll();
});
roomSelect.addEventListener("change", () => {
  curRoomId = roomSelect.value;
  clearSelection();
  renderRoomSelect();
  renderDoorList();
  draw();
});

document.getElementById("addLevel").addEventListener("click", () => {
  const id = prompt("New level id:", nextLevelId());
  if (!id) return;
  if (getLevel(id)) return alert("A level with that id already exists.");
  const lvl = { id, rooms: [makeRoom("room1", 9, 9)] };
  data.levels.push(lvl);
  curLevelId = id;
  curRoomId = "room1";
  refreshAll();
});

document.getElementById("addRoom").addEventListener("click", () => {
  const level = getLevel();
  if (!level) return;
  const id = prompt("New room id:", nextRoomId(level));
  if (!id) return;
  if (level.rooms.some((r) => r.id === id)) return alert("That room id already exists in this level.");
  const w = parseInt(roomWidthInput.value) || 9;
  const h = parseInt(roomHeightInput.value) || 9;
  level.rooms.push(makeRoom(id, w, h));
  curRoomId = id;
  refreshAll();
});

document.getElementById("removeLevel").addEventListener("click", () => {
  if (data.levels.length <= 1) return alert("There must be at least one level.");
  if (!confirm(`Delete level "${curLevelId}" and all its rooms?`)) return;
  data.levels = data.levels.filter((l) => l.id !== curLevelId);
  curLevelId = data.levels[0].id;
  curRoomId = getLevel().rooms[0].id;
  if (data.start.level === undefined || !getLevel(data.start.level)) {
    data.start = { level: curLevelId, room: curRoomId };
  }
  refreshAll();
});

document.getElementById("deleteRoom").addEventListener("click", () => {
  const level = getLevel();
  if (!level || level.rooms.length <= 1) return alert("A level needs at least one room.");
  if (!confirm(`Delete room "${curRoomId}"?`)) return;
  level.rooms = level.rooms.filter((r) => r.id !== curRoomId);
  curRoomId = level.rooms[0].id;
  refreshAll();
});

document.getElementById("resizeRoom").addEventListener("click", () => {
  const room = getRoom();
  if (!room) return;
  const w = Math.max(1, Math.min(60, parseInt(roomWidthInput.value) || room.width));
  const h = Math.max(1, Math.min(60, parseInt(roomHeightInput.value) || room.height));
  resizeRoom(room, w, h);
  renderDoorList();
  draw();
});

document.getElementById("exportJson").addEventListener("click", () => {
  // keep start pointing at something valid
  if (!getLevel(data.start.level) || !getRoom(data.start.level, data.start.room)) {
    data.start = { level: curLevelId, room: curRoomId };
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "levels.json";
  a.click();
  URL.revokeObjectURL(url);
});

const fileInput = document.getElementById("fileInput");
document.getElementById("loadJson").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  try {
    loadData(JSON.parse(await file.text()));
  } catch (e) {
    alert("Could not parse that file as JSON.");
  }
  fileInput.value = "";
});

function loadData(parsed) {
  data = parsed;
  if (!data.levels || data.levels.length === 0) {
    data = emptyData();
    data.levels.push({ id: "level1", rooms: [makeRoom("room1", 9, 9)] });
  }
  curLevelId = data.start?.level && getLevel(data.start.level) ? data.start.level : data.levels[0].id;
  curRoomId = getLevel().rooms[0].id;
  refreshAll();
}

// ---------------------------------------------------------------------------
// Boot: try to load the existing levels.json, otherwise start fresh
// ---------------------------------------------------------------------------
(async function boot() {
  // select default tool
  document.querySelector('.tool[data-tool="wall"]').click();
  try {
    const res = await fetch("../levels/levels.json");
    if (res.ok) {
      loadData(await res.json());
      return;
    }
  } catch (_) {
    /* file:// or missing file — start fresh */
  }
  data = emptyData();
  data.levels.push({ id: "level1", rooms: [makeRoom("room1", 9, 9)] });
  curLevelId = "level1";
  curRoomId = "room1";
  refreshAll();
})();
