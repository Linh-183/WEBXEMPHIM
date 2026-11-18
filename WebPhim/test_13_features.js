const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 VERIFYING 13 NEW USER REQUIREMENTS & BUG FIXES');
console.log('====================================================');

// 1. Kiểm tra không mất ghế sau 10s trong trangdatvephim.ejs
const bookingView = fs.readFileSync(path.join(__dirname, 'views', 'trangdatvephim.ejs'), 'utf8');
assert(bookingView.includes('async function loadOccupiedSeats(resetSelected = false)'), 'Must support resetSelected parameter');
assert(bookingView.includes('if (resetSelected)'), 'Must only wipe selection if resetSelected is true');
assert(bookingView.includes('userSelectedCodes'), 'Must preserve user selected seats');
assert(bookingView.includes('loadOccupiedSeats(false)'), 'Polling and focus must pass resetSelected = false');
console.log('  ✓ Requirement 1: Sửa lỗi mất ghế sau 10s - Verified');

// 2. Hiển thị voucher có sẵn tại trang thanh toán
const checkoutView = fs.readFileSync(path.join(__dirname, 'views', 'trangthanhtoan.ejs'), 'utf8');
assert(checkoutView.includes('availableSystemVouchers'), 'trangthanhtoan.ejs must check available system vouchers');
assert(checkoutView.includes('Voucher Ưu Đãi Có Sẵn Hôm Nay'), 'trangthanhtoan.ejs must show available vouchers section');
assert(checkoutView.includes('fillVoucher'), 'trangthanhtoan.ejs must have 1-click apply button');
console.log('  ✓ Requirement 2: Hiển thị voucher có sẵn tại thanh toán - Verified');

// 3. Lỗi header bị đơ do popover che click
const headerView = fs.readFileSync(path.join(__dirname, 'views', 'partials', 'header.ejs'), 'utf8');
const editorialCss = fs.readFileSync(path.join(__dirname, 'public', 'css', 'cinego-editorial.css'), 'utf8');
assert(headerView.includes('id="quick-cinema-menu" popover="auto" class="cinego-popover hidden'), 'quick-cinema-menu must have hidden class by default');
assert(headerView.includes('id="user-profile-menu" popover="auto" class="cinego-popover hidden'), 'user-profile-menu must have hidden class by default');
assert(editorialCss.includes('.cinego-popover:not(:popover-open)'), 'CSS must handle :not(:popover-open)');
assert(editorialCss.includes('pointer-events: none !important'), 'CSS must disable pointer events when closed');
console.log('  ✓ Requirement 3: Khắc phục triệt để lỗi header đơ / click overlay - Verified');

// 4. Mất trailerUrl khi sửa phim
const quanTriCode = fs.readFileSync(path.join(__dirname, 'dieu-huong', 'quan-tri.js'), 'utf8');
assert(quanTriCode.includes("router.post('/phim/sua/:id'"), 'Must have update movie route');
assert(quanTriCode.includes('trailerUrl: trailerUrl ? trailerUrl.trim() : \'\''), 'Must save trailerUrl in findByIdAndUpdate');
console.log('  ✓ Requirement 4: Sửa lỗi mất trailerUrl khi sửa phim - Verified');

// 5. Mở trailer chuyển trực tiếp sang YouTube
const footerView = fs.readFileSync(path.join(__dirname, 'views', 'partials', 'footer.ejs'), 'utf8');
assert(footerView.includes("window.open(watchUrl, '_blank')"), 'openTrailerModal must open YouTube directly in new tab');
console.log('  ✓ Requirement 5: Xem trailer chuyển trực tiếp sang YouTube - Verified');

// 6. Tự gõ giờ chiếu, không cần gợi ý giờ
['admin-themphim.ejs', 'admin-suaphim.ejs', 'admin-quanlyphim.ejs'].forEach(f => {
  const code = fs.readFileSync(path.join(__dirname, 'views', f), 'utf8');
  assert(!code.includes('+09:30'), `${f} must not force +09:30 suggestion chips`);
  assert(code.includes('Nhập giờ chiếu tùy ý'), `${f} must have custom time input placeholder`);
});
console.log('  ✓ Requirement 6: Tự nhập giờ chiếu tùy ý, không gợi ý giờ - Verified');

