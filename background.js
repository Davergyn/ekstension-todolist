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
