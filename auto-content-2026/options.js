document.addEventListener('DOMContentLoaded', () => {
    const defaultAiProvider = document.getElementById('defaultAiProvider');
    const geminiInput = document.getElementById('geminiApiKey');
    const groqInput = document.getElementById('groqApiKey');
    const openrouterInput = document.getElementById('openrouterApiKey');
    const tmdbInput = document.getElementById('tmdbApiKey');
    
    const btnSave = document.getElementById('btnSave');
    const saveStatus = document.getElementById('saveStatus');

    // โหลดข้อมูลเก่ามาแสดง
    chrome.storage.local.get('settings', (data) => {
        if (data.settings) {
            defaultAiProvider.value = data.settings.defaultAiProvider || 'gemini';
            geminiInput.value = data.settings.geminiApiKey || '';
            groqInput.value = data.settings.groqApiKey || '';
            openrouterInput.value = data.settings.openrouterApiKey || '';
            tmdbInput.value = data.settings.tmdbApiKey || '';
        }
    });

    // บันทึกข้อมูล
    btnSave.addEventListener('click', () => {
        const settings = {
            defaultAiProvider: defaultAiProvider.value,
            geminiApiKey: geminiInput.value.trim(),
            groqApiKey: groqInput.value.trim(),
            openrouterApiKey: openrouterInput.value.trim(),
            tmdbApiKey: tmdbInput.value.trim()
        };

        chrome.storage.local.set({ settings }, () => {
            // แสดงข้อความยืนยันการบันทึก
            saveStatus.textContent = 'บันทึกสำเร็จ! ✔️';
            saveStatus.classList.add('show');
            setTimeout(() => {
                saveStatus.classList.remove('show');
            }, 3000);
        });
    });
});
