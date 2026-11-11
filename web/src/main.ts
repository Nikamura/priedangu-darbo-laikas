import "@fontsource-variable/onest";
import "@fontsource-variable/unbounded";
import "leaflet/dist/leaflet.css";
import "./style.css";
import L from "leaflet";
import { type Dataset, fold, type Kind, loadData, type Shelter } from "./data.ts";
import { appleMapsUrl, distanceM, googleMapsUrl, type Point, walkMinutes } from "./geo.ts";
import { detectLang, type Dict, fmt, isLang, type Lang, LANGS } from "./i18n/index.ts";
import { hhmm, shelterStatus, type Status, type Tone, vilniusNow } from "./status.ts";

const KINDS: Kind[] = ["underground", "parking", "apartment", "education", "health", "shopping", "public", "other"];
const TONES: Tone[] = ["open", "maybe", "closed", "limited", "nodata"];
const NEAREST_COUNT = 5;
const OPEN_SEARCH_KM = 5;
const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

type Origin = { point: Point; source: "gps" | "picked"; accuracy?: number };

const state = {
  lang: detectLang(),
  data: null as Dataset | null,
  dataError: false,
  origin: null as Origin | null,
  locating: false,
  locateMessage: "" as "" | "denied" | "unavailable" | "insecure",
  showCount: NEAREST_COUNT,
  selectedId: null as number | null,
  picking: false,
  now: vilniusNow(),
  filters: { q: "", tones: new Set<Tone>(TONES), always: false, accessible: false, kind: "" as Kind | "" },
};

let t: Dict = LANGS[state.lang];

// ---------- helpers ----------

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function get(path: string): string {
  let v: unknown = t;
  for (const k of path.split(".")) v = (v as Record<string, unknown>)?.[k];
  return typeof v === "string" ? v : "";
}

function num(n: number): string {
  return new Intl.NumberFormat(t.code).format(n);
}

function distanceLabel(m: number): string {
  const label =
    m < 1000
      ? fmt(t.units.m, { n: num(Math.round(m / 10) * 10) })
      : fmt(t.units.km, { n: new Intl.NumberFormat(t.code, { maximumFractionDigits: 1 }).format(m / 1000) });
  return label.replace(/ /g, "\u00a0");
}

function weekdayName(day: number): string {
  // 2024-01-01 was a Monday.
  return new Intl.DateTimeFormat(t.code, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + day)));
}

function statusText(s: Status): string {
  return fmt(t.status[s.key], {
    time: s.time != null ? hhmm(s.time) : "",
    day: s.day != null ? weekdayName(s.day) : "",
  });
}

function hostLines(s: Shelter): string {
  if (!s.host) return "";
  return `<div class="host">
    <p>${esc(fmt(t.results.host, { name: s.host.name }))}</p>
    <p>${esc(fmt(t.results.hostHours, { h: s.host.hoursRaw }))}
      <a href="https://www.openstreetmap.org/${esc(s.host.osmId)}" target="_blank" rel="noopener">${esc(t.results.hostSource)}</a></p>
  </div>`;
}

function title(s: Shelter): string {
  return s.name ?? t.results.unnamed;
}

function place(s: Shelter): string {
  return [s.address, s.settlement].filter(Boolean).join(", ");
}

const statusCache = new Map<number, Status>();
function statusOf(s: Shelter): Status {
  let st = statusCache.get(s.id);
  if (!st) statusCache.set(s.id, (st = shelterStatus(s, state.now)));
  return st;
}

function savePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
function loadPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const icon = {
  walk: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13" cy="4" r="2" fill="currentColor"/><path d="M13 7l-2 6 3 3-1 6M11 13l-3 3M12 9l4 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  nav: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8z" fill="currentColor"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.5" fill="currentColor"/></svg>`,
  access: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4" r="2" fill="currentColor"/><path d="M12 7v6h5l2 5M12 10h4M9.5 11a5 5 0 1 0 6 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  people: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor"/><circle cx="16.5" cy="9" r="2.5" fill="currentColor"/><path d="M2 20c0-3.5 2.7-6 6-6s6 2.5 6 6zM14 20c0-2.2-.6-4-1.6-5.3a5 5 0 0 1 9.6 2.3V20z" fill="currentColor"/></svg>`,
};

// ---------- static text ----------

