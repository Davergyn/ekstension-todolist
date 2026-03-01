/* =============================================
   TIMER FEATURE
   ============================================= */

// Timer State
let timerInterval = null;
let endTime = null;
let currentTimerMode = 'focus';
let timerDuration = 25 * 60 * 1000;
let timerRemaining = 25 * 60 * 1000;
let timerState = 'STOPPED'; // STOPPED, RUNNING, PAUSED

const FOCUS_DEFAULT = 25 * 60 * 1000; // 25 menit
const BREAK_DEFAULT = 5 * 60 * 1000;  // 5 menit

/**
 * Inisialisasi seluruh fitur Timer.
 * Dipanggil dari app.js saat DOMContentLoaded.
 */
function initTimer() {
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
        if (timerState === 'RUNNING' || timerState === 'PAUSED') return;
        resetTimerToMode('focus');
    });

    tabBreak.addEventListener("click", () => {
        if (timerState === 'RUNNING' || timerState === 'PAUSED') return;
        resetTimerToMode('break');
    });

    // Input Field handling
    function handleInputNumericOnly(e) {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    }

    function handleInputBlur(e) {
        if (timerState === 'RUNNING') return;

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
        updateTimerDisplay();
    }

    function handleInputFocus(e) {
        if (timerState === 'RUNNING') {
            e.target.blur();
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
            btnPauseResume.style.background = 'rgba(224, 92, 106, 0.15)';
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

        const now = Date.now();
        timerRemaining = endTime - now;

        if (timerRemaining <= 0) {
            timerRemaining = 0;
            timerState = 'STOPPED';
            clearInterval(timerInterval);
            updateTimerDisplay();
            updateControlsUI();
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
        timerInterval = setInterval(tickTimer, 100);
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
                minutes: minsToStart,
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
}
