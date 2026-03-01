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
