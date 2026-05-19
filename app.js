const STORAGE_KEY = "personal-schedule-events-v2";
const LEGACY_STORAGE_KEY = "personal-schedule-events-v1";

const categoryLabels = {
  customer: "顧客対応",
  staff: "スタッフ対応",
  branch: "店舗/式場",
  admin: "事務処理",
  system: "kintone/システム",
  report: "日報/振り返り",
  personal: "私用"
};

const typeLabels = {
  meeting: "打合せ",
  visit: "訪問",
  call: "電話/連絡",
  work: "作業",
  check: "確認",
  travel: "移動",
  deadline: "締切",
  off: "休み"
};

const statusLabels = {
  scheduled: "予定",
  tentative: "仮予定",
  active: "対応中",
  done: "完了",
  hold: "保留",
  postponed: "延期/キャンセル"
};

const priorityLabels = {
  high: "高",
  normal: "通常",
  low: "低"
};

const roleLabels = {
  owner: "主担当",
  support: "同行/補助",
  reviewer: "確認者",
  share: "共有のみ"
};

const flagLabels = {
  reply: "要返信",
  precheck: "要事前確認",
  share: "要共有",
  report: "日報",
  gcal: "GCal済"
};

const state = {
  events: loadEvents(),
  visibleDate: startOfMonth(new Date()),
  selectedDate: toDateKey(new Date()),
  activeView: "list",
  period: "upcoming",
  categoryFilter: "all",
  statusFilter: "all",
  search: ""
};

const els = {
  todayText: document.querySelector("#todayText"),
  monthTitle: document.querySelector("#monthTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  selectedDateTitle: document.querySelector("#selectedDateTitle"),
  selectedEvents: document.querySelector("#selectedEvents"),
  allEventsList: document.querySelector("#allEventsList"),
  eventForm: document.querySelector("#eventForm"),
  eventId: document.querySelector("#eventId"),
  titleInput: document.querySelector("#titleInput"),
  dateInput: document.querySelector("#dateInput"),
  assigneeInput: document.querySelector("#assigneeInput"),
  allDayInput: document.querySelector("#allDayInput"),
  startInput: document.querySelector("#startInput"),
  endInput: document.querySelector("#endInput"),
  categoryInput: document.querySelector("#categoryInput"),
  eventTypeInput: document.querySelector("#eventTypeInput"),
  statusInput: document.querySelector("#statusInput"),
  priorityInput: document.querySelector("#priorityInput"),
  roleInput: document.querySelector("#roleInput"),
  branchInput: document.querySelector("#branchInput"),
  projectInput: document.querySelector("#projectInput"),
  locationInput: document.querySelector("#locationInput"),
  notesInput: document.querySelector("#notesInput"),
  quickMemo: document.querySelector("#quickMemo"),
  conflictWarning: document.querySelector("#conflictWarning"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  searchInput: document.querySelector("#searchInput"),
  filterCategoryInput: document.querySelector("#filterCategoryInput"),
  filterStatusInput: document.querySelector("#filterStatusInput"),
  todayCount: document.querySelector("#todayCount"),
  reportCount: document.querySelector("#reportCount"),
  highCount: document.querySelector("#highCount"),
  checkCount: document.querySelector("#checkCount"),
  eventTemplate: document.querySelector("#eventTemplate")
};

bindEvents();
registerServiceWorker();
resetForm();
render();

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setActiveView(button.dataset.view));
  });

  document.querySelector("#quickAddButton").addEventListener("click", () => openNewEventForm());
  document.querySelector("#listAddButton").addEventListener("click", () => openNewEventForm());

  document.querySelector("#prevMonthButton").addEventListener("click", () => {
    state.visibleDate = addMonths(state.visibleDate, -1);
    renderCalendar();
  });

  document.querySelector("#nextMonthButton").addEventListener("click", () => {
    state.visibleDate = addMonths(state.visibleDate, 1);
    renderCalendar();
  });

  document.querySelector("#todayButton").addEventListener("click", () => {
    const today = new Date();
    state.visibleDate = startOfMonth(today);
    state.selectedDate = toDateKey(today);
    resetForm({ date: state.selectedDate });
    render();
  });

  document.querySelector("#addSelectedButton").addEventListener("click", () => openNewEventForm(state.selectedDate));

  document.querySelector("#parseMemoButton").addEventListener("click", () => {
    const parsed = parseJapaneseMemo(els.quickMemo.value);
    resetForm({
      title: parsed.title,
      date: parsed.date || state.selectedDate,
      start: parsed.start,
      end: parsed.end,
      allDay: !parsed.start,
      category: parsed.category,
      eventType: parsed.eventType,
      flags: parsed.flags,
      notes: els.quickMemo.value.trim()
    });
    setActiveView("form");
    els.titleInput.focus();
  });

  els.eventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveCurrentForm();
  });

  els.cancelEditButton.addEventListener("click", () => resetForm({ date: state.selectedDate }));

  [els.dateInput, els.assigneeInput, els.startInput, els.endInput, els.allDayInput].forEach((input) => {
    input.addEventListener("input", updateConflictWarning);
  });

  els.allDayInput.addEventListener("change", () => {
    const disabled = els.allDayInput.checked;
    els.startInput.disabled = disabled;
    els.endInput.disabled = disabled;
    if (disabled) {
      els.startInput.value = "";
      els.endInput.value = "";
    }
    updateConflictWarning();
  });

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim().toLowerCase();
    renderList();
  });

  els.filterCategoryInput.addEventListener("change", () => {
    state.categoryFilter = els.filterCategoryInput.value;
    renderList();
  });

  els.filterStatusInput.addEventListener("change", () => {
    state.statusFilter = els.filterStatusInput.value;
    renderList();
  });

  document.querySelectorAll("[data-period]").forEach((button) => {
    button.addEventListener("click", () => {
      state.period = button.dataset.period;
      document.querySelectorAll("[data-period]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderList();
    });
  });

  document.querySelector("#exportJsonButton").addEventListener("click", () => {
    downloadFile("schedule-events.json", JSON.stringify(state.events, null, 2), "application/json");
  });

  document.querySelector("#exportCsvButton").addEventListener("click", () => {
    downloadFile("schedule-events.csv", toCsv(state.events), "text/csv;charset=utf-8");
  });

  document.querySelector("#importInput").addEventListener("change", importJson);
  document.querySelector("#seedButton").addEventListener("click", addSampleEvents);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  });
}

