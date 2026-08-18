// Constants & Utils
const STORE_PREFIX = 'sportsArena_';
const TOURNAMENTS_KEY = STORE_PREFIX + 'tournaments';
const REGISTRATIONS_KEY = STORE_PREFIX + 'registrations';
const ADMIN_LOGGED_IN_KEY = STORE_PREFIX + 'adminLoggedIn';

const generateId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); });
const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const getSemesterLabel = (num) => {
  const s = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]) + " Semester";
};
const isDeadlinePassed = (deadline) => new Date(deadline) < new Date();

// 1. Data Store Module (Supabase)
const supabaseUrl = 'https://lptjiaqzrbbgdzgsxrrv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwdGppYXF6cmJiZ2R6Z3N4cnJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjk5MDAsImV4cCI6MjEwMjY0NTkwMH0.ZJ67bW4SrKHfAWWE2SvHRAxnjq6p-q2X9XYJnjcE84s';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const Store = {
  async getTournaments() {
    const { data, error } = await supabaseClient.from('tournaments').select('*');
    if (error) console.error('Error fetching tournaments:', error);
    return (data || []).map(t => ({
      ...t,
      registrationDeadline: t.registration_deadline
    }));
  },
  async getRegistrations() {
    const { data, error } = await supabaseClient.from('registrations').select('*');
    if (error) console.error('Error fetching registrations:', error);
    return (data || []).map(r => ({
      ...r,
      tournamentId: r.tournament_id,
      teamName: r.team_name,
      contactNumber: r.contact_number,
      feeStatus: r.fee_status,
      paymentScreenshot: r.payment_screenshot,
      submittedAt: r.submitted_at
    }));
  },
  async addTournament(tournament) {
    const { data, error } = await supabaseClient.from('tournaments').insert([{
      name: tournament.name,
      sport: tournament.sport,
      fee: tournament.fee,
      date: tournament.date,
      registration_deadline: tournament.registration_deadline || tournament.registrationDeadline,
      venue: tournament.venue,
      description: tournament.description,
      status: tournament.status
    }]).select();
    if (error) console.error('Error adding tournament:', error);
    return data ? data[0] : null;
  },
  async updateTournament(id, updates) {
    if (updates.registrationDeadline) {
      updates.registration_deadline = updates.registrationDeadline;
      delete updates.registrationDeadline;
    }
    const { error } = await supabaseClient.from('tournaments').update(updates).eq('id', id);
    if (error) console.error('Error updating tournament:', error);
  },
  async deleteTournament(id) {
    const { error } = await supabaseClient.from('tournaments').delete().eq('id', id);
    if (error) console.error('Error deleting tournament:', error);
  },
  async addRegistration(registration) {
    const { data, error } = await supabaseClient.from('registrations').insert([{
      tournament_id: registration.tournament_id || registration.tournamentId,
      semester: registration.semester,
      team_name: registration.team_name || registration.teamName,
      captain: registration.captain,
      players: registration.players,
      contact_number: registration.contact_number || registration.contactNumber,
      fee_status: registration.fee_status || registration.feeStatus,
      payment_screenshot: registration.payment_screenshot || registration.paymentScreenshot
    }]).select();
    if (error) console.error('Error adding registration:', error);
    return data ? data[0] : null;
  },
  async updateRegistration(id, updates) {
    if (updates.feeStatus) updates.fee_status = updates.feeStatus;
    if (updates.paymentScreenshot) updates.payment_screenshot = updates.paymentScreenshot;
    delete updates.feeStatus;
    delete updates.paymentScreenshot;

    const { error } = await supabaseClient.from('registrations').update(updates).eq('id', id);
    if (error) console.error('Error updating registration:', error);
  },
  async deleteRegistration(id) {
    const { error } = await supabaseClient.from('registrations').delete().eq('id', id);
    if (error) console.error('Error deleting registration:', error);
  },
  isAdminLoggedIn() { return localStorage.getItem(ADMIN_LOGGED_IN_KEY) === 'true'; },
  setAdminLoggedIn(val) { localStorage.setItem(ADMIN_LOGGED_IN_KEY, val); }
};

// 4. Toast System
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 5. Confirm Modal
let confirmResolver = null;
function showConfirm(title, message) {
  return new Promise(resolve => {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').classList.remove('hidden');
    confirmResolver = resolve;
  });
}

