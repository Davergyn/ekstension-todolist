/* =============================================
   DOM ELEMENTS
   ============================================= */
const datePicker = document.getElementById("datePicker");
const selectedDate = document.getElementById("selectedDate");
const selectedDay = document.getElementById("selectedDay");
const taskList = document.getElementById("taskList");
const calendarIcon = document.querySelector(".calendar-icon");
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const taskTitle = document.getElementById("taskTitle");
const taskDesc = document.getElementById("taskDesc");
const emptyState = document.getElementById("emptyState");

// null = mode tambah; object = mode edit
let editContext = null;

// Tanggal aktif untuk penambahan task baru (format: "YYYY-MM-DD")
let activeDate = null;

// Timer State
let timerInterval = null;
let endTime = null;
let currentTimerMode = 'focus';
let timerDuration = 25 * 60 * 1000;
let timerRemaining = 25 * 60 * 1000;
let timerState = 'STOPPED'; // STOPPED, RUNNING, PAUSED

/* =============================================
   STORAGE (chrome.storage.local)
   ============================================= */
/**
 * Mengambil semua data tasks yang tersimpan dari chrome.storage.local.
 * @param {function} callback - dieksekusi setelah data berhasil diambil, menerima objek allTasks.
 */
function getAllTasks(callback) {
  chrome.storage.local.get("tasksByDate", (result) => {
    callback(result.tasksByDate || {});
  });
}

/**
 * Menyimpan seluruh struktur data tasks kembali ke chrome.storage.local.
 * @param {object} allTasks - objek berisi pasangan tanggal sebagai key, dan array tasks sebagai value.
 * @param {function} callback - dieksekusi setelah berhasil tersimpan.
 */
function saveAllTasks(allTasks, callback) {
  chrome.storage.local.set({ tasksByDate: allTasks }, callback);
}

/**
 * Mengambil array task khusus untuk satu tanggal tertentu.
 * @param {string} dateKey - string tanggal (format YYYY-MM-DD).
 * @param {function} callback - dieksekusi dengan array task untuk tanggal tersebut.
 */
function getTasksForDate(dateKey, callback) {
  getAllTasks((all) => {
    callback(all[dateKey] || []);
  });
}

/**
 * Menyimpan atau memperbarui array task untuk satu tanggal tertentu.
 * @param {string} dateKey - string tanggal (format YYYY-MM-DD).
 * @param {Array} tasks - array task baru yang akan disimpan.
 * @param {function} callback - dieksekusi setelah berhasil disimpan.
 */
function saveTasksForDate(dateKey, tasks, callback) {
  getAllTasks((all) => {
    all[dateKey] = tasks;
    saveAllTasks(all, callback);
  });
}

/**
 * Menghapus task yang sudah lebih dari 2 hari berdasarkan waktu saat ini (today).
 * @param {function} callback - dieksekusi setelah proses pengecekan dan penghapusan selesai.
 */
function deleteOldTasks(callback) {
  getAllTasks((all) => {
    let changed = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const dateKey in all) {
      const target = new Date(dateKey);
      target.setHours(0, 0, 0, 0);
      const diffDays = Math.round((today - target) / 86400000);

      // Jika lebih dari 2 hari di masa lalu
      if (diffDays > 2) {
        delete all[dateKey];
        changed = true;
      }
    }

    if (changed) {
      saveAllTasks(all, callback);
    } else {
      if (callback) callback();
    }
  });
}

/* =============================================
   DATE LABEL HELPERS
   ============================================= */
/**
 * Menghasilkan label teks relatif (contoh: "Hari ini", "Kemarin", "Besok")
 * berdasarkan selisih hari antara waktu saat ini dengan dateKey.
 * @param {string} dateKey - string tanggal (format YYYY-MM-DD).
 * @returns {string} Label tanggal yang formatnya sudah disesuaikan.
 */
function getDateLabel(dateKey) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateKey);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - target) / 86400000);

  if (diffDays === 0) return "Hari ini";
  if (diffDays === 1) return "Kemarin";
  if (diffDays === 2) return "2 hari lalu";
  if (diffDays === -1) return "Besok";
  if (diffDays === -2) return "Lusa";

  return target.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* =============================================
   CALENDAR / DATE SELECTION
   ============================================= */
