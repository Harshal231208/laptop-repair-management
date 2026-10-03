const form = document.getElementById('repairForm');
const loadingSpinner = document.getElementById('loadingSpinner');
const messageDiv = document.getElementById('message');

function showMessage(text, type) {
  messageDiv.textContent = text;
  messageDiv.className = `message show ${type}`;
  if (window.showToast) showToast(text, type);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = {
    customerName: document.getElementById('customerName').value.trim(),
    customerEmail: document.getElementById('customerEmail').value.trim(),
    customerPhone: document.getElementById('customerPhone').value.trim(),
    deviceModel: document.getElementById('deviceModel').value.trim(),
    serialNumber: document.getElementById('serialNumber').value.trim(),
    category: document.getElementById('category').value,
    priority: document.getElementById('priority').value,
    estimatedCost: document.getElementById('estimatedCost').value,
    estimatedCompletion: document.getElementById('estimatedCompletion').value,
    issueDescription: document.getElementById('issueDescription').value.trim()
  };

  if (!formData.customerName || !formData.customerEmail || !formData.customerPhone || !formData.deviceModel || !formData.issueDescription) {
    showMessage('Please complete all required fields.', 'error');
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(formData.customerEmail)) {
    showMessage('Please enter a valid email address.', 'error');
    return;
  }
  if (!/^[0-9+()\-\s]{10,20}$/.test(formData.customerPhone)) {
    showMessage('Please enter a valid phone number.', 'error');
    return;
  }

  loadingSpinner.style.display = 'block';
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const response = await fetch(`${API_URL}/repair-jobs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to create ticket.');
    showMessage(`Ticket submitted successfully. Your ticket number is #${data.jobId}.`, 'success');
    form.reset();
    document.getElementById('priority').value = 'Normal';
    document.getElementById('category').value = 'Other';
  } catch (error) {
    console.error(error);
    showMessage(error.message || 'Connection error.', 'error');
  } finally {
    loadingSpinner.style.display = 'none';
    submitButton.disabled = false;
  }
});
