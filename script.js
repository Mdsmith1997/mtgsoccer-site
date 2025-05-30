const API_URL = 'https://script.google.com/macros/s/AKfycbwEp1mbdPMehaACEIg33wcPnS_YJ941ama4dyGK5jDHiezeQxwk8J6a9c_OJOB9U-mlAg/exec'; // Replace with your web app URL

const bookedSlots = {};
let selectedPayButton = null;
let selectedSessionButton = null;
let selectedTrainingButton = null;
let processedBookings = new Set();

function resetForm() {
  const form = document.getElementById('bookingForm');
  form.style.transition = 'opacity 0.3s ease';
  form.style.opacity = '0';
  setTimeout(() => {
    form.reset();
    ['trainingOption', 'sessionType', 'payOption'].forEach(id => {
      document.getElementById(id).value = '';
    });
    const buttonTypes = ['training', 'session', 'pay'];
    buttonTypes.forEach(type => {
      const buttons = document.querySelectorAll(`button[onclick*="selectOption('${type}'"]`);
      buttons.forEach(btn => {
        btn.style.backgroundColor = '#00bcd4';
        btn.style.color = '#1a1a1a';
        btn.disabled = false;
        btn.style.opacity = '1';
      });
    });
    selectedPayButton = null;
    selectedSessionButton = null;
    selectedTrainingButton = null;
    document.getElementById('venmoUsername').value = '';
    document.getElementById('paymentConfirmed').checked = false;
    document.getElementById('date').value = '';
    document.getElementById('time').innerHTML = '<option value="">Select a time</option>';
    document.getElementById('remainingSpots').innerHTML = '<p>Please select a date, time, training type, and session type to view available slots.</p>';
    const oneOnOneBtn = document.getElementById('btn-oneonone');
    oneOnOneBtn.disabled = false;
    oneOnOneBtn.style.backgroundColor = '#00bcd4';
    oneOnOneBtn.style.color = '#1a1a1a';
    oneOnOneBtn.style.opacity = '1';
    updateDateOptions();
    displayCoach(currentCoachIndex);
    form.style.opacity = '1';
  }, 300);
}

function formatDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

async function updateDateOptions() {
  const sessionType = document.getElementById('sessionType').value;
  const trainingType = document.getElementById('trainingOption').value;
  const dateSelect = document.getElementById('date');
  dateSelect.innerHTML = '<option value="">Select a date</option>';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getValidDates', data: { training: trainingType, session: sessionType } })
    });
    const dates = await response.json();
    if (dates.success === false) {
      showMessage('Error loading dates: ' + dates.message, 'error');
      return;
    }
    dates.forEach(date => {
      const option = document.createElement('option');
      option.value = date;
      option.textContent = formatDate(date);
      dateSelect.appendChild(option);
    });
    updateTimeOptions();
    updateRemainingSpots(document.getElementById('date').value, document.getElementById('time').value);
  } catch (error) {
    showMessage('Error loading dates: ' + error.message, 'error');
  }
}

async function updateTimeOptions() {
  const selectedDate = document.getElementById('date').value;
  const sessionType = document.getElementById('sessionType').value;
  const trainingType = document.getElementById('trainingOption').value;
  const timeSelect = document.getElementById('time');
  timeSelect.innerHTML = '<option value="">Select a time</option>';

  if (!selectedDate || !sessionType || !trainingType) {
    updateRemainingSpots('', '');
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAvailableTimes', data: { training: trainingType, session: sessionType, date: selectedDate } })
    });
    const times = await response.json();
    if (times.success === false) {
      showMessage('Error loading times: ' + times.message, 'error');
      updateRemainingSpots('', '');
      return;
    }
    if (times.length === 0) {
      showMessage('No times available for the selected date.', 'error');
      updateRemainingSpots('', '');
      return;
    }
    times.forEach(time => {
      const option = document.createElement('option');
      option.value = time;
      option.textContent = time;
      timeSelect.appendChild(option);
    });
    updateRemainingSpots(selectedDate, document.getElementById('time').value);
  } catch (error) {
    showMessage('Error loading times: ' + error.message, 'error');
    updateRemainingSpots('', '');
  }
}