function handleConfirmClose(result) {
  document.getElementById('confirmModal').classList.add('hidden');
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

// 6. Tournament Card Rendering
function createTournamentCard(tournament, regsCount = 0, showRegisterBtn = true) {
  const isClosed = tournament.status === 'closed' || isDeadlinePassed(tournament.registrationDeadline);
  const regs = regsCount;
  
  return `
    <div class="tournament-card">
      <div class="card-header ${tournament.sport}">
        <span class="sport-badge">${tournament.sport === 'football' ? '⚽ Football' : '🏏 Cricket'}</span>
        <span class="date">${formatDate(tournament.date)}</span>
      </div>
      <div class="card-body">
        <h3>${tournament.name}</h3>
        <p><strong>Fee:</strong> ₹${tournament.fee}</p>
        <p><strong>Deadline:</strong> <span class="live-countdown" data-deadline="${tournament.registrationDeadline}" style="font-weight: 700; font-family: 'Poppins', sans-serif; color: var(--accent); background: var(--accent-light); padding: 2px 8px; border-radius: 4px; margin-left: 4px;">${formatDate(tournament.registrationDeadline)}</span></p>
        ${tournament.venue ? `<p><strong>Venue:</strong> ${tournament.venue}</p>` : ''}
        ${tournament.description ? `<p>${tournament.description}</p>` : ''}
        <p class="status ${isClosed ? 'text-red' : 'text-green'}">
          ${isClosed ? 'Registration Closed' : 'Registration Open'}
        </p>
        <p class="regs-count">${regs} teams registered</p>
      </div>
      ${showRegisterBtn ? `
      <div class="card-footer">
        ${isClosed 
          ? `<button class="btn btn-disabled" disabled>Closed</button>`
          : `<a href="#register?tournament=${tournament.id}" class="btn btn-primary">Register Now</a>`
        }
      </div>` : ''}
    </div>
  `;
}

// 7. Home Page Rendering
async function renderHome() {
  const homeTournaments = document.getElementById('homeTournaments');
  const homeEmpty = document.getElementById('homeEmpty');
  
  // Add loading state
  homeTournaments.innerHTML = '<div class="empty-state"><p>Loading tournaments...</p></div>';

  const tournaments = await Store.getTournaments();
  const registrations = await Store.getRegistrations();
  
  const activeTournaments = tournaments.filter(t => t.status !== 'closed' && !isDeadlinePassed(t.registrationDeadline));
  const approvedRegs = registrations.filter(r => r.feeStatus === 'approved');
  const uniqueSemesters = new Set(registrations.map(r => r.semester)).size;

  document.getElementById('statTournaments').textContent = activeTournaments.length;
  document.getElementById('statTeams').textContent = registrations.length;
  document.getElementById('statApproved').textContent = approvedRegs.length;
  document.getElementById('statSemesters').textContent = uniqueSemesters;

  if (activeTournaments.length === 0) {
    homeTournaments.innerHTML = '';
    homeEmpty.classList.remove('hidden');
  } else {
    homeEmpty.classList.add('hidden');
    homeTournaments.innerHTML = activeTournaments.map(t => {
      const count = registrations.filter(r => r.tournamentId === t.id).length;
      return createTournamentCard(t, count);
    }).join('');
  }

  // Recent Registrations Feed
  renderHomeRecentRegistrations(tournaments, registrations);
}

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function renderHomeRecentRegistrations(tournaments, registrations) {
  const container = document.getElementById('homeRecentRegistrations');
  const empty = document.getElementById('homeRecentEmpty');
  
  if (registrations.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  const recent = [...registrations].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 8);
  
  let html = '<div class="recent-reg-feed">';
  recent.forEach(r => {
    const t = tournaments.find(t => t.id === r.tournamentId);
    const sport = t ? t.sport : '';
    const sportIcon = sport === 'football' ? '⚽' : (sport === 'cricket' ? '🏏' : '🏆');
    const tName = t ? t.name : 'Tournament';
    const badgeClass = r.feeStatus === 'approved' ? 'bg-green' : (r.feeStatus === 'rejected' ? 'bg-red' : 'bg-yellow');
    
    html += `
      <div class="recent-reg-item">
        <div class="recent-reg-sport">${sportIcon}</div>
        <div class="recent-reg-info">
          <div class="recent-reg-team">${r.teamName}</div>
          <div class="recent-reg-meta">
            <span>${getSemesterLabel(r.semester)}</span>
            <span>${tName}</span>
            <span>Captain: ${r.captain}</span>
          </div>
        </div>
        <div class="recent-reg-status">
          <span class="status-badge ${badgeClass}">${r.feeStatus.toUpperCase()}</span>
          <div class="recent-reg-time">${getTimeAgo(r.submittedAt)}</div>
        </div>
      </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// 8. Tournaments Page Rendering
async function renderTournaments() {
  const allTournamentsContainer = document.getElementById('allTournaments');
  const tournamentsEmpty = document.getElementById('tournamentsEmpty');
  
  allTournamentsContainer.innerHTML = '<div class="empty-state"><p>Loading tournaments...</p></div>';
  
  const tournaments = await Store.getTournaments();
  const registrations = await Store.getRegistrations();

  if (tournaments.length === 0) {
    allTournamentsContainer.innerHTML = '';
    tournamentsEmpty.classList.remove('hidden');
  } else {
    tournamentsEmpty.classList.add('hidden');
    // Sort by date descending
    tournaments.sort((a, b) => new Date(b.date) - new Date(a.date));
    allTournamentsContainer.innerHTML = tournaments.map(t => {
      const count = registrations.filter(r => r.tournamentId === t.id).length;
      return createTournamentCard(t, count);
    }).join('');
  }
}

// 9. Registration Form Logic
function updateCaptainDropdown() {
  const inputs = document.querySelectorAll('#playersContainer input');
  const captainSelect = document.getElementById('captainSelect');
  const currentVal = captainSelect.value;
  
  captainSelect.innerHTML = '<option value="">Select Captain</option>';
  
  inputs.forEach(input => {
    const val = input.value.trim();
    if (val) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      captainSelect.appendChild(opt);
    }
  });
  
  if (currentVal && Array.from(captainSelect.options).some(o => o.value === currentVal)) {
    captainSelect.value = currentVal;
  }
}

function updatePlayerCount() {
  const count = document.querySelectorAll('#playersContainer .player-row').length;
  document.getElementById('playerCount').textContent = `${count} / 11`;
}

function addPlayerRow(name = '') {
  const container = document.getElementById('playersContainer');
  const currentCount = container.querySelectorAll('.player-row').length;
  if (currentCount >= 11) {
    showToast('Maximum 11 players allowed', 'error');
    return;
  }
  
  const row = document.createElement('div');
  row.className = 'player-row animate-in';
  row.innerHTML = `
    <input type="text" placeholder="Player Name" value="${name}" required>
    <button type="button" class="btn-remove-player" ${currentCount < 5 ? 'disabled' : ''}>&times;</button>
  `;
  
  const input = row.querySelector('input');
  input.addEventListener('input', updateCaptainDropdown);
  
  const removeBtn = row.querySelector('.btn-remove-player');
  removeBtn.addEventListener('click', () => {
    if (container.querySelectorAll('.player-row').length > 5) {
      row.remove();
      updatePlayerCount();
      updateCaptainDropdown();
    }
  });
  
  container.appendChild(row);
  updatePlayerCount();
  updateCaptainDropdown();
}

async function renderRegister(preselectedTournamentId = null) {
  const select = document.getElementById('tournamentSelect');
  select.innerHTML = '<option value="">-- Loading Tournaments... --</option>';
  
  const allTournaments = await Store.getTournaments();
  const activeTournaments = allTournaments.filter(t => t.status !== 'closed' && !isDeadlinePassed(t.registrationDeadline));
  
  select.innerHTML = '<option value="">-- Select Tournament --</option>';
  activeTournaments.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.name} (${t.sport === 'football' ? 'Football' : 'Cricket'}) - ₹${t.fee}`;
    opt.dataset.fee = t.fee;
    select.appendChild(opt);
  });

  if (preselectedTournamentId && activeTournaments.some(t => t.id === preselectedTournamentId)) {
    select.value = preselectedTournamentId;
    const feeDisplay = document.getElementById('feeDisplay');
    const feeAmount = document.getElementById('feeAmount');
    const selectedOpt = select.options[select.selectedIndex];
    feeAmount.textContent = selectedOpt.dataset.fee;
    feeDisplay.classList.remove('hidden');
  }
}
// 10. Registrations Page Logic
async function initRegistrationsPage() {
  const tournaments = await Store.getTournaments();
  const filterSelect = document.getElementById('regFilterTournament');
  
  filterSelect.innerHTML = '<option value="all">All Tournaments</option>';
  tournaments.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    filterSelect.appendChild(opt);
  });

  await renderRegistrationsList(filterSelect.value);
}

