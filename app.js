const STORAGE_KEY = "baseball-count-v1";
const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MOODS = { great: "🔥", good: "😊", normal: "🙂", tired: "😵‍💫" };

const makeSplit = () => ({ plateAppearances: 0, hits: 0, runs: 0, walks: 0, strikeouts: 0 });
const makePlayerStats = () => ({
  plateAppearances: 0,
  hits: 0,
  singles: 0,
  doubles: 0,
  triples: 0,
  homeRuns: 0,
  runs: 0,
  walks: 0,
  strikeouts: 0,
  doublePlays: 0,
  outs: 0,
  pitches: 0
});

const localDateKey = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

function loadStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.days) return saved;
  } catch (error) {
    console.warn("保存データを読み込めませんでした", error);
  }
  return { version: 2, days: {}, roster: [] };
}

let store = loadStore();
if (!Array.isArray(store.roster) || !store.roster.length) {
  store.roster = [{ id: "player-1", name: "プレイヤー1" }];
}

const makeDay = () => ({
  counts: { strikes: 0, balls: 0, outs: 0 },
  stats: { plateAppearances: 0, hits: 0, runs: 0, walks: 0, strikeouts: 0 },
  splits: [makeSplit(), makeSplit(), makeSplit()],
  pitchTotal: 0,
  atBatPitches: 0,
  mode: "inning",
  bases: { first: false, second: false, third: false },
  activePlayerId: store.roster[0].id,
  playerStats: {},
  mood: "",
  note: "",
  touched: false,
  updatedAt: Date.now()
});

let activeDate = localDateKey();
let selectedRecordPlayerId = store.roster[0].id;
let toastTimer;
let noteTimer;

function normalizeDay(target) {
  target.counts ||= { strikes: 0, balls: 0, outs: 0 };
  target.stats ||= { plateAppearances: 0, hits: 0, runs: 0, walks: 0, strikeouts: 0 };
  target.splits ||= [makeSplit(), makeSplit(), makeSplit()];
  target.pitchTotal = Number(target.pitchTotal || 0);
  target.atBatPitches = Number(target.atBatPitches || 0);
  target.actionHistory ||= [];
  target.mode = target.mode === "atbat" ? "atbat" : "inning";
  target.bases ||= { first: false, second: false, third: false };
  ["first", "second", "third"].forEach((base) => {
    if (target.bases[base] === true) target.bases[base] = "manual";
    if (!target.bases[base]) target.bases[base] = false;
  });
  target.playerStats ||= {};

  const rosterHasActive = store.roster.some((player) => player.id === target.activePlayerId);
  if (!rosterHasActive) target.activePlayerId = store.roster[0].id;

  if (!Object.keys(target.playerStats).length && target.stats.plateAppearances) {
    target.playerStats[store.roster[0].id] = {
      ...makePlayerStats(),
      plateAppearances: target.stats.plateAppearances || 0,
      hits: target.stats.hits || 0,
      singles: target.stats.hits || 0,
      runs: target.stats.runs || 0,
      walks: target.stats.walks || 0,
      strikeouts: target.stats.strikeouts || 0
    };
  }

  store.roster.forEach((player) => {
    target.playerStats[player.id] ||= makePlayerStats();
  });
  return target;
}

function day() {
  store.days[activeDate] ||= makeDay();
  return normalizeDay(store.days[activeDate]);
}

function currentPlayer() {
  const target = day();
  return store.roster.find((player) => player.id === target.activePlayerId) || store.roster[0];
}

function playerStatsFor(target, playerId) {
  normalizeDay(target);
  target.playerStats[playerId] ||= makePlayerStats();
  return target.playerStats[playerId];
}

function currentPlayerStats() {
  return playerStatsFor(day(), currentPlayer().id);
}