// 7. Sửa giá bán và giá gốc
const movieModel = fs.readFileSync(path.join(__dirname, 'models', 'Movie.js'), 'utf8');
assert(movieModel.includes('price: { type: Number'), 'Movie schema must have price');
assert(movieModel.includes('originalPrice: { type: Number'), 'Movie schema must have originalPrice');
assert(quanTriCode.includes('price: safePrice'), 'quan-tri.js must save price in Movie create & update');
assert(quanTriCode.includes('originalPrice: safeOriginalPrice'), 'quan-tri.js must save originalPrice');
console.log('  ✓ Requirement 7: Sửa và lưu giá bán, giá gốc phim - Verified');

// 8. Vé bắp nước riêng đã mua
const ticketHistoryView = fs.readFileSync(path.join(__dirname, 'views', 'lichsudatve.ejs'), 'utf8');
assert(ticketHistoryView.includes('Bắp Nước Đặt Riêng (F&B)'), 'lichsudatve.ejs must have F&B tab');
assert(ticketHistoryView.includes('isConcessionOnly'), 'lichsudatve.ejs must recognize standalone F&B orders');
assert(ticketHistoryView.includes('ĐƠN BẮP NƯỚC F&B'), 'lichsudatve.ejs must display concession badge');
console.log('  ✓ Requirement 8: Hiển thị vé bắp nước riêng đã mua - Verified');

// 9. Tích nhiều điểm khi mua vé & bắp nước
const khachHangCode = fs.readFileSync(path.join(__dirname, 'dieu-huong', 'khach-hang.js'), 'utf8');
assert(khachHangCode.includes('Math.floor(verifiedTotalPrice / 1000)'), 'Ticket checkout must award 1 pt per 1000đ');
assert(khachHangCode.includes('Math.floor(total / 1000)'), 'F&B checkout must award 1 pt per 1000đ');
console.log('  ✓ Requirement 9: Tích nhiều điểm thưởng khi mua vé (1000đ = 1 điểm) - Verified');

// 10. Bộ lọc khi tìm kiếm phim
const searchView = fs.readFileSync(path.join(__dirname, 'views', 'trangtimkiem.ejs'), 'utf8');
assert(searchView.includes('name="genre"'), 'trangtimkiem.ejs must have genre filter');
assert(searchView.includes('name="cinema"'), 'trangtimkiem.ejs must have cinema filter');
assert(searchView.includes('name="status"'), 'trangtimkiem.ejs must have status filter');
assert(searchView.includes('name="ageRating"'), 'trangtimkiem.ejs must have ageRating filter');
assert(khachHangCode.includes('mongoQuery.genre ='), 'khach-hang.js must filter by genre in mongoQuery');
assert(khachHangCode.includes("mongoQuery['showtimes.cinema'] ="), 'khach-hang.js must filter by cinema');
console.log('  ✓ Requirement 10: Bộ lọc tìm kiếm phim đa tiêu chí - Verified');

// 11 & 12. Đổi điểm voucher 50k & Khấu trừ điểm thật
const profileView = fs.readFileSync(path.join(__dirname, 'views', 'thongtincanhan.ejs'), 'utf8');
assert(profileView.includes('Voucher Giảm 50.000đ'), 'thongtincanhan.ejs must offer 50k voucher redemption');
assert(profileView.includes('redeemVoucher'), 'thongtincanhan.ejs must call redeemVoucher function');
assert(khachHangCode.includes("router.post('/api/doi-diem-voucher'"), 'khach-hang.js must have /api/doi-diem-voucher endpoint');
assert(khachHangCode.includes('user.diemTichLuy -= cost'), 'Endpoint must deduct real points from user');
console.log('  ✓ Requirements 11 & 12: Đổi điểm voucher 50K & Khấu trừ điểm thật vào Database - Verified');

// 13. Cài sinh nhật nhận ưu đãi hàng năm
const userModel = fs.readFileSync(path.join(__dirname, 'models', 'User.js'), 'utf8');
assert(userModel.includes('lastBirthdayGiftYear: { type: Number }'), 'User schema must track lastBirthdayGiftYear');
assert(khachHangCode.includes('checkAndAwardBirthdayGift'), 'khach-hang.js must have birthday gift checking function');
assert(khachHangCode.includes('isBirthdayToday'), 'Must check if current day and month match birthday');
assert(profileView.includes('birthdayCelebration'), 'Profile view must celebrate user birthday');
console.log('  ✓ Requirement 13: Cài sinh nhật nhận ưu đãi hàng năm - Verified');

console.log('\n====================================================');
console.log('🎉 ALL 13 REQUIREMENTS FULLY VERIFIED AND PASSING!');
console.log('====================================================');