async function renderRegistrationsList(tournamentIdFilter = 'all') {
  const container = document.getElementById('registrationsView');
  const empty = document.getElementById('registrationsEmpty');
  
  container.innerHTML = '<div class="empty-state"><p>Loading registrations...</p></div>';
  empty.classList.add('hidden');

  let regs = await Store.getRegistrations();
  const tournaments = await Store.getTournaments();
  
  if (tournamentIdFilter !== 'all') {
    regs = regs.filter(r => r.tournamentId === tournamentIdFilter);
  }

  if (regs.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  
  // Group by semester
  const grouped = {};
  regs.forEach(r => {
    if (!grouped[r.semester]) grouped[r.semester] = [];
    grouped[r.semester].push(r);
  });

  let html = '';
  Object.keys(grouped).sort().forEach(sem => {
    html += `<div class="semester-group">
      <h3 class="semester-heading">${getSemesterLabel(sem)} — ${grouped[sem].length} Teams</h3>
      <div class="team-cards-grid">`;
    
    grouped[sem].forEach(r => {
      const t = tournaments.find(t => t.id === r.tournamentId);
      const tName = t ? t.name : 'Unknown Tournament';
      const sport = t ? t.sport : '';
      const sportIcon = sport === 'football' ? '⚽' : (sport === 'cricket' ? '🏏' : '');
      const badgeClass = r.feeStatus === 'approved' ? 'bg-green' : (r.feeStatus === 'rejected' ? 'bg-red' : 'bg-yellow');
      
      html += `
        <div class="team-card border-${r.feeStatus}">
          <div class="team-header">
            <h4>${r.teamName}</h4>
            <span class="status-badge ${badgeClass}">${r.feeStatus.toUpperCase()}</span>
          </div>
          <p class="team-meta">${sportIcon} ${tName}</p>
          <p class="team-meta">📞 ${r.contactNumber}</p>
          <div class="players-list">
            ${r.players.map(p => `<span class="player-tag ${p === r.captain ? 'captain' : ''}">${p} ${p === r.captain ? '⭐' : ''}</span>`).join('')}
          </div>
        </div>`;
    });
    
    html += `</div></div>`;
  });

  container.innerHTML = html;
}


// 11. Admin Panel Logic

async function renderAdminDashboard() {
  const regs = await Store.getRegistrations();
  const tournaments = await Store.getTournaments();
  
  const activeTournaments = tournaments.filter(t => t.status !== 'closed' && !isDeadlinePassed(t.registrationDeadline));
  const approved = regs.filter(r => r.feeStatus === 'approved');
  const pending = regs.filter(r => r.feeStatus === 'pending');

  document.getElementById('adminStatTournaments').textContent = activeTournaments.length;
  document.getElementById('adminStatTeams').textContent = regs.length;
  document.getElementById('adminStatApproved').textContent = approved.length;
  document.getElementById('adminStatPending').textContent = pending.length;

  const recentContainer = document.getElementById('adminRecentRegistrations');
  recentContainer.innerHTML = '<div class="empty-state"><p>Loading recent registrations...</p></div>';
  const recents = [...regs].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 5);

  if (recents.length === 0) {
    recentContainer.innerHTML = '<div class="empty-state"><p>No recent registrations.</p></div>';
  } else {
    recentContainer.innerHTML = recents.map(r => {
      const t = tournaments.find(t => t.id === r.tournamentId);
      const tName = t ? t.name : 'Unknown Tournament';
      const sport = t ? t.sport : '';
      const sportIcon = sport === 'football' ? '⚽' : (sport === 'cricket' ? '🏏' : '🏆');
      const sportLabel = sport === 'football' ? 'Football' : (sport === 'cricket' ? 'Cricket' : 'Sport');
      const fee = t ? t.fee : 0;
      const bg = r.feeStatus === 'approved' ? 'green' : (r.feeStatus === 'rejected' ? 'red' : 'yellow');
      const statusText = r.feeStatus === 'approved' ? '✅ APPROVED' : (r.feeStatus === 'rejected' ? '❌ REJECTED' : '⏳ PENDING');
      
      return `
        <div class="admin-detail-card border-${r.feeStatus}" style="margin-bottom: 16px; border-radius: var(--radius)">
          <div class="admin-detail-top">
            <div class="admin-detail-left">
              <div class="admin-detail-title">
                <h4>${r.teamName} <span style="font-size: 0.9rem; color: var(--text-light); font-weight: 500">(Sem ${r.semester})</span></h4>
                <span class="status-badge bg-${bg}">${statusText}</span>
              </div>
              <div class="admin-detail-meta">
                <span class="admin-meta-item">${sportIcon} ${sportLabel}</span>
                <span class="admin-meta-item">🏆 ${tName}</span>
                <span class="admin-meta-item">📞 ${r.contactNumber}</span>
                <span class="admin-meta-item">📅 ${formatDate(r.submittedAt)}</span>
              </div>

              <div class="admin-detail-section">
                <h5>👨‍👩‍👦‍👦 Players (${r.players.length})</h5>
                <div class="admin-players-list">
                  ${r.players.map((p, i) => `
                    <div class="admin-player-row ${p === r.captain ? 'is-captain' : ''}">
                      <span class="admin-player-num">${i + 1}</span>
                      <span class="admin-player-name">${p}</span>
                      ${p === r.captain ? '<span class="captain-badge">⭐ Captain</span>' : ''}
                    </div>
                  `).join('')}
                </div>
              </div>

              <div class="admin-detail-section">
                <h5>💰 Registration Fee</h5>
                <div class="admin-fee-display">
                  <span class="admin-fee-amount">₹${fee}</span>
                  <span class="admin-fee-status status-badge bg-${bg}">${r.feeStatus.toUpperCase()}</span>
                </div>
              </div>
            </div>

            <div class="admin-detail-right">
              <div class="admin-detail-section">
                <h5>📷 Payment Screenshot</h5>
                ${r.paymentScreenshot ? `
                  <div class="admin-screenshot-container">
                    <img src="${r.paymentScreenshot}" alt="Payment proof by ${r.teamName}" class="admin-screenshot-img" onclick="viewScreenshot('${r.id}')">
                    <p class="admin-screenshot-hint">Click to enlarge</p>
                  </div>
                ` : `
                  <div class="admin-no-screenshot">
                    <span class="no-ss-icon">🚫</span>
                    <p>No screenshot uploaded</p>
                  </div>
                `}
              </div>
            </div>
          </div>

          <div class="admin-detail-actions">
            ${r.feeStatus === 'pending' ? `
              <button class="btn btn-success" onclick="approveRegistration('${r.id}')">✅ Approve Payment</button>
              <button class="btn btn-danger" onclick="rejectRegistration('${r.id}')">❌ Reject Payment</button>
            ` : `
              <button class="btn btn-outline" onclick="Store.updateRegistration('${r.id}', {feeStatus: 'pending'}); renderAdminAll();">🔄 Reset Status</button>
            `}
            <button class="btn btn-danger btn-sm" onclick="deleteRegistration('${r.id}')" style="margin-left:auto">🗑 Delete</button>
          </div>
        </div>
      `;
    }).join('');
  }
}

