/* =============================================
   MODAL OPEN / CLOSE
   ============================================= */

const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const taskTitle = document.getElementById("taskTitle");
const taskDesc = document.getElementById("taskDesc");

// null = mode tambah; object = mode edit
let editContext = null;

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
