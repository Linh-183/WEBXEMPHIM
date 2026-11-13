// File: test_system_flow.js
// Automated Integration & Verification Suite for CineGo Platform

const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✕ FAIL: ${message}`);
    failedTests++;
  }
}

console.log('====================================================');
console.log('🧪 CINEGO COMPREHENSIVE SYSTEM VERIFICATION SUITE');
console.log('====================================================\n');

// 1. FILE & ASSETS INTEGRITY
console.log('--- TEST GROUP 1: Codebase & Asset Integrity ---');
const requiredFiles = [
  'server.js',
  'package.json',
  'dieu-huong/khach-hang.js',
  'dieu-huong/quan-tri.js',
  'trung-gian/xac-thuc.js',
  'models/User.js',
  'models/Movie.js',
  'models/Ticket.js',
  'models/Voucher.js',
  'models/Cinema.js',
  'models/FoodCombo.js',
  'models/SeatLock.js',
  'models/FlashSale.js',
  'views/partials/header.ejs',
  'views/partials/footer.ejs',
  'views/partials/admin-header.ejs',
  'views/partials/admin-footer.ejs',
  'views/admin-dashboard.ejs',
  'views/admin-quanlyphim.ejs',
  'views/thongtincanhan.ejs',
  'views/trangkhuyenmai.ejs',
  'views/trangthanhtoan.ejs',
  'public/css/cinego-editorial.css',
  'public/css/style.css'
];

requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  assert(exists, `Required file exists: ${file}`);
});

// 2. CHECK FOOTER REQUIREMENTS
console.log('\n--- TEST GROUP 2: Footer & Hotline Verification ---');
const footerContent = fs.readFileSync(path.join(__dirname, 'views/partials/footer.ejs'), 'utf8');
const adminFooterContent = fs.readFileSync(path.join(__dirname, 'views/partials/admin-footer.ejs'), 'utf8');

assert(footerContent.includes('12345678'), 'Customer footer has hotline 12345678');
assert(!footerContent.includes('1900 6017'), 'Customer footer no longer has 1900 6017');
assert(!footerContent.includes('LOCKING 5 MINS'), 'Customer footer no longer has LOCKING 5 MINS');
assert(footerContent.includes('Dịch Vụ & Hỗ Trợ'), 'Customer footer has new Dịch Vụ & Hỗ Trợ section');

assert(adminFooterContent.includes('12345678'), 'Admin footer has hotline 12345678');
assert(!adminFooterContent.includes('OPTIMISTIC SEAT LOCK 5M'), 'Admin footer no longer has OPTIMISTIC SEAT LOCK 5M');

// 3. CHECK ADMIN DASHBOARD REAL DATA INTEGRATION
console.log('\n--- TEST GROUP 3: Admin Dashboard Real Data Verification ---');
const dashboardContent = fs.readFileSync(path.join(__dirname, 'views/admin-dashboard.ejs'), 'utf8');
const adminRouteContent = fs.readFileSync(path.join(__dirname, 'dieu-huong/quan-tri.js'), 'utf8');

assert(!dashboardContent.includes('Dune: Hành Tinh Cát 2</h3>'), 'Admin dashboard has NO mock Dune 2 fallback');
assert(!dashboardContent.includes('Oppenheimer</h3>'), 'Admin dashboard has NO mock Oppenheimer fallback');
assert(!dashboardContent.includes('85 vé</span>'), 'Admin dashboard has NO fake 85 vé');
assert(dashboardContent.includes('realLabels'), 'Admin dashboard uses dynamic realLabels from database');
assert(dashboardContent.includes('realRevenue'), 'Admin dashboard uses dynamic realRevenue from database');
assert(dashboardContent.includes('shareObj'), 'Admin dashboard uses dynamic cinema share data');
assert(adminRouteContent.includes('chartRevenueData'), 'Admin route computes real 7-day revenue trend');
assert(adminRouteContent.includes('cinemaShare'), 'Admin route computes real cinema share');

// 4. CHECK MOVIE MANAGEMENT INLINE FORM
console.log('\n--- TEST GROUP 4: Movie Management Inline Form ---');
const adminMovieContent = fs.readFileSync(path.join(__dirname, 'views/admin-quanlyphim.ejs'), 'utf8');
const adminHeaderContent = fs.readFileSync(path.join(__dirname, 'views/partials/admin-header.ejs'), 'utf8');

assert(adminMovieContent.includes('id="addMovieSection"'), 'admin-quanlyphim has inline addMovieSection form');
assert(adminMovieContent.includes('toggleAddMovieForm'), 'admin-quanlyphim has toggleAddMovieForm function');
assert(adminMovieContent.includes('previewInlinePoster'), 'admin-quanlyphim has live poster preview');
assert(!adminMovieContent.includes('+ Thêm Phim Mới</span>'), 'admin-quanlyphim has NO duplicate plus sign in button');
assert(!adminHeaderContent.includes('Thêm Phim Nhanh'), 'Admin sidebar has NO redundant Thêm Phim Nhanh link');

// 5. CHECK REMOVAL OF QUAN LY GIAO DICH & ZERO FAKE DATA
console.log('\n--- TEST GROUP 5: Removal of Quan Ly Giao Dich & Real-Time Data ---');
const adminBaoCaoContent = fs.readFileSync(path.join(__dirname, 'views/admin-baocaodoanhthu.ejs'), 'utf8');
const adminSuatChieuContent = fs.readFileSync(path.join(__dirname, 'views/admin-quanlysuatchieu.ejs'), 'utf8');
const cinemaModelContent = fs.readFileSync(path.join(__dirname, 'models/Cinema.js'), 'utf8');

assert(!adminHeaderContent.includes('/admin/giao-dich'), 'Admin sidebar NO LONGER has Quản Lý Giao Dịch link');
assert(!dashboardContent.includes('href="/admin/giao-dich"'), 'Admin dashboard NO LONGER links to /admin/giao-dich');
assert(adminRouteContent.includes("res.redirect('/admin')"), '/admin/giao-dich route cleanly redirects to /admin');
assert(!fs.existsSync(path.join(__dirname, 'views/admin-quanlygiaodich.ejs')), 'admin-quanlygiaodich.ejs file is completely removed');

// Zero fake data in Báo Cáo
assert(!adminBaoCaoContent.includes('42 suất'), 'Báo cáo doanh thu has NO fake 42 suất fallback');
assert(!adminBaoCaoContent.includes('720 vé'), 'Báo cáo doanh thu has NO fake 720 vé fallback');
assert(!adminBaoCaoContent.includes('+18.5% so với tháng trước'), 'Báo cáo doanh thu has NO fake +18.5% growth');
assert(!adminRouteContent.includes('totalRevenue || 182450000'), 'Admin route has NO fake 182tr fallback');
assert(!adminRouteContent.includes('totalFnb || 48200000'), 'Admin route has NO fake 48tr fallback');

// Zero fake data in Suất Chiếu
assert(!adminSuatChieuContent.includes('Dune: Hành Tinh Cát 2</td>'), 'Quản lý suất chiếu has NO hardcoded Dune 2');
assert(!adminSuatChieuContent.includes('Mai (Trấn Thành Phim)</td>'), 'Quản lý suất chiếu has NO hardcoded Mai');
assert(adminSuatChieuContent.includes('showtimesList'), 'Quản lý suất chiếu dynamically iterates showtimesList');
assert(cinemaModelContent.includes('phone: { type: String, default: \'12345678\' }'), 'Cinema model default phone is 12345678');

// 6. CHECK VOUCHER WALLET & SAVING MECHANISM
console.log('\n--- TEST GROUP 6: Voucher Wallet & Saving Mechanism ---');
const userModelContent = fs.readFileSync(path.join(__dirname, 'models/User.js'), 'utf8');
const customerRouteContent = fs.readFileSync(path.join(__dirname, 'dieu-huong/khach-hang.js'), 'utf8');
const profileContent = fs.readFileSync(path.join(__dirname, 'views/thongtincanhan.ejs'), 'utf8');
const promoContent = fs.readFileSync(path.join(__dirname, 'views/trangkhuyenmai.ejs'), 'utf8');

assert(userModelContent.includes('vouchers: [{ type: mongoose.Schema.Types.ObjectId, ref: \'Voucher\' }]'), 'User schema includes vouchers array');
assert(customerRouteContent.includes('/api/luu-voucher'), 'Customer router has POST /api/luu-voucher');
assert(customerRouteContent.includes('/api/xoa-voucher-vi'), 'Customer router has POST /api/xoa-voucher-vi');
assert(promoContent.includes('saveVoucherToWallet'), 'Promotion page has saveVoucherToWallet');
assert(!promoContent.includes('Sao Chép Mã'), 'Promotion page does not use copy code');
assert(profileContent.includes('handleSaveToWallet'), 'Profile page has handleSaveToWallet');
assert(profileContent.includes('removeVoucherFromWallet'), 'Profile page has removeVoucherFromWallet');

// 7. SYNTAX CHECK ALL ROUTERS & MODELS
console.log('\n--- TEST GROUP 7: JavaScript Syntax Validation ---');
const jsFilesToCheck = [
  'server.js',
  'dieu-huong/khach-hang.js',
  'dieu-huong/quan-tri.js',
  'trung-gian/xac-thuc.js',
  'models/User.js',
  'models/Movie.js',
  'models/Ticket.js',
  'models/Voucher.js',
  'models/SeatLock.js',
  'models/FoodCombo.js',
  'models/Cinema.js',
  'models/FlashSale.js'
];

jsFilesToCheck.forEach(f => {
  try {
    require(path.join(__dirname, f));
    assert(true, `Syntax & Module Load OK: ${f}`);
  } catch (err) {
    assert(false, `Module load failed: ${f} - ${err.message}`);
  }
});

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('====================================================');

process.exit(failedTests > 0 ? 1 : 0);