async function renderAdminRegistrationsList() {
  const container = document.getElementById('adminRegistrationsList');
  const empty = document.getElementById('adminRegistrationsEmpty');
  container.innerHTML = '<div class="empty-state"><p>Loading registrations...</p></div>';

  const tFilter = document.getElementById('adminFilterTournament').value;
  const sFilter = document.getElementById('adminFilterStatus').value;
  
  let regs = await Store.getRegistrations();
  const tournaments = await Store.getTournaments();
  
  if (tFilter !== 'all') regs = regs.filter(r => r.tournamentId === tFilter);
  if (sFilter !== 'all') regs = regs.filter(r => r.feeStatus === sFilter);

  if (regs.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  
  const grouped = {};
  regs.forEach(r => {
    if (!grouped[r.semester]) grouped[r.semester] = [];
    grouped[r.semester].push(r);
  });

  let html = '';
  Object.keys(grouped).sort((a, b) => a - b).forEach(sem => {
    const semRegs = grouped[sem];
    html += `
      <div class="admin-semester-block">
        <div class="admin-semester-header">
          <h3>📚 ${getSemesterLabel(sem)}</h3>
          <span class="admin-semester-count">${semRegs.length} Team${semRegs.length > 1 ? 's' : ''}</span>
        </div>`;
    
    semRegs.forEach(r => {
      const t = tournaments.find(t => t.id === r.tournamentId);
      const tName = t ? t.name : 'Unknown Tournament';
      const sport = t ? t.sport : '';
      const sportIcon = sport === 'football' ? '⚽' : (sport === 'cricket' ? '🏏' : '🏆');
      const sportLabel = sport === 'football' ? 'Football' : (sport === 'cricket' ? 'Cricket' : 'Sport');
      const fee = t ? t.fee : 0;
      const bg = r.feeStatus === 'approved' ? 'green' : (r.feeStatus === 'rejected' ? 'red' : 'yellow');
      const statusText = r.feeStatus === 'approved' ? '✅ APPROVED' : (r.feeStatus === 'rejected' ? '❌ REJECTED' : '⏳ PENDING');
      
      html += `
        <div class="admin-detail-card border-${r.feeStatus}">
          <div class="admin-detail-top">
            <div class="admin-detail-left">
              <div class="admin-detail-title">
                <h4>${r.teamName}</h4>
                <span class="status-badge bg-${bg}">${statusText}</span>
              </div>
              <div class="admin-detail-meta">
                <span class="admin-meta-item">${sportIcon} ${sportLabel}</span>
                <span class="admin-meta-item">🏆 ${tName}</span>
                <span class="admin-meta-item">📞 ${r.contactNumber}</span>
                <span class="admin-meta-item">📅 ${formatDate(r.submittedAt)}</span>
              </div>

              <div class="admin-detail-section">
                <h5>👨‍👩‍👦‍👦 Players (${r.players.length})</h5>
                <div class="admin-players-list">
                  ${r.players.map((p, i) => `
                    <div class="admin-player-row ${p === r.captain ? 'is-captain' : ''}">
                      <span class="admin-player-num">${i + 1}</span>
                      <span class="admin-player-name">${p}</span>
                      ${p === r.captain ? '<span class="captain-badge">⭐ Captain</span>' : ''}
                    </div>
                  `).join('')}
                </div>
              </div>

              <div class="admin-detail-section">
                <h5>💰 Registration Fee</h5>
                <div class="admin-fee-display">
                  <span class="admin-fee-amount">₹${fee}</span>
                  <span class="admin-fee-status status-badge bg-${bg}">${r.feeStatus.toUpperCase()}</span>
                </div>
              </div>
            </div>

            <div class="admin-detail-right">
              <div class="admin-detail-section">
                <h5>📷 Payment Screenshot</h5>
                ${r.paymentScreenshot ? `
                  <div class="admin-screenshot-container">
                    <img src="${r.paymentScreenshot}" alt="Payment proof by ${r.teamName}" class="admin-screenshot-img" onclick="viewScreenshot('${r.id}')">
                    <p class="admin-screenshot-hint">Click to enlarge</p>
                  </div>
                ` : `
                  <div class="admin-no-screenshot">
                    <span class="no-ss-icon">🚫</span>
                    <p>No screenshot uploaded</p>
                  </div>
                `}
              </div>
            </div>
          </div>

          <div class="admin-detail-actions">
            ${r.feeStatus === 'pending' ? `
              <button class="btn btn-success" onclick="approveRegistration('${r.id}')">✅ Approve Payment</button>
              <button class="btn btn-danger" onclick="rejectRegistration('${r.id}')">❌ Reject Payment</button>
            ` : `
              <button class="btn btn-outline" onclick="Store.updateRegistration('${r.id}', {feeStatus: 'pending'}); renderAdminAll();">🔄 Reset Status</button>
            `}
            <button class="btn btn-danger btn-sm" onclick="deleteRegistration('${r.id}')" style="margin-left:auto">🗑 Delete</button>
          </div>
        </div>`;
    });
    
    html += `</div>`;
  });
  
  container.innerHTML = html;
}

async function renderAdminTournamentsList() {
  const container = document.getElementById('adminTournamentsList');
  const empty = document.getElementById('adminTournamentsEmpty');
  container.innerHTML = '<div class="empty-state"><p>Loading tournaments...</p></div>';

  const tournaments = await Store.getTournaments();
  const regs = await Store.getRegistrations();
  
  if (tournaments.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  
  container.innerHTML = tournaments.map(t => {
    const isClosed = t.status === 'closed' || isDeadlinePassed(t.registrationDeadline);
    const regsCount = regs.filter(r => r.tournamentId === t.id).length;
    return `
      <div class="tournament-card">
        <div class="card-header ${t.sport}">
          <span>${t.name}</span>
          <span class="status-badge ${isClosed ? 'bg-red' : 'bg-green'}">${isClosed ? 'Closed' : 'Active'}</span>
        </div>
        <div class="card-body">
          <p>Date: ${formatDate(t.date)}</p>
          <p>Deadline: ${formatDate(t.registrationDeadline)}</p>
          <p>Fee: ₹${t.fee}</p>
          <p>Teams Registered: ${regsCount}</p>
          <div class="admin-actions mt-3">
            <button class="btn btn-sm btn-outline" onclick="toggleTournamentStatus('${t.id}')">
              Make ${t.status === 'active' ? 'Closed' : 'Active'}
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteTournament('${t.id}')">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function renderAdminAll() {
  await renderAdminDashboard();
  await renderAdminRegistrationsList();
  await renderAdminTournamentsList();
}

async function renderAdmin() {
  if (Store.isAdminLoggedIn()) {
    document.getElementById('adminLoginOverlay').classList.add('hidden');
    document.getElementById('adminContent').classList.remove('hidden');
    
    // Populate admin filters
    const filterT = document.getElementById('adminFilterTournament');
    const currT = filterT.value;
    filterT.innerHTML = '<option value="all">Loading...</option>';
    
    const tournaments = await Store.getTournaments();
    filterT.innerHTML = '<option value="all">All Tournaments</option>';
    tournaments.forEach(t => {
      filterT.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    });
    if(currT) filterT.value = currT;
    
    await renderAdminAll();
  } else {
    document.getElementById('adminLoginOverlay').classList.remove('hidden');
    document.getElementById('adminContent').classList.add('hidden');
  }
}

// Global Handlers for Admin actions (attached to window for inline onclick access)
window.approveRegistration = async (id) => {
  await Store.updateRegistration(id, { feeStatus: 'approved' });
  showToast('Registration approved!');
  await renderAdminAll();
};
window.rejectRegistration = async (id) => {
  await Store.updateRegistration(id, { feeStatus: 'rejected' });
  showToast('Registration rejected.', 'error');
  await renderAdminAll();
};
window.deleteRegistration = async (id) => {
  const ok = await showConfirm('Delete Registration', 'Are you sure you want to delete this registration? This cannot be undone.');
  if (ok) {
    await Store.deleteRegistration(id);
    showToast('Registration deleted.', 'info');
    await renderAdminAll();
  }
};
window.toggleTournamentStatus = async (id) => {
  const tournaments = await Store.getTournaments();
  const t = tournaments.find(t => t.id === id);
  if(t) {
    await Store.updateTournament(id, { status: t.status === 'active' ? 'closed' : 'active' });
    showToast(`Tournament marked as ${t.status === 'active' ? 'closed' : 'active'}`);
    await renderAdminAll();
  }
}
window.deleteTournament = async (id) => {
  const ok = await showConfirm('Delete Tournament', 'Are you sure? This will delete the tournament AND all its registrations!');
  if (ok) {
    await Store.deleteTournament(id);
    showToast('Tournament deleted.', 'info');
    await renderAdminAll();
  }
};


// 2. Router & Initialization
function handleHashChange() {
  let hash = window.location.hash || '#home';
  let page = hash;
  let query = {};
  
  if (hash.includes('?')) {
    const parts = hash.split('?');
    page = parts[0];
    const urlParams = new URLSearchParams(parts[1]);
    query = Object.fromEntries(urlParams.entries());
  }
  
  const pageName = page.substring(1) || 'home';

  // Toggle page visibility
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetPage = document.getElementById(`page-${pageName}`);
  if (targetPage) targetPage.classList.add('active');

  // Update Nav Links
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('data-page') === pageName) link.classList.add('active');
    else link.classList.remove('active');
  });

  // Close Mobile Nav
  document.getElementById('navLinks').classList.remove('active');

  // Route specific renders
  if (pageName === 'home') renderHome();
  else if (pageName === 'tournaments') renderTournaments();
  else if (pageName === 'register') renderRegister(query.tournament);
  else if (pageName === 'registrations') renderRegistrations();
  else if (pageName === 'admin') renderAdmin();
}

document.addEventListener('DOMContentLoaded', () => {
  // Navigation setup
  document.getElementById('navToggle').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('active');
  });
  
  window.addEventListener('scroll', () => {
    const nav = document.querySelector('.navbar');
    if (window.scrollY > 50) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  });

  // Confirm Modal setup
  document.getElementById('confirmOk').addEventListener('click', () => handleConfirmClose(true));
  document.getElementById('confirmCancel').addEventListener('click', () => handleConfirmClose(false));
  document.getElementById('confirmClose').addEventListener('click', () => handleConfirmClose(false));

  // Registration Form setup
  const tSelect = document.getElementById('tournamentSelect');
  if(tSelect) {
    tSelect.addEventListener('change', (e) => {
      const feeDisplay = document.getElementById('feeDisplay');
      if (e.target.value) {
        const opt = e.target.options[e.target.selectedIndex];
        document.getElementById('feeAmount').textContent = opt.dataset.fee;
        feeDisplay.classList.remove('hidden');
      } else {
        feeDisplay.classList.add('hidden');
      }
    });
  }

  const addPlayerBtn = document.getElementById('addPlayerBtn');
  if(addPlayerBtn) addPlayerBtn.addEventListener('click', () => addPlayerRow());

  const regForm = document.getElementById('registerForm');
  if(regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tournamentId = document.getElementById('tournamentSelect').value;
      const semester = parseInt(document.getElementById('semesterSelect').value);
      const teamName = document.getElementById('teamName').value.trim();
      const captain = document.getElementById('captainSelect').value;
      const contactNumber = document.getElementById('contactNumber').value.trim();
      
      const players = Array.from(document.querySelectorAll('#playersContainer input'))
                          .map(i => i.value.trim())
                          .filter(v => v);

      if (!tournamentId || !semester || !teamName || !captain || !contactNumber) {
        return showToast('Please fill all required fields', 'error');
      }
      if (players.length < 5) {
        return showToast('Minimum 5 players required', 'error');
      }

      // Check duplicate
      const allRegs = await Store.getRegistrations();
      const exists = allRegs.some(r => r.tournamentId === tournamentId && r.semester === semester && r.teamName.toLowerCase() === teamName.toLowerCase());
      if (exists) {
        return showToast('A team with this name is already registered for this tournament and semester.', 'error');
      }

      const insertedReg = await Store.addRegistration({
        tournamentId,
        semester,
        teamName,
        captain,
        players,
        contactNumber,
        feeStatus: 'pending',
        paymentScreenshot: null
      });

      const regId = insertedReg ? insertedReg.id : null;

      // Get the fee for payment modal
      const allTournaments = await Store.getTournaments();
      const selectedTournament = allTournaments.find(t => t.id === tournamentId);
      const fee = selectedTournament ? selectedTournament.fee : 0;

      // Show payment QR modal with registration ID
      showPaymentModal(fee, regId);

      regForm.reset();
      document.getElementById('feeDisplay').classList.add('hidden');
      document.getElementById('playersContainer').innerHTML = '';
      for (let i = 0; i < 5; i++) addPlayerRow();
    });
  }

  // Registrations Filter
  const regFilter = document.getElementById('regFilterTournament');
  if(regFilter) {
    regFilter.addEventListener('change', (e) => {
      renderRegistrationsList(e.target.value);
    });
  }

  // Admin Login
  const loginBtn = document.getElementById('adminLoginBtn');
  const loginInput = document.getElementById('adminPassword');
  
  const handleLogin = () => {
    if (loginInput.value === 'admin123') {
      Store.setAdminLoggedIn('true');
      loginInput.value = '';
      renderAdmin();
      showToast('Logged in successfully');
    } else {
      const box = document.querySelector('.login-box');
      box.classList.add('shake');
      setTimeout(() => box.classList.remove('shake'), 500);
      showToast('Invalid password', 'error');
    }
  };
  
  if(loginBtn) loginBtn.addEventListener('click', handleLogin);
  if(loginInput) loginInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  const logoutBtn = document.getElementById('adminLogoutBtn');
  if(logoutBtn) logoutBtn.addEventListener('click', () => {
    Store.setAdminLoggedIn('false');
    renderAdmin();
    showToast('Logged out');
  });

  // Admin Tabs
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      
      const target = e.currentTarget;
      target.classList.add('active');
      const tabName = target.getAttribute('data-admin-tab');
      
      const sectionMap = {
        'dashboard': 'adminDashboard',
        'create': 'adminCreate',
        'manage': 'adminManage',
        'tournaments-manage': 'adminTournamentsManage'
      };
      
      document.getElementById(sectionMap[tabName]).classList.add('active');
    });
  });

  // Admin Create Tournament
  const createTForm = document.getElementById('createTournamentForm');
  if(createTForm) {
    createTForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const date = document.getElementById('tDate').value;
      const deadline = document.getElementById('tDeadline').value;
      
      if (new Date(deadline) > new Date(date)) {
        return showToast('Deadline must be before the tournament date', 'error');
      }

      await Store.addTournament({
        name: document.getElementById('tName').value.trim(),
        sport: document.getElementById('tSport').value,
        fee: parseFloat(document.getElementById('tFee').value),
        date: date,
        registration_deadline: deadline,
        venue: document.getElementById('tVenue').value.trim(),
        description: document.getElementById('tDescription').value.trim(),
        status: 'active'
      });

      showToast('Tournament created successfully!');
      createTForm.reset();
      
      // Switch back to dashboard tab
      document.querySelector('.admin-tab[data-admin-tab="dashboard"]').click();
      await renderAdminAll();
    });
  }

  // Admin Filters
  const adminFilterT = document.getElementById('adminFilterTournament');
  const adminFilterS = document.getElementById('adminFilterStatus');
  if(adminFilterT) adminFilterT.addEventListener('change', renderAdminRegistrationsList);
  if(adminFilterS) adminFilterS.addEventListener('change', renderAdminRegistrationsList);

  // Payment Modal handlers
  const paymentModalClose = document.getElementById('paymentModalClose');
  const paymentDoneBtn = document.getElementById('paymentDoneBtn');
  
  function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
    // Reset upload state
    resetScreenshotUpload();
    window.location.hash = '#registrations';
  }
  
  if (paymentModalClose) paymentModalClose.addEventListener('click', function() {
    // Allow closing without screenshot but warn
    document.getElementById('paymentModal').classList.add('hidden');
    resetScreenshotUpload();
    showToast('You can upload your payment screenshot later from the registration page.', 'info');
    window.location.hash = '#registrations';
  });
  if (paymentDoneBtn) paymentDoneBtn.addEventListener('click', async function() {
    // Save screenshot to registration
    if (currentScreenshotData && currentPaymentRegId) {
      
      const doneBtn = document.getElementById('paymentDoneBtn');
      doneBtn.disabled = true;
      doneBtn.textContent = 'Uploading... Please wait';
      
      // Upload to Supabase Storage
      const fileExt = currentScreenshotData.name.split('.').pop();
      const fileName = `ss_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data, error } = await supabaseClient.storage
        .from('payment_screenshots')
        .upload(fileName, currentScreenshotData);
        
      if (error) {
        showToast('Image upload failed. Try again later.', 'error');
        doneBtn.disabled = false;
        doneBtn.textContent = 'Submit Payment Proof →';
        return;
      }
      
      const { data: urlData } = supabaseClient.storage
        .from('payment_screenshots')
        .getPublicUrl(fileName);

      await Store.updateRegistration(currentPaymentRegId, { paymentScreenshot: urlData.publicUrl });
      showToast('Payment screenshot uploaded successfully! Admin will verify and approve.', 'success');
    }
    document.getElementById('paymentModal').classList.add('hidden');
    resetScreenshotUpload();
    window.location.hash = '#registrations';
  });

  // Screenshot Upload handlers
  setupScreenshotUpload();

  // Initialize Router
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
});