function showMessage(message, type) {
  const thankYouBox = document.getElementById('thankYouMessage');
  const errorModal = document.getElementById('errorModal');
  const errorMessageText = document.getElementById('errorMessageText');

  if (type === 'error') {
    thankYouBox.style.display = 'none';
    errorMessageText.textContent = message;
    errorModal.style.display = 'flex';
    errorModal.style.opacity = '0';
    errorModal.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      errorModal.style.opacity = '1';
    }, 10);
  } else if (type === 'thankYou') {
    errorModal.style.display = 'none';
    thankYouBox.style.display = 'flex';
  } else {
    errorModal.style.display = 'none';
    thankYouBox.style.display = 'none';
  }
}

function showCustomAlert(message, venmoUrl) {
  const modal = document.getElementById('customAlertModal');
  const overlay = document.getElementById('customAlertOverlay');
  const msg = document.getElementById('customAlertMessage');
  msg.textContent = message;
  modal.style.display = 'block';
  overlay.style.display = 'block';
  document.getElementById('customAlertOkBtn').onclick = function() {
    modal.style.display = 'none';
    overlay.style.display = 'none';
    if (venmoUrl) {
      window.open(venmoUrl, '_blank');
      document.getElementById('venmoConfirmationModal').style.display = 'flex';
    }
  };
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.style.display = 'none';
  modal.classList.remove('show');
  if (id === 'venmoConfirmationModal' && window.currentFormData) {
    const bookingId = `${window.currentFormData.email}-${window.currentFormData.date}-${window.currentFormData.time}`;
    processedBookings.delete(bookingId);
  }
}

function selectOption(event, type, value) {
  const oneOnOneBtn = document.getElementById('btn-oneonone');
  if (type === 'pay') {
    document.getElementById('payOption').value = value;
    if (selectedPayButton) {
      selectedPayButton.style.backgroundColor = '#00bcd4';
      selectedPayButton.style.color = '#1a1a1a';
    }
    selectedPayButton = event.target;
    selectedPayButton.style.backgroundColor = 'green';
    selectedPayButton.style.color = 'white';
  } else if (type === 'session') {
    document.getElementById('sessionType').value = value;
    if (selectedSessionButton) {
      selectedSessionButton.style.backgroundColor = '#00bcd4';
      selectedSessionButton.style.color = '#1a1a1a';
    }
    selectedSessionButton = event.target;
    selectedSessionButton.style.backgroundColor = 'green';
    selectedSessionButton.style.color = 'white';
    updateDateOptions();
  } else if (type === 'training') {
    document.getElementById('trainingOption').value = value;
    if (selectedTrainingButton) {
      selectedTrainingButton.style.backgroundColor = '#00bcd4';
      selectedTrainingButton.style.color = '#1a1a1a';
    }
    selectedTrainingButton = event.target;
    selectedTrainingButton.style.backgroundColor = 'green';
    selectedTrainingButton.style.color = 'white';
    if (value === 'Goalkeeper') {
      oneOnOneBtn.disabled = true;
      oneOnOneBtn.style.backgroundColor = '#555';
      oneOnOneBtn.style.color = '#ccc';
      oneOnOneBtn.style.opacity = '0.6';
      if (document.getElementById('sessionType').value === '1-on-1 Session') {
        document.getElementById('sessionType').value = '';
        if (selectedSessionButton) {
          selectedSessionButton.style.backgroundColor = '#00bcd4';
          selectedSessionButton.style.color = '#1a1a1a';
          selectedSessionButton = null;
        }
      }
    } else {
      oneOnOneBtn.disabled = false;
      oneOnOneBtn.style.backgroundColor = '#00bcd4';
      oneOnOneBtn.style.color = '#1a1a1a';
      oneOnOneBtn.style.opacity = '1';
    }
    updateDateOptions();
  }
}

const coaches = [
  {
    name: "Coach Malik",
    bio: "Coach Malik, from London, England, has 20+ years of high-level soccer experience. A former professional academy and semi-professional player in the UK, he played college and semi-professional soccer in the U.S. He’s now the Head Girls Varsity Coach at Heritage HS and coaches for Detroit City FC.",
    image: "https://i.imgur.com/I9Su8DG.png"
  },
  {
    name: "Coach Vitor",
    bio: "Coach Vitor is a goalkeeper coach from Brazil with a strong background in developing players. He previously coached at Freeland High School, focusing on goalkeepers, and served as Head Coach of the SVSU Men’s Club Soccer team for two years. Currently, he coaches club and travel soccer with Detroit City FC.",
    image: "https://i.imgur.com/GmWYBSS.jpeg"
  },
  {
    name: "Coach Ole",
    bio: "Coach Ole, from Leipzig, Germany, brings a strong international background in coaching and player development. He’s coached at Real Madrid Foundation camps, worked with FC Eilenburg’s first team, and now develops players in Michigan as a Detroit City FC coach.",
    image: "https://i.imgur.com/w1FkPek.png"
  }
];
let currentCoachIndex = 0;