datePicker.addEventListener("click", openCalendar);

if (calendarIcon) {
  calendarIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    openCalendar();
  });
}

/**
 * Membuka input tampilan kalender bawaan browser.
 */
function openCalendar() {
  if (typeof datePicker.showPicker === "function") {
    datePicker.showPicker();
  } else {
    datePicker.focus();
  }
}

datePicker.addEventListener("change", () => {
  if (!datePicker.value) return;
  setActiveDate(datePicker.value);
});

/**
 * Mengatur tanggal aktif aplikasi berdasarkan input yang dipilih dari kalender,
 * memperbarui tampilan UI untuk tanggal tersebut, dan menyimpannya ke local storage.
 * @param {string} dateValue - tangal yang dipilih (format YYYY-MM-DD).
 */
function setActiveDate(dateValue) {
  activeDate = dateValue;

  const date = new Date(dateValue);
  const formattedDate = date.toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const dayName = date.toLocaleDateString("id-ID", { weekday: "long" });

  selectedDate.textContent = formattedDate;
  if (selectedDay) selectedDay.textContent = dayName;
  datePicker.value = dateValue;

  chrome.storage.local.set({ selectedDateValue: dateValue });

  renderAllTasks();
}

/* =============================================
   RENDER — SEMUA TASK, DIURUTKAN TERLAMA DULU
   ============================================= */
/**
 * Mengambil, memilah, dan merender (menampilkan kembali) semua task dari local storage
 * ke layar ekstensi berdasarkan urutan tertentu (pinned, status komplet).
 */
function renderAllTasks() {
  getAllTasks((all) => {
    taskList.innerHTML = "";

    const dateKeys = Object.keys(all).sort((a, b) => (a < b ? -1 : 1));
    const nonEmpty = dateKeys.filter((k) => all[k] && all[k].length > 0);

    if (nonEmpty.length === 0) {
      updateEmptyState(true);
      return;
    }

    updateEmptyState(false);

    nonEmpty.forEach((dateKey) => {
      const tasks = all[dateKey];

      const sorted = [...tasks].sort((a, b) => {
        const aPriority = a.pinned ? 0 : a.completed ? 2 : 1;
        const bPriority = b.pinned ? 0 : b.completed ? 2 : 1;
        return aPriority - bPriority;
      });

      const header = document.createElement("li");
      header.className = "date-label";
      header.textContent = getDateLabel(dateKey);
      taskList.appendChild(header);

      sorted.forEach((task) => {
        createTaskElement(
          task.text,
          task.desc || "",
          task.completed,
          task.pinned,
          task.expanded || false,
          dateKey
        );
      });
    });
  });
}

/**
 * Memperbarui tampilan "kosong" (empty state) apabila tidak ada satupun task.
 * @param {boolean} show - true untuk menampilkan info "Belum ada task tersimpan", false untuk menyembunyikannya.
 */
function updateEmptyState(show) {
  if (!emptyState) return;
  emptyState.style.display = show ? "flex" : "none";
  const textEl = emptyState.querySelector(".empty-state-text");
  if (textEl) {
    textEl.textContent = "Belum ada task tersimpan";
  }
}

/* =============================================
   LOAD ON STARTUP
   ============================================= */
