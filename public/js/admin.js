/* =====================================================
   Smart Computer Training — Admin Panel JS
   ===================================================== */

// ── Toast Notifications ───────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer') || (() => {
    const c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container';
    document.body.appendChild(c);
    return c;
  })();

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ── API Helper ────────────────────────────────────────
async function apiCall(url, method = 'GET', body = null, isFormData = false) {
  const opts = { method, headers: {} };
  if (body) {
    if (isFormData) {
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const res  = await fetch(url, opts);
  return res.json();
}

// ── Modal Helpers ─────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

document.querySelectorAll('[data-modal-open]').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.modalOpen)));
document.querySelectorAll('[data-modal-close]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.modalClose)));
document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));

// ── Image Preview ─────────────────────────────────────
document.querySelectorAll('input[type=file][data-preview]').forEach(input => {
  input.addEventListener('change', () => {
    const preview = document.getElementById(input.dataset.preview);
    if (!preview || !input.files[0]) return;
    preview.src = URL.createObjectURL(input.files[0]);
    preview.classList.add('show');
  });
});

// ── Delete Confirmation ───────────────────────────────
async function confirmDelete(url, onSuccess) {
  if (!confirm('আপনি কি নিশ্চিতভাবে মুছে ফেলতে চান?')) return;
  try {
    const data = await apiCall(url, 'DELETE');
    if (data.success) { showToast(data.message || 'মুছে ফেলা হয়েছে।', 'success'); onSuccess?.(); }
    else showToast(data.message || 'ত্রুটি হয়েছে।', 'error');
  } catch { showToast('সংযোগ ত্রুটি।', 'error'); }
}

// ── Table Search Filter ───────────────────────────────
document.querySelectorAll('[data-search-table]').forEach(input => {
  const tableId = input.dataset.searchTable;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    document.querySelectorAll(`#${tableId} tbody tr`).forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
});

// ── Subject Builder (Result Manager) ─────────────────
function addSubjectRow(containerId = 'subjectsContainer') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'subject-row';
  row.innerHTML = `
    <input class="admin-input" name="subjectName[]"   placeholder="বিষয়ের নাম" required>
    <input class="admin-input" name="subjectMarks[]"  placeholder="নম্বর" type="number" min="0" max="100">
    <input class="admin-input" name="subjectGrade[]"  placeholder="গ্রেড (A+, A…)">
    <button type="button" class="action-btn delete" onclick="this.closest('.subject-row').remove()"><i class="bi bi-trash"></i></button>`;
  container.appendChild(row);
}

// ── Collect subjects from builder ─────────────────────
function collectSubjects() {
  const names  = [...document.querySelectorAll('[name="subjectName[]"]')].map(i => i.value);
  const marks  = [...document.querySelectorAll('[name="subjectMarks[]"]')].map(i => i.value);
  const grades = [...document.querySelectorAll('[name="subjectGrade[]"]')].map(i => i.value);
  return names.map((name, i) => ({ name, marks: marks[i], grade: grades[i] })).filter(s => s.name);
}

// ── Admin search result by regNo ──────────────────────
const adminRegSearch = document.getElementById('adminRegSearch');
adminRegSearch?.addEventListener('change', async () => {
  const regNo = adminRegSearch.value.trim();
  if (!regNo) return;
  const data = await apiCall(`/admin/results/search/${encodeURIComponent(regNo)}`);
  if (data.success) {
    const r = data.result;
    document.getElementById('formStudentName').value = r.studentName || '';
    document.getElementById('formCourseName').value  = r.courseName  || '';
    document.getElementById('formSession').value     = r.session     || '';
    document.getElementById('formRollNo').value      = r.rollNo      || '';
    document.getElementById('formFatherName').value  = r.fatherName  || '';
    document.getElementById('formPhone').value       = r.phone       || '';
    document.getElementById('formGPA').value         = r.totalGPA    || '';
    document.getElementById('formStatus').value      = r.status      || 'Pass';
    // Restore subjects
    const container = document.getElementById('subjectsContainer');
    if (container && r.subjects) {
      container.innerHTML = '';
      r.subjects.forEach(s => {
        addSubjectRow();
        const rows = container.querySelectorAll('.subject-row');
        const last = rows[rows.length - 1];
        last.querySelector('[name="subjectName[]"]').value  = s.name  || '';
        last.querySelector('[name="subjectMarks[]"]').value = s.marks || '';
        last.querySelector('[name="subjectGrade[]"]').value = s.grade || '';
      });
    }
    showToast('রেজাল্ট তথ্য লোড হয়েছে।', 'info');
  }
});

// ── Result Form Submit ────────────────────────────────
document.getElementById('resultForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const subjects = collectSubjects();
  const payload = {
    regNo:       document.getElementById('adminRegSearch')?.value,
    studentName: document.getElementById('formStudentName')?.value,
    courseName:  document.getElementById('formCourseName')?.value,
    session:     document.getElementById('formSession')?.value,
    rollNo:      document.getElementById('formRollNo')?.value,
    fatherName:  document.getElementById('formFatherName')?.value,
    phone:       document.getElementById('formPhone')?.value,
    totalGPA:    document.getElementById('formGPA')?.value,
    status:      document.getElementById('formStatus')?.value,
    subjects:    JSON.stringify(subjects),
  };
  const data = await apiCall('/admin/results', 'POST', payload);
  showToast(data.message, data.success ? 'success' : 'error');
  if (data.success) setTimeout(() => location.reload(), 1200);
});

// ── Logout ────────────────────────────────────────────
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await fetch('/admin/logout', { method: 'POST' });
  location.href = '/admin/login';
});

// ── Sidebar mobile toggle ─────────────────────────────
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.querySelector('.admin-sidebar')?.classList.toggle('open');
});

// ── Live clock ────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('adminClock');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ── Settings: color theme preview ────────────────────
document.getElementById('themeColorInput')?.addEventListener('input', e => {
  document.getElementById('themeColorPreview').style.background = e.target.value;
});
