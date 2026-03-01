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
