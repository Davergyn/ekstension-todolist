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
  const closeTimerModalBtn = document.getElementById("closeTimerModalBtn");
  const startTimerBtn = document.getElementById("startTimerBtn");
  const stopTimerBtn = document.getElementById("stopTimerBtn");

  const timerModeSelect = document.getElementById("timerMode");
  const timerMinutesInput = document.getElementById("timerMinutes");

  const timerSetupSection = document.getElementById("timerSetupSection");
  const timerInputSection = document.getElementById("timerInputSection");
  const timerActiveState = document.getElementById("timerActiveState");
  const timerCountdownDisplay = document.getElementById("timerCountdownDisplay");

  const timerActions = document.getElementById("timerActions");
  const timerStopActions = document.getElementById("timerStopActions");

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

  /**
   * Mengecek apakah ada timer yang sedang aktif / berjalan di background.
   * Jika ada, maka akan lanjut menampilkan UI Countdown (Hitung Mundur).
   */
  function checkActiveTimer() {
    chrome.storage.local.get(["timerEndTime", "timerMode"], (result) => {
      if (result.timerEndTime && result.timerEndTime > Date.now()) {
        // Timer sedang berjalan
        endTime = result.timerEndTime;
        currentTimerMode = result.timerMode || 'focus';
        showActiveTimerUI();
        startCountdownDisplay();
      } else {
        // Tidak ada timer / sudah selesai
        showSetupTimerUI();
        if (timerInterval) clearInterval(timerInterval);
      }
    });
  }

  /**
   * Mengatur antarmuka untuk timer yang sedang aktif (Hitung Mundur).
   */
  function showActiveTimerUI() {
    timerSetupSection.style.display = "none";
    timerInputSection.style.display = "none";
    timerActions.style.display = "none";

    timerActiveState.style.display = "block";
    timerStopActions.style.display = "flex";
  }

  /**
   * Menampilkan layar pengaturan form untuk membuat timer baru yang belum aktif.
   */
  function showSetupTimerUI() {
    timerSetupSection.style.display = "block";
    timerInputSection.style.display = "block";
    timerActions.style.display = "flex";

    timerActiveState.style.display = "none";
    timerStopActions.style.display = "none";

    // Default values
    timerModeSelect.value = "focus";
    timerMinutesInput.value = "";
  }

  /**
   * Melakukan pembaruan terhadap string hitung mundur (kalkulasi sisa waktu)
   * serta mengeksekusi penghentian UI bila waktunya sudah tercapai (<= 0).
   */
  function updateCountdownText() {
    if (!endTime) return;
    const remaining = endTime - Date.now();

    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerCountdownDisplay.textContent = "00:00";
      setTimeout(() => {
        closeTimerModal();
        showSetupTimerUI();
      }, 1000);
      return;
    }

    const totalSeconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    timerCountdownDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Memulai fungsi setInterval() setiap 1 detik untuk `updateCountdownText()`.
   */
  function startCountdownDisplay() {
    if (timerInterval) clearInterval(timerInterval);
    updateCountdownText();
    timerInterval = setInterval(updateCountdownText, 1000);
  }

  // Event Listeners Timer
  if (timerBellIcon) timerBellIcon.addEventListener("click", openTimerModal);
  if (cancelTimerBtn) cancelTimerBtn.addEventListener("click", closeTimerModal);
  if (closeTimerModalBtn) closeTimerModalBtn.addEventListener("click", closeTimerModal);

  // Klik overlay -> tutup
  timerModalOverlay.addEventListener("click", (e) => {
    if (e.target === timerModalOverlay) closeTimerModal();
  });

  // Start Timer
  startTimerBtn.addEventListener("click", () => {
    // Minta Notif Permission pertama kali user klik tombol ini start
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    const mins = parseInt(timerMinutesInput.value, 10);
    if (!mins || mins <= 0) {
      timerMinutesInput.style.borderColor = "#e00";
      setTimeout(() => { timerMinutesInput.style.borderColor = ""; }, 1500);
      return;
    }

    const mode = timerModeSelect.value;

    // Kirim pesan ke background script untuk setup alarm
    chrome.runtime.sendMessage({
      action: "startTimer",
      minutes: mins,
      mode: mode
    }, (response) => {
      if (response && response.success) {
        checkActiveTimer();
      }
    });
  });

  // Stop Timer
  stopTimerBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "stopTimer" }, (response) => {
      if (response && response.success) {
        if (timerInterval) clearInterval(timerInterval);
        endTime = null;
        chrome.storage.local.remove(["timerEndTime", "timerMode"], () => {
          showSetupTimerUI();
        });
      }
    });
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