function setActiveView(view) {
  state.activeView = view;
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === `${view}View`);
  });
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openNewEventForm(date = state.selectedDate) {
  resetForm({ date });
  setActiveView("form");
  els.titleInput.focus();
}

function render() {
  els.todayText.textContent = new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "full"
  }).format(new Date());
  renderStats();
  renderList();
  renderCalendar();
  renderSelectedDay();
  updateConflictWarning();
}

function renderStats() {
  const today = toDateKey(new Date());
  els.todayCount.textContent = state.events.filter((item) => item.date === today && item.status !== "done").length;
  els.checkCount.textContent = state.events.filter((item) => hasCheckFlag(item) && item.status !== "done").length;
  els.highCount.textContent = state.events.filter((item) => item.priority === "high" && item.status !== "done").length;
  els.reportCount.textContent = state.events.filter((item) => item.flags.includes("report")).length;
}

function renderList() {
  const events = filteredEvents();
  els.allEventsList.innerHTML = "";

  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "条件に合う予定はありません";
    els.allEventsList.appendChild(empty);
    return;
  }

  const grouped = groupByDate(events);
  Object.entries(grouped).forEach(([date, items]) => {
    const section = document.createElement("section");
    section.className = "date-group";
    section.innerHTML = `
      <div class="date-heading">
        <span>${formatDateHeading(date)}</span>
        <small>${items.length}件</small>
      </div>
      <div class="event-list"></div>
    `;
    const list = section.querySelector(".event-list");
    items.forEach((item) => list.appendChild(createEventNode(item)));
    els.allEventsList.appendChild(section);
  });
}

