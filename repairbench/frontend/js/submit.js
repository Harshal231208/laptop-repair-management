const form = document.getElementById('repairForm');
const loadingSpinner = document.getElementById('loadingSpinner');
const messageDiv = document.getElementById('message');
const completionInput = document.getElementById('estimatedCompletion');
if (completionInput) completionInput.min = new Date().toISOString().split('T')[0];

function showMessage(text, type) {
  messageDiv.textContent = text;
  messageDiv.className = `message show ${type}`;
  if (window.showToast) showToast(text, type);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!window.validateForm(form)) {
    showMessage('Please correct the highlighted fields.', 'error');
    return;
  }
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

  if (formData.customerName.length < 2 || formData.deviceModel.length < 2 || formData.issueDescription.length < 10) {
    showMessage('Name and device model must be at least 2 characters, and the issue description must be at least 10 characters.', 'error');
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
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) throw new Error('The server returned an unexpected response.');
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