function save({ touch = true } = {}) {
  const target = day();
  if (touch) target.touched = true;
  target.updatedAt = Date.now();
  store.version = 2;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  const label = $("#savedLabel");
  if (label) {
    label.textContent = "保存しました";
    window.setTimeout(() => { label.textContent = "自動保存"; }, 1200);
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

function setDateLabels() {
  const date = new Date(`${activeDate}T12:00:00`);
  $("#datePicker").value = activeDate;
  $("#weekdayLabel").textContent = WEEKDAYS[date.getDay()];
  $("#displayDate").textContent = `${date.getMonth() + 1}月${date.getDate()}日`;
}

function renderCounts() {
  const counts = day().counts;
  $$(".lamp[data-count-type]").forEach((lamp) => {
    lamp.classList.toggle("is-on", counts[lamp.dataset.countType] >= Number(lamp.dataset.index));
  });
  $("#strikeText").textContent = `${counts.strikes} STRIKE`;
  $("#ballText").textContent = `${counts.balls} BALL`;
  $("#outText").textContent = `${counts.outs} OUT`;
}

function renderStats() {
  const target = day();
  const stats = currentPlayerStats();
  const atBats = Math.max(0, stats.plateAppearances - stats.walks);
  const totalBases = stats.singles + (stats.doubles * 2) + (stats.triples * 3) + (stats.homeRuns * 4);
  const battingAverage = atBats ? stats.hits / atBats : 0;
  const onBasePercentage = stats.plateAppearances ? (stats.hits + stats.walks) / stats.plateAppearances : 0;
  const slugging = atBats ? totalBases / atBats : 0;
  const ops = onBasePercentage + slugging;
  const strikeoutRate = stats.plateAppearances ? (stats.strikeouts / stats.plateAppearances) * 100 : 0;
  $("#totalPitches").textContent = target.pitchTotal;
  $("#atBatPitches").textContent = target.atBatPitches;
  $("#dayStrikeouts").textContent = target.stats.strikeouts;
  $("#currentBatterName").textContent = currentPlayer().name;
  $("#statPa").textContent = stats.plateAppearances;
  $("#statHits").textContent = stats.hits;
  $("#statHomeRuns").textContent = stats.homeRuns;
  $("#statWalks").textContent = stats.walks;
  $("#playerStrikeouts").textContent = stats.strikeouts;
  $("#playerAverage").textContent = battingAverage.toFixed(3).replace(/^0/, "");
  $("#playerOps").textContent = ops.toFixed(3).replace(/^0/, "");
  $("#playerStrikeoutRate").textContent = `${strikeoutRate.toFixed(1)}%`;
  $("#inningRuns").textContent = `${target.stats.runs}得点`;
}

function renderModeAndRunners() {
  const target = day();
  const inningMode = target.mode === "inning";
  $$("[data-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === target.mode)));
  $("#runnerPanel").classList.toggle("is-disabled", !inningMode);
  $("#runnerModeHint").textContent = inningMode ? "塁をタップして修正" : "1打席モードでは使用しません";
  $$("[data-base]").forEach((button) => {
    button.disabled = !inningMode;
    button.setAttribute("aria-pressed", String(Boolean(target.bases[button.dataset.base])));
  });
  const hasRunner = Boolean(target.bases.first || target.bases.second || target.bases.third);
  $("#doublePlayButton").disabled = !inningMode || !hasRunner;
}

function renderCondition() {
  const target = day();
  $$("[data-mood]").forEach((button) => button.classList.toggle("is-selected", button.dataset.mood === target.mood));
  $("#noteInput").value = target.note || "";
  $("#noteCount").textContent = (target.note || "").length;
}

function renderHome() {
  setDateLabels();
  renderCounts();
  renderStats();
  renderModeAndRunners();
  renderCondition();
}

function resetPitchCount() {
  day().counts.strikes = 0;
  day().counts.balls = 0;
}

function clearBases(target = day()) {
  target.bases = { first: false, second: false, third: false };
}

function occupiedRunnerIds(target = day()) {
  return [target.bases.first, target.bases.second, target.bases.third].filter(Boolean);
}

function advanceForHit(target, type, batterId) {
  const { first, second, third } = target.bases;
  if (type === "single") {
    target.bases = { first: batterId, second: first, third: second };
    return [third].filter(Boolean);
  }
  if (type === "double") {
    target.bases = { first: false, second: batterId, third: first };
    return [second, third].filter(Boolean);
  }
  if (type === "triple") {
    target.bases = { first: false, second: false, third: batterId };
    return [first, second, third].filter(Boolean);
  }
  clearBases(target);
  return [first, second, third, batterId].filter(Boolean);
}

function advanceForWalk(target, batterId) {
  const { first, second, third } = target.bases;
  const scorers = first && second && third ? [third] : [];
  target.bases.first = batterId;
  if (first) target.bases.second = first;
  if (first && second) target.bases.third = second;
  return scorers;
}

function scoreRunners(target, runnerIds) {
  if (!runnerIds.length) return;
  target.stats.runs += runnerIds.length;
  runnerIds.forEach((runnerId) => {
    if (target.playerStats[runnerId]) target.playerStats[runnerId].runs += 1;
  });
}

function removeLeadRunner(target) {
  if (target.bases.third) target.bases.third = false;
  else if (target.bases.second) target.bases.second = false;
  else if (target.bases.first) target.bases.first = false;
}

function recordPitch() {
  const target = day();
  target.pitchTotal += 1;
  target.atBatPitches += 1;
  currentPlayerStats().pitches += 1;
}

function pushPitchSnapshot(target = day()) {
  target.actionHistory ||= [];
  const snapshot = JSON.parse(JSON.stringify(target));
  delete snapshot.actionHistory;
  target.actionHistory.push(snapshot);
  if (target.actionHistory.length > 60) target.actionHistory.shift();
}

function undoLastPitch() {
  const target = day();
  if (!target.actionHistory.length) {
    showToast("戻せる投球がありません");
    return;
  }
  const history = target.actionHistory;
  const snapshot = history.pop();
  store.days[activeDate] = { ...snapshot, actionHistory: history };
  save();
  renderHome();
  showToast("1球前に戻しました");
}

function resetCurrentPlayerStats() {
  const target = day();
  const playerId = currentPlayer().id;
  const previous = currentPlayerStats();
  target.stats.plateAppearances = Math.max(0, target.stats.plateAppearances - previous.plateAppearances);
  target.stats.hits = Math.max(0, target.stats.hits - previous.hits);
  target.stats.runs = Math.max(0, target.stats.runs - previous.runs);
  target.stats.walks = Math.max(0, target.stats.walks - previous.walks);
  target.stats.strikeouts = Math.max(0, target.stats.strikeouts - previous.strikeouts);
  target.pitchTotal = Math.max(0, target.pitchTotal - previous.pitches);
  target.atBatPitches = 0;
  resetPitchCount();
  ["first", "second", "third"].forEach((base) => {
    if (target.bases[base] === playerId) target.bases[base] = false;
  });
  target.playerStats[playerId] = makePlayerStats();
  target.actionHistory = [];
  save();
  renderHome();
  showToast(`${currentPlayer().name}の今日の成績をリセットしました`);
}

function addOuts(count) {
  const target = day();
  if (target.counts.outs + count >= 3) {
    target.counts.outs = 0;
    if (target.mode === "inning") clearBases(target);
    return true;
  }
  target.counts.outs += count;
  return false;
}

function handleCount(action) {
  const target = day();
  pushPitchSnapshot(target);
  recordPitch();

  if (action === "ball") {
    target.counts.balls += 1;
    if (target.counts.balls >= 4) {
      recordResult("walk", { automatic: true, countPitch: false });
      return;
    }
  }

  if (action === "strike") {
    target.counts.strikes += 1;
    if (target.counts.strikes >= 3) {
      recordResult("strikeout", { automatic: true, countPitch: false });
      return;
    }
  }

  if (action === "foul") {
    if (target.counts.strikes < 2) target.counts.strikes += 1;
    else showToast("2ストライク後のファウル");
  }

  save();
  renderHome();
}

function recordResult(type, { automatic = false, countPitch = true } = {}) {
  const target = day();
  if (type === "doublePlay" && (target.mode !== "inning" || !occupiedRunnerIds(target).length)) {
    showToast("併殺はイニングモードでランナーがいる時だけ使えます");
    return;
  }
  const playerStats = currentPlayerStats();
  const outAtRecord = Math.min(target.counts.outs, 2);
  const split = target.splits[outAtRecord];
  const hitTypes = {
    single: ["singles", "単打"],
    double: ["doubles", "二塁打"],
    triple: ["triples", "三塁打"],
    homeRun: ["homeRuns", "本塁打"]
  };
  let inningChanged = false;
  let label = "結果を記録";
  let scoringRunners = [];

  if (countPitch) {
    pushPitchSnapshot(target);
    recordPitch();
  }
  target.stats.plateAppearances += 1;
  playerStats.plateAppearances += 1;
  split.plateAppearances += 1;

  if (hitTypes[type]) {
    const [statKey, hitLabel] = hitTypes[type];
    target.stats.hits += 1;
    playerStats.hits += 1;
    playerStats[statKey] += 1;
    split.hits += 1;
    label = hitLabel;
    if (target.mode === "inning") scoringRunners = advanceForHit(target, type, currentPlayer().id);
  }

  if (type === "walk") {
    target.stats.walks += 1;
    playerStats.walks += 1;
    split.walks += 1;
    label = automatic ? "4ボール・四球" : "四球";
    if (target.mode === "inning") scoringRunners = advanceForWalk(target, currentPlayer().id);
  }

  if (type === "strikeout") {
    target.stats.strikeouts += 1;
    playerStats.strikeouts += 1;
    playerStats.outs += 1;
    split.strikeouts += 1;
    inningChanged = addOuts(1);
    label = automatic ? "3ストライク・三振" : "三振";
  }

  if (type === "doublePlay") {
    playerStats.doublePlays += 1;
    playerStats.outs += 2;
    removeLeadRunner(target);
    inningChanged = addOuts(2);
    label = "併殺";
  }

  if (type === "plateOut") {
    playerStats.outs += 1;
    inningChanged = addOuts(1);
    label = "アウト";
  }

  if (scoringRunners.length) {
    scoreRunners(target, scoringRunners);
    split.runs += scoringRunners.length;
  }

  resetPitchCount();
  save();
  renderHome();
  const runMessage = scoringRunners.length ? `・${scoringRunners.length}得点` : "";
  showToast(`${label}を記録${runMessage}${inningChanged ? "・チェンジ！" : ""}`);
}

function switchBatter(playerId) {
  const target = day();
  let nextId = playerId;
  if (!nextId) {
    const index = store.roster.findIndex((player) => player.id === target.activePlayerId);
    nextId = store.roster[(index + 1) % store.roster.length].id;
  }
  target.activePlayerId = nextId;
  target.atBatPitches = 0;
  resetPitchCount();
  save();
  renderHome();
  showToast(`${currentPlayer().name}に切り替えました`);
}

function average(hits, plateAppearances, walks = 0) {
  const atBats = Math.max(0, plateAppearances - walks);
  if (!atBats) return ".000";
  return (hits / atBats).toFixed(3).replace(/^0/, "");
}

function allRecordedDays() {
  return Object.entries(store.days)
    .map(([dateKey, value]) => [dateKey, normalizeDay(value)])
    .filter(([, value]) => value.touched)
    .sort(([a], [b]) => b.localeCompare(a));
}

function aggregatePlayer(playerId, days) {
  const totals = makePlayerStats();
  let activeDays = 0;
  days.forEach(([, value]) => {
    const stats = value.playerStats[playerId];
    if (!stats) return;
    Object.keys(totals).forEach((key) => { totals[key] += Number(stats[key] || 0); });
    if (stats.plateAppearances || stats.pitches) activeDays += 1;
  });
  return { totals, activeDays };
}

function renderPlayerSelect() {
  const select = $("#recordPlayerSelect");
  if (!store.roster.some((player) => player.id === selectedRecordPlayerId)) selectedRecordPlayerId = store.roster[0].id;
  select.innerHTML = "";
  store.roster.forEach((player) => {
    const option = document.createElement("option");
    option.value = player.id;
    option.textContent = player.name;
    option.selected = player.id === selectedRecordPlayerId;
    select.appendChild(option);
  });
}

function renderRecords() {
  const days = allRecordedDays();
  renderPlayerSelect();
  const { totals, activeDays } = aggregatePlayer(selectedRecordPlayerId, days);

  $("#careerAverage").textContent = average(totals.hits, totals.plateAppearances, totals.walks);
  $("#careerDays").textContent = activeDays;
  $("#careerHits").textContent = totals.hits;
  $("#careerPa").textContent = totals.plateAppearances;
  $("#careerSingles").textContent = totals.singles;
  $("#careerDoubles").textContent = totals.doubles;
  $("#careerTriples").textContent = totals.triples;
  $("#careerHomeRuns").textContent = totals.homeRuns;
  $("#careerWalks").textContent = totals.walks;
  $("#careerStrikeouts").textContent = totals.strikeouts;
  $("#careerDoublePlays").textContent = totals.doublePlays;

  const list = $("#historyList");
  list.innerHTML = "";
  $("#emptyState").hidden = days.length > 0;

  days.forEach(([dateKey, value]) => {
    const date = new Date(`${dateKey}T12:00:00`);
    const activePlayers = Object.values(value.playerStats).filter((stats) => stats.plateAppearances || stats.pitches).length;
    const button = document.createElement("button");
    button.className = "history-card";
    button.dataset.historyDate = dateKey;
    button.innerHTML = `
      <span class="history-date"><strong>${date.getDate()}</strong><span>${date.getMonth() + 1}月</span></span>
      <span class="history-main"><strong>${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 <i class="history-mood">${MOODS[value.mood] || ""}</i></strong><p>${value.pitchTotal}球 ・ ${value.stats.hits}安打 ・ ${value.stats.strikeouts}奪三振 ・ ${activePlayers}人</p></span>
      <span class="history-side"><strong>${value.stats.plateAppearances}</strong><span>打席</span></span>`;
    list.appendChild(button);
  });
}

function renderPlayerList() {
  const list = $("#playerList");
  list.innerHTML = "";
  store.roster.forEach((player) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.playerId = player.id;
    button.classList.toggle("is-active", player.id === day().activePlayerId);
    button.append(document.createTextNode(player.name));
    const status = document.createElement("span");
    status.textContent = player.id === day().activePlayerId ? "現在の打者" : "選択";
    button.appendChild(status);
    list.appendChild(button);
  });
}

function addPlayer() {
  const input = $("#playerNameInput");
  const name = input.value.trim();
  if (!name) {
    showToast("選手名を入力してください");
    return;
  }
  if (store.roster.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
    showToast("同じ名前の選手が登録されています");
    return;
  }
  const player = { id: `player-${Date.now()}`, name };
  store.roster.push(player);
  Object.values(store.days).forEach((target) => { normalizeDay(target).playerStats[player.id] ||= makePlayerStats(); });
  input.value = "";
  switchBatter(player.id);
  renderPlayerList();
}

function switchView(name) {
  $$(".view").forEach((view) => {
    const active = view.dataset.view === name;
    view.hidden = !active;
    view.classList.toggle("is-active", active);
  });
  $$("[data-nav]").forEach((button) => {
    const active = button.dataset.nav === name;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (name === "record") renderRecords();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$$("[data-action]").forEach((button) => button.addEventListener("click", () => handleCount(button.dataset.action)));
$$("[data-result]").forEach((button) => button.addEventListener("click", () => recordResult(button.dataset.result)));
$$("[data-nav]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.nav)));

$$("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = day();
    if (target.mode === button.dataset.mode) return;
    target.mode = button.dataset.mode;
    target.counts = { strikes: 0, balls: 0, outs: 0 };
    target.atBatPitches = 0;
    clearBases(target);
    save();
    renderHome();
    showToast(target.mode === "inning" ? "イニングモードに切り替えました" : "1打席モードに切り替えました");
  });
});

$$("[data-base]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = day();
    if (target.mode !== "inning") return;
    const base = button.dataset.base;
    target.bases[base] = target.bases[base] ? false : currentPlayer().id;
    save();
    renderHome();
  });
});

