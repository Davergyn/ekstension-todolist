// background.js - Service Worker (Manifest V3)
// Otomatis membuka popup greeting saat browser Chrome pertama kali dibuka

chrome.runtime.onStartup.addListener(() => {
    // Ambil info display untuk menempatkan di pojok kanan atas
    chrome.system.display.getInfo((displays) => {
        // Cari display utama
        const primaryDisplay = displays.find(d => d.isPrimary) || displays[0];

        const popupWidth = 480;
        const popupHeight = 600;

        // workArea mengecualikan taskbar Windows
        const leftPosition = primaryDisplay.workArea.left + primaryDisplay.workArea.width - popupWidth;
        const topPosition = primaryDisplay.workArea.top;

        // Buka jendela kecil (popup-style window) dengan halaman greeting
        chrome.windows.create({
            url: chrome.runtime.getURL("greeting.html"),
            type: "popup",
            width: popupWidth,
            height: popupHeight,
            left: Math.round(leftPosition),
            top: Math.round(topPosition),
            focused: true
        });
    });
});

/* =============================================
   TIMER & ALARM LOGIC
   ============================================= */

// Listen pesan dari script.js (UI popup)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startTimer") {
        const { minutes, mode } = request;
        const endTime = Date.now() + minutes * 60 * 1000;

        // Simpan state di storage agar tetap jalan meski popup ditutup
        chrome.storage.local.set({
            timerEndTime: endTime,
            timerMode: mode
        }, () => {
            // Buat Chrome alarm
            chrome.alarms.create("todoTimer", { delayInMinutes: minutes });
            sendResponse({ success: true });
        });
        return true;
    }

    if (request.action === "stopTimer") {
        // Hentikan alarm dan hapus dari storage
        chrome.alarms.clear("todoTimer", () => {
            chrome.storage.local.remove(["timerEndTime", "timerMode"], () => {
                sendResponse({ success: true });
            });
        });
        return true;
    }
});

// Trigger alarm ketika waktu habis
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "todoTimer") {
        // Ambil mode terakhir dari storage
        chrome.storage.local.get(["timerMode"], (result) => {
            const mode = result.timerMode || "focus";

            const showNotification = () => {
                // Tampilkan Custom HTML Notifikasi
                chrome.system.display.getInfo((displays) => {
                    const primaryDisplay = displays.find(d => d.isPrimary) || displays[0];
                    const width = 360;
                    const height = 400;

                    // Posisikan window di tengah layar utama
                    const left = Math.round(primaryDisplay.workArea.left + (primaryDisplay.workArea.width - width) / 2);
                    const top = Math.round(primaryDisplay.workArea.top + (primaryDisplay.workArea.height - height) / 2);

                    chrome.windows.create({
                        url: chrome.runtime.getURL(`timer_notif.html?mode=${mode}`),
                        type: "popup",
                        width: width,
                        height: height,
                        left: left,
                        top: top,
                        focused: true
                    });
                });
            };

            // Mengecek apakah extension sedang terbuka (misal sedang melihat task)
            if (chrome.runtime.getContexts) {
                // Untuk Manifest V3 (Chrome 116+)
                chrome.runtime.getContexts({ contextTypes: ["POPUP", "TAB"] }, (contexts) => {
                    if (contexts.length === 0) {
                        showNotification();
                    }
                });
            } else {
                // Fallback untuk versi Chrome yang lebih lama
                chrome.tabs.query({ url: chrome.runtime.getURL("*") }, (tabs) => {
                    if (tabs.length === 0) {
                        showNotification();
                    }
                });
            }

            // Bersihkan data timer di storage
            chrome.storage.local.remove(["timerEndTime", "timerMode"]);
        });
    }
});