document.addEventListener("DOMContentLoaded", () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDate = new Date();
  selectedDate.textContent = todayDate.toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
  });
  if (selectedDay) {
    selectedDay.textContent = todayDate.toLocaleDateString("id-ID", { weekday: "long" });
  }

  datePicker.min = todayStr;
  datePicker.value = todayStr;

  chrome.storage.local.get("selectedDateValue", (result) => {
    const savedValue = result.selectedDateValue;
    activeDate = savedValue || todayStr;
    if (!savedValue) chrome.storage.local.set({ selectedDateValue: todayStr });

    // Hapus task lama lalu render task yang tersisa
    deleteOldTasks(() => {
      renderAllTasks();
    });
  });

  // ── Reminder Popup ──
  const reminderPopup = document.getElementById("reminderPopup");
  const reminderClose = document.getElementById("reminderClose");

  function closeReminderPopup() {
    reminderPopup.classList.add("hide");
    setTimeout(() => { reminderPopup.style.display = "none"; }, 300);
  }

  if (reminderClose) {
    reminderClose.addEventListener("click", closeReminderPopup);
  }

  // Auto-close setelah 5 detik
  setTimeout(closeReminderPopup, 5000);

  // FAB → buka modal tambah task
  document.getElementById("fabBtn").addEventListener("click", () => openModal());

  // Klik overlay (luar modal) → tutup modal
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modalOverlay")) closeModalDirect();
  });

  // Tombol Batal
  document.getElementById("cancelBtn").addEventListener("click", () => closeModalDirect());

  // Tombol Simpan
  document.getElementById("saveBtn").addEventListener("click", () => addTask());

  // Enter di judul → simpan
  document.getElementById("taskTitle").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addTask();
    }
  });

  /* =============================================
     TIMER FEATURE SETUP
     ============================================= */
  const timerBellIcon = document.getElementById("timerBellIcon");
  const timerModalOverlay = document.getElementById("timerModalOverlay");
  const cancelTimerBtn = document.getElementById("cancelTimerBtn");

  // New UI Elements
  const tabFocus = document.getElementById("tabFocus");
  const tabBreak = document.getElementById("tabBreak");
  const timerMinInput = document.getElementById("timerMinInput");
  const timerSecInput = document.getElementById("timerSecInput");
  const timerProgressCircle = document.getElementById("timerProgressCircle");
  const btnPauseResume = document.getElementById("btnPauseResume");
  const iconPauseResume = document.getElementById("iconPauseResume");
  const textPauseResume = document.getElementById("textPauseResume");
  const btnReset = document.getElementById("btnReset");

  const FOCUS_DEFAULT = 25 * 60 * 1000; // 25 menit
  const BREAK_DEFAULT = 5 * 60 * 1000;  // 5 menit

  /**
   * Menampilkan dialog overlay modal untuk Timer (Fokus/Istirahat).
   */
  function openTimerModal() {
    timerModalOverlay.classList.add("active");
    checkActiveTimer();
  }

  /**
   * Menyembunyikan dialog overlay modal untuk Timer.
   */
  function closeTimerModal() {
    timerModalOverlay.classList.remove("active");
  }

  // Set default mode UI based on `currentTimerMode`
  function setTabUI(mode) {
    if (mode === 'focus') {
      tabFocus.classList.add('active');
      tabBreak.classList.remove('active');
    } else {
      tabBreak.classList.add('active');
      tabFocus.classList.remove('active');
    }
  }

  // Update SVG Progress Circle based on percentage
  function updateTimerDisplay() {
    const totalSeconds = Math.max(0, Math.floor(timerRemaining / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    // Update inputs regardless of state
    timerMinInput.value = minutes.toString().padStart(2, '0');
    timerSecInput.value = seconds.toString().padStart(2, '0');

    // Update Circle Progress
    const progress = timerRemaining / timerDuration;
    // radius = 45 -> circumference = 283
    const dashOffset = 283 - (progress * 283);
    timerProgressCircle.style.strokeDashoffset = dashOffset;

    // Change color based on mode
    if (currentTimerMode === 'focus') {
      timerProgressCircle.style.stroke = 'var(--accent)';
    } else {
      timerProgressCircle.style.stroke = 'var(--success)';
    }
  }

  // Reset Timer to initial tab default
  function resetTimerToMode(mode) {
    currentTimerMode = mode;
    timerDuration = (mode === 'focus') ? FOCUS_DEFAULT : BREAK_DEFAULT;
    timerRemaining = timerDuration;
    timerState = 'STOPPED';

    setTabUI(mode);
    updateTimerDisplay();
    updateControlsUI();

    if (timerInterval) clearInterval(timerInterval);
    chrome.runtime.sendMessage({ action: "stopTimer" });
  }

  // Tab Listeners
  tabFocus.addEventListener("click", () => {
    if (timerState === 'RUNNING' || timerState === 'PAUSED') return; // Do not switch while active unless reset
    resetTimerToMode('focus');
  });

  tabBreak.addEventListener("click", () => {
    if (timerState === 'RUNNING' || timerState === 'PAUSED') return;
    resetTimerToMode('break');
  });

  // Input Field handling
  function handleInputNumericOnly(e) {
    // Only allow numbers
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  }

  function handleInputBlur(e) {
    if (timerState === 'RUNNING') return; // Cannot edit while running

    let val = e.target.value.replace(/[^0-9]/g, '');
    if (!val) val = "0";

    e.target.value = val.padStart(2, '0');

    const minVal = parseInt(timerMinInput.value, 10) || 0;
    const secVal = parseInt(timerSecInput.value, 10) || 0;

    if (minVal === 0 && secVal === 0) {
      resetTimerToMode(currentTimerMode);
      return;
    }

    timerDuration = (minVal * 60 + secVal) * 1000;
    timerRemaining = timerDuration;
    updateTimerDisplay(); // Ensures bounds on display (e.g. if > 60 sec is typed, it usually stays, but logically it's added up correctly)
  }

  function handleInputFocus(e) {
    if (timerState === 'RUNNING') {
      e.target.blur(); // Prevent editing while running
    } else {
      e.target.select();
    }
  }

  timerMinInput.addEventListener("input", handleInputNumericOnly);
  timerSecInput.addEventListener("input", handleInputNumericOnly);

  timerMinInput.addEventListener("blur", handleInputBlur);
  timerSecInput.addEventListener("blur", handleInputBlur);

  timerMinInput.addEventListener("focus", handleInputFocus);
  timerSecInput.addEventListener("focus", handleInputFocus);

  // Jump to seconds on Enter from Mins
  timerMinInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      timerSecInput.value = "00";
      timerSecInput.focus();
    }
  });

  // Save/Unfocus on Enter from Secs
  timerSecInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      timerSecInput.blur();
    }
  });


  function updateControlsUI() {
    if (timerState === 'RUNNING') {
      iconPauseResume.textContent = '⏸';
      textPauseResume.textContent = 'Pause';
      btnPauseResume.style.background = 'rgba(224, 92, 106, 0.15)'; // dim danger
      btnPauseResume.style.color = 'var(--danger)';
      btnPauseResume.style.borderColor = 'rgba(224, 92, 106, 0.3)';
      timerMinInput.readOnly = true;
      timerSecInput.readOnly = true;
    } else if (timerState === 'PAUSED') {
      iconPauseResume.textContent = '▶';
      textPauseResume.textContent = 'Resume';
      btnPauseResume.style.background = 'var(--accent-dim)';
      btnPauseResume.style.color = 'var(--accent-hover)';
      btnPauseResume.style.borderColor = 'rgba(124, 111, 247, 0.3)';
      timerMinInput.readOnly = false;
      timerSecInput.readOnly = false;
    } else { // STOPPED
      iconPauseResume.textContent = '▶';
      textPauseResume.textContent = 'Start';
      btnPauseResume.style.background = 'var(--accent-dim)';
      btnPauseResume.style.color = 'var(--accent-hover)';
      btnPauseResume.style.borderColor = 'rgba(124, 111, 247, 0.3)';
      timerMinInput.readOnly = false;
      timerSecInput.readOnly = false;
    }
  }

  function tickTimer() {
    if (timerState !== 'RUNNING') return;

    // In background driven approach, we could just rely on Date.now() vs endTime
    // to be accurate in case background interval throttles
    const now = Date.now();
    timerRemaining = endTime - now;

    if (timerRemaining <= 0) {
      timerRemaining = 0;
      timerState = 'STOPPED';
      clearInterval(timerInterval);
      updateTimerDisplay();
      updateControlsUI();
      // Reset after a brief delay so user sees 00:00
      setTimeout(() => {
        resetTimerToMode(currentTimerMode);
        closeTimerModal();
      }, 1500);
      return;
    }

    updateTimerDisplay();
  }

  function startTimerLocally() {
    if (timerInterval) clearInterval(timerInterval);
    endTime = Date.now() + timerRemaining;
    timerState = 'RUNNING';
    updateControlsUI();
    // Start interval
    timerInterval = setInterval(tickTimer, 100); // 100ms for smoother progress circle
  }

  // Check state on open
  function checkActiveTimer() {
    chrome.storage.local.get(["timerEndTime", "timerMode", "timerState", "timerDuration", "timerRemaining"], (result) => {
      if (result.timerState === 'PAUSED') {
        timerState = 'PAUSED';
        currentTimerMode = result.timerMode || 'focus';
        timerDuration = result.timerDuration || FOCUS_DEFAULT;
        timerRemaining = result.timerRemaining || FOCUS_DEFAULT;
        setTabUI(currentTimerMode);
        updateTimerDisplay();
        updateControlsUI();
      } else if (result.timerState === 'RUNNING' && result.timerEndTime && result.timerEndTime > Date.now()) {
        currentTimerMode = result.timerMode || 'focus';
        timerDuration = result.timerDuration || FOCUS_DEFAULT;
        timerRemaining = result.timerEndTime - Date.now();
        setTabUI(currentTimerMode);
        startTimerLocally();
      } else {
        // Handle case where we open it fresh after it finished or stopped
        resetTimerToMode(currentTimerMode);
      }
    });
  }

  // Button Listeners
  btnPauseResume.addEventListener("click", () => {
    // Permission Notif
    if (timerState === 'STOPPED' && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    if (timerState === 'STOPPED' || timerState === 'PAUSED') {
      // START / RESUME
      const minsToStart = timerRemaining / (60 * 1000);
      chrome.runtime.sendMessage({
        action: "startTimer",
        minutes: minsToStart, // Use raw minutes / float is fine for alarm
        mode: currentTimerMode,
        duration: timerDuration
      }, (response) => {
        if (response && response.success) {
          startTimerLocally();
          chrome.storage.local.set({ timerState: 'RUNNING', timerDuration: timerDuration });
        }
      });
    } else if (timerState === 'RUNNING') {
      // PAUSE
      timerState = 'PAUSED';
      if (timerInterval) clearInterval(timerInterval);
      updateControlsUI();

      chrome.runtime.sendMessage({ action: "stopTimer" }, () => {
        // Save paused state
        chrome.storage.local.set({
          timerState: 'PAUSED',
          timerRemaining: timerRemaining,
          timerDuration: timerDuration,
          timerMode: currentTimerMode
        });
      });
    }
  });

  btnReset.addEventListener("click", () => {
    resetTimerToMode(currentTimerMode);
  });

  if (timerBellIcon) timerBellIcon.addEventListener("click", openTimerModal);
  if (cancelTimerBtn) cancelTimerBtn.addEventListener("click", closeTimerModal);

  // Klik overlay -> tutup
  timerModalOverlay.addEventListener("click", (e) => {
    if (e.target === timerModalOverlay) closeTimerModal();
  });
});