$("#switchBatterButton").addEventListener("click", () => switchBatter());
$("#undoPitchButton").addEventListener("click", undoLastPitch);

$$("[data-mood]").forEach((button) => {
  button.addEventListener("click", () => {
    day().mood = button.dataset.mood;
    save();
    renderCondition();
  });
});

$("#noteInput").addEventListener("input", (event) => {
  day().note = event.target.value;
  $("#noteCount").textContent = event.target.value.length;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => save(), 350);
});

$("#datePicker").addEventListener("change", (event) => {
  if (!event.target.value) return;
  activeDate = event.target.value;
  renderHome();
  showToast("記録日を切り替えました");
});

$("#recordPlayerSelect").addEventListener("change", (event) => {
  selectedRecordPlayerId = event.target.value;
  renderRecords();
});

$("#historyList").addEventListener("click", (event) => {
  const card = event.target.closest("[data-history-date]");
  if (!card) return;
  activeDate = card.dataset.historyDate;
  renderHome();
  switchView("home");
});

const resetDialog = $("#resetDialog");
$("#resetGameButton").addEventListener("click", () => resetDialog.showModal());
resetDialog.addEventListener("close", () => {
  if (resetDialog.returnValue !== "confirm") return;
  day().counts = { strikes: 0, balls: 0, outs: 0 };
  day().atBatPitches = 0;
  clearBases();
  save();
  renderHome();
  showToast("カウントをリセットしました");
});

const playerDialog = $("#playerDialog");
$("#openPlayerDialog").addEventListener("click", () => {
  renderPlayerList();
  playerDialog.showModal();
  window.setTimeout(() => $("#playerNameInput").focus(), 80);
});
$("#addPlayerButton").addEventListener("click", addPlayer);
$("#playerNameInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addPlayer();
  }
});
$("#playerList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-player-id]");
  if (!button) return;
  switchBatter(button.dataset.playerId);
  playerDialog.close();
});

const playerResetDialog = $("#playerResetDialog");
$("#resetPlayerStatsButton").addEventListener("click", () => {
  $("#resetPlayerName").textContent = currentPlayer().name;
  playerResetDialog.showModal();
});
playerResetDialog.addEventListener("close", () => {
  if (playerResetDialog.returnValue === "confirm") resetCurrentPlayerStats();
});

renderHome();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
}