function renderCalendar() {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long"
  });
  els.monthTitle.textContent = formatter.format(state.visibleDate);
  els.calendarGrid.innerHTML = "";

  const first = startOfMonth(state.visibleDate);
  const start = addDays(first, -(first.getDay() === 0 ? 6 : first.getDay() - 1));
  const todayKey = toDateKey(new Date());

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(start, index);
    const dateKey = toDateKey(date);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day-cell";
    if (date.getMonth() !== state.visibleDate.getMonth()) cell.classList.add("is-muted");
    if (dateKey === todayKey) cell.classList.add("is-today");
    if (dateKey === state.selectedDate) cell.classList.add("is-selected");
    cell.addEventListener("click", () => {
      state.selectedDate = dateKey;
      renderCalendar();
      renderSelectedDay();
    });

    const dayEvents = eventsForDate(dateKey);
    cell.innerHTML = `
      <span class="day-number">
        <span>${date.getDate()}</span>
        <span>${dayEvents.length || ""}</span>
      </span>
      <span class="day-events"></span>
    `;

    const eventWrap = cell.querySelector(".day-events");
    dayEvents.slice(0, 3).forEach((item) => {
      const chip = document.createElement("span");
      chip.className = `chip ${item.category}`;
      chip.textContent = `${formatTimeRange(item)} ${item.title}`.trim();
      eventWrap.appendChild(chip);
    });
    els.calendarGrid.appendChild(cell);
  }
}

function renderSelectedDay() {
  els.selectedDateTitle.textContent = formatDateHeading(state.selectedDate);
  renderEventList(els.selectedEvents, eventsForDate(state.selectedDate));
}

function renderEventList(container, events) {
  container.innerHTML = "";
  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "予定なし";
    container.appendChild(empty);
    return;
  }
  events.sort(sortEvents).forEach((item) => container.appendChild(createEventNode(item)));
}

function createEventNode(item) {
  const node = els.eventTemplate.content.firstElementChild.cloneNode(true);
  node.classList.add(`priority-${item.priority}`, `status-${item.status}`);
  node.querySelector(".event-time").textContent = `${formatTimeRange(item)} ${typeLabels[item.eventType] || ""}`.trim();
  node.querySelector(".event-status").textContent = statusLabels[item.status] || item.status;
  node.querySelector(".event-title").textContent = item.title;

  const meta = [
    categoryLabels[item.category],
    item.assignee,
    roleLabels[item.role],
    item.branch ? `拠点:${item.branch}` : "",
    item.project ? `案件:${item.project}` : "",
    item.location ? `場所:${item.location}` : "",
    item.priority === "high" ? "高優先" : ""
  ].filter(Boolean);
  node.querySelector(".event-meta").textContent = meta.join(" / ");

  const flagWrap = node.querySelector(".event-flags");
  item.flags.forEach((flag) => {
    const tag = document.createElement("span");
    tag.className = `flag-tag ${flag}`;
    tag.textContent = flagLabels[flag] || flag;
    flagWrap.appendChild(tag);
  });

  node.querySelector(".edit-button").addEventListener("click", () => editEvent(item.id));
  node.querySelector(".delete-button").addEventListener("click", () => deleteEvent(item.id));
  node.querySelector(".done-button").addEventListener("click", () => markDone(item.id));
  return node;
}

function filteredEvents() {
  const today = toDateKey(new Date());
  const tomorrow = toDateKey(addDays(new Date(), 1));
  const weekEnd = toDateKey(addDays(new Date(), 7));

  return state.events
    .filter((item) => {
      if (state.categoryFilter !== "all" && item.category !== state.categoryFilter) return false;
      if (state.statusFilter !== "all" && item.status !== state.statusFilter) return false;
      if (!matchesSearch(item)) return false;
      if (state.period === "today") return item.date === today;
      if (state.period === "tomorrow") return item.date === tomorrow;
      if (state.period === "week") return item.date >= today && item.date <= weekEnd;
      if (state.period === "needs-check") return hasCheckFlag(item);
      if (state.period === "high") return item.priority === "high";
      if (state.period === "report") return item.flags.includes("report");
      return item.date >= today || item.status !== "done";
    })
    .sort(sortEvents);
}

