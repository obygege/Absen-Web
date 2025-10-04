document.addEventListener("DOMContentLoaded", () => {
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzCTa_nps72qN7rSqZ77NbxRGwzwQ9h73HeQ0VWdfo2y0ionGIo7lSRuymgPwCs7I09sg/exec";
    const user = JSON.parse(localStorage.getItem("user"));
    let appData = null; let mapInstance = null; let mapMarker = null; let currentUserPosition = null;

    if (!user) { window.location.href = "index.html"; return; }
    
    const loader = document.getElementById('loader');
    const toastEl = document.getElementById('appToast');
    const appToast = new bootstrap.Toast(toastEl);
    let contentAreaEl, pageTitleEl, addUserModal, addLocationModal, changePasswordModal;

    const routes = {
        'staff': [ { name: 'Absen', icon: 'bi-fingerprint', render: renderAbsenChoice }, { name: 'Riwayat', icon: 'bi-clock-history', render: renderRiwayat }, { name: 'Cuti', icon: 'bi-calendar4-week', render: renderCuti }, { name: 'Lembur', icon: 'bi-hourglass-split', render: renderLembur } ],
        'kepala': [ { name: 'Dashboard', icon: 'bi-grid-1x2-fill', render: renderAdminHomeDashboard }, { name: 'Manajemen Staff', icon: 'bi-people-fill', render: renderAdminDataManagement }, { name: 'Lokasi Kantor', icon: 'bi-pin-map-fill', render: renderOfficeLocations }, { name: 'Persetujuan Cuti', icon: 'bi-check2-square', render: renderPersetujuanCuti, notification: true } ],
        'super admin': [ { name: 'Dashboard', icon: 'bi-grid-1x2-fill', render: renderAdminHomeDashboard }, { name: 'Manajemen Staff', icon: 'bi-people-fill', render: renderAdminDataManagement }, { name: 'Lokasi Kantor', icon: 'bi-pin-map-fill', render: renderOfficeLocations } ]
    };

    function setupLayout() {
        if (user.role === 'staff') {
            document.getElementById('staff-layout').classList.remove('d-none');
            contentAreaEl = document.getElementById('content-area-staff');
            document.getElementById('user-name-staff').textContent = user.name;
            document.getElementById('logout-btn-staff').addEventListener('click', logout);
            createNavLinks('main-nav-staff-mobile', routes.staff, true);
        } else {
            document.getElementById('admin-layout').classList.remove('d-none');
            contentAreaEl = document.getElementById('content-area-admin');
            pageTitleEl = document.getElementById('page-title');
            addUserModal = new bootstrap.Modal(document.getElementById('addUserModal'));
            addLocationModal = new bootstrap.Modal(document.getElementById('addLocationModal'));
            changePasswordModal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
            document.getElementById('admin-name-display').textContent = user.name;
            document.getElementById('logout-btn-admin-desktop').addEventListener('click', logout);
            document.getElementById('sidebar-toggle').addEventListener('click', () => { document.body.classList.toggle('sidebar-collapsed'); });
            document.getElementById('change-password-btn-desktop').addEventListener('click', () => openChangePasswordModal(user.id, user.name));
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
            clickableElement.dataset.navName = item.name;
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
        contentAreaEl.innerHTML = `<div class="card shadow-sm"><div class="card-body text-center"><div class="d-flex justify-content-between align-items-center mb-3"><h5 class="card-title mb-0">Absensi via GPS</h5><button class="btn btn-sm btn-outline-secondary" id="back-to-choice"><i class="bi bi-arrow-left"></i> Kembali</button></div><div id="gps-content-wrapper"></div></div></div>`;
        document.getElementById('back-to-choice').addEventListener('click', renderAbsenChoice);
        
        const gpsWrapper = document.getElementById('gps-content-wrapper');
        gpsWrapper.innerHTML = `<div class="d-grid"><button id="activate-gps-btn" class="btn btn-success btn-lg"><i class="bi bi-broadcast-pin me-2"></i>Aktifkan & Lacak GPS Saya</button></div>`;
        document.getElementById('activate-gps-btn').addEventListener('click', (e) => {
            e.target.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Mencari Sinyal GPS...`;
            e.target.disabled = true;
            
            gpsWrapper.innerHTML = `<div class="p-2 bg-light rounded border mb-3"><small class="text-muted">Lokasi Anda Saat Ini:</small><p id="location-text" class="fw-bold mb-0">Mendeteksi lokasi...</p></div><div id="map" class="mb-3 w-100"></div><p id="clock" class="h4 fw-bold font-monospace mb-3"></p><div class="mb-3"><select id="branch-select" class="form-select"><option value="">-- Pilih Cabang --</option>${branchOptions}</select></div><div id="attendance-button-container" class="d-grid gap-2"></div>`;
            
            initializeGeolocation();
            const clockEl = document.getElementById('clock');
            const clockInterval = setInterval(() => { if(clockEl) { clockEl.textContent = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Makassar', hour12: false }); } else { clearInterval(clockInterval); } }, 1000);
            document.getElementById('branch-select').addEventListener('change', updateAttendanceButtons);
            updateAttendanceButtons();
        });
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
        const mapEl = document.getElementById('map');
        if (!mapEl) return;
        mapInstance = L.map(mapEl).setView([-5.1477, 119.4327], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
        
        navigator.geolocation.watchPosition(async (position) => {
            currentUserPosition = position.coords;
            const { latitude, longitude } = currentUserPosition; const latlng = [latitude, longitude];
            mapInstance.setView(latlng, 17);
            if (!mapMarker) { mapMarker = L.marker(latlng).addTo(mapInstance); } else { mapMarker.setLatLng(latlng); }
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await response.json(); const locationTextEl = document.getElementById('location-text');
            if(locationTextEl) locationTextEl.textContent = data.display_name || 'Lokasi terdeteksi';
            updateAttendanceButtons();
        }, () => { const el = document.getElementById('location-text'); if(el) el.textContent = 'GPS tidak aktif atau ditolak.'; }, { enableHighAccuracy: true });
    }

    function getDistance(lat1, lon1, lat2, lon2) {
        const safeParse = (coord) => parseFloat(String(coord).replace(',', '.'));
        lat1 = safeParse(lat1); lon1 = safeParse(lon1);
        lat2 = safeParse(lat2); lon2 = safeParse(lon2);
        if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return Infinity;

        const R = 6371e3; 
        const p1 = lat1 * Math.PI/180; const p2 = lat2 * Math.PI/180;
        const deltaP = p2 - p1; const deltaLon = lon2 - lon1;
        const deltaLambda = (deltaLon * Math.PI) / 180;
        const a = Math.sin(deltaP/2) * Math.sin(deltaP/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    function updateAttendanceButtons() {
        const container = document.getElementById('attendance-button-container'); if (!container) return;
        const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" })).toISOString().slice(0, 10);
        const todayAttendance = appData.attendance?.find(a => new Date(a.date).toISOString().slice(0, 10) === today);
        
        let branchName;
        if (!todayAttendance) {
            const branchSelect = document.getElementById('branch-select');
            branchName = branchSelect.value;
            if (!branchName) { container.innerHTML = `<p class="alert alert-warning small">Silakan pilih cabang untuk memulai absensi.</p>`; return; }
        } else {
            branchName = todayAttendance.branch;
        }

        if (!currentUserPosition) { container.innerHTML = `<p class="alert alert-info small">Mendeteksi lokasi GPS Anda...</p>`; return; }
        
        const officeLocation = appData.locations.find(loc => loc.branch_name === branchName);
        if (!officeLocation) { container.innerHTML = `<p class="alert alert-danger small">Lokasi untuk cabang '${branchName}' belum diatur Admin.</p>`; return; }
        
        const distance = getDistance(currentUserPosition.latitude, currentUserPosition.longitude, officeLocation.latitude, officeLocation.longitude);
        if (distance > 100) {
            container.innerHTML = `<p class="alert alert-danger fw-bold">Anda tidak berada di lokasi kantor. (Jarak: ${Math.round(distance)} meter)</p>`;
            return;
        }

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
        if (!currentUserPosition) { showToast('Lokasi GPS saat ini tidak ditemukan.', 'danger'); return; }
        showToast('Memproses...', 'info');
        const location = `${currentUserPosition.latitude},${currentUserPosition.longitude}`;
        const result = await postData("recordAttendance", { userId: user.id, type, location, branch: branchSelect.value });
        if (result.status === 'success') {
            showToast(result.message, 'success');
            await refreshData();
            updateAttendanceButtons();
        } else { showToast(`Error: ${result.message}`, 'danger'); }
    }
    
    function startQrScanner() {
        const branchSelect = document.getElementById('branch-select');
        const html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
            async (decodedText) => {
                if (!branchSelect.value) { showToast('Pilih cabang terlebih dahulu!', 'danger'); return; }
                await html5QrCode.stop().catch(err => console.error(err));
                showToast(`QR terdeteksi, memproses...`, 'info');
                navigator.geolocation.getCurrentPosition(async (position) => {
                    const { latitude, longitude } = position.coords; const location = `${latitude},${longitude}`;
                    const result = await postData("recordAttendance", { userId: user.id, type: 'check_in', location: `QR Scan: ${decodedText.split('|')[0]} at ${location}`, branch: branchSelect.value });
                    if (result.status === 'success') {
                        showToast(result.message, 'success'); await refreshData();
                        renderAbsenChoice();
                    } else { showToast(`Error: ${result.message}`, 'danger'); }
                }, () => { showToast('GPS diperlukan untuk merekam lokasi saat scan QR.', 'danger'); });
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
            e.preventDefault(); const form = e.target; showToast("Mengirim pengajuan...", 'info');
            const result = await postData('submitLeave', { userId: user.id, startDate: form.startDate.value, endDate: form.endDate.value, reason: form.reason.value });
            if(result.status === 'success') { showToast(result.message, 'success'); form.reset(); await refreshData(); } else { showToast(result.message, 'danger'); }
        });
    }
    
    function renderLembur() {
        contentAreaEl.innerHTML = `<div class="card shadow-sm"><h5 class="card-header bg-white">Pengajuan Lembur</h5><div class="card-body"><form id="overtimeForm"><div class="mb-3"><label class="form-label">Tanggal</label><input type="date" name="date" required class="form-control"></div><div class="row mb-3"><div class="col"><label class="form-label">Waktu Mulai</label><input type="time" name="startTime" required class="form-control"></div><div class="col"><label class="form-label">Waktu Selesai</label><input type="time" name="endTime" required class="form-control"></div></div><div class="mb-3"><label class="form-label">Keperluan</label><textarea name="reason" rows="3" required class="form-control"></textarea></div><button type="submit" class="btn btn-primary">Ajukan Lembur</button></form></div></div>`;
        document.getElementById('overtimeForm').addEventListener('submit', async (e) => {
            e.preventDefault(); const form = e.target; showToast("Mengirim pengajuan...", 'info');
            const result = await postData('submitOvertime', { userId: user.id, date: form.date.value, startTime: form.startTime.value, endTime: form.endTime.value, reason: form.reason.value });
            if(result.status === 'success') { showToast(result.message, 'success'); form.reset(); await refreshData(); } else { showToast(result.message, 'danger'); }
        });
    }

    function renderAdminHomeDashboard() {
        const { users, leave, overtime } = appData;
        contentAreaEl.innerHTML = `<div class="row"><div class="col-lg-4 col-md-6 col-12 mb-4"><div class="card bg-primary text-white shadow"><div class="card-body"><div class="d-flex justify-content-between"><h5 class="card-title text-white">Total Staff</h5><i class="bi bi-people-fill fs-2"></i></div><p class="display-4 fw-bold">${users.filter(u=>u.role === 'staff').length}</p></div></div></div><div class="col-lg-4 col-md-6 col-12 mb-4"><div class="card bg-warning text-dark shadow"><div class="card-body"><div class="d-flex justify-content-between"><h5 class="card-title text-dark">Total Cuti Diajukan</h5><i class="bi bi-calendar4-week fs-2"></i></div><p class="display-4 fw-bold">${leave.length}</p></div></div></div><div class="col-lg-4 col-md-6 col-12 mb-4"><div class="card bg-info text-white shadow"><div class="card-body"><div class="d-flex justify-content-between"><h5 class="card-title text-white">Total Lembur</h5><i class="bi bi-hourglass-split fs-2"></i></div><p class="display-4 fw-bold">${overtime.length}</p></div></div></div></div>`;
    }
    
    function renderAdminDataManagement() {
        const { users, attendance, leave, overtime } = appData;
        const renderUserTable = (rows) => {
            const showActions = user.role === 'super admin' || user.role === 'kepala';
            return rows.map(row => `<tr><td>${row.id || ''}</td><td>${row.name || ''}</td><td>${row.username || ''}</td><td>${row.role || ''}</td>${showActions && row.role === 'staff' ? `<td class="py-2"><div class="btn-group"><button class="btn btn-sm btn-outline-secondary change-pass-btn" data-id="${row.id}" data-name="${row.name}"><i class="bi bi-key-fill"></i></button><button class="btn btn-sm btn-outline-danger delete-btn" data-id="${row.id}" data-sheet="Users"><i class="bi bi-trash"></i></button></div></td>` : `<td></td>`}</tr>`).join('');
        }
        contentAreaEl.innerHTML = `<div class="card mb-4 shadow-sm"><div class="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2"><span>Data Staff</span><div class="d-flex gap-2"><div class="input-group" style="width: 250px;"><span class="input-group-text"><i class="bi bi-search"></i></span><input type="text" class="form-control form-control-sm" placeholder="Cari nama staff..." id="user-search-input"></div><button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#addUserModal"><i class="bi bi-plus-circle me-1"></i> Tambah</button></div></div><div class="table-responsive text-nowrap"><table class="table table-hover table-striped align-middle"><thead class="table-dark"><tr><th>ID</th><th>Name</th><th>Username</th><th>Role</th><th>Aksi</th></tr></thead><tbody id="users-table-body">${renderUserTable(users.filter(u=>u.role==='staff'))}</tbody></table></div></div>
        <div class="card mb-4 shadow-sm"><h5 class="card-header bg-white">Data Absensi</h5><div class="table-responsive text-nowrap"><table class="table table-hover table-striped align-middle"><thead class="table-dark"><tr><th>ID</th><th>User ID</th><th>Check In</th><th>Branch</th><th>Check In Location</th></tr></thead><tbody>${attendance.map(row => `<tr><td>${row.id}</td><td>${row.user_id}</td><td>${row.check_in}</td><td>${row.branch}</td><td><div class="d-flex align-items-center"><span class="me-2 text-truncate" style="max-width:150px;">${row.check_in_location || ''}</span>${row.check_in_location && row.check_in_location.includes(',') ? `<a href="https://www.google.com/maps?q=${row.check_in_location}" target="_blank" class="btn btn-xs btn-outline-primary p-1"><i class="bi bi-geo-alt-fill"></i></a>` : ''}</div></td></tr>`).join('')}</tbody></table></div></div>`;
        
        document.getElementById('user-search-input').addEventListener('keyup', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredUsers = appData.users.filter(u => u.role === 'staff' && u.name.toLowerCase().includes(searchTerm));
            document.getElementById('users-table-body').innerHTML = renderUserTable(filteredUsers);
            attachActionListeners('#users-table-body');
        });
        attachActionListeners('#users-table-body');
        document.getElementById('addUserForm').addEventListener('submit', handleAddUser);
    }
    
    function attachActionListeners(tbodySelector){
        document.querySelectorAll(`${tbodySelector} .delete-btn`).forEach(btn => btn.addEventListener('click', handleDelete));
        document.querySelectorAll(`${tbodySelector} .change-pass-btn`).forEach(btn => btn.addEventListener('click', (e) => { const target = e.target.closest('.change-pass-btn'); openChangePasswordModal(target.dataset.id, target.dataset.name); }));
    }

    function renderOfficeLocations() {
        const { locations } = appData;
        const adminBranch = appData.users.find(u => u.id === user.id)?.branch;
        const renderTable = (title, headers, rows, sheetName, addBtn = false) => {
             const keys = headers.map(h => h.toLowerCase().replace(/ /g, '_')); const showActions = user.role === 'super admin' || user.role === 'kepala';
             let tableHeaders = [...headers]; if (showActions) tableHeaders.push("Aksi");
             return `<div class="card mb-4 shadow-sm"><div class="card-header bg-white d-flex justify-content-between align-items-center"><span>${title}</span>${addBtn ? `<button class="btn btn-primary btn-sm" id="add-location-btn"><i class="bi bi-plus-circle me-1"></i> Tambah Lokasi</button>`: ''}</div><div class="table-responsive text-nowrap"><table class="table table-hover table-striped align-middle"><thead class="table-dark"><tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${keys.map(key => `<td>${row[key] || ''}</td>`).join('')}${showActions ? `<td class="py-2"><button class="btn btn-sm btn-outline-danger delete-btn" data-id="${row.id}" data-sheet="${sheetName}"><i class="bi bi-trash"></i></button></td>` : ''}</tr>`).join('')}</tbody></table></div></div>`;
        };
        contentAreaEl.innerHTML = renderTable('Daftar Lokasi Kantor', ['ID', 'Branch Name', 'Latitude', 'Longitude'], locations, 'Locations', true);
        document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDelete));
        document.getElementById('add-location-btn').addEventListener('click', () => {
            const form = document.getElementById('addLocationForm');
            const branchInput = form.querySelector('input[name="branch_name"]');
            if (adminBranch) { branchInput.value = adminBranch; branchInput.readOnly = true; } 
            else { branchInput.value = ''; branchInput.readOnly = false; }
            addLocationModal.show();
        });
        const addLocationModalEl = document.getElementById('addLocationModal');
        addLocationModalEl.addEventListener('shown.bs.modal', () => {
             const statusEl = document.getElementById('location-detection-status');
             const saveBtn = document.getElementById('save-location-btn');
             const latInput = document.querySelector('#addLocationForm input[name="latitude"]');
             const lonInput = document.querySelector('#addLocationForm input[name="longitude"]');
             saveBtn.disabled = true;
             statusEl.innerHTML = `<div class="spinner-border spinner-border-sm me-2"></div>Mendeteksi lokasi GPS Anda...`;
             
             navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                latInput.value = latitude.toFixed(6);
                lonInput.value = longitude.toFixed(6);
                statusEl.className = 'alert alert-success';
                statusEl.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i>Lokasi berhasil dideteksi. Silakan simpan.`;
                saveBtn.disabled = false;
             }, () => {
                statusEl.className = 'alert alert-danger';
                statusEl.innerHTML = `<i class="bi bi-x-circle-fill me-2"></i>Gagal mendeteksi lokasi. Pastikan GPS aktif.`;
             }, { enableHighAccuracy: true });
        });
        document.getElementById('addLocationForm').addEventListener('submit', handleAddLocation);
    }
    
    async function handleAddUser(e) {
        e.preventDefault(); const form = e.target;
        const userData = { name: form.name.value, username: form.username.value, password: form.password.value, role: form.role.value };
        const result = await postData("addUser", { userData, adminId: user.id });
        if (result.status === "success") {
            addUserModal.hide(); form.reset(); showToast(result.message, 'success');
            await refreshData(); renderAdminDataManagement();
        } else { showToast(`Error: ${result.message}`, 'danger'); }
    }
    
    async function handleAddLocation(e) {
        e.preventDefault(); const form = e.target;
        const locationData = { branch_name: form.branch_name.value, latitude: form.latitude.value, longitude: form.longitude.value, added_by: user.id };
        if (!locationData.latitude || !locationData.longitude) { showToast('Lokasi belum berhasil dideteksi.', 'danger'); return; }
        const result = await postData("addLocation", { locationData });
        if (result.status === "success") {
            addLocationModal.hide(); form.reset(); showToast(result.message, 'success');
            await refreshData(); renderOfficeLocations();
        } else { showToast(`Error: ${result.message}`, 'danger'); }
    }

    async function handleDelete(e) {
        const id = e.target.closest('.delete-btn').dataset.id; const sheetName = e.target.closest('.delete-btn').dataset.sheet;
        if(confirm(`Anda yakin ingin menghapus data ID ${id}?`)) {
            const result = await postData("deleteRecord", { sheetName, id, adminId: user.id });
            if (result.status === "success") { showToast(result.message, 'success'); await refreshData(); document.querySelector('.nav-link.active, .sidebar-link.active').click(); } 
            else { showToast(result.message, 'danger'); }
        }
    }
    
    function openChangePasswordModal(userId, userName) {
        const form = document.getElementById('changePasswordForm');
        form.reset();
        form.userIdToChange.value = userId;
        document.getElementById('changePasswordTitle').textContent = `Ubah Password untuk ${userName}`;
        changePasswordModal.show();
    }

    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault(); const form = e.target;
        const payload = { userIdToChange: form.userIdToChange.value, newPassword: form.newPassword.value, changerId: user.id };
        showToast('Mengubah password...', 'info');
        const result = await postData('changePassword', payload);
        if (result.status === 'success') {
            changePasswordModal.hide(); showToast(result.message, 'success');
        } else { showToast(result.message, 'danger'); }
    });

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