// Screenshot upload state
let currentScreenshotData = null;
let currentPaymentRegId = null;

// Payment Modal
function showPaymentModal(fee, regId) {
  document.getElementById('paymentFeeValue').textContent = `₹${fee}`;
  document.getElementById('paymentStepAmount').textContent = `₹${fee}`;
  currentPaymentRegId = regId;
  currentScreenshotData = null;
  resetScreenshotUpload();
  document.getElementById('paymentModal').classList.remove('hidden');
  showToast('Registration submitted! Complete the payment and upload screenshot.', 'success');
}

function resetScreenshotUpload() {
  currentScreenshotData = null;
  const preview = document.getElementById('screenshotPreview');
  const content = document.getElementById('dropzoneContent');
  const doneBtn = document.getElementById('paymentDoneBtn');
  const fileInput = document.getElementById('screenshotInput');
  if (preview) preview.classList.add('hidden');
  if (content) content.classList.remove('hidden');
  if (doneBtn) {
    doneBtn.disabled = true;
    doneBtn.textContent = 'Upload Screenshot to Submit →';
  }
  if (fileInput) fileInput.value = '';
}

function handleScreenshotFile(file) {
  if (!file) return;
  
  // Validate type
  if (!file.type.match(/image\/(png|jpeg|jpg)/)) {
    showToast('Please upload a PNG or JPG image', 'error');
    return;
  }
  
  // Validate size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    showToast('File size must be under 5MB', 'error');
    return;
  }

  currentScreenshotData = file; // Store the actual File object to upload to Supabase

  const reader = new FileReader();
  reader.onload = (e) => {
    // Show preview
    const preview = document.getElementById('screenshotPreview');
    const content = document.getElementById('dropzoneContent');
    const img = document.getElementById('screenshotPreviewImg');
    const doneBtn = document.getElementById('paymentDoneBtn');
    
    img.src = e.target.result;
    preview.classList.remove('hidden');
    content.classList.add('hidden');
    doneBtn.disabled = false;
    doneBtn.textContent = 'Submit Payment Proof →';
  };
  reader.readAsDataURL(file);
}

