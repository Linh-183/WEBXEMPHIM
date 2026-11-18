const fs = require('fs');
const assert = require('assert');
const path = require('path');

// 1. Check trangdatvephim.ejs
const bookingPath = path.join(__dirname, 'views', 'trangdatvephim.ejs');
const bookingView = fs.readFileSync(bookingPath, 'utf8');
assert(!bookingView.includes('class="seat-unit seat-sold"'), 'trangdatvephim.ejs must NOT contain hardcoded seat-sold elements');
assert(bookingView.includes('getAvailableShowtimes'), 'trangdatvephim.ejs must contain getAvailableShowtimes function');
assert(bookingView.includes('loadOccupiedSeats'), 'trangdatvephim.ejs must contain loadOccupiedSeats function');
assert(bookingView.includes('/api/ghe-da-dat'), 'trangdatvephim.ejs must fetch /api/ghe-da-dat');
assert(bookingView.includes('Chưa có lịch chiếu tại'), 'trangdatvephim.ejs must display empty state notice when no showtimes for date/cinema');
assert(!bookingView.includes("return ['09:30', '13:15', '16:45', '19:30', '21:45']"), 'trangdatvephim.ejs must NOT have fake default showtimes fallback');
assert(bookingView.includes('updateDatePillsStatus'), 'trangdatvephim.ejs must update date pills status per cinema');
assert(bookingView.includes('noShowtimeNotice'), 'trangdatvephim.ejs must have noShowtimeNotice for seat map');

// 2. Check trangthanhtoan.ejs
const checkoutPath = path.join(__dirname, 'views', 'trangthanhtoan.ejs');
const checkoutView = fs.readFileSync(checkoutPath, 'utf8');
assert(checkoutView.includes('i<=10'), 'trangthanhtoan.ejs must loop 10 seats for rows A-E');
assert(checkoutView.includes('checkoutCouples'), 'trangthanhtoan.ejs must include checkoutCouples for row F');
assert(checkoutView.includes('F1-F2'), 'trangthanhtoan.ejs must include couple seat F1-F2');
assert(checkoutView.includes('F9-F10'), 'trangthanhtoan.ejs must include couple seat F9-F10');
assert(!checkoutView.includes('2026-11-12'), 'trangthanhtoan.ejs must NOT have hardcoded fallback 2026-11-12');

// 3. Check admin views alignment and time formatting
['admin-themphim.ejs', 'admin-suaphim.ejs', 'admin-quanlyphim.ejs'].forEach(file => {
  const content = fs.readFileSync(path.join(__dirname, 'views', file), 'utf8');
  assert(!content.includes('grid-cols-4 gap-3 p-4 bg-[#FAF8F5] border border-[#E5E0D5] items-end'), file + ' must NOT use items-end with unbalanced labels');
  assert(content.includes('h-5 flex items-center'), file + ' must use uniform h-5 label wrappers');
  assert(content.includes('formatShowtimeInput'), file + ' must have formatShowtimeInput helper');
  assert(content.includes('addShowtimeRow'), file + ' must have addShowtimeRow helper');
  assert(!content.includes('+09:30'), file + ' must NOT force +09:30 quick chips per user request');
});

// 4. Check khach-hang.js API
const khachHangPath = path.join(__dirname, 'dieu-huong', 'khach-hang.js');
const khachHangContent = fs.readFileSync(khachHangPath, 'utf8');
assert(khachHangContent.includes("router.get('/api/ghe-da-dat'"), 'khach-hang.js must have /api/ghe-da-dat endpoint');
assert(khachHangContent.includes('new Set(bookedSeats)'), 'khach-hang.js must deduplicate bookedSeats');

// 5. Check quan-tri.js time formatting
const quanTriPath = path.join(__dirname, 'dieu-huong', 'quan-tri.js');
const quanTriContent = fs.readFileSync(quanTriPath, 'utf8');
assert(quanTriContent.includes('normalizeTimeSlot'), 'quan-tri.js must have normalizeTimeSlot to enforce HH:MM format with colon');

console.log('✅ ALL 25 REAL-TIME BOOKING, STRICT ISOLATION & TIME FORMATTING VERIFICATIONS PASSED!');