/* =============================================
   MODAL OPEN / CLOSE
   ============================================= */
/**
 * Membuka modal form Task (bisa digunakan untuk Tambah Task Baru atau Edit Task).
 * @param {object} ctx - Jika form digunakan untuk edit (mengandung context edit dari element DOM task). Jika null, anggap form "Tambah Baru".
 */
function openModal(ctx = null) {
  editContext = ctx;

  if (ctx) {
    modalTitle.textContent = "Edit Task";
    taskTitle.value = ctx.textEl.textContent;
    taskDesc.value = ctx.descPanelEl ? ctx.descPanelEl.textContent : "";
  } else {
    modalTitle.textContent = "Tambah Task Baru";
    taskTitle.value = "";
    taskDesc.value = "";
  }

  modalOverlay.classList.add("active");
  taskTitle.focus();
  taskTitle.select();
}

/**
 * Dipanggil secara responsif bila pengguna menekan tombol klik pada background modal overlay untuk menutup modal.
 */
function closeModal(event) {
  if (event.target === modalOverlay) closeModalDirect();
}

/**
 * Menutup form secara paksa, membersihkan field input, dan me-reset status `editContext`.
 */
function closeModalDirect() {
  modalOverlay.classList.remove("active");
  editContext = null;
  taskTitle.value = "";
  taskDesc.value = "";
}

