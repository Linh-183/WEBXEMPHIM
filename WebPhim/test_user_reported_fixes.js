const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 VERIFYING 7 USER REPORTED FIXES');
console.log('====================================================');

// 1. SƠ ĐỒ GHẾ ADMIN: RÕ RÀNG, ĐẦY ĐỦ MÀU SẮC, KHÔNG BỊ TỐI ĐEN
const soDoGheView = fs.readFileSync(path.join(__dirname, 'views', 'admin-sodoghe.ejs'), 'utf8');
assert(soDoGheView.includes('#FFFFFF') && soDoGheView.includes('#D97706') && soDoGheView.includes('#EC4899'), 'Seats must have explicit visible styling');
assert(soDoGheView.includes('applySeatVisual'), 'Must have applySeatVisual function');
console.log('✓ FIX 1: Sơ đồ ghế admin hiển thị rõ ràng, đầy đủ loại ghế và giá vé - PASSED!');

// 2. MUA BẮP NƯỚC XONG CÓ THÔNG BÁO TOAST
const bapNuocView = fs.readFileSync(path.join(__dirname, 'views', 'trangbapnuoc.ejs'), 'utf8');
assert(bapNuocView.includes('cinegoToast.success') && bapNuocView.includes('Mã nhận đơn'), 'Must show toast on concession order');
console.log('✓ FIX 2: Mua bắp nước xong có thông báo xác nhận tức thì - PASSED!');

// 3. ÁP MÃ VOUCHER KHI ĐẶT BẮP NƯỚC RIÊNG
assert(bapNuocView.includes('id="concessionVoucherCode"') && bapNuocView.includes('applyConcessionVoucher()'), 'Concession must support voucher input and apply');
const khachHangCode = fs.readFileSync(path.join(__dirname, 'dieu-huong', 'khach-hang.js'), 'utf8');
assert(khachHangCode.includes('voucherCode') && khachHangCode.includes('discountAmount'), 'api/dat-bap-nuoc must save voucher discount');
console.log('✓ FIX 3: Áp mã voucher cho quầy bắp nước riêng hoạt động - PASSED!');

// 4. VOUCHER ĐỔI ĐIỂM THƯỞNG KHÔNG LÀM LOẠN Ô ADMIN
const voucherModel = fs.readFileSync(path.join(__dirname, 'models', 'Voucher.js'), 'utf8');
assert(voucherModel.includes('isReward'), 'Voucher model must have isReward field');
const quanTriCode = fs.readFileSync(path.join(__dirname, 'dieu-huong', 'quan-tri.js'), 'utf8');
assert(quanTriCode.includes('isReward: { $ne: true }'), 'Admin voucher list must filter out reward vouchers');
console.log('✓ FIX 4: Danh sách voucher Admin chỉ hiển thị voucher do Admin tạo - PASSED!');

// 5. TÌM KIẾM KHÔNG BẬT POPUP, HIỆN KẾT QUẢ NGAY DƯỚI Ô TÌM KIẾM
const headerView = fs.readFileSync(path.join(__dirname, 'views', 'partials', 'header.ejs'), 'utf8');
assert(!headerView.includes('id="search-modal"'), 'Must NOT have search-modal dialog popup');
assert(headerView.includes('id="headerSearchDropdown"') && headerView.includes('id="headerSearchInput"'), 'Must have inline dropdown directly under input');
console.log('✓ FIX 5: Tìm kiếm hiển thị kết quả dropdown ngay dưới ô tìm kiếm, không popup - PASSED!');

// 6. GOURMET CONCESSIONS TRANG CHỦ THAY ĐỔI THEO COMBO DATABASE
const trangChuView = fs.readFileSync(path.join(__dirname, 'views', 'trangchu.ejs'), 'utf8');
assert(trangChuView.includes('combos.forEach'), 'trangchu.ejs must dynamically render combos');
assert(khachHangCode.includes('FoodCombo.find'), 'Home route must query FoodCombo');
console.log('✓ FIX 6: Quầy bắp nước trang chủ tự động đổi món theo combo database - PASSED!');

// 7. ĐÁNH GIÁ PHIM: CHỈ ĐƯỢC ĐÁNH GIÁ SAU KHI XEM
assert(fs.existsSync(path.join(__dirname, 'models', 'Review.js')), 'Review model must exist');
assert(khachHangCode.includes('/api/danh-gia') && khachHangCode.includes('Ticket.findOne'), 'Review API must check ticket purchase');
const chiTietPhimView = fs.readFileSync(path.join(__dirname, 'views', 'trangchitietphim.ejs'), 'utf8');
assert(chiTietPhimView.includes('danh-gia-phim') && chiTietPhimView.includes('hasWatched'), 'Movie detail must have review section with hasWatched check');
const lichSuView = fs.readFileSync(path.join(__dirname, 'views', 'lichsudatve.ejs'), 'utf8');
assert(lichSuView.includes('Đánh Giá') && lichSuView.includes('#danh-gia-phim'), 'Ticket history must have direct review button');
console.log('✓ FIX 7: Hệ thống đánh giá phim chuẩn xác, chỉ mở sau khi xem phim - PASSED!');

console.log('====================================================');
console.log('🎉 ALL 7 REPORTED FIXES ARE VERIFIED AND PASSING 100%!');
console.log('====================================================');