function saveCurrentForm() {
  const event = {
    id: els.eventId.value || crypto.randomUUID(),
    title: els.titleInput.value.trim(),
    date: els.dateInput.value,
    assignee: els.assigneeInput.value.trim(),
    allDay: els.allDayInput.checked,
    start: els.allDayInput.checked ? "" : els.startInput.value,
    end: els.allDayInput.checked ? "" : els.endInput.value,
    category: els.categoryInput.value,
    eventType: els.eventTypeInput.value,
    status: els.statusInput.value,
    priority: els.priorityInput.value,
    role: els.roleInput.value,
    branch: els.branchInput.value.trim(),
    project: els.projectInput.value.trim(),
    location: els.locationInput.value.trim(),
    flags: selectedFlags(),
    notes: els.notesInput.value.trim(),
    updatedAt: new Date().toISOString()
  };

  if (!event.title || !event.date || !event.assignee) return;
  if (!event.allDay && event.start && event.end && event.end < event.start) {
    els.conflictWarning.textContent = "終了時刻が開始時刻より前です。";
    els.conflictWarning.classList.remove("hidden");
    return;
  }

  const existingIndex = state.events.findIndex((item) => item.id === event.id);
  if (existingIndex >= 0) {
    state.events[existingIndex] = event;
  } else {
    state.events.push(event);
  }

  state.selectedDate = event.date;
  state.visibleDate = startOfMonth(new Date(`${event.date}T00:00:00`));
  persist();
  resetForm({ date: event.date });
  setActiveView("list");
  render();
}

function editEvent(id) {
  const item = state.events.find((event) => event.id === id);
  if (!item) return;
  els.eventId.value = item.id;
  els.titleInput.value = item.title;
  els.dateInput.value = item.date;
  els.assigneeInput.value = item.assignee;
  els.allDayInput.checked = item.allDay;
  els.startInput.value = item.start;
  els.endInput.value = item.end;
  els.categoryInput.value = item.category;
  els.eventTypeInput.value = item.eventType;
  els.statusInput.value = item.status;
  els.priorityInput.value = item.priority;
  els.roleInput.value = item.role;
  els.branchInput.value = item.branch;
  els.projectInput.value = item.project;
  els.locationInput.value = item.location;
  els.notesInput.value = item.notes;
  setSelectedFlags(item.flags);
  els.cancelEditButton.classList.remove("hidden");
  els.startInput.disabled = item.allDay;
  els.endInput.disabled = item.allDay;
  updateConflictWarning();
  setActiveView("form");
}

function deleteEvent(id) {
  state.events = state.events.filter((item) => item.id !== id);
  persist();
  render();
}

function markDone(id) {
  const item = state.events.find((event) => event.id === id);
  if (!item) return;
  item.status = "done";
  item.updatedAt = new Date().toISOString();
  persist();
  render();
}

function resetForm(overrides = {}) {
  els.eventForm.reset();
  els.eventId.value = "";
  els.titleInput.value = overrides.title || "";
  els.dateInput.value = overrides.date || state.selectedDate;
  els.assigneeInput.value = overrides.assignee || "自分";
  els.allDayInput.checked = overrides.allDay ?? false;
  els.startInput.value = overrides.start || "";
  els.endInput.value = overrides.end || "";
  els.categoryInput.value = overrides.category || "customer";
  els.eventTypeInput.value = overrides.eventType || "meeting";
  els.statusInput.value = overrides.status || "scheduled";
  els.priorityInput.value = overrides.priority || "normal";
  els.roleInput.value = overrides.role || "owner";
  els.branchInput.value = overrides.branch || "";
  els.projectInput.value = overrides.project || "";
  els.locationInput.value = overrides.location || "";
  els.notesInput.value = overrides.notes || "";
  setSelectedFlags(overrides.flags || []);
  els.startInput.disabled = els.allDayInput.checked;
  els.endInput.disabled = els.allDayInput.checked;
  els.cancelEditButton.classList.add("hidden");
  els.conflictWarning.classList.add("hidden");
}

