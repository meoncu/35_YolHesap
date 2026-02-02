document.getElementById('calculate-btn').addEventListener('click', () => {
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;

    if (!origin || !destination) {
        alert('Lütfen kalkış ve varış noktalarını girin.');
        return;
    }

    // AI/API simülasyonu
    document.getElementById('calculate-btn').innerText = 'Hesaplanıyor...';
    
    setTimeout(() => {
        document.getElementById('dist-val').innerText = '452 km';
        document.getElementById('time-val').innerText = '5 saat 20 dk';
        document.getElementById('calculate-btn').innerText = 'Rotayı Oluştur';
        
        console.log('Google Stitch API ile tasarım detayları gözden geçiriliyor...');
    }, 1500);
});
