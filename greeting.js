// greeting.js - Logic untuk halaman startup popup

// ===== Update Jam Real-time =====
function updateTime() {
    const now = new Date();

    // Format jam: HH:MM:SS
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('timeDisplay').textContent = `${hours}:${minutes}:${seconds}`;

    // Format tanggal dalam Bahasa Indonesia
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const dayName = days[now.getDay()];
    const date = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    document.getElementById('dateDisplay').textContent = `${dayName}, ${date} ${month} ${year}`;
}

// Jalankan sekali langsung, lalu update setiap detik
updateTime();
setInterval(updateTime, 1000);


// ===== Greeting berdasarkan waktu =====
function setGreeting() {
    const hour = new Date().getHours();
    let greeting, desc;

    if (hour >= 5 && hour < 12) {
        greeting = 'Selamat Pagi! ☀️';
        desc = 'Mulai harimu dengan semangat! Cek daftar tugasmu sekarang.';
    } else if (hour >= 12 && hour < 15) {
        greeting = 'Selamat Siang! 🌤️';
        desc = 'Tetap fokus! Kamu sudah setengah jalan hari ini.';
    } else if (hour >= 15 && hour < 18) {
        greeting = 'Selamat Sore! 🌅';
        desc = 'Sore yang produktif! Selesaikan tugasmu sebelum malam.';
    } else if (hour >= 18 && hour < 21) {
        greeting = 'Selamat Malam! 🌙';
        desc = 'Malam yang sibuk! Jangan lupa istirahat setelah kerja keras.';
    } else {
        greeting = 'Halo! 🌟';
        desc = 'Semangat! Selesaikan tugasmu dan istirahat yang cukup.';
    }

    document.getElementById('greetingText').textContent = greeting;
    document.getElementById('greetingDesc').textContent = desc;
}

setGreeting();


// ===== Tombol: Buka Aplikasi Utama & Tutup Popup =====
document.getElementById('btnOpen').addEventListener('click', async () => {
    try {
        // Coba cari window Chrome utama yang sedang aktif
        const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });

        if (win && win.id) {
            // Fokuskan window utama tersebut terlebih dahulu
            await chrome.windows.update(win.id, { focused: true });

            // Buka popup asli extension (menempel di icon toolbar) di window tersebut
            // Membutuhkan Chrome 99+
            await chrome.action.openPopup({ windowId: win.id });
        } else {
            throw new Error("Tidak ada window Chrome normal ditemukan");
        }
    } catch (err) {
        // Fallback: Jika API gagal atau tidak didukung, buka sebagai window kecil melayang (mirip popup)
        chrome.windows.create({
            url: chrome.runtime.getURL('index.html'),
            type: 'popup',
            width: 400,
            height: 600,
            focused: true
        });
    }

    // Tutup jendela greeting ini
    window.close();
});