function updateConflictWarning() {
  const draft = {
    id: els.eventId.value,
    date: els.dateInput.value,
    assignee: els.assigneeInput.value.trim(),
    allDay: els.allDayInput.checked,
    start: els.startInput.value,
    end: els.endInput.value
  };
  const conflicts = findConflicts(draft);
  if (!conflicts.length) {
    els.conflictWarning.classList.add("hidden");
    return;
  }
  els.conflictWarning.textContent = `重複候補: ${conflicts.map((item) => item.title).join("、")}`;
  els.conflictWarning.classList.remove("hidden");
}

function findConflicts(draft) {
  if (!draft.date || draft.allDay || !draft.start) return [];
  return state.events.filter((item) => {
    if (item.id === draft.id || item.date !== draft.date || item.allDay || !item.start) return false;
    if (item.assignee !== draft.assignee) return false;
    const draftEnd = draft.end || draft.start;
    const itemEnd = item.end || item.start;
    return draft.start <= itemEnd && draftEnd >= item.start;
  });
}

function selectedFlags() {
  return Array.from(document.querySelectorAll('input[name="flags"]:checked')).map((input) => input.value);
}

function setSelectedFlags(flags) {
  document.querySelectorAll('input[name="flags"]').forEach((input) => {
    input.checked = flags.includes(input.value);
  });
}

function eventsForDate(dateKey) {
  return state.events.filter((item) => item.date === dateKey).sort(sortEvents);
}

function sortEvents(a, b) {
  return `${a.date} ${a.start || "00:00"}`.localeCompare(`${b.date} ${b.start || "00:00"}`);
}

function matchesSearch(item) {
  if (!state.search) return true;
  const haystack = [item.title, item.assignee, item.branch, item.project, item.location, item.notes].join(" ").toLowerCase();
  return haystack.includes(state.search);
}

function hasCheckFlag(item) {
  return item.flags.some((flag) => ["reply", "precheck", "share"].includes(flag)) || item.status === "hold";
}

function groupByDate(events) {
  return events.reduce((groups, item) => {
    groups[item.date] = groups[item.date] || [];
    groups[item.date].push(item);
    return groups;
  }, {});
}