function displayCoach(index) {
  try {
    const coach = coaches[index];
    document.getElementById('coach-name').textContent = coach.name || 'Unknown Coach';
    document.getElementById('coach-bio').textContent = coach.bio || 'No bio available.';
    document.getElementById('coach-image').src = coach.image || 'https://i.imgur.com/8tNuYmw.png';
  } catch (error) {
    console.error('Error displaying coach:', error);
    document.getElementById('coach-name').textContent = 'Error';
    document.getElementById('coach-bio').textContent = 'Failed to load coach information.';
    document.getElementById('coach-image').src = 'https://i.imgur.com/8tNuYmw.png';
  }
}

function prevCoach() {
  currentCoachIndex = (currentCoachIndex - 1 + coaches.length) % coaches.length;
  displayCoach(currentCoachIndex);
}

function nextCoach() {
  currentCoachIndex = (currentCoachIndex + 1) % coaches.length;
  displayCoach(currentCoachIndex);
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isFacebookApp = /FBAN|FBAV|Facebook/i.test(userAgent);
    if (isFacebookApp) {
      const errorModal = document.getElementById('errorModal');
      const errorMessageText = document.getElementById('errorMessageText');
      errorMessageText.innerHTML = 'This page works best in your default browser. <a href="https://mtgsoccer.com" target="_blank">Open in Chrome/Safari</a>';
      errorModal.style.display = 'flex';
      errorModal.style.opacity = '1';
      console.warn('Detected Facebook in-app browser');
      return;
    }
    console.log('Page loaded, initializing...');
    document.querySelector('.nav-prev').addEventListener('click', prevCoach);
    document.querySelector('.nav-next').addEventListener('click', nextCoach);
    displayCoach(currentCoachIndex);
    updateDateOptions();
    const trainingType = document.getElementById('trainingOption').value;
    const oneOnOneBtn = document.getElementById('btn-oneonone');
    if (trainingType === 'Goalkeeper') {
      oneOnOneBtn.disabled = true;
      oneOnOneBtn.style.backgroundColor = '#555';
      oneOnOneBtn.style.color = '#ccc';
      oneOnOneBtn.style.opacity = '0.6';
    }
  } catch (error) {
    console.error('Initialization error:', error);
    showMessage('Failed to load page: ' + (error.message || 'Unknown error'), 'error');
  }
});

function validateEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

function validateAge(age) {
  const ageNum = parseInt(age, 10);
  return !isNaN(ageNum) && ageNum > 0 && age === ageNum.toString();
}

