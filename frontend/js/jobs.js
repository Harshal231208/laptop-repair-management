const jobsList = document.getElementById('jobsList');
const jobSearch = document.getElementById('jobSearch');
const statusFilter = document.getElementById('statusFilter');
const refreshBtn = document.getElementById('refreshBtn');
let allJobs=[];
function statusClass(s){return String(s||'').toLowerCase().replace(/\s+/g,'_');}
function renderJobs(jobs){if(!jobs.length){jobsList.innerHTML='<div class="empty-state"><p>No jobs match your search.</p></div>';return;}jobsList.innerHTML=jobs.map(j=>`<div class="job-card"><div class="jc-id">#${j.job_id}<small>${escapeHtml(j.priority||'Normal')}</small></div><div class="jc-main"><strong>${escapeHtml(j.customer_name)}</strong><span>${escapeHtml(j.model)}${j.serial_number?' · '+escapeHtml(j.serial_number):''}</span></div><div class="jc-issue"><b>${escapeHtml(j.category||'Other')}</b> · ${escapeHtml(j.issue_description)}</div><div class="jc-date">${formatDate(j.date_reported)}<small>${j.technician_name?'Tech: '+escapeHtml(j.technician_name):'Unassigned'}</small></div><span class="status-badge status-${statusClass(j.status)}">${escapeHtml(j.status)}</span></div>`).join('');}
function applyFilters(){const q=jobSearch.value.trim().toLowerCase(),s=statusFilter.value;renderJobs(allJobs.filter(j=>(s==='all'||j.status===s)&&(!q||[j.customer_name,j.model,j.serial_number,j.issue_description,String(j.job_id)].some(v=>String(v||'').toLowerCase().includes(q)))));}
async function loadJobs(){jobsList.innerHTML='<div class="skeleton-card"><div class="skeleton-bar wide"></div></div>';try{const r=await fetch(`${API_URL}/repair-jobs`);if(!r.ok)throw new Error('Unable to load repair jobs.');allJobs=await r.json();applyFilters();}catch(e){jobsList.innerHTML=`<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;showToast(e.message,'error');}}
jobSearch.addEventListener('input',applyFilters);statusFilter.addEventListener('change',applyFilters);refreshBtn.addEventListener('click',loadJobs);window.addEventListener('load',loadJobs);
