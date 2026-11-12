/**
 * CINEGO ADMIN ANALYTICS & INTERACTIVE TOOLING
 */

window.CinegoAdmin = (function() {
  function initDashboardCharts() {
    // 1. Revenue Chart
    const revenueCtx = document.getElementById('adminRevenueChart');
    if (revenueCtx && window.Chart) {
      new Chart(revenueCtx, {
        type: 'line',
        data: {
          labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
          datasets: [{
            label: 'Doanh thu (Triệu VNĐ)',
            data: [12.5, 14.8, 18.2, 16.0, 28.5, 42.0, 39.5],
            borderColor: '#E50914',
            backgroundColor: 'rgba(229, 9, 20, 0.12)',
            tension: 0.35,
            fill: true,
            pointBackgroundColor: '#E50914',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8' } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8' } }
          }
        }
      });
    }

    // 2. Cinema Occupancy Chart
    const cinemaCtx = document.getElementById('adminCinemaChart');
    if (cinemaCtx && window.Chart) {
      new Chart(cinemaCtx, {
        type: 'doughnut',
        data: {
          labels: ['CGV Kim Cúc (45%)', 'Starlight Nguyễn Kim (32%)', 'Dcine Phú Tài (23%)'],
          datasets: [{
            data: [45, 32, 23],
            backgroundColor: ['#E50914', '#F59E0B', '#3B82F6'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#CBD5E1', boxWidth: 12 } }
          }
        }
      });
    }
  }

  // POS QR Ticket Scanner Check-In Simulator
  const checkInDatabase = new Map([
    ['CG682914', { customer: 'Nguyễn Văn An', movie: 'Thám Tử Lừng Danh Conan', cinema: 'CGV Kim Cúc', seats: ['E5', 'E6'], showTime: '19:30 - Hôm nay', checkedIn: false }],
    ['CG992145', { customer: 'Trần Thị Mai', movie: 'Dune: Hành Tinh Cát 2', cinema: 'Starlight Quy Nhơn', seats: ['F8'], showTime: '21:00 - Hôm nay', checkedIn: true }],
    ['CG551023', { customer: 'Lê Hoàng Nam', movie: 'Kung Fu Panda 4', cinema: 'Dcine Quy Nhơn', seats: ['D3', 'D4', 'D5'], showTime: '15:15 - Hôm nay', checkedIn: false }]
  ]);

  function scanTicketCode(code) {
    const cleanCode = (code || '').trim().toUpperCase();
    const resultBox = document.getElementById('scanner-result-box');
    if (!resultBox) return;

    if (!cleanCode) {
      window.cinegoToast?.warning('Vui lòng nhập hoặc quét mã vé!');
      return;
    }

    const ticket = checkInDatabase.get(cleanCode);
    if (!ticket) {
      resultBox.innerHTML = `
        <div class="p-6 bg-red-900/30 border border-red-500/50 rounded-2xl text-center">
          <span class="material-symbols-outlined text-4xl text-red-500 mb-2">cancel</span>
          <h4 class="text-lg font-bold text-white">MÃ VÉ KHÔNG HỢP LỆ</h4>
          <p class="text-sm text-red-300 mt-1">Không tìm thấy mã đặt chỗ [${cleanCode}] trong cơ sở dữ liệu hệ thống.</p>
        </div>
      `;
      window.cinegoToast?.error('Vé không hợp lệ!');
      return;
    }

    if (ticket.checkedIn) {
      resultBox.innerHTML = `
        <div class="p-6 bg-amber-900/30 border border-amber-500/50 rounded-2xl text-center">
          <span class="material-symbols-outlined text-4xl text-amber-500 mb-2">warning</span>
          <h4 class="text-lg font-bold text-white">CẢNH BÁO: VÉ ĐÃ ĐƯỢC CHECK-IN TRƯỚC ĐÓ!</h4>
          <p class="text-sm text-amber-300 mt-1">Mã vé [${cleanCode}] đã quét lúc 18:45. Nghiêm cấm vào rạp lần 2!</p>
          <div class="mt-4 p-3 bg-black/40 rounded-xl text-xs text-slate-300 text-left space-y-1">
            <p><strong>Khách hàng:</strong> ${ticket.customer}</p>
            <p><strong>Phim:</strong> ${ticket.movie}</p>
            <p><strong>Suất chiếu:</strong> ${ticket.showTime} | Ghế: ${ticket.seats.join(', ')}</p>
          </div>
        </div>
      `;
      window.cinegoToast?.warning('Vé này đã được soát trước đó!');
      return;
    }

    // Valid check-in
    ticket.checkedIn = true;
    resultBox.innerHTML = `
      <div class="p-6 bg-emerald-900/30 border border-emerald-500/50 rounded-2xl">
        <div class="flex items-center gap-3 text-emerald-400 mb-3">
          <span class="material-symbols-outlined text-3xl">check_circle</span>
          <h4 class="text-lg font-bold text-white">XÁC NHẬN SOÁT VÉ THÀNH CÔNG</h4>
        </div>
        <div class="space-y-2 text-sm text-slate-300 border-t border-white/10 pt-3">
          <p><span class="text-slate-400">Khách hàng:</span> <strong class="text-white">${ticket.customer}</strong></p>
          <p><span class="text-slate-400">Phim:</span> <strong class="text-red-400">${ticket.movie}</strong></p>
          <p><span class="text-slate-400">Rạp & Suất:</span> <strong class="text-white">${ticket.cinema} | ${ticket.showTime}</strong></p>
          <p><span class="text-slate-400">Ghế ngồi:</span> <span class="px-2 py-0.5 bg-red-600 text-white font-bold rounded text-xs">${ticket.seats.join(', ')}</span></p>
        </div>
        <div class="mt-4 pt-3 border-t border-white/10 flex justify-end">
          <span class="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full">ĐÃ CHECK-IN HỢP LỆ</span>
        </div>
      </div>
    `;
    window.cinegoToast?.success(`Soát vé thành công cho ${ticket.customer}! Mời vào phòng.`);
  }

  // Showtime Conflict Checker
  function checkShowtimeConflict(room, date, startTime, durationMinutes) {
    // Calculate end time: start + duration + 15 min cleaning
    const [h, m] = startTime.split(':').map(Number);
    const startTotalMins = h * 60 + m;
    const endTotalMins = startTotalMins + Number(durationMinutes) + 15;

    const endH = Math.floor(endTotalMins / 60) % 24;
    const endM = endTotalMins % 60;
    const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

    return {
      startTime,
      endTime: endTimeStr,
      cleaningMinutes: 15,
      hasConflict: false // returns calculated schedule
    };
  }

  return {
    initDashboardCharts,
    scanTicketCode,
    checkShowtimeConflict
  };
})();