// Tutup semua dropdown saat klik di luar
document.addEventListener("click", () => {
  document
    .querySelectorAll(".task-dropdown.open")
    .forEach((d) => d.classList.remove("open"));
});

/* =============================================
   ADD / EDIT TASK
   ============================================= */
/**
 * Logic utama untuk "Simpan" hasil Tambah / Edit Task.
 * Membaca nilai dari field Judul & Deskripsi, memanipulasi DOM untuk task list,
 * lalu trigger sinkronisasi dari DOM ke Storage.
 */
function addTask() {
  if (!activeDate) {
    closeModalDirect();
    openCalendar();
    return;
  }

  const title = taskTitle.value.trim();
  if (title === "") {
    taskTitle.style.borderColor = "#e00";
    taskTitle.focus();
    setTimeout(() => { taskTitle.style.borderColor = ""; }, 1500);
    return;
  }
  const desc = taskDesc.value.trim();

  if (editContext) {
    // ── Mode EDIT ──
    const { textEl, descPanelEl, expandIndicatorEl, li, dateKey: editDateKey } = editContext;
    textEl.textContent = title;

    if (desc) {
      if (descPanelEl) {
        descPanelEl.textContent = desc;
      } else {
        const newPanel = document.createElement("div");
        newPanel.className = "task-desc-panel";
        newPanel.textContent = desc;
        li.appendChild(newPanel);
        expandIndicatorEl.textContent = "▶";
        expandIndicatorEl.style.visibility = "visible";
        expandIndicatorEl.addEventListener("click", (e) => {
          e.stopPropagation();
          const expanded = li.classList.toggle("expanded");
          expandIndicatorEl.textContent = expanded ? "▼" : "▶";
          saveTasksFromDOM(li.dataset.dateKey);
        });
      }
    } else if (descPanelEl) {
      descPanelEl.remove();
      expandIndicatorEl.textContent = "";
      expandIndicatorEl.style.visibility = "hidden";
      li.classList.remove("expanded");
    }

    closeModalDirect();
    saveTasksFromDOM(editDateKey, () => renderAllTasks());
  } else {
    // ── Mode TAMBAH ──
    closeModalDirect();
    saveSingleTask(activeDate, { text: title, desc, completed: false, pinned: false, expanded: false }, () => {
      renderAllTasks();
    });
  }
}

