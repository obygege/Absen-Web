document.addEventListener("DOMContentLoaded", () => {
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzCTa_nps72qN7rSqZ77NbxRGwzwQ9h73HeQ0VWdfo2y0ionGIo7lSRuymgPwCs7I09sg/exec";
    const user = JSON.parse(localStorage.getItem("user"));
    let appData = null; let mapInstance = null; let mapMarker = null;

    if (!user) { window.location.href = "index.html"; return; }
    
    const loader = document.getElementById('loader');
    const toastEl = document.getElementById('appToast');
    const appToast = new bootstrap.Toast(toastEl);
    let contentAreaEl, pageTitleEl, addUserModal;

    const routes = {
        'staff': [ { name: 'Absen', icon: 'bi-fingerprint', render: renderAbsenChoice }, { name: 'Riwayat', icon: 'bi-clock-history', render: renderRiwayat }, { name: 'Cuti', icon: 'bi-calendar4-week', render: renderCuti }, { name: 'Lembur', icon: 'bi-hourglass-split', render: renderLembur } ],
        'kepala': [ { name: 'Dashboard', icon: 'bi-grid-1x2-fill', render: renderAdminHomeDashboard }, { name: 'Manajemen Data', icon: 'bi-table', render: renderAdminDataManagement }, { name: 'Persetujuan Cuti', icon: 'bi-check2-square', render: renderPersetujuanCuti, notification: true } ],
        'super admin': [ { name: 'Dashboard', icon: 'bi-grid-1x2-fill', render: renderAdminHomeDashboard }, { name: 'Manajemen Data', icon: 'bi-table', render: renderAdminDataManagement } ]
    };

    function setupLayout() {
        if (user.role === 'staff') {
            document.getElementById('staff-layout').classList.remove('d-none');
            contentAreaEl = document.getElementById('content-area-staff');
            document.getElementById('logout-btn-staff').addEventListener('click', logout);
            createNavLinks('main-nav-staff-mobile', routes.staff, true);
        } else {
            document.getElementById('admin-layout').classList.remove('d-none');
            contentAreaEl = document.getElementById('content-area-admin');
            pageTitleEl = document.getElementById('page-title');
            addUserModal = new bootstrap.Modal(document.getElementById('addUserModal'));
            document.getElementById('logout-btn-admin-desktop').addEventListener('click', logout);
            document.getElementById('sidebar-toggle').addEventListener('click', () => {
                document.getElementById('sidebarMenu').classList.toggle('collapsed');
                document.getElementById('mainContent').classList.toggle('collapsed');
            });
            createNavLinks('main-nav-desktop', routes[user.role], false);
        }
        initializeApp();
    }

    function createNavLinks(containerId, navItems, isMobile) {
        const container = document.getElementById(containerId); container.innerHTML = '';
        navItems.forEach(item => {
            let navElement, clickableElement;
            const badgeId = item.notification ? `notification-badge-${item.name.replace(/\s+/g, '')}` : '';
            const badgeHTML = item.notification ? `<span id="${badgeId}" class="badge bg-danger rounded-pill ms-auto d-none"></span>` : '';

            if (isMobile) {
                navElement = document.createElement('a'); navElement.href = '#';
                navElement.className = 'nav-link d-flex flex-column align-items-center text-secondary p-2 flex-grow-1 bottom-nav-link';
                navElement.innerHTML = `<i class="bi ${item.icon} fs-4"></i><span class="small">${item.name}</span>`;
                clickableElement = navElement;
            } else {
                navElement = document.createElement('li'); navElement.className = 'nav-item';
                navElement.innerHTML = `<a href="#" class="nav-link sidebar-link"><i class="bi ${item.icon}"></i>${item.name}${badgeHTML}</a>`;
                clickableElement = navElement.querySelector('a');
            }
            clickableElement.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.sidebar-link.active, .bottom-nav-link.active').forEach(el => el.classList.remove('active'));
                clickableElement.classList.add('active');
                if (pageTitleEl) pageTitleEl.textContent = item.name;
                if (appData) item.render();
                else contentAreaEl.innerHTML = `<div class="d-flex justify-content-center mt-5"><div class="spinner-border text-primary" role="status"></div></div>`;
            });
            container.appendChild(navElement);
        });
    }

    async function initializeApp() {
        try {
            const result = await postData("getInitialData", { userId: user.id, role: user.role });
            if (result.status === 'success') {
                appData = result.data;
                updateNotifications();
                document.querySelector('#main-nav-desktop a, #main-nav-staff-mobile a')?.click();
            } else { contentAreaEl.innerHTML = `<p class="text-center text-danger">Gagal memuat data awal: ${result.message}</p>`; }
        } catch(error) { contentAreaEl.innerHTML = `<p class="text-center text-danger">Terjadi kesalahan: ${error.message}</p>`; } 
        finally { loader.classList.add('hidden'); }
    }
    
    function updateNotifications() {
        if (user.role === 'kepala') {
            const pendingCount = appData.leave.filter(l => l.status === 'Pending').length;
            const badge = document.getElementById('notification-badge-PersetujuanCuti');
            if (badge) { badge.textContent = pendingCount > 0 ? pendingCount : ''; badge.classList.toggle('d-none', pendingCount === 0); }
        }
    }
    
    function showToast(message, type = 'success') {
        const toastBody = toastEl.querySelector('.toast-body');
        toastEl.classList.remove('bg-success', 'bg-danger', 'bg-info', 'text-white');
        toastBody.textContent = message;
        if (type === 'success') toastEl.classList.add('bg-success', 'text-white');
        else if (type === 'danger') toastEl.classList.add('bg-danger', 'text-white');
        else if (type === 'info') toastEl.classList.add('bg-info', 'text-white');
        appToast.show();
    }

    async function postData(action, payload = {}) {
        try {
            const response = await fetch(SCRIPT_URL, { method: "POST", redirect: "follow", body: JSON.stringify({ action, ...payload }) });
            return await response.json();
        } catch (error) { return { status: "error", message: `Terjadi kesalahan koneksi.` }; }
    }
    
    function renderAbsenChoice() {
        contentAreaEl.innerHTML = `<div class="card shadow-sm"><div class="card-body text-center p-4"><h5 class="card-title mb-4">Pilih Metode Absensi</h5><div class="d-grid gap-3"><button id="absen-gps-choice" class="btn btn-primary btn-lg"><i class="bi bi-geo-alt-fill me-2"></i>Gunakan GPS & Peta</button><button id="absen-qr-choice" class="btn btn-outline-secondary btn-lg"><i class="bi bi-qr-code-scan me-2"></i>Scan QR Code Kantor</button></div></div></div>`;
        document.getElementById('absen-gps-choice').addEventListener('click', renderAbsenGps);
        document.getElementById('absen-qr-choice').addEventListener('click', renderAbsenQr);
    }

    function renderAbsenGps() {
        const { branches } = appData;
        let branchOptions = branches.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
        contentAreaEl.innerHTML = `<div class="card shadow-sm"><div class="card-body text-center"><div class="d-flex justify-content-between align-items-center mb-3"><h5 class="card-title mb-0">Absensi via GPS</h5><button class="btn btn-sm btn-outline-secondary" id="back-to-choice"><i class="bi bi-arrow-left"></i> Kembali</button></div><div class="p-2 bg-light rounded border mb-3"><small class="text-muted">Lokasi Anda Saat Ini:</small><p id="location-text" class="fw-bold mb-0">Mendeteksi lokasi...</p></div><div id="map" class="mb-3 w-100"></div><p id="clock" class="h4 fw-bold font-monospace mb-3"></p><div class="mb-3"><select id="branch-select" class="form-select"><option value="">-- Pilih Cabang --</option>${branchOptions}</select></div><div id="attendance-button-container" class="d-grid gap-2"></div></div></div>`;
        document.getElementById('back-to-choice').addEventListener('click', renderAbsenChoice);
        initializeGeolocation();
        updateAttendanceButtons();
        const clockEl = document.getElementById('clock');
        const clockInterval = setInterval(() => { if(clockEl) { clockEl.textContent = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Makassar', hour12: false }); } else { clearInterval(clockInterval); } }, 1000);
    }
    
    function renderAbsenQr() {
        const { branches } = appData;
        let branchOptions = branches.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
        contentAreaEl.innerHTML = `<div class="card shadow-sm"><div class="card-body text-center"><div class="d-flex justify-content-between align-items-center mb-3"><h5 class="card-title mb-0">Absensi via QR</h5><button class="btn btn-sm btn-outline-secondary" id="back-to-choice"><i class="bi bi-arrow-left"></i> Kembali</button></div><div class="mb-3"><select id="branch-select" class="form-select"><option value="">-- Pilih Cabang --</option>${branchOptions}</select></div><div id="qr-scanner-container" class="mt-2 border rounded p-2 bg-light"><div id="qr-reader" style="width:100%"></div></div></div></div>`;
        document.getElementById('back-to-choice').addEventListener('click', renderAbsenChoice);
        startQrScanner();
    }

    function initializeGeolocation() {
        if (mapInstance) { mapInstance.remove(); mapInstance = null; }
        mapInstance = L.map('map').setView([-5.1477, 119.4327], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
        navigator.geolocation.watchPosition(async (position) => {
            const { latitude, longitude } = position.coords; const latlng = [latitude, longitude];
            mapInstance.setView(latlng, 17);
            if (!mapMarker) { mapMarker = L.marker(latlng).addTo(mapInstance); } else { mapMarker.setLatLng(latlng); }
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await response.json(); const locationTextEl = document.getElementById('location-text');
            if(locationTextEl) locationTextEl.textContent = data.display_name || 'Lokasi terdeteksi';
        }, () => { const el = document.getElementById('location-text'); if(el) el.textContent = 'GPS tidak aktif atau ditolak.'; });
    }

    function updateAttendanceButtons() {
        const container = document.getElementById('attendance-button-container'); if (!container) return;
        const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" })).toISOString().slice(0, 10);
        const todayAttendance = appData.attendance?.find(a => new Date(a.date).toISOString().slice(0, 10) === today);
        let buttonHTML = '';
        if (!todayAttendance) { buttonHTML = `<button data-type="check_in" class="btn btn-primary btn-lg">Check-In Sekarang</button>`; } 
        else if (!todayAttendance.break_start) { buttonHTML = `<button data-type="break_start" class="btn btn-warning btn-lg">Mulai Istirahat</button>`; } 
        else if (!todayAttendance.break_end) { buttonHTML = `<button data-type="break_end" class="btn btn-info btn-lg">Selesai Istirahat</button>`; } 
        else if (!todayAttendance.check_out) { buttonHTML = `<button data-type="check_out" class="btn btn-danger btn-lg">Pulang</button>`; } 
        else { container.innerHTML = '<p class="text-success fw-bold">Absensi hari ini sudah lengkap.</p>'; return; }
        container.innerHTML = buttonHTML;
        container.querySelector('button').addEventListener('click', handleAttendanceClick);
    }
    
    async function handleAttendanceClick(e) {
        const type = e.target.dataset.type;
        const branchSelect = document.getElementById('branch-select');
        showToast('Memproses...', 'info');
        if (type === 'check_in' && !branchSelect.value) { showToast('Pilih cabang terlebih dahulu!', 'danger'); return; }
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords; const location = `${latitude},${longitude}`;
                const result = await postData("recordAttendance", { userId: user.id, type, location, branch: branchSelect.value });
                if (result.status === 'success') {
                    showToast(result.message, 'success');
                    await refreshData(); updateAttendanceButtons();
                } else { showToast(`Error: ${result.message}`, 'danger'); }
            },
            () => { showToast('Gagal mendeteksi lokasi.', 'danger'); },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }
    
    function startQrScanner() {
        const branchSelect = document.getElementById('branch-select');
        const html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
            async (decodedText) => {
                if (!branchSelect.value) { showToast('Pilih cabang terlebih dahulu!', 'danger'); return; }
                await html5QrCode.stop().catch(err => console.error(err));
                showToast(`QR terdeteksi, memproses...`, 'info');
                const result = await postData("recordAttendance", { userId: user.id, type: 'check_in', location: `QR Scan: ${decodedText.split('|')[0]}`, branch: branchSelect.value });
                if (result.status === 'success') {
                    showToast(result.message, 'success'); await refreshData();
                    renderAbsenChoice();
                } else { showToast(`Error: ${result.message}`, 'danger'); }
            }
        ).catch(() => { showToast("Gagal memulai kamera QR.", 'danger'); });
    }

    async function refreshData() {
        const newData = await postData("getInitialData", { userId: user.id, role: user.role });
        if (newData.status === 'success') appData = newData.data;
        updateNotifications(); return;
    }

    function renderRiwayat() {
        const { attendance, leave, overtime } = appData;
        const renderTable = (title, headers, rows) => {
             const keys = headers.map(h => h.toLowerCase().replace(/ /g, '_'));
             return `<div class="card mb-4 shadow-sm"><h5 class="card-header bg-white">${title}</h5><div class="table-responsive text-nowrap"><table class="table table-hover table-striped"><thead class="table-dark"><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${keys.map(key => `<td>${row[key] || ''}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${headers.length}" class="text-center p-4">Tidak ada data riwayat.</td></tr>`}</tbody></table></div></div>`;
        };
        contentAreaEl.innerHTML = renderTable("Riwayat Absensi", ['Date', 'Check In', 'Branch'], attendance) + renderTable("Riwayat Cuti", ['Start Date', 'End Date', 'Status'], leave) + renderTable("Riwayat Lembur", ['Date', 'Reason'], overtime);
    }

    function renderCuti() {
        contentAreaEl.innerHTML = `<div class="card shadow-sm"><h5 class="card-header bg-white">Pengajuan Cuti</h5><div class="card-body"><form id="leaveForm"><div class="mb-3"><label class="form-label">Tanggal Mulai</label><input type="date" name="startDate" required class="form-control"></div><div class="mb-3"><label class="form-label">Tanggal Selesai</label><input type="date" name="endDate" required class="form-control"></div><div class="mb-3"><label class="form-label">Keperluan</label><textarea name="reason" rows="3" required class="form-control"></textarea></div><button type="submit" class="btn btn-primary">Ajukan Cuti</button></form></div></div>`;
        document.getElementById('leaveForm').addEventListener('submit', async (e) => {
            e.preventDefault(); const form = e.target;
            showToast("Mengirim pengajuan...", 'info');
            const result = await postData('submitLeave', { userId: user.id, startDate: form.startDate.value, endDate: form.endDate.value, reason: form.reason.value });
            if(result.status === 'success') { showToast(result.message, 'success'); form.reset(); await refreshData(); } else { showToast(result.message, 'danger'); }
        });
    }
    
    function renderLembur() {
        contentAreaEl.innerHTML = `<div class="card shadow-sm"><h5 class="card-header bg-white">Pengajuan Lembur</h5><div class="card-body"><form id="overtimeForm"><div class="mb-3"><label class="form-label">Tanggal</label><input type="date" name="date" required class="form-control"></div><div class="row mb-3"><div class="col"><label class="form-label">Waktu Mulai</label><input type="time" name="startTime" required class="form-control"></div><div class="col"><label class="form-label">Waktu Selesai</label><input type="time" name="endTime" required class="form-control"></div></div><div class="mb-3"><label class="form-label">Keperluan</label><textarea name="reason" rows="3" required class="form-control"></textarea></div><button type="submit" class="btn btn-primary">Ajukan Lembur</button></form></div></div>`;
        document.getElementById('overtimeForm').addEventListener('submit', async (e) => {
            e.preventDefault(); const form = e.target;
            showToast("Mengirim pengajuan...", 'info');
            const result = await postData('submitOvertime', { userId: user.id, date: form.date.value, startTime: form.startTime.value, endTime: form.endTime.value, reason: form.reason.value });
            if(result.status === 'success') { showToast(result.message, 'success'); form.reset(); await refreshData(); } else { showToast(result.message, 'danger'); }
        });
    }

    function renderAdminHomeDashboard() {
        const { users, leave, overtime } = appData;
        contentAreaEl.innerHTML = `<div class="row">
        <div class="col-lg-4 col-md-6 col-12 mb-4"><div class="card bg-primary text-white shadow"><div class="card-body"><div class="d-flex justify-content-between"><h5 class="card-title text-white">Total Staff</h5><i class="bi bi-people-fill fs-2"></i></div><p class="display-4 fw-bold">${users.length}</p></div></div></div>
        <div class="col-lg-4 col-md-6 col-12 mb-4"><div class="card bg-warning text-dark shadow"><div class="card-body"><div class="d-flex justify-content-between"><h5 class="card-title text-dark">Total Cuti Diajukan</h5><i class="bi bi-calendar4-week fs-2"></i></div><p class="display-4 fw-bold">${leave.length}</p></div></div></div>
        <div class="col-lg-4 col-md-6 col-12 mb-4"><div class="card bg-info text-white shadow"><div class="card-body"><div class="d-flex justify-content-between"><h5 class="card-title text-white">Total Lembur</h5><i class="bi bi-hourglass-split fs-2"></i></div><p class="display-4 fw-bold">${overtime.length}</p></div></div></div>
        </div>`;
    }
    
    function renderAdminDataManagement() {
        const { users, attendance, leave, overtime } = appData;
        const renderTable = (title, headers, rows, sheetName, addBtn = false) => {
             const keys = headers.map(h => h.toLowerCase().replace(/ /g, '_'));
             const showActions = user.role === 'super admin';
             let tableHeaders = [...headers]; if (showActions) tableHeaders.push("Aksi");
             return `<div class="card mb-4 shadow-sm"><div class="card-header bg-white d-flex justify-content-between align-items-center"><span>${title}</span>${addBtn ? `<button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#addUserModal"><i class="bi bi-plus-circle me-1"></i> Tambah</button>`: ''}</div><div class="table-responsive text-nowrap"><table class="table table-hover table-striped align-middle"><thead class="table-dark"><tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${keys.map(key => {
                 if (key === 'check_in_location') return `<td><div class="d-flex align-items-center"><span class="me-2 text-truncate" style="max-width:150px;">${row[key] || ''}</span>${row[key] && row[key].includes(',') ? `<a href="https://maps.google.com/?q=${row[key]}" target="_blank" class="btn btn-xs btn-outline-primary p-1"><i class="bi bi-geo-alt-fill"></i></a>` : ''}</div></td>`;
                 return `<td>${row[key] || ''}</td>`;
             }).join('')}${showActions ? `<td class="py-2"><button class="btn btn-sm btn-outline-danger delete-btn" data-id="${row.id}" data-sheet="${sheetName}"><i class="bi bi-trash"></i></button></td>` : ''}</tr>`).join('')}</tbody></table></div></div>`;
        };
        contentAreaEl.innerHTML = renderTable('Data Pengguna', ['ID', 'Name', 'Role'], users, 'Users', true) + renderTable('Data Absensi', ['ID', 'User ID', 'Check In', 'Branch', 'Check In Location'], attendance, 'Attendance') + renderTable('Data Cuti', ['ID', 'User ID', 'Status'], leave, 'Leave') + renderTable('Data Lembur', ['ID', 'User ID', 'Reason'], overtime, 'Overtime');
        document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDelete));
        document.getElementById('addUserForm').addEventListener('submit', handleAddUser);
    }
    
    async function handleAddUser(e) {
        e.preventDefault(); const form = e.target;
        const userData = { name: form.name.value, username: form.username.value, password: form.password.value, role: form.role.value };
        const result = await postData("addUser", { userData });
        if (result.status === "success") {
            addUserModal.hide(); form.reset();
            showToast(result.message, 'success');
            await refreshData(); renderAdminDataManagement();
        } else { showToast(`Error: ${result.message}`, 'danger'); }
    }

    async function handleDelete(e) {
        const id = e.target.closest('.delete-btn').dataset.id; const sheetName = e.target.closest('.delete-btn').dataset.sheet;
        if(confirm(`Anda yakin ingin menghapus data ID ${id}?`)) {
            const result = await postData("deleteRecord", { sheetName, id });
            if (result.status === "success") { showToast(result.message, 'success'); await refreshData(); renderAdminDataManagement(); } 
            else { showToast(result.message, 'danger'); }
        }
    }

    function renderPersetujuanCuti() {
        const { users, leave } = appData;
        const pendingLeave = leave.filter(l => l.status === 'Pending');
        contentAreaEl.innerHTML = `<div class="card shadow-sm"><h5 class="card-header bg-white">Persetujuan Cuti</h5><div class="card-body"><ul class="list-group list-group-flush">${pendingLeave.length > 0 ? pendingLeave.map(l => `<li class="list-group-item d-flex justify-content-between align-items-center flex-wrap"><div><div class="fw-bold">${users.find(u=>u.id === l.user_id)?.name}</div><small>${l.start_date} - ${l.end_date}</small><p class="mb-0 w-100">${l.reason}</p></div><button data-leave-id="${l.id}" class="btn btn-sm btn-success approve-btn mt-2 mt-sm-0">Setujui</button></li>`).join('') : '<li class="list-group-item text-center">Tidak ada pengajuan cuti.</li>'}</ul></div></div>`;
        document.querySelectorAll('.approve-btn').forEach(button => button.addEventListener('click', async (e) => {
            const leaveId = e.target.dataset.leaveId; 
            showToast('Menyetujui...', 'info');
            const result = await postData('approveLeave', { leaveId, approverId: user.id });
            if(result.status === 'success') { showToast(result.message, 'success'); await refreshData(); renderPersetujuanCuti(); } 
            else { showToast(result.message, 'danger'); }
        }));
    }

    function logout() { localStorage.removeItem("user"); window.location.href = "index.html"; }

    setupLayout();
});