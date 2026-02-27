// Ambil query parameter
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode') || 'focus';

const iconEl = document.getElementById('notifIcon');
const titleEl = document.getElementById('notifTitle');
const messageEl = document.getElementById('notifMessage');
const closeBtn = document.getElementById('btnClose');

if (mode === 'focus') {
    document.title = "Waktunya Istirahat";
    iconEl.textContent = '☕';
    iconEl.className = 'icon break';
    titleEl.textContent = 'Silahkan Istirahat';
    messageEl.innerHTML = 'Kerja bagus!<br>Waktunya mengambil break sejenak.';
} else {
    document.title = "Waktu Istirahat Habis";
    iconEl.textContent = '🎯';
    iconEl.className = 'icon focus';
    titleEl.textContent = 'Waktu Istirahat Habis';
    messageEl.innerHTML = 'Ayo kembali produktif<br>dan selesaikan taskmu!';
    closeBtn.style.background = 'var(--pin)';
    closeBtn.style.color = '#0f0f1a';
}

closeBtn.addEventListener('click', async () => {
    try {
        // Coba cari window Chrome utama yang sedang aktif
        const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });

        if (win && win.id) {
            // Fokuskan window utama
            await chrome.windows.update(win.id, { focused: true });
            // Buka popup extension di window tersebut
            await chrome.action.openPopup({ windowId: win.id });
        } else {
            throw new Error("Tidak ada window Chrome normal ditemukan");
        }
    } catch (err) {
        // Fallback jika API openPopup gagal/tidak didukung:
        chrome.windows.create({
            url: chrome.runtime.getURL('index.html'),
            type: 'popup',
            width: 480,
            height: 600,
            focused: true
        });
    }

    // Tutup jendela Notif ini
    window.close();
});

// Atur posisi window di tengah layar setelah dirender
setTimeout(() => {
    chrome.system.display.getInfo((displays) => {
        const primary = displays.find(d => d.isPrimary) || displays[0];
        const width = 360;
        const height = 400;
        const left = Math.round(primary.workArea.left + (primary.workArea.width - width) / 2);
        const top = Math.round(primary.workArea.top + (primary.workArea.height - height) / 2);

        chrome.windows.getCurrent((win) => {
            chrome.windows.update(win.id, { left, top, width, height });
        });
    });
}, 100);