document.getElementById('submitBtn').addEventListener('click', async function(event) {
  event.preventDefault();
  this.disabled = true;

  const formData = {
    name: document.getElementById('name').value.trim(),
    email: document.getElementById('email').value.trim(),
    age: document.getElementById('age').value.trim(),
    date: document.getElementById('date').value,
    time: document.getElementById('time').value,
    training: document.getElementById('trainingOption').value,
    session: document.getElementById('sessionType').value,
    payment: document.getElementById('payOption').value,
    venmoUsername: document.getElementById('payOption').value === 'Pay with Venmo' ? '' : 'N/A'
  };

  if (!formData.name || !formData.email || !formData.age || !formData.date || !formData.time || !formData.payment || !formData.session || !formData.training) {
    showMessage('Please fill in all required fields and select all options.', 'error');
    this.disabled = false;
    return;
  }

  if (!validateEmail(formData.email)) {
    showMessage('Please enter a valid email address (e.g., example@example.com).', 'error');
    this.disabled = false;
    return;
  }

  if (!validateAge(formData.age)) {
    showMessage('Please enter a valid age (must be a positive number).', 'error');
    this.disabled = false;
    return;
  }

  const bookingId = `${formData.email}-${formData.date}-${formData.time}`;
  if (processedBookings.has(bookingId)) {
    showMessage('This booking has already been processed.', 'error');
    this.disabled = false;
    return;
  }

  processedBookings.add(bookingId);
  window.currentFormData = formData;

  try {
    const checkResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'checkSlotAvailability',
        data: { date: formData.date, time: formData.time, training: formData.training, session: formData.session }
      })
    });
    const checkResult = await checkResponse.json();

    if (checkResult.success) {
      if (formData.payment === 'Pay with Venmo') {
        showCustomAlert(
          'IMPORTANT: After completing payment, return to this page to confirm your Venmo username.',
          'https://venmo.com/u/Mjay1997'
        );
      } else {
        const bookResponse = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'bookSession', data: formData })
        });
        const bookResult = await bookResponse.json();

        if (bookResult.success) {
          document.getElementById('thankYouMessage').style.display = 'flex';
          await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sendFinalConfirmation', data: formData })
          });
          setTimeout(() => {
            closeModal('thankYouMessage');
            resetForm();
            this.disabled = false;
          }, 3000);
        } else {
          processedBookings.delete(bookingId);
          window.currentFormData = null;
          showMessage('Booking failed: ' + bookResult.message, 'error');
          this.disabled = false;
        }
      }
    } else {
      processedBookings.delete(bookingId);
      window.currentFormData = null;
      showMessage('Booking failed: ' + checkResult.message, 'error');
      this.disabled = false;
    }
  } catch (error) {
    processedBookings.delete(bookingId);
    window.currentFormData = null;
    showMessage('Error checking availability: ' + error.message, 'error');
    this.disabled = false;
  }
});

async function finalizeBooking() {
  const username = document.getElementById('venmoUsername').value.trim();
  const confirmed = document.getElementById('paymentConfirmed').checked;
  const formData = window.currentFormData;
  const submitButton = document.getElementById('venmoSubmitBtn');

  if (!formData) {
    showMessage('Booking data is missing. Please try again.', 'error');
    return;
  }

  if (!username) {
    showMessage('Please enter your Venmo username.', 'error');
    return;
  }
  if (!confirmed) {
    showMessage('Please confirm that you have sent the payment.', 'error');
    return;
  }

  submitButton.disabled = true;
  formData.venmoUsername = username;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bookSession', data: formData })
    });
    const result = await response.json();

    submitButton.disabled = false;
    if (result.success) {
      document.getElementById('venmoConfirmationModal').style.display = 'none';
      document.getElementById('thankYouMessage').style.display = 'flex';
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendFinalConfirmation', data: formData })
      });
      setTimeout(() => {
        closeModal('thankYouMessage');
        resetForm();
      }, 3000);
    } else {
      showMessage('Booking failed: ' + result.message, 'error');
      document.getElementById('venmoConfirmationModal').style.display = 'none';
    }
  } catch (error) {
    submitButton.disabled = false;
    showMessage('Error booking session: ' + error.message, 'error');
    document.getElementById('venmoConfirmationModal').style.display = 'none';
  }
}

async function updateRemainingSpots(date, time) {
  const remainingSpotsDiv = document.getElementById('remainingSpots');
  const sessionType = document.getElementById('sessionType').value;
  const trainingType = document.getElementById('trainingOption').value;

  if (!date || !time || !sessionType || !trainingType) {
    remainingSpotsDiv.innerHTML = '<p>Please select a date, time, training type, and session type to view available slots.</p>';
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getRemainingSpots', data: { date, time, training: trainingType, session: sessionType } })
    });
    const spots = await response.json();
    const scheduleKey = trainingType === 'Goalkeeper' ? 'goalkeeper' : sessionType.toLowerCase();
    const count = spots[scheduleKey] || 0;
    const className = count === 0 ? '' : 'count';
    const status = count === 0 ? 'All spots booked' : `${count} slot(s) available`;
    remainingSpotsDiv.innerHTML = `<p><strong>${scheduleKey.charAt(0).toUpperCase() + scheduleKey.slice(1)}:</strong> <span class="${className}">${status}</span></p>`;
  } catch (error) {
    remainingSpotsDiv.innerHTML = '<p>Error loading available slots. Please try again.</p>';
  }
}

document.getElementById('date').addEventListener('change', function() {
  updateTimeOptions();
});

document.getElementById('time').addEventListener('change', function() {
  const selectedDate = document.getElementById('date').value;
  updateRemainingSpots(selectedDate, this.value);
});