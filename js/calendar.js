/* =============================================
   CALENDAR / DATE SELECTION
   ============================================= */

const datePicker = document.getElementById("datePicker");
const selectedDate = document.getElementById("selectedDate");
const selectedDay = document.getElementById("selectedDay");
const calendarIcon = document.querySelector(".calendar-icon");

// Tanggal aktif untuk penambahan task baru (format: "YYYY-MM-DD")
let activeDate = null;

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

datePicker.addEventListener("click", openCalendar);

if (calendarIcon) {
    calendarIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        openCalendar();
    });
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
