const referenceDate = startOfDay(new Date());
const checkinForm = document.querySelector('#checkin-form');
const sleepInput = document.querySelector('#entry-sleep');
const waterInput = document.querySelector('#entry-water');
const submitButton = document.querySelector('#submit-entry');
const errorMessage = document.querySelector('#form-error');
let editingId = null;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateDaysAgo(date, daysAgo) {
  const result = new Date(date);
  result.setDate(result.getDate() - daysAgo);
  return result;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function updateSleepOutput() {
  document.querySelector('#sleep-output').value = sleepInput.value;
}

function updateWaterCups() {
  const selectedAmount = Number.isFinite(waterInput.valueAsNumber)
    ? Math.max(0, Math.min(waterInput.valueAsNumber, Number(waterInput.max)))
    : 0;
  const cups = document.querySelector('#water-cups');
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < selectedAmount; index += 1) {
    const cup = document.createElement('span');
    cup.className = 'water-cup';
    cup.textContent = '🥛';
    fragment.append(cup);
  }

  cups.replaceChildren(fragment);
  document.querySelector('#water-cup-description').textContent = `${selectedAmount} ${selectedAmount === 1 ? 'glass' : 'glasses'} selected`;
  document.querySelector('#water-decrease').disabled = selectedAmount <= 0;
  document.querySelector('#water-increase').disabled = selectedAmount >= Number(waterInput.max);
}

function changeWaterAmount(change) {
  const currentAmount = Number.isFinite(waterInput.valueAsNumber) ? waterInput.valueAsNumber : 0;
  waterInput.value = String(Math.max(0, Math.min(currentAmount + change, Number(waterInput.max))));
  updateWaterCups();
}

async function handleCheckinSubmit(event) {
  event.preventDefault();
  errorMessage.hidden = true;
  submitButton.disabled = true;
  submitButton.firstChild.textContent = editingId ? 'Updating… ' : 'Saving… ';

  const formData = new FormData(checkinForm);
  const payload = {
    date: String(formData.get('date')),
    mood: Number(formData.get('mood')),
    sleep: Number(formData.get('sleep')),
    water: Number(formData.get('water')),
    activity: Number(formData.get('activity')),
    note: String(formData.get('note')).trim()
  };

  try {
    const response = await fetch(editingId ? `/api/checkins/${editingId}` : '/api/checkins', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save this check-in.');

    const [year, month, day] = payload.date.split('-').map(Number);
    const selectedDate = startOfDay(new Date(year, month - 1, day));
    const daysAgo = Math.floor((referenceDate - selectedDate) / 86400000);
    const period = daysAgo < 7 ? '7' : daysAgo < 14 ? '14' : '30';
    window.location.assign(`/dashboard?period=${period}`);
  } catch (error) {
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
    submitButton.disabled = false;
    submitButton.firstChild.textContent = editingId ? 'Update my check-in ' : 'Save my check-in ';
  }
}

async function loadCheckinForEdit(id) {
  if (!/^\d+$/.test(id) || Number(id) < 1) {
    errorMessage.textContent = 'This check-in link is not valid.';
    errorMessage.hidden = false;
    submitButton.disabled = true;
    return;
  }

  editingId = Number(id);
  submitButton.disabled = true;
  submitButton.firstChild.textContent = 'Loading check-in… ';

  try {
    const response = await fetch(`/api/checkins/${editingId}`);
    const record = await response.json();
    if (!response.ok) throw new Error(record.error || 'Could not load this check-in.');

    document.querySelector('#entry-date').value = record.date;
    document.querySelector(`input[name="mood"][value="${record.mood}"]`).checked = true;
    sleepInput.value = String(record.sleep);
    waterInput.value = String(record.water);
    document.querySelector('#entry-activity').value = String(record.activity);
    document.querySelector('#entry-note').value = record.note;
    document.querySelector('.form-step').textContent = 'EDIT YOUR CHECK-IN';
    submitButton.firstChild.textContent = 'Update my check-in ';
    submitButton.disabled = false;
    updateSleepOutput();
    updateWaterCups();
  } catch (error) {
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
    submitButton.firstChild.textContent = 'Update my check-in ';
  }
}

function initializeCheckin() {
  const dateInput = document.querySelector('#entry-date');
  dateInput.max = toDateInputValue(referenceDate);
  dateInput.min = toDateInputValue(dateDaysAgo(referenceDate, 29));
  dateInput.value = toDateInputValue(referenceDate);

  sleepInput.addEventListener('input', updateSleepOutput);
  waterInput.addEventListener('input', updateWaterCups);
  document.querySelector('#water-decrease').addEventListener('click', () => changeWaterAmount(-1));
  document.querySelector('#water-increase').addEventListener('click', () => changeWaterAmount(1));
  checkinForm.addEventListener('submit', handleCheckinSubmit);
  updateSleepOutput();
  updateWaterCups();

  const requestedId = new URLSearchParams(window.location.search).get('id');
  if (requestedId) loadCheckinForEdit(requestedId);
}

initializeCheckin();