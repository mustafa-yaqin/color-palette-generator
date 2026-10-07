/* ==========================================================
   YAQIN-CODE | Color Palette Generator
   All UI is rendered from JavaScript.
   ========================================================== */

const PALETTE_SIZE = 5;
const HISTORY_LIMIT = 12;
const STORAGE_KEY = "yaqin-palette-history";

const HARMONIES = {
  random: "Random",
  analogous: "Analogous",
  complementary: "Complementary",
  triadic: "Triadic",
  monochrome: "Monochrome",
};

const state = {
  colors: [],
  locked: new Array(PALETTE_SIZE).fill(false),
  harmony: "random",
  history: [],
};

const els = {};

/* ---------- Small helpers ---------- */

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") el.className = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value);
  }
  children.flat().forEach((child) => {
    if (child == null) return;
    el.append(child.nodeType ? child : document.createTextNode(child));
  });
  return el;
}

const icon = (classes) => h("i", { class: classes });
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const rand = (min, max) => Math.random() * (max - min) + min;

/* ---------- Color math ---------- */

function hslToHex(hue, sat, light) {
  hue = ((hue % 360) + 360) % 360;
  sat = clamp(sat, 0, 100) / 100;
  light = clamp(light, 0, 100) / 100;

  const k = (n) => (n + hue / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  return (
    "#" +
    [f(0), f(8), f(4)]
      .map((x) => Math.round(x * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function hexToHsl(hex) {
  let { r, g, b } = hexToRgb(hex);
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
  }
  return { h: Math.round(hue), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function readableTextColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1f2933" : "#ffffff";
}

/* ---------- Palette generation ---------- */

function generateRandomColor() {
  return hslToHex(rand(0, 360), rand(45, 85), rand(35, 70));
}

function generateHarmony(type) {
  const base = rand(0, 360);
  const sat = rand(50, 80);
  const light = rand(45, 60);
  const hues = [];

  switch (type) {
    case "analogous":
      for (let i = 0; i < PALETTE_SIZE; i++) hues.push(base + i * 25);
      break;
    case "complementary":
      hues.push(base, base + 15, base + 180, base + 195, base + 165);
      break;
    case "triadic":
      hues.push(base, base + 120, base + 240, base + 20, base + 140);
      break;
    case "monochrome":
      return Array.from({ length: PALETTE_SIZE }, (_, i) =>
        hslToHex(base, sat, 25 + i * 14),
      );
    default:
      return Array.from({ length: PALETTE_SIZE }, generateRandomColor);
  }

  return hues.map((hue, i) =>
    hslToHex(hue, sat + rand(-10, 10), light + (i % 2 ? 8 : -6)),
  );
}

function generatePalette() {
  const fresh = generateHarmony(state.harmony);

  state.colors = fresh.map((color, i) =>
    state.locked[i] && state.colors[i] ? state.colors[i] : color,
  );

  pushHistory();
  render();
}

/* ---------- History (localStorage) ---------- */

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) state.history = saved;
  } catch {
    state.history = [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
  } catch {
    /* storage unavailable, ignore */
  }
}

function pushHistory() {
  const key = state.colors.join("");
  state.history = state.history.filter((p) => p.join("") !== key);
  state.history.unshift([...state.colors]);
  state.history = state.history.slice(0, HISTORY_LIMIT);
  saveHistory();
}

function clearHistory() {
  state.history = [];
  saveHistory();
  renderHistory();
  showToast("History cleared");
}

function restorePalette(colors) {
  state.colors = [...colors];
  render();
}

/* ---------- Clipboard / export ---------- */

async function copyText(text, message = "Copied!") {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${message} ${text.length < 20 ? text : ""}`.trim());
    return true;
  } catch (err) {
    console.log(err);
    showToast("Copy failed");
    return false;
  }
}

async function copyWithFeedback(text, iconEl) {
  const ok = await copyText(text);
  if (ok && iconEl) showCopySuccess(iconEl);
}

function showCopySuccess(element) {
  element.classList.remove("far", "fa-copy");
  element.classList.add("fas", "fa-check");
  element.style.color = "#48bb78";

  setTimeout(() => {
    element.classList.remove("fas", "fa-check");
    element.classList.add("far", "fa-copy");
    element.style.color = "";
  }, 1500);
}

function exportCssVariables() {
  const css =
    ":root {\n" +
    state.colors.map((c, i) => `  --color-${i + 1}: ${c};`).join("\n") +
    "\n}";
  copyText(css, "CSS variables copied");
}

function exportJson() {
  copyText(JSON.stringify(state.colors, null, 2), "JSON copied");
}

function downloadPng() {
  const canvas = document.createElement("canvas");
  const width = 1000;
  const height = 400;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const step = width / state.colors.length;

  state.colors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * step, 0, step, height);
    ctx.fillStyle = readableTextColor(color);
    ctx.font = "600 22px Poppins, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(color.toUpperCase(), i * step + step / 2, height - 30);
  });

  const link = document.createElement("a");
  link.download = "palette.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("PNG downloaded");
}

/* ---------- Toast ---------- */

let toastTimer;

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1600);
}

/* ---------- Rendering ---------- */

function buildColorBox(color, index) {
  const locked = state.locked[index];
  const { h: hue, s, l } = hexToHsl(color);
  const textColor = readableTextColor(color);

  const lockBtn = h(
    "button",
    {
      class: "lock-btn" + (locked ? " active" : ""),
      title: locked ? "Unlock color" : "Lock color",
      style: `color:${textColor}`,
      onclick: () => {
        state.locked[index] = !state.locked[index];
        render();
      },
    },
    icon(locked ? "fas fa-lock" : "fas fa-lock-open"),
  );

  const swatch = h(
    "div",
    {
      class: "color",
      style: `background-color:${color}`,
      title: "Click to copy",
      onclick: () => copyWithFeedback(color, copyIcon),
    },
    lockBtn,
  );

  const copyIcon = icon("far fa-copy copy-btn");
  copyIcon.title = "Copy to clipboard";
  copyIcon.addEventListener("click", () => copyWithFeedback(color, copyIcon));

  const info = h(
    "div",
    { class: "color-info" },
    h(
      "div",
      { class: "color-text" },
      h("span", { class: "hex-value" }, color),
      h("span", { class: "hsl-value" }, `hsl(${hue}, ${s}%, ${l}%)`),
    ),
    copyIcon,
  );

  return h("div", { class: "color-box" }, swatch, info);
}

function buildToolbar() {
  const select = h(
    "select",
    {
      id: "harmony-select",
      onchange: (e) => {
        state.harmony = e.target.value;
        generatePalette();
      },
    },
    Object.entries(HARMONIES).map(([value, label]) =>
      h("option", { value, ...(value === state.harmony ? { selected: "" } : {}) }, label),
    ),
  );

  const generateBtn = h(
    "button",
    { id: "generate-btn", onclick: generatePalette },
    icon("fas fa-sync-alt"),
    " Generate Palette",
  );

  const exportBtns = h(
    "div",
    { class: "export-group" },
    h("button", { class: "ghost-btn", onclick: exportCssVariables }, icon("fab fa-css3-alt"), " CSS"),
    h("button", { class: "ghost-btn", onclick: exportJson }, icon("fas fa-code"), " JSON"),
    h("button", { class: "ghost-btn", onclick: downloadPng }, icon("fas fa-image"), " PNG"),
  );

  return h(
    "div",
    { class: "toolbar" },
    generateBtn,
    h("label", { class: "select-wrap" }, "Mode ", select),
    exportBtns,
  );
}

function renderPalette() {
  els.palette.replaceChildren(
    ...state.colors.map((color, i) => buildColorBox(color, i)),
  );
}

function renderHistory() {
  const items = state.history.map((colors) =>
    h(
      "button",
      {
        class: "history-item",
        title: colors.join(", "),
        onclick: () => restorePalette(colors),
      },
      colors.map((c) => h("span", { style: `background:${c}` })),
    ),
  );

  els.history.replaceChildren(
    h(
      "div",
      { class: "history-header" },
      h("h4", {}, "Recent palettes"),
      state.history.length
        ? h("button", { class: "link-btn", onclick: clearHistory }, "Clear")
        : null,
    ),
    items.length
      ? h("div", { class: "history-list" }, items)
      : h("p", { class: "empty" }, "No palettes yet."),
  );
}

function render() {
  renderPalette();
  renderHistory();
}

function buildApp() {
  els.palette = h("div", { class: "palette-container" });
  els.history = h("div", { class: "history" });
  els.toast = h("div", { class: "toast", role: "status" });

  const container = h(
    "div",
    { class: "container" },
    h("div", { class: "brand" }, h("h1", {}, "YAQIN-CODE")),
    h("h3", {}, "Color Palette Generator"),
    buildToolbar(),
    els.palette,
    h("p", { class: "hint" }, "Press ", h("kbd", {}, "Space"), " to generate a new palette"),
    els.history,
  );

  document.getElementById("app").append(container, els.toast);
}

/* ---------- Init ---------- */

document.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  if (e.code === "Space" && tag !== "BUTTON" && tag !== "SELECT") {
    e.preventDefault();
    generatePalette();
  }
});

function init() {
  loadHistory();
  buildApp();
  generatePalette();
}

init();
