const jobsList = document.getElementById('jobsList');
const jobSearch = document.getElementById('jobSearch');
const statusFilter = document.getElementById('statusFilter');
const priorityFilter = document.getElementById('priorityFilter');
const refreshBtn = document.getElementById('refreshBtn');
let allJobs = [];
let technicians = [];

const STATUS_OPTIONS = ['Received','Diagnosing','Waiting for Approval','Repairing','Ready for Pickup','Completed','Cancelled'];
const PRIORITIES = ['Low','Normal','High','Urgent'];
const CATEGORIES = ['Hardware','Software','Display','Battery','Charging','Storage','Memory','Keyboard','Network','Operating System','Other'];

function statusClass(status) {
  return String(status || '').toLowerCase().replace(/\s+/g, '_');
}

function priorityClass(priority) {
  return String(priority || 'Normal').toLowerCase();
}

function money(value) {
  return value === null || value === undefined || value === ''
    ? '—'
    : `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function renderStats(c) {
  const cards = [
    ['Total Jobs', c.total || 0, 'All tickets'],
    ['Needs Attention', c.pending || 0, 'Received / diagnosing'],
    ['Repairing', c.repairing || 0, 'Currently on bench'],
    ['Ready for Pickup', c.ready || 0, 'Waiting for customer'],
    ['Completed', c.completed || 0, `${money(c.revenue || 0)} collected`]
  ];
  document.getElementById('dashboardStats').innerHTML =
    cards.map(([label,value,sub]) => `<div class="stat-card"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`).join('');
}

function renderCategories(rows) {
  const max = Math.max(1, ...rows.map(r => Number(r.count)));
  document.getElementById('categoryChart').innerHTML = rows.length
    ? rows.map(r => `<div class="bar-row"><div><span>${escapeHtml(r.category)}</span><strong>${r.count}</strong></div><div class="bar-track"><i style="width:${(Number(r.count)/max)*100}%"></i></div></div>`).join('')
    : '<p>No category data yet.</p>';
}

function renderTechnicians() {
  document.getElementById('technicianList').innerHTML = technicians.length
    ? technicians.map(t => `<div class="tech-row"><div class="avatar">${escapeHtml(t.name.charAt(0))}</div><div><strong>${escapeHtml(t.name)}</strong><span>${escapeHtml(t.specialization || 'General repair')}</span></div><b>${t.active_jobs} active</b></div>`).join('')
    : '<p>No technicians found.</p>';
}

function renderJobs(jobs) {
  if (!jobs.length) {
    jobsList.innerHTML = '<div class="empty-state"><p>No jobs match the selected filters.</p></div>';
    return;
  }

  jobsList.innerHTML = jobs.map(job => `
    <article class="admin-job-card" data-job-id="${job.job_id}">
      <div class="admin-job-top">
        <div>
          <span class="ticket-mini">#${job.job_id}</span>
          <span class="priority-badge priority-${priorityClass(job.priority)}">${escapeHtml(job.priority || 'Normal')}</span>
        </div>
        <span class="status-badge status-${statusClass(job.status)}">${escapeHtml(job.status)}</span>
      </div>

      <div class="admin-job-main">
        <div>
          <h3>${escapeHtml(job.customer_name)}</h3>
          <p>${escapeHtml(job.model)}${job.serial_number ? ` · S/N ${escapeHtml(job.serial_number)}` : ''}</p>
        </div>
        <p class="issue-text">${escapeHtml(job.issue_description)}</p>
        <p class="job-date">Reported ${formatDate(job.date_reported)}</p>
      </div>

      <div class="admin-controls">
        <label>Status
          <select class="status-select">${STATUS_OPTIONS.map(s => `<option ${s===job.status?'selected':''}>${s}</option>`).join('')}</select>
        </label>

        <label>Technician
          <select class="tech-select">
            <option value="">Unassigned</option>
            ${technicians.map(t => `<option value="${t.tech_id}" ${String(t.tech_id)===String(job.tech_id)?'selected':''}>${escapeHtml(t.name)}</option>`).join('')}
          </select>
        </label>

        <label>Category
          <select class="category-select">${CATEGORIES.map(c => `<option ${c===(job.category||'Other')?'selected':''}>${c}</option>`).join('')}</select>
        </label>

        <label>Priority
          <select class="priority-select">${PRIORITIES.map(p => `<option ${p===(job.priority||'Normal')?'selected':''}>${p}</option>`).join('')}</select>
        </label>

        <label>Est. ₹
          <input class="estimated-cost" type="number" min="0" step="0.01" value="${job.estimated_cost ?? ''}">
        </label>

        <label>Actual ₹
          <input class="actual-cost" type="number" min="0" step="0.01" value="${job.actual_cost ?? ''}">
        </label>

        <label>Expected date
          <input class="estimated-date" type="date" value="${job.estimated_completion || ''}">
        </label>

        <div class="admin-actions">
          <button class="btn btn-outline btn-details">Details</button>
          <button class="btn btn-outline btn-print">Print</button>
          <button class="btn btn-outline btn-xml">XML</button>
          <button class="btn btn-copper btn-save-status">Save changes</button>
          <button class="btn btn-delete btn-delete-job">Delete Job</button>
        </div>
      </div>
    </article>
  `).join('');

  jobsList.querySelectorAll('.btn-save-status').forEach(btn => btn.addEventListener('click', saveJob));
  jobsList.querySelectorAll('.btn-delete-job').forEach(btn => btn.addEventListener('click', deleteJob));
  jobsList.querySelectorAll('.btn-details').forEach(btn => btn.addEventListener('click', () => openDetails(btn.closest('.admin-job-card').dataset.jobId)));
  jobsList.querySelectorAll('.btn-print').forEach(btn => btn.addEventListener('click', () => printJob(btn.closest('.admin-job-card').dataset.jobId)));
  jobsList.querySelectorAll('.btn-xml').forEach(btn => btn.addEventListener('click', () => exportXml(btn.closest('.admin-job-card').dataset.jobId)));
}

function applyFilters() {
  const q = jobSearch.value.trim().toLowerCase();
  const s = statusFilter.value;
  const p = priorityFilter.value;

  renderJobs(allJobs.filter(j =>
    (!q || [j.customer_name, j.model, j.serial_number, j.issue_description, String(j.job_id)]
      .some(v => String(v || '').toLowerCase().includes(q))) &&
    (s === 'all' || j.status === s) &&
    (p === 'all' || (j.priority || 'Normal') === p)
  ));
}

async function saveJob(e) {
  const btn = e.currentTarget;
  const card = btn.closest('.admin-job-card');
  const id = card.dataset.jobId;

  btn.disabled = true;
  btn.textContent = 'Saving…';

  const body = {
    status: card.querySelector('.status-select').value,
    technician_id: card.querySelector('.tech-select').value || null,
    category: card.querySelector('.category-select').value,
    priority: card.querySelector('.priority-select').value,
    estimated_cost: card.querySelector('.estimated-cost').value,
    actual_cost: card.querySelector('.actual-cost').value,
    estimated_completion: card.querySelector('.estimated-date').value || null,
    remarks: 'Updated from admin dashboard'
  };

  try {
    const r = await AdminAuth.fetch(`${API_URL}/repair-jobs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Update failed');

    showToast(`Ticket #${id} updated successfully.`, 'success');
    await loadAll();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save changes';
  }
}