function setupScreenshotUpload() {
  const dropzone = document.getElementById('screenshotDropzone');
  const fileInput = document.getElementById('screenshotInput');
  const browseBtn = document.getElementById('browseScreenshotBtn');
  const removeBtn = document.getElementById('removeScreenshotBtn');
  const content = document.getElementById('dropzoneContent');
  
  if (!dropzone) return;

  // Click to browse
  if (browseBtn) browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  
  // Click on dropzone content
  if (content) content.addEventListener('click', () => fileInput.click());

  // File input change
  fileInput.addEventListener('change', (e) => {
    handleScreenshotFile(e.target.files[0]);
  });

  // Drag and drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });
  
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    handleScreenshotFile(file);
  });

  // Remove screenshot
  if (removeBtn) removeBtn.addEventListener('click', () => {
    resetScreenshotUpload();
  });
}

// View screenshot in admin (opens in new modal/window)
window.viewScreenshot = async (regId) => {
  const regs = await Store.getRegistrations();
  const reg = regs.find(r => r.id === regId);
  if (reg && reg.paymentScreenshot) {
    // Create a simple image viewer overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '5000';
    overlay.innerHTML = `
      <div class="modal" style="max-width:600px;width:95%">
        <div class="modal-header">
          <h3>📷 Payment Screenshot — ${reg.teamName}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="text-align:center;padding:16px">
          <img src="${reg.paymentScreenshot}" style="max-width:100%;max-height:500px;border-radius:8px;border:1px solid var(--border)" alt="Payment Screenshot">
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
        </div>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }
};

// Global Live Countdown Timer for Deadlines
setInterval(() => {
  document.querySelectorAll('.live-countdown').forEach(el => {
    const deadlineStr = el.getAttribute('data-deadline');
    if (!deadlineStr) return;
    
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const diff = deadline - now;
    
    if (diff <= 0) {
      el.textContent = "Registration Closed";
      el.style.color = "var(--danger)";
      el.style.background = "var(--danger-light)";
      return;
    }
    
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / 1000 / 60) % 60);
    const s = Math.floor((diff / 1000) % 60);
    
    let timeStr = '⏳ ';
    if (d > 0) timeStr += `${d}d `;
    timeStr += `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    
    el.textContent = timeStr;
  });
}, 1000);