function applyStaticText() {
  document.documentElement.lang = t.code;
  document.title = t.meta.title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", t.meta.description);
  for (const el of document.querySelectorAll<HTMLElement>("[data-t]")) el.textContent = get(el.dataset.t!);
  for (const el of document.querySelectorAll<HTMLElement>("[data-t-aria]")) el.setAttribute("aria-label", get(el.dataset.tAria!));
  $<HTMLInputElement>("#q").placeholder = t.map.searchPlaceholder;
  $("#textsize").setAttribute("aria-label", t.bar.textSize);

  const kindSel = $<HTMLSelectElement>("#f-kind");
  kindSel.innerHTML =
    `<option value="">${esc(t.map.allKinds)}</option>` +
    KINDS.map((k) => `<option value="${k}">${esc(t.kinds[k])}</option>`).join("");
  kindSel.value = state.filters.kind;


  renderFooter();
  renderLocate();
  renderResults();
  renderSelected();
  renderLegend();
  renderShownCount();
  renderFilterBanner();
  setPicking(state.picking);
}

function renderLocate() {
  $("#locate-text").textContent = state.origin?.source === "gps" ? t.hero.findAgain : t.hero.find;
  const btn = $<HTMLButtonElement>("#locate");
  btn.setAttribute("aria-busy", String(state.locating));
  const msg = state.locating ? t.hero.locating : state.locateMessage ? t.hero[state.locateMessage] : "";
  const el = $("#locate-state");
  el.textContent = msg;
  el.classList.toggle("is-error", !!state.locateMessage && !state.locating);
  if (state.locateMessage && !state.locating) {
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "linkish";
    pick.textContent = t.hero.pickOnMap;
    pick.addEventListener("click", () => setPicking(true));
    el.append(" ", pick);
  }
}

// ---------- nearest results ----------

function nearest(origin: Point, list: Shelter[], count: number) {
  return list
    .map((s) => ({ s, d: distanceM(origin, s) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count);
}

function card(s: Shelter, d: number | null, extraClass = ""): string {
  const st = statusOf(s);
  const name = title(s);
  const chips = [
    s.capacity ? `<span class="chip-info">${icon.people}${esc(fmt(t.results.capacity, { n: num(s.capacity) }))}</span>` : "",
    s.accessible ? `<span class="chip-info">${icon.access}${esc(t.results.accessible)}</span>` : "",
  ].join("");
  return `<li class="card tone-${st.tone} ${extraClass}">
    ${
      d != null
        ? `<div class="card-dist"><strong>${esc(distanceLabel(d))}</strong><span>${icon.walk}${esc(fmt(t.results.walk, { min: walkMinutes(d) }))}</span></div>`
        : ""
    }
    <div class="card-body">
      <h3>${esc(name)}</h3>
      ${place(s) ? `<p class="addr">${esc(place(s))}</p>` : ""}
      <p class="status"><span class="dot tone-${st.tone}"></span>${esc(statusText(st))}</p>
      ${s.hoursRaw ? `<p class="hours">${esc(fmt(t.results.hours, { h: s.hoursRaw }))}</p>` : ""}
      ${hostLines(s)}
      ${chips ? `<p class="chips">${chips}</p>` : ""}
      <div class="actions">
        <a class="btn btn-go" href="${googleMapsUrl(s)}" target="_blank" rel="noopener" aria-label="${esc(fmt(t.results.navigateLabel, { name }))}">${icon.nav}${esc(t.results.navigate)}</a>
        ${isApple ? `<a class="btn" href="${appleMapsUrl(s)}" target="_blank" rel="noopener">${esc(t.results.appleMaps)}</a>` : ""}
        <button class="btn btn-quiet" type="button" data-show="${s.id}">${icon.pin}${esc(t.results.showOnMap)}</button>
      </div>
    </div>
  </li>`;
}

function renderResults() {
  const el = $("#results");
  if (!state.data) {
    el.innerHTML = `<p class="loading">${esc(state.dataError ? t.hero.dataError : t.hero.loadingData)}</p>`;
    return;
  }
  if (!state.origin) {
    el.innerHTML = "";
    return;
  }
  const { point, source, accuracy } = state.origin;
  const list = nearest(point, state.data.shelters, state.showCount);
  const anyOpen = list.some(({ s }) => statusOf(s).tone === "open");

  let openBlock = "";
  if (!anyOpen) {
    const open = nearest(
      point,
      state.data.shelters.filter((s) => statusOf(s).tone === "open"),
      1,
    )[0];
    openBlock =
      open && open.d <= OPEN_SEARCH_KM * 1000
        ? `<p class="subhead">${esc(t.results.nearestOpen)}</p><ol class="cards">${card(open.s, open.d, "is-open-pick")}</ol>`
        : `<p class="notice">${esc(fmt(t.results.noneOpenNearby, { km: OPEN_SEARCH_KM }))}</p>`;
  }

  el.innerHTML = `
    <div class="results-head">
      <h2>${esc(t.results.title)}</h2>
      <p>${esc(source === "gps" ? t.results.fromYou : t.results.fromPicked)}</p>
      ${accuracy && accuracy > 100 ? `<p>${esc(fmt(t.results.accuracy, { m: num(Math.round(accuracy)) }))}</p>` : ""}
    </div>
    <ol class="cards">${list.map(({ s, d }) => card(s, d)).join("")}</ol>
    <button class="btn btn-quiet more" type="button" id="more">${esc(t.results.more)}</button>
    ${openBlock}
    <p class="locked-tip">${esc(t.results.locked)}</p>
    <p class="data-note">${esc(t.results.dataNote)}</p>`;
}

$("#panel").addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const show = target.closest<HTMLElement>("[data-show]");
  if (show) {
    selectShelter(Number(show.dataset.show), true);
    return;
  }
  if (target.closest("#close-selected")) {
    selectShelter(null);
    return;
  }
  if (target.closest("#more")) {
    state.showCount += NEAREST_COUNT;
    renderResults();
  }
});

