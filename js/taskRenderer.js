/* =============================================
   RENDER — SEMUA TASK, DIURUTKAN TERLAMA DULU
   ============================================= */

const taskList = document.getElementById("taskList");
const emptyState = document.getElementById("emptyState");

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
     * Helper ringkas di dalam `createTaskElement` untuk membuat tiap item dropdown list.
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