/**
 * Secara ekslusif memasukan obyek satu task (baru) ke dalam array tugas di tanggal yang cocok.
 * @param {string} dateKey - string tanggal penyimpanannya (YYYY-MM-DD).
 * @param {object} taskObj - data asli satu task (text, desc, completed, dst).
 * @param {function} callback - callback untuk render display sesudahnya.
 */
function saveSingleTask(dateKey, taskObj, callback) {
  getTasksForDate(dateKey, (tasks) => {
    tasks.push(taskObj);
    saveTasksForDate(dateKey, tasks, callback);
  });
}

/* =============================================
   CREATE TASK ELEMENT
   ============================================= */
/**
 * Berfungsi untuk "Membangun/Create" node HTML `<li>` lengkap untuk satu task
 * beserta semua child logic-event listeners (ceklis, expand-deskripsi, menu-tiga-titik).
 * Hasil node `<li>` difabrikasi langsung masuk (appends) ke dalam root `taskList`.
 */
function createTaskElement(titleValue, descValue, isCompleted, isPinned = false, isExpanded = false, dateKey = null) {
  const li = document.createElement("li");
  li.className = "task-item";
  li.dataset.dateKey = dateKey || activeDate || "";

  if (isCompleted) li.classList.add("completed");
  if (isPinned) li.classList.add("pinned");

  const hasDesc = descValue && descValue.trim() !== "";

  // ── Baris utama ──
  const taskMain = document.createElement("div");
  taskMain.className = "task-main";

  // Checkbox
  const check = document.createElement("div");
  check.className = "check";
  check.innerHTML = isCompleted ? "✔" : "";
  check.addEventListener("click", (e) => {
    e.stopPropagation();
    li.classList.toggle("completed");
    check.innerHTML = li.classList.contains("completed") ? "✔" : "";
    saveTasksFromDOM(li.dataset.dateKey, () => renderAllTasks());
  });

  // Judul
  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = titleValue;

  const titleArea = document.createElement("div");
  titleArea.className = "task-title-area";
  titleArea.appendChild(text);

  // Tombol expand
  const expandBtn = document.createElement("button");
  expandBtn.className = "expand-btn";
  if (hasDesc) {
    expandBtn.textContent = isExpanded ? "▼" : "▶";
    expandBtn.title = "Toggle deskripsi";
    expandBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const expanded = li.classList.toggle("expanded");
      expandBtn.textContent = expanded ? "▼" : "▶";
      saveTasksFromDOM(li.dataset.dateKey);
    });
  } else {
    expandBtn.style.visibility = "hidden";
  }

  // ── Hamburger menu ──
  const menuWrapper = document.createElement("div");
  menuWrapper.className = "menu-wrapper";

  const hamburgerBtn = document.createElement("button");
  hamburgerBtn.className = "hamburger-btn";
  hamburgerBtn.innerHTML = "&#xFE19;";
  hamburgerBtn.setAttribute("aria-label", "Menu opsi task");

  const dropdown = document.createElement("div");
  dropdown.className = "task-dropdown";

  hamburgerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".task-dropdown.open").forEach((d) => {
      if (d !== dropdown) d.classList.remove("open");
    });
    dropdown.classList.toggle("open");
  });

  /**
   * Helper ringkas di dalam `createTaskElement` untuk membuat tiap item dropdown list (misal Tombol Hapus).
   */
  function makeMenuItem(icon, label, cls, handler) {
    const item = document.createElement("button");
    item.className = "dropdown-item " + cls;
    item.innerHTML = `<span class="item-icon">${icon}</span><span>${label}</span>`;
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.remove("open");
      handler();
    });
    return item;
  }

  const pinItem = makeMenuItem("📌", isPinned ? "Unpin" : "Pin", "item-pin", () => {
    li.classList.toggle("pinned");
    saveTasksFromDOM(li.dataset.dateKey, () => renderAllTasks());
  });

  const editItem = makeMenuItem("✏️", "Edit", "item-edit", () => {
    openModal({
      li,
      textEl: text,
      descPanelEl: li.querySelector(".task-desc-panel"),
      expandIndicatorEl: expandBtn,
      dateKey: li.dataset.dateKey,
    });
  });

  const deleteItem = makeMenuItem("🗑️", "Hapus", "item-delete", () => {
    const dk = li.dataset.dateKey;
    li.remove();
    saveTasksFromDOM(dk, () => renderAllTasks());
  });

  dropdown.appendChild(pinItem);
  dropdown.appendChild(editItem);
  dropdown.appendChild(deleteItem);
  menuWrapper.appendChild(hamburgerBtn);
  menuWrapper.appendChild(dropdown);

  taskMain.appendChild(check);
  taskMain.appendChild(titleArea);
  taskMain.appendChild(expandBtn);
  taskMain.appendChild(menuWrapper);

  // ── Panel deskripsi ──
  if (hasDesc) {
    const descPanel = document.createElement("div");
    descPanel.className = "task-desc-panel";
    descPanel.textContent = descValue;
    li.appendChild(taskMain);
    li.appendChild(descPanel);
    if (isExpanded) li.classList.add("expanded");
  } else {
    li.appendChild(taskMain);
  }

  taskList.appendChild(li);
}

/* =============================================
   SAVE TASKS — snapshot DOM → chrome.storage.local
   ============================================= */
/**
 * Fungsi ini melakukan "Scraping" atau pengambilan status terkini dari tampilan DOM (`<li>`)
 * seperti: apakah UI memperlihatkan list `completed` atau `pinned`,
 * dan mereplika ulang struktur DOM ke struktur Array, lalu menyimpannya ke `chrome.storage.local`.
 * @param {string} dateKey - Group ID Task per Tanggal.
 * @param {function} callback - dieksekusi setelah snapshot tersimpan.
 */
function saveTasksFromDOM(dateKey, callback) {
  if (!dateKey) return;
  const tasks = [];
  document.querySelectorAll(`#taskList li.task-item[data-date-key="${dateKey}"]`).forEach((li) => {
    const descEl = li.querySelector(".task-desc-panel");
    tasks.push({
      text: li.querySelector(".task-text").textContent,
      desc: descEl ? descEl.textContent : "",
      completed: li.classList.contains("completed"),
      pinned: li.classList.contains("pinned"),
      expanded: li.classList.contains("expanded"),
    });
  });
  saveTasksForDate(dateKey, tasks, callback);
}
