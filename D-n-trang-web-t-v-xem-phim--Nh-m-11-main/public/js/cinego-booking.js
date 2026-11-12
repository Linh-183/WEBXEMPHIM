/**
 * CINEGO SEAT BOOKING & COUNTDOWN ENGINE (SRS STANDARD)
 * Implements 4-Color Interactive Seat Matrix & 5-Minute Hold Timer
 */

window.CinegoBooking = (function() {
  const STATE = {
    movieId: null,
    cinema: 'CGV Kim Cúc Plaza Quy Nhơn',
    showDate: null,
    showTime: null,
    selectedSeats: new Set(),
    heldSeats: new Set(['C5', 'D6']), // Mock seats held by other users
    soldSeats: new Set(['A1', 'A2', 'B3', 'B4', 'E7', 'E8']), // Mock sold seats
    seatPrices: {
      standard: 75000,
      vip: 95000,
      couple: 170000
    },
    combos: {
      solo: { name: 'Combo Solo', price: 75000, count: 0 },
      couple: { name: 'Combo Couple', price: 115000, count: 0 },
      party: { name: 'Combo Party', price: 195000, count: 0 }
    },
    timerDuration: 300, // 5 minutes in seconds
    timerRemaining: 300,
    timerInterval: null
  };

  function init(config) {
    if (config) {
      STATE.movieId = config.movieId || STATE.movieId;
      STATE.cinema = config.cinema || STATE.cinema;
      STATE.showDate = config.showDate || STATE.showDate;
      STATE.showTime = config.showTime || STATE.showTime;
    }

    renderSeatMap();
    setupEventListeners();
    updateSummary();
  }

  function renderSeatMap() {
    const seatContainer = document.getElementById('seat-matrix-grid');
    if (!seatContainer) return;

    seatContainer.innerHTML = '';
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const cols = 12;

    rows.forEach((row, rowIndex) => {
      const rowElem = document.createElement('div');
      rowElem.className = 'flex items-center justify-center gap-1.5 sm:gap-2 my-1.5';

      // Row Label Left
      const labelL = document.createElement('span');
      labelL.className = 'w-5 text-center text-xs font-black text-slate-500';
      labelL.innerText = row;
      rowElem.appendChild(labelL);

      // Seats in row
      const isCoupleRow = (row === 'H'); // Last row is Sweetbox couple seats
      const isVipRow = (row === 'D' || row === 'E' || row === 'F'); // Middle rows are VIP

      if (isCoupleRow) {
        // 6 couple seats instead of 12 single
        for (let c = 1; c <= 6; c++) {
          const seatId = `${row}${c * 2 - 1}-${c * 2}`;
          const seatBtn = createSeatElement(seatId, 'couple', isVipRow);
          rowElem.appendChild(seatBtn);
        }
      } else {
        for (let col = 1; col <= cols; col++) {
          // Aisle spacing after column 3 and 9
          if (col === 4 || col === 10) {
            const aisle = document.createElement('div');
            aisle.className = 'w-3 sm:w-6';
            rowElem.appendChild(aisle);
          }

          const seatId = `${row}${col}`;
          const seatBtn = createSeatElement(seatId, isVipRow ? 'vip' : 'standard', isVipRow);
          rowElem.appendChild(seatBtn);
        }
      }

      // Row Label Right
      const labelR = document.createElement('span');
      labelR.className = 'w-5 text-center text-xs font-black text-slate-500';
      labelR.innerText = row;
      rowElem.appendChild(labelR);

      seatContainer.appendChild(rowElem);
    });
  }

  function createSeatElement(seatId, type, isVip) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = `seat-${seatId}`;
    btn.dataset.seatId = seatId;
    btn.dataset.seatType = type;

    let baseClass = 'cine-seat ';
    if (type === 'couple') baseClass += 'seat-couple ';
    if (isVip) baseClass += 'seat-vip ';

    // Determine status (Free, Selected, Held, Sold)
    if (STATE.soldSeats.has(seatId)) {
      btn.className = baseClass + 'seat-sold';
      btn.title = `Ghế ${seatId} - Đã bán`;
      btn.disabled = true;
      btn.innerHTML = `<span class="opacity-50">✕</span>`;
    } else if (STATE.heldSeats.has(seatId)) {
      btn.className = baseClass + 'seat-held';
      btn.title = `Ghế ${seatId} - Đang có người giữ`;
      btn.disabled = true;
      btn.innerHTML = `<span>${seatId}</span>`;
    } else if (STATE.selectedSeats.has(seatId)) {
      btn.className = baseClass + 'seat-selected';
      btn.title = `Ghế ${seatId} - Bạn đang chọn`;
      btn.innerHTML = `<span>${seatId}</span>`;
    } else {
      btn.className = baseClass + 'seat-free';
      btn.title = `Ghế ${seatId} (${type.toUpperCase()}) - Trống`;
      btn.innerHTML = `<span>${seatId}</span>`;
    }

    btn.addEventListener('click', () => toggleSeat(seatId, type));
    return btn;
  }

  function toggleSeat(seatId, type) {
    if (STATE.soldSeats.has(seatId)) {
      window.cinegoToast?.error(`Ghế ${seatId} đã được bán!`);
      return;
    }
    if (STATE.heldSeats.has(seatId)) {
      window.cinegoToast?.warning(`Ghế ${seatId} hiện đang được người khác giữ trong 5 phút!`);
      return;
    }

    if (STATE.selectedSeats.has(seatId)) {
      STATE.selectedSeats.delete(seatId);
    } else {
      if (STATE.selectedSeats.size >= 8) {
        window.cinegoToast?.warning('Bạn chỉ có thể chọn tối đa 8 ghế trong một lần đặt!');
        return;
      }
      STATE.selectedSeats.add(seatId);
      // Start countdown timer on first seat selection if not already running
      if (!STATE.timerInterval) {
        startCountdown();
      }
    }

    updateSeatVisual(seatId, type);
    updateSummary();
  }

  function updateSeatVisual(seatId, type) {
    const btn = document.getElementById(`seat-${seatId}`);
    if (!btn) return;

    if (STATE.selectedSeats.has(seatId)) {
      btn.classList.remove('seat-free');
      btn.classList.add('seat-selected');
    } else {
      btn.classList.remove('seat-selected');
      btn.classList.add('seat-free');
    }
  }

  function startCountdown() {
    clearInterval(STATE.timerInterval);
    STATE.timerRemaining = STATE.timerDuration;
    renderTimer();

    const timerBox = document.getElementById('booking-timer-container');
    if (timerBox) timerBox.classList.remove('hidden');

    STATE.timerInterval = setInterval(() => {
      STATE.timerRemaining--;
      renderTimer();

      if (STATE.timerRemaining <= 0) {
        clearInterval(STATE.timerInterval);
        STATE.timerInterval = null;
        onTimerExpired();
      }
    }, 1000);
  }

  function renderTimer() {
    const timerElem = document.getElementById('countdown-timer');
    const barElem = document.getElementById('countdown-progress');
    if (!timerElem) return;

    const mins = Math.floor(STATE.timerRemaining / 60);
    const secs = STATE.timerRemaining % 60;
    timerElem.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (barElem) {
      const pct = (STATE.timerRemaining / STATE.timerDuration) * 100;
      barElem.style.width = `${pct}%`;
      if (pct < 20) {
        barElem.className = 'h-full bg-red-600 transition-all duration-1000';
      }
    }
  }

  function onTimerExpired() {
    window.cinegoToast?.error('Đã hết 5 phút giữ ghế! Các ghế của bạn đã được giải phóng.');
    STATE.selectedSeats.clear();
    renderSeatMap();
    updateSummary();

    const timerBox = document.getElementById('booking-timer-container');
    if (timerBox) timerBox.classList.add('hidden');
  }

  function updateCombo(key, delta) {
    if (!STATE.combos[key]) return;
    const newCount = STATE.combos[key].count + delta;
    if (newCount >= 0 && newCount <= 10) {
      STATE.combos[key].count = newCount;
      const countDisplay = document.getElementById(`qty-${key}`);
      if (countDisplay) countDisplay.innerText = newCount;
      updateSummary();
    }
  }

  function updateSummary() {
    let seatTotal = 0;
    const seatListArray = Array.from(STATE.selectedSeats);

    seatListArray.forEach(id => {
      if (id.includes('-')) seatTotal += STATE.seatPrices.couple;
      else if (['D', 'E', 'F'].some(r => id.startsWith(r))) seatTotal += STATE.seatPrices.vip;
      else seatTotal += STATE.seatPrices.standard;
    });

    let comboTotal = 0;
    let comboDetailsArray = [];
    Object.keys(STATE.combos).forEach(k => {
      const item = STATE.combos[k];
      if (item.count > 0) {
        comboTotal += item.price * item.count;
        comboDetailsArray.push(`${item.name} x${item.count}`);
      }
    });

    const grandTotal = seatTotal + comboTotal;

    // Update DOM displays
    const seatListElem = document.getElementById('selected-seats-display');
    const seatTotalElem = document.getElementById('seat-total-display');
    const comboTotalElem = document.getElementById('combo-total-display');
    const grandTotalElem = document.getElementById('grand-total-display');
    const btnSubmit = document.getElementById('btn-proceed-payment');

    if (seatListElem) {
      seatListElem.innerHTML = seatListArray.length > 0
        ? seatListArray.map(s => `<span class="inline-block px-2 py-1 bg-red-600/20 text-red-500 font-bold rounded text-xs border border-red-500/30">${s}</span>`).join(' ')
        : '<span class="text-slate-500 text-xs italic">Chưa chọn ghế</span>';
    }

    if (seatTotalElem) seatTotalElem.innerText = seatTotal.toLocaleString('vi-VN') + ' đ';
    if (comboTotalElem) comboTotalElem.innerText = comboTotal.toLocaleString('vi-VN') + ' đ';
    if (grandTotalElem) grandTotalElem.innerText = grandTotal.toLocaleString('vi-VN') + ' đ';

    // Hidden form fields for POST /thanh-toan
    setHiddenVal('input-seats', seatListArray.join(','));
    setHiddenVal('input-total', grandTotal);
    setHiddenVal('input-combo-details', comboDetailsArray.join('; '));
    setHiddenVal('input-combo-total', comboTotal);

    if (btnSubmit) {
      btnSubmit.disabled = seatListArray.length === 0;
      if (seatListArray.length === 0) {
        btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');
      } else {
        btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    }
  }

  function setHiddenVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function setupEventListeners() {
    // Cinema buttons
    document.querySelectorAll('.cinema-select-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.cinema-select-btn').forEach(b => b.classList.remove('border-red-600', 'bg-red-600/10'));
        this.classList.add('border-red-600', 'bg-red-600/10');
        STATE.cinema = this.dataset.cinema;
        setHiddenVal('input-cinema', STATE.cinema);
        window.cinegoToast?.info(`Đã chọn rạp: ${STATE.cinema}`);
      });
    });

    // Showtime buttons
    document.querySelectorAll('.showtime-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.showtime-btn').forEach(b => b.classList.remove('bg-red-600', 'text-white'));
        this.classList.add('bg-red-600', 'text-white');
        STATE.showTime = this.dataset.time;
        setHiddenVal('input-showtime', STATE.showTime);
      });
    });
  }

  return {
    init,
    updateCombo,
    toggleSeat
  };
})();