async function deleteJob(e) {
  const btn = e.currentTarget;
  const card = btn.closest('.admin-job-card');
  const id = card.dataset.jobId;

  const confirmed = confirm(`Are you sure you want to delete repair ticket #${id}? This action cannot be undone.`);
  if (!confirmed) return;

  btn.disabled = true;
  btn.textContent = 'Deleting…';

  try {
    const r = await AdminAuth.fetch(`${API_URL}/repair-jobs/${id}`, { method: 'DELETE' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Delete failed');

    showToast(`Ticket #${id} deleted successfully.`, 'success');
    await loadAll();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Delete Job';
  }
}

async function fetchJobDetails(id) {
  const r = await AdminAuth.fetch(`${API_URL}/admin/repair-jobs/${id}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Unable to load ticket details.');
  return data;
}

function historyHtml(history) {
  if (!history || !history.length) return '<p>No repair history recorded.</p>';

  return `<div class="detail-history">${history.map(h => `
    <div class="detail-history-item">
      <span class="history-dot"></span>
      <div>
        <strong>${escapeHtml(h.new_status)}</strong>
        <p>${escapeHtml(h.remarks || 'Status updated')} · ${formatDate(h.changed_at, true)}</p>
        <small>By ${escapeHtml(h.changed_by || 'Admin')}</small>
      </div>
    </div>
  `).join('')}</div>`;
}

function openModal() {
  document.getElementById('jobDetailsModal').hidden = false;
  document.body.classList.add('modal-open');
}

function closeModal() {
  document.getElementById('jobDetailsModal').hidden = true;
  document.body.classList.remove('modal-open');
}

async function openDetails(id) {
  const modalBody = document.getElementById('jobDetailsBody');
  modalBody.innerHTML = '<div class="modal-loading">Loading ticket details…</div>';
  openModal();

  try {
    const job = await fetchJobDetails(id);
    modalBody.innerHTML = `
      <div class="detail-modal-head">
        <div>
          <span class="ticket-mini">Ticket #${job.job_id}</span>
          <h2 id="jobDetailsTitle">${escapeHtml(job.customer_name)}</h2>
        </div>
        <span class="status-badge status-${statusClass(job.status)}">${escapeHtml(job.status)}</span>
      </div>

      <div class="detail-grid">
        <div><span>Customer</span><strong>${escapeHtml(job.customer_name)}</strong></div>
        <div><span>Email</span><strong>${escapeHtml(job.email)}</strong></div>
        <div><span>Phone</span><strong>${escapeHtml(job.phone || 'Not provided')}</strong></div>
        <div><span>Device</span><strong>${escapeHtml(job.model)}</strong></div>
        <div><span>Serial number</span><strong>${escapeHtml(job.serial_number || 'Not provided')}</strong></div>
        <div><span>Technician</span><strong>${escapeHtml(job.technician_name || 'Not assigned')}</strong></div>
        <div><span>Category</span><strong>${escapeHtml(job.category || 'Other')}</strong></div>
        <div><span>Priority</span><strong>${escapeHtml(job.priority || 'Normal')}</strong></div>
        <div><span>Estimated cost</span><strong>${money(job.estimated_cost)}</strong></div>
        <div><span>Actual cost</span><strong>${money(job.actual_cost)}</strong></div>
        <div><span>Expected completion</span><strong>${formatDate(job.estimated_completion)}</strong></div>
        <div><span>Reported</span><strong>${formatDate(job.date_reported, true)}</strong></div>
      </div>

      <div class="issue-box">
        <span>Reported issue</span>
        <p>${escapeHtml(job.issue_description)}</p>
      </div>

      <div class="issue-box">
        <span>Admin notes</span>
        <p>${escapeHtml(job.notes || 'No notes added.')}</p>
      </div>

      <div class="history">
        <h3>Repair history</h3>
        ${historyHtml(job.history)}
      </div>

      <div class="modal-actions">
        <button class="btn btn-outline modal-print">Print receipt</button>
        <button class="btn btn-outline modal-xml">Export XML</button>
        <button class="btn btn-copper modal-close-action">Close</button>
      </div>
    `;

    modalBody.querySelector('.modal-close-action').addEventListener('click', closeModal);
    modalBody.querySelector('.modal-print').addEventListener('click', () => printJob(job.job_id));
    modalBody.querySelector('.modal-xml').addEventListener('click', () => exportXml(job.job_id));
  } catch (err) {
    modalBody.innerHTML = `<div class="empty-state"><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function printJob(id) {
  const printWindow = window.open('', '_blank', 'width=850,height=900');
  if (!printWindow) {
    showToast('Please allow pop-ups to print the receipt.', 'error');
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html><head><title>Repair Receipt #${escapeHtml(id)}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#181f2b;padding:40px;max-width:800px;margin:auto}
      h1{margin:0 0 6px}h2{margin-top:30px;font-size:18px;border-bottom:1px solid #ddd;padding-bottom:8px}
      .muted{color:#666}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 30px}
      .item{padding:8px 0;border-bottom:1px solid #eee}.label{display:block;color:#777;font-size:12px;text-transform:uppercase}
      .value{font-weight:600}.issue{background:#f5f5f5;padding:14px;margin-top:10px}
      .history{border-left:3px solid #c06a2e;padding-left:16px}.event{margin:0 0 14px}
      .footer{margin-top:35px;padding-top:15px;border-top:1px solid #ddd;font-size:12px;color:#777}
      @media print{body{padding:0}.no-print{display:none}}
    </style></head><body>
    <div id="receipt">Loading…</div>
    </body></html>
  `);
  printWindow.document.close();

  fetchJobDetails(id).then(job => {
    const history = (job.history || []).map(h =>
      `<div class="event"><strong>${escapeHtml(h.new_status)}</strong><br><span class="muted">${escapeHtml(h.remarks || 'Status updated')} · ${formatDate(h.changed_at, true)}</span></div>`
    ).join('');

    printWindow.document.getElementById('receipt').innerHTML = `
      <h1>RepairBench</h1>
      <p class="muted">Laptop Repair Management System</p>
      <h2>Repair Receipt — Ticket #${job.job_id}</h2>
      <div class="grid">
        <div class="item"><span class="label">Customer</span><span class="value">${escapeHtml(job.customer_name)}</span></div>
        <div class="item"><span class="label">Status</span><span class="value">${escapeHtml(job.status)}</span></div>
        <div class="item"><span class="label">Email</span><span class="value">${escapeHtml(job.email)}</span></div>
        <div class="item"><span class="label">Phone</span><span class="value">${escapeHtml(job.phone || 'Not provided')}</span></div>
        <div class="item"><span class="label">Device</span><span class="value">${escapeHtml(job.model)}</span></div>
        <div class="item"><span class="label">Serial number</span><span class="value">${escapeHtml(job.serial_number || 'Not provided')}</span></div>
        <div class="item"><span class="label">Category</span><span class="value">${escapeHtml(job.category || 'Other')}</span></div>
        <div class="item"><span class="label">Priority</span><span class="value">${escapeHtml(job.priority || 'Normal')}</span></div>
        <div class="item"><span class="label">Technician</span><span class="value">${escapeHtml(job.technician_name || 'Not assigned')}</span></div>
        <div class="item"><span class="label">Expected completion</span><span class="value">${formatDate(job.estimated_completion)}</span></div>
        <div class="item"><span class="label">Estimated cost</span><span class="value">${money(job.estimated_cost)}</span></div>
        <div class="item"><span class="label">Actual cost</span><span class="value">${money(job.actual_cost)}</span></div>
      </div>
      <h2>Reported Issue</h2>
      <div class="issue">${escapeHtml(job.issue_description)}</div>
      <h2>Repair History</h2>
      <div class="history">${history || '<p class="muted">No history recorded.</p>'}</div>
      <div class="footer">Generated by RepairBench Admin · ${new Date().toLocaleString('en-IN')}</div>
    `;

    printWindow.focus();
    printWindow.print();
  }).catch(err => {
    printWindow.close();
    showToast(err.message, 'error');
  });
}

async function exportXml(id) {
  try {
    const r = await AdminAuth.fetch(`${API_URL}/admin/repair-jobs/${id}/xml`);
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.error || 'Unable to export XML.');
    }

    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repair-job-${id}.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`Ticket #${id} exported as XML.`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadAll() {
  try {
    const [jobsR, dashR, techR] = await Promise.all([
      AdminAuth.fetch(`${API_URL}/admin/repair-jobs`),
      AdminAuth.fetch(`${API_URL}/admin/dashboard`),
      AdminAuth.fetch(`${API_URL}/admin/technicians`)
    ]);

    if (!jobsR.ok || !dashR.ok || !techR.ok) {
      throw new Error('Could not load dashboard data.');
    }

    allJobs = await jobsR.json();
    const dash = await dashR.json();
    technicians = await techR.json();

    renderStats(dash.counts);
    renderCategories(dash.categories);
    renderTechnicians();
    applyFilters();
  } catch (err) {
    jobsList.innerHTML = `<div class="empty-state"><p>${escapeHtml(err.message)}</p></div>`;
    showToast('Could not load dashboard. Check the API and database.', 'error');
  }
}

jobSearch.addEventListener('input', applyFilters);
statusFilter.addEventListener('change', applyFilters);
priorityFilter.addEventListener('change', applyFilters);
refreshBtn.addEventListener('click', loadAll);

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('jobDetailsModal').addEventListener('click', (e) => {
  if (e.target.id === 'jobDetailsModal') closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

window.addEventListener('load', loadAll);