// ---------- geolocation ----------

let watchId: number | null = null;

function locate() {
  if (!window.isSecureContext) {
    state.locateMessage = "insecure";
    renderLocate();
    return;
  }
  if (!("geolocation" in navigator)) {
    state.locateMessage = "unavailable";
    renderLocate();
    return;
  }
  state.locating = true;
  state.locateMessage = "";
  renderLocate();
  if (watchId != null) navigator.geolocation.clearWatch(watchId);

  let first = true;
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      state.locating = false;
      state.showCount = NEAREST_COUNT;
      setOrigin({ point: { lat: pos.coords.latitude, lng: pos.coords.longitude }, source: "gps", accuracy: pos.coords.accuracy });
      if (first) {
        first = false;
        scrollPanelTo($("#results"));
      }
      // Stop draining the battery once the fix is good.
      if (pos.coords.accuracy < 30 && watchId != null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    },
    (err) => {
      state.locating = false;
      if (!state.origin) state.locateMessage = err.code === err.PERMISSION_DENIED ? "denied" : "unavailable";
      renderLocate();
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
    },
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 },
  );
}

function setOrigin(origin: Origin) {
  state.origin = origin;
  syncOriginUrl();
  renderLocate();
  renderResults();
  placeOriginMarker();
}

/**
 * A place picked on the map goes into ?at= so the link can be shared or bookmarked.
 * A GPS position never does: sharing a link must not reveal where someone is.
 */
function syncOriginUrl() {
  const url = new URL(location.href);
  if (state.origin?.source === "picked") {
    const { lat, lng } = state.origin.point;
    url.searchParams.set("at", `${lat.toFixed(5)},${lng.toFixed(5)}`);
  } else url.searchParams.delete("at");
  // Keep the comma readable in shared links (54.68459,25.28540 rather than %2C).
  history.replaceState(null, "", url.toString().replace(/%2C/gi, ","));
}

/** Scrolls the side panel (not the page) so `el` is at its top. */
function scrollPanelTo(el: HTMLElement) {
  const panel = $("#panel");
  const top = el.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop - 12;
  panel.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

/** Brings the map + panel screen back into view if the page was scrolled to the guides below. */
function scrollToApp() {
  const app = $("#find");
  const barH = $(".bar").offsetHeight;
  if (Math.abs(app.getBoundingClientRect().top - barH) > 2) app.scrollIntoView({ behavior: "smooth", block: "start" });
}

$("#locate").addEventListener("click", () => {
  setPicking(false);
  locate();
});
$("#pick").addEventListener("click", () => setPicking(!state.picking));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.picking) setPicking(false);
});

// ---------- map ----------

let map: L.Map | null = null;
const LITHUANIA = L.latLngBounds([53.89, 20.93], [56.45, 26.84]);
const renderer = L.canvas({ padding: 0.5 });
const markers = new Map<number, L.CircleMarker>();
const layer = L.layerGroup();
let originMarker: L.CircleMarker | null = null;

