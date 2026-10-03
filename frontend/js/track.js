const trackInput = document.getElementById('trackInput');
const trackBtn = document.getElementById('trackBtn');
const trackResult = document.getElementById('trackResult');
const loadingSpinner = document.getElementById('loadingSpinner');
const STAGES = ['Received','Diagnosing','Waiting for Approval','Repairing','Ready for Pickup','Completed'];

function stageIndex(status) { const i=STAGES.indexOf(status); return i < 0 ? 0 : i; }
function renderTimeline(status) {
  const current=stageIndex(status);
  return `<div class="timeline timeline-wide">${STAGES.map((stage,i)=>{const cls=i<current?'done':i===current?'current':'';return `<div class="timeline-step ${cls}"><div class="dot"></div><div class="label">${escapeHtml(stage)}</div></div>`}).join('')}</div>`;
}
function renderTicket(job) {
  const history=(job.history||[]).map(h=>`<div class="history-item"><div><span class="history-dot"></span></div><div><strong>${escapeHtml(h.new_status)}</strong><span>${escapeHtml(h.remarks||'Status updated')} · ${formatDate(h.changed_at,true)}</span></div></div>`).join('');
  const canCancel = !['Completed','Cancelled'].includes(job.status);
  const actions = `<div class="ticket-actions no-print">
      <button class="btn btn-outline" id="printTicketBtn">Print / Save PDF</button>
      ${canCancel ? `<button class="btn btn-danger" id="cancelTicketBtn" data-id="${job.job_id}">Cancel this ticket</button>` : ''}
    </div>`;
  trackResult.innerHTML=`<div class="result-card" id="ticketPrintArea"><div class="ticket-top"><div class="ticket-id">Ticket<strong>#${job.job_id}</strong></div><span class="status-badge status-${String(job.status).toLowerCase().replace(/\s+/g,'_')}">${escapeHtml(job.status)}</span></div>${renderTimeline(job.status)}<div class="detail-grid"><div><span>Customer</span><strong>${escapeHtml(job.customer_name)}</strong></div><div><span>Device</span><strong>${escapeHtml(job.model)}</strong></div><div><span>Serial number</span><strong>${escapeHtml(job.serial_number||'Not provided')}</strong></div><div><span>Category</span><strong>${escapeHtml(job.category||'Other')}</strong></div><div><span>Technician</span><strong>${escapeHtml(job.technician_name||'Not assigned')}</strong></div><div><span>Priority</span><strong>${escapeHtml(job.priority||'Normal')}</strong></div><div><span>Estimated cost</span><strong>${job.estimated_cost!=null?'₹'+Number(job.estimated_cost).toLocaleString('en-IN'):'To be assessed'}</strong></div><div><span>Expected completion</span><strong>${formatDate(job.estimated_completion)}</strong></div></div><div class="issue-box"><span>Reported issue</span><p>${escapeHtml(job.issue_description)}</p></div><div class="history"><h3>Repair history</h3>${history||'<p>No history available yet.</p>'}</div>${actions}</div>`;

  document.getElementById('printTicketBtn').addEventListener('click', () => window.print());
  const cancelBtn = document.getElementById('cancelTicketBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => cancelTicket(job.job_id));
}

async function cancelTicket(jobId) {
  if (!confirm(`Cancel ticket #${jobId}? You will need to submit a new ticket if you change your mind.`)) return;
  loadingSpinner.style.display = 'block';
  try {
    const r = await fetch(`${API_URL}/repair-jobs/${jobId}/cancel`, { method: 'PUT' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Unable to cancel this ticket.');
    showToast(`Ticket #${jobId} cancelled.`, 'success');
    loadTicket(jobId);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    loadingSpinner.style.display = 'none';
  }
}
function renderEmpty(message){trackResult.innerHTML=`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><p>${escapeHtml(message)}</p></div>`;}
async function track(){
  const query=trackInput.value.trim(); if(!query){renderEmpty('Enter a ticket number or email to look up a repair.');return;}
  loadingSpinner.style.display='block'; trackResult.innerHTML='';
  try { const r=await fetch(`${API_URL}/repair-jobs/lookup/${encodeURIComponent(query)}`); const data=await r.json(); if(!r.ok) throw new Error(data.error||'No ticket found.');
    if(data.length===1) renderTicket(data[0]); else trackResult.innerHTML=`<div class="lookup-list"><h3>${data.length} tickets found</h3>${data.map(j=>`<button class="lookup-ticket" data-id="${j.job_id}"><span>#${j.job_id} · ${escapeHtml(j.model)}</span><span class="status-badge status-${String(j.status).toLowerCase().replace(/\s+/g,'_')}">${escapeHtml(j.status)}</span></button>`).join('')}</div>`;
    trackResult.querySelectorAll('.lookup-ticket').forEach(b=>b.addEventListener('click',()=>loadTicket(b.dataset.id)));
  } catch(err){renderEmpty(err.message);showToast(err.message,'error');} finally{loadingSpinner.style.display='none';}
}
async function loadTicket(id){loadingSpinner.style.display='block';try{const r=await fetch(`${API_URL}/repair-jobs/${id}`);const d=await r.json();if(!r.ok)throw new Error(d.error);renderTicket(d);}catch(e){showToast(e.message,'error');}finally{loadingSpinner.style.display='none';}}
trackBtn.addEventListener('click',track); trackInput.addEventListener('keydown',e=>{if(e.key==='Enter')track();});
