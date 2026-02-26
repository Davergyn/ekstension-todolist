// background.js - Service Worker (Manifest V3)
// Otomatis membuka popup greeting saat browser Chrome pertama kali dibuka

chrome.runtime.onStartup.addListener(() => {
    // Buka jendela kecil (popup-style window) dengan halaman greeting
    chrome.windows.create({
        url: chrome.runtime.getURL("greeting.html"),
        type: "popup",
        width: 480,
        height: 600,
        focused: true
    });
});