function toneColor(tone: Tone): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--tone-${tone}`).trim();
}

function initMap() {
  map = L.map("leaflet", {
    renderer,
    zoomControl: true,
    attributionControl: true,
    // Double-click places "I am here" instead of zooming; +/− and pinch still zoom.
    doubleClickZoom: false,
    // Fire contextmenu on press-and-hold in browsers that don't do it natively (iOS Safari).
    tapHold: true,
  }).fitBounds(LITHUANIA);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  layer.addTo(map);
  // ?debug exposes the map to automated browser tests.
  if (new URLSearchParams(location.search).has("debug")) Object.assign(window, { __map: map, __markers: markers });
  // A single tap only sets the location in "choose a place" mode, so stray taps while panning do nothing.
  map.on("click", (e: L.LeafletMouseEvent) => {
    if (state.picking) pickAt(e.latlng);
  });
  // Double-click (mouse) or press-and-hold (touch, which browsers report as contextmenu) always does.
  const pickHere = (e: L.LeafletMouseEvent) => {
    L.DomEvent.preventDefault(e.originalEvent);
    pickAt(e.latlng);
  };
  map.on("dblclick", pickHere);
  map.on("contextmenu", pickHere);
}

function pickAt(latlng: L.LatLng) {
  setPicking(false);
  state.showCount = NEAREST_COUNT;
  selectShelter(null);
  setOrigin({ point: { lat: latlng.lat, lng: latlng.lng }, source: "picked" });
  scrollPanelTo($("#results"));
}

function buildMarkers() {
  if (!map || !state.data) return;
  const colors = Object.fromEntries(TONES.map((tone) => [tone, toneColor(tone)])) as Record<Tone, string>;
  for (const s of state.data.shelters) {
    const tone = statusOf(s).tone;
    const m = L.circleMarker([s.lat, s.lng], {
      renderer,
      ...MARKER_STYLE,
      fillColor: colors[tone],
      fillOpacity: 0.95,
      // A tap on a shelter must not also count as "I am here" on the map.
      bubblingMouseEvents: false,
    });
    // The shelter's card opens in the panel, not in a popup: a popup doesn't fit on a phone-sized map.
    m.on("click", () => selectShelter(s.id));
    markers.set(s.id, m);
  }
  applyFilters();
}

const MARKER_STYLE = { radius: 6, weight: 1.5, color: "#10131a" };

function recolorMarkers() {
  if (!state.data) return;
  const colors = Object.fromEntries(TONES.map((tone) => [tone, toneColor(tone)])) as Record<Tone, string>;
  for (const s of state.data.shelters) markers.get(s.id)?.setStyle({ fillColor: colors[statusOf(s).tone] });
}

function matches(s: Shelter): boolean {
  const f = state.filters;
  if (f.kind && s.kind !== f.kind) return false;
  if (f.accessible && s.accessible !== true) return false;
  const st = statusOf(s);
  if (f.always && st.key !== "always") return false;
  if (!f.tones.has(st.tone)) return false;
  if (f.q) {
    for (const word of fold(f.q).split(/\s+/).filter(Boolean)) if (!s.haystack.includes(word)) return false;
  }
  return true;
}

let shownCount = 0;
function applyFilters(fit = false) {
  if (!state.data) return;
  layer.clearLayers();
  const bounds: L.LatLngExpression[] = [];
  shownCount = 0;
  for (const s of state.data.shelters) {
    if (!matches(s)) continue;
    const m = markers.get(s.id);
    if (m) layer.addLayer(m);
    bounds.push([s.lat, s.lng]);
    shownCount++;
  }
  renderShownCount();
  renderFilterBanner();
  if (fit && map && bounds.length) map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 16 });
}

/** Status rows with live counts; each one is also a show/hide toggle for the map. */
function renderLegend() {
  const counts = Object.fromEntries(TONES.map((tone) => [tone, 0])) as Record<Tone, number>;
  for (const s of state.data?.shelters ?? []) counts[statusOf(s).tone]++;
  $("#legend").innerHTML =
    `<legend>${esc(t.map.status)}</legend>` +
    TONES.map(
      (tone) => `<label class="tone-row"><input type="checkbox" data-tone="${tone}"${state.filters.tones.has(tone) ? " checked" : ""} />
        <span><i class="check" aria-hidden="true"></i><i class="dot tone-${tone}" aria-hidden="true"></i>${esc(t.legend[tone])}<b>${
          state.data ? num(counts[tone]) : ""
        }</b><small>${esc(t.legendHelp[tone])}</small></span></label>`,
    ).join("");
}

function filtersActive(): boolean {
  const f = state.filters;
  return !!f.q || f.always || f.accessible || !!f.kind || f.tones.size !== TONES.length;
}

/** Says plainly on the map itself when some shelters are hidden, with a one-tap way back. */
function renderFilterBanner() {
  const el = $("#filter-banner");
  el.hidden = !state.data || !filtersActive();
  if (el.hidden || !state.data) return;
  el.innerHTML = `<span>${esc(fmt(t.map.filtered, { n: num(shownCount), total: num(state.data.shelters.length) }))}</span>
    <button type="button" class="btn btn-go" data-reset>${esc(t.map.showAll)}</button>`;
}

function setPicking(on: boolean) {
  state.picking = on;
  const btn = $<HTMLButtonElement>("#pick");
  btn.textContent = on ? t.hero.pickCancel : t.hero.pickOnMap;
  btn.setAttribute("aria-pressed", String(on));
  const banner = $("#pick-banner");
  banner.hidden = !on;
  banner.textContent = t.map.pickNow;
  $("#leaflet").classList.toggle("is-picking", on);
  if (on) scrollToApp();
}

function renderShownCount() {
  const el = $("#shown");
  if (!state.data) {
    el.textContent = "";
    return;
  }
  el.innerHTML =
    shownCount === 0
      ? `${esc(t.map.noResults)} <button type="button" class="linkish" data-reset>${esc(t.map.reset)}</button>`
      : esc(fmt(t.map.shown, { n: num(shownCount), total: num(state.data.shelters.length) }));
}

function placeOriginMarker() {
  if (!map || !state.origin) return;
  const { point, source } = state.origin;
  originMarker?.remove();
  originMarker = L.circleMarker([point.lat, point.lng], {
    // Same canvas as the shelters: a second canvas on top would swallow every tap on them.
    renderer,
    interactive: false,
    radius: 10,
    weight: 4,
    color: "#ffffff",
    fillColor: "#1d4ed8",
    fillOpacity: 1,
  })
    .bindTooltip(source === "gps" ? t.map.youAreHere : t.map.picked, { permanent: true, direction: "top", offset: [0, -10] })
    .addTo(map);
  // Show where you are together with the nearest shelters, zooming only if they're not already in view.
  const near = state.data ? nearest(point, state.data.shelters, 3).map(({ s }) => L.latLng(s.lat, s.lng)) : [];
  const bounds = L.latLngBounds([L.latLng(point.lat, point.lng), ...near]);
  const view = map.getBounds().pad(-0.08);
  if (source === "gps" || !view.contains(bounds)) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
}

const SELECTED_STYLE = { radius: 12, weight: 4, color: "#1d4ed8" };

/** Shows one shelter's card at the top of the panel and highlights it on the map. */
function selectShelter(id: number | null, pan = false) {
  const prev = state.selectedId != null ? state.data?.shelters.find((x) => x.id === state.selectedId) : undefined;
  if (prev) markers.get(prev.id)?.setStyle(MARKER_STYLE);
  state.selectedId = id;
  renderSelected();
  if (id == null) return;
  const s = state.data?.shelters.find((x) => x.id === id);
  const m = markers.get(id);
  if (!s || !m || !map) return;
  if (!layer.hasLayer(m)) layer.addLayer(m);
  m.setStyle(SELECTED_STYLE).bringToFront();
  if (pan) {
    scrollToApp();
    map.setView([s.lat, s.lng], Math.max(map.getZoom(), 16));
  }
  scrollPanelTo($("#selected"));
}

function renderSelected() {
  const el = $("#selected");
  const s = state.selectedId != null ? state.data?.shelters.find((x) => x.id === state.selectedId) : undefined;
  if (!s) {
    el.innerHTML = "";
    return;
  }
  const d = state.origin ? distanceM(state.origin.point, s) : null;
  el.innerHTML = `<div class="selected-head"><h2>${esc(t.results.selected)}</h2>
    <button class="btn btn-quiet" type="button" id="close-selected">${esc(t.results.close)}</button></div>
    <ol class="cards">${card(s, d)}</ol>`;
}

document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (target.closest("[data-reset]")) {
    state.filters = { q: "", tones: new Set<Tone>(TONES), always: false, accessible: false, kind: "" };
    $<HTMLInputElement>("#q").value = "";
    for (const id of ["#f-always", "#f-accessible"]) $<HTMLInputElement>(id).checked = false;
    renderLegend();
    $<HTMLSelectElement>("#f-kind").value = "";
    applyFilters();
    return;
  }
});

let searchTimer: number | undefined;
$("#q").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    state.filters.q = (e.target as HTMLInputElement).value.trim();
    applyFilters(state.filters.q.length >= 3);
  }, 200);
});
$("#legend").addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;
  const tone = input.dataset.tone as Tone | undefined;
  if (!tone) return;
  if (input.checked) state.filters.tones.add(tone);
  else state.filters.tones.delete(tone);
  applyFilters();
});
for (const [id, key] of [["#f-always", "always"], ["#f-accessible", "accessible"]] as const) {
  $<HTMLInputElement>(id).addEventListener("change", (e) => {
    state.filters[key] = (e.target as HTMLInputElement).checked;
    applyFilters();
  });
}
$<HTMLSelectElement>("#f-kind").addEventListener("change", (e) => {
  state.filters.kind = (e.target as HTMLSelectElement).value as Kind | "";
  applyFilters();
});

function renderFooter() {
  const date = state.data?.sourcePublishedAt
    ? new Intl.DateTimeFormat(t.code, { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Vilnius" }).format(
        state.data.sourcePublishedAt,
      )
    : "–";
  $("#footer").innerHTML = `<div>
    <p class="footer-emergency"><a href="tel:112">112</a> <a href="tel:1856">1856</a></p>
    <p>${esc(t.footer.emergency)}</p>
    <p>${esc(t.footer.unofficial)}</p>
    <p>${esc(fmt(t.footer.data, { date }))}</p>
    <p>${esc(t.footer.guidance)}</p>
    <p>${esc(t.footer.offline)}</p>
    <p>${esc(t.footer.map)}</p>
  </div>`;
}

// ---------- language and text size ----------

const langSel = $<HTMLSelectElement>("#lang");
langSel.innerHTML = Object.values(LANGS)
  .map((l) => `<option value="${l.code}" lang="${l.code}">${esc(l.name)}</option>`)
  .join("");
langSel.value = state.lang;
langSel.addEventListener("change", () => {
  const v = langSel.value;
  if (!isLang(v)) return;
  setLang(v);
});

function setLang(lang: Lang) {
  state.lang = lang;
  t = LANGS[lang];
  savePref("lang", lang);
  const url = new URL(location.href);
  url.searchParams.set("lang", lang);
  history.replaceState(null, "", url);
  applyStaticText();
  originMarker?.setTooltipContent(state.origin?.source === "gps" ? t.map.youAreHere : t.map.picked);
  renderSelected();
}

const SIZES = ["1", "2", "3"];
function setSize(size: string) {
  document.documentElement.dataset.size = size;
  savePref("size", size);
  $("#textsize").setAttribute("aria-pressed", String(size !== "1"));
  map?.invalidateSize();
}
setSize(SIZES.includes(loadPref("size") ?? "") ? loadPref("size")! : "1");
$("#textsize").addEventListener("click", () => {
  const cur = document.documentElement.dataset.size ?? "1";
  setSize(SIZES[(SIZES.indexOf(cur) + 1) % SIZES.length]!);
});

// ---------- clock: statuses change with time ----------

setInterval(() => {
  const now = vilniusNow();
  if (now.minutes === state.now.minutes && now.day === state.now.day) return;
  state.now = now;
  statusCache.clear();
  recolorMarkers();
  applyFilters();
  renderLegend();
  renderResults();
}, 30_000);

// ---------- layout ----------

// The map + panel screen fills the viewport under the sticky bar, whose height
// changes with the text size and language.
new ResizeObserver(() => {
  document.documentElement.style.setProperty("--bar-h", `${$(".bar").offsetHeight}px`);
}).observe($(".bar"));
new ResizeObserver(() => map?.invalidateSize()).observe($("#leaflet"));

// ---------- boot ----------

applyStaticText();
initMap();

/** ?at=54.687,25.279 opens the page with that place as the origin (useful for QR codes on buildings). */
function originFromUrl(): Origin | null {
  const m = new URLSearchParams(location.search).get("at")?.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return lat >= 53 && lat <= 57 && lng >= 20 && lng <= 27.5 ? { point: { lat, lng }, source: "picked" } : null;
}

loadData()
  .then((data) => {
    state.data = data;
    buildMarkers();
    applyStaticText();
    const at = originFromUrl();
    if (at) {
      // Fit the shared place and its nearest shelters, whatever the current view.
      map?.setView([at.point.lat, at.point.lng], 16, { animate: false });
      setOrigin(at);
    }
  })
  .catch(() => {
    state.dataError = true;
    renderResults();
  });

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}));
}