function parseJapaneseMemo(text) {
  const source = text.trim();
  const now = new Date();
  let date = state.selectedDate;
  let cleaned = source;
  let eventType = "meeting";
  let category = "customer";
  const flags = [];

  if (/明日/.test(cleaned)) {
    date = toDateKey(addDays(now, 1));
    cleaned = cleaned.replace(/明日/g, "");
  } else if (/今日|本日/.test(cleaned)) {
    date = toDateKey(now);
    cleaned = cleaned.replace(/今日|本日/g, "");
  } else {
    const dateMatch = cleaned.match(/(\d{1,2})[\/月](\d{1,2})日?/);
    if (dateMatch) {
      const year = now.getFullYear();
      date = toDateKey(new Date(year, Number(dateMatch[1]) - 1, Number(dateMatch[2])));
      cleaned = cleaned.replace(dateMatch[0], "");
    }
  }

  const timeMatch = cleaned.match(/(\d{1,2})(?::|時)(\d{2})?/);
  const start = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${(timeMatch[2] || "00").padStart(2, "0")}` : "";
  const end = start ? addMinutesToTime(start, 60) : "";
  if (timeMatch) cleaned = cleaned.replace(timeMatch[0], "");

  if (/電話|連絡|返信/.test(source)) eventType = "call";
  if (/訪問|外出|式場|店舗/.test(source)) eventType = "visit";
  if (/移動/.test(source)) eventType = "travel";
  if (/締切|期限/.test(source)) eventType = "deadline";
  if (/確認/.test(source)) eventType = "check";
  if (/スタッフ|面談|勤務/.test(source)) category = "staff";
  if (/kintone|システム|アプリ/.test(source)) category = "system";
  if (/日報|振り返り/.test(source)) category = "report";
  if (/事務|請求|契約|資料/.test(source)) category = "admin";
  if (/返信/.test(source)) flags.push("reply");
  if (/確認/.test(source)) flags.push("precheck");
  if (/共有/.test(source)) flags.push("share");
  if (/日報/.test(source)) flags.push("report");

  return {
    date,
    start,
    end,
    category,
    eventType,
    flags,
    title: cleaned.replace(/\s+/g, " ").trim() || source || "新しい予定"
  };
}

function toCsv(events) {
  const headers = [
    "date",
    "start",
    "end",
    "allDay",
    "assignee",
    "category",
    "eventType",
    "status",
    "priority",
    "role",
    "branch",
    "project",
    "title",
    "location",
    "flags",
    "notes"
  ];
  const rows = [...events].sort(sortEvents).map((item) => headers.map((key) => csvEscape(key === "flags" ? item.flags.join("|") : item[key])).join(","));
  return [headers.join(","), ...rows].join("\r\n");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!Array.isArray(imported)) throw new Error("Invalid JSON");
      state.events = imported.map(normalizeEvent).filter(Boolean);
      persist();
      render();
      setActiveView("list");
    } catch {
      alert("JSONを読み込めませんでした。");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function normalizeEvent(item) {
  if (!item || !item.title || !item.date) return null;
  const legacyFlags = [];
  if (item.status === "needs-check") legacyFlags.push("precheck");
  if (Array.isArray(item.flags)) legacyFlags.push(...item.flags);

  return {
    id: item.id || crypto.randomUUID(),
    title: String(item.title),
    date: String(item.date),
    assignee: item.assignee || "自分",
    allDay: Boolean(item.allDay),
    start: item.start || "",
    end: item.end || "",
    category: mapCategory(item.category),
    eventType: typeLabels[item.eventType] ? item.eventType : inferEventType(item),
    status: statusLabels[item.status] ? item.status : item.status === "done" ? "done" : "scheduled",
    priority: priorityLabels[item.priority] ? item.priority : "normal",
    role: roleLabels[item.role] ? item.role : "owner",
    branch: item.branch || "",
    project: item.project || "",
    location: item.location || "",
    flags: [...new Set(legacyFlags.filter((flag) => flagLabels[flag]))],
    notes: item.notes || "",
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function mapCategory(category) {
  if (categoryLabels[category]) return category;
  if (category === "meeting") return "customer";
  if (category === "task" || category === "work") return "admin";
  if (category === "travel") return "branch";
  return "customer";
}

function inferEventType(item) {
  if (item.category === "travel") return "travel";
  if (item.category === "task") return "work";
  if (/電話|連絡|返信/.test(item.title || "")) return "call";
  if (/締切|期限/.test(item.title || "")) return "deadline";
  return "meeting";
}

function addSampleEvents() {
  const today = toDateKey(new Date());
  const tomorrow = toDateKey(addDays(new Date(), 1));
  state.events = [
    ...state.events,
    {
      id: crypto.randomUUID(),
      title: "朝の優先順位整理",
      date: today,
      assignee: "自分",
      allDay: false,
      start: "09:00",
      end: "09:30",
      category: "report",
      eventType: "check",
      status: "scheduled",
      priority: "high",
      role: "owner",
      branch: "事務所",
      project: "",
      location: "",
      flags: ["precheck", "report"],
      notes: "今日の予定、返信、待ちを確認",
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      title: "顧客向け提案メモ作成",
      date: tomorrow,
      assignee: "自分",
      allDay: false,
      start: "14:00",
      end: "15:00",
      category: "customer",
      eventType: "work",
      status: "scheduled",
      priority: "normal",
      role: "owner",
      branch: "オンライン",
      project: "提案準備",
      location: "オンライン",
      flags: ["share"],
      notes: "",
      updatedAt: new Date().toISOString()
    }
  ];
  persist();
  render();
  setActiveView("list");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function loadEvents() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "[]";
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeEvent).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.events));
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateHeading(dateKey) {
  const target = new Date(`${dateKey}T00:00:00`);
  const today = toDateKey(new Date());
  const tomorrow = toDateKey(addDays(new Date(), 1));
  const prefix = dateKey === today ? "今日" : dateKey === tomorrow ? "明日" : "";
  const label = new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(target);
  return prefix ? `${prefix} ${label}` : label;
}

function formatTimeRange(item) {
  if (item.allDay) return "終日";
  if (item.start && item.end) return `${item.start}-${item.end}`;
  return item.start || "";
}

function addMinutesToTime(time, minutes) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hour, minute + minutes);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
