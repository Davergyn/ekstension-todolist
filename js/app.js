/* =============================================
   APP INITIALIZATION (Entry Point)
   ============================================= */

// Tutup semua dropdown saat klik di luar
document.addEventListener("click", () => {
    document
        .querySelectorAll(".task-dropdown.open")
        .forEach((d) => d.classList.remove("open"));
});

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

    // Inisialisasi Timer
    initTimer();
});
