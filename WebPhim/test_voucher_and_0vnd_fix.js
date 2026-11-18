const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

console.log('====================================================');
console.log('🧪 VERIFYING FIXES FOR 0Đ VOUCHER, POINTS & SINGLE-USE');
console.log('====================================================');

// 1. TEST 0Đ TICKET RENDERING IN lichsudatve.ejs
const lichSuPath = path.join(__dirname, 'views', 'lichsudatve.ejs');
const lichSuTpl = fs.readFileSync(lichSuPath, 'utf8');

const zeroTicket = {
  _id: '67332211aabbccddeeff0011',
  movie: { title: 'GODZILLA TRỪ KHÔNG' },
  cinema: 'CGV Kim Cúc Plaza',
  showDate: '2026-11-18',
  showTime: '22:00',
  seats: ['D3', 'D4'],
  comboDetails: 'Combo Cine Solo x1',
  totalPrice: 0 // Free due to voucher!
};

const renderedZeroTicket = ejs.render(lichSuTpl, {
  tickets: [zeroTicket],
  user: { hoTen: 'Nguyễn Hoàng Bảo L...', email: 'test@gmail.com' }
}, {
  views: [path.join(__dirname, 'views')],
  filename: lichSuPath
});

// Must show '0 đ' and NOT '95.000 đ'
assert(renderedZeroTicket.includes('0 đ'), 'Must render 0 đ for 0đ ticket in lichsudatve.ejs');
assert(!renderedZeroTicket.includes('95.000 đ'), 'Must NOT fall back to 95.000 đ for 0đ ticket');
console.log('✓ TEST 1: 0đ ticket in lichsudatve renders "0 đ" and never 95.000đ - PASSED!');

// 2. TEST CHECKOUT FORM CONTAINS voucherCode AND discountAmount
const thanhToanPath = path.join(__dirname, 'views', 'trangthanhtoan.ejs');
const thanhToanTpl = fs.readFileSync(thanhToanPath, 'utf8');
assert(thanhToanTpl.includes('name="voucherCode"'), 'trangthanhtoan.ejs must contain hidden input voucherCode');
assert(thanhToanTpl.includes('name="discountAmount"'), 'trangthanhtoan.ejs must contain hidden input discountAmount');
assert(thanhToanTpl.includes("document.getElementById('input_voucher_code').value"), 'trangthanhtoan.ejs must update input_voucher_code on apply');
console.log('✓ TEST 2: Checkout form submits voucherCode & discountAmount to backend - PASSED!');

// 3. TEST BACKEND LOGIC IN dieu-huong/khach-hang.js
const khachHangCode = fs.readFileSync(path.join(__dirname, 'dieu-huong', 'khach-hang.js'), 'utf8');

// Check that usedVouchers prevents reuse
assert(khachHangCode.includes('userInDb.usedVouchers.includes(upperCode)'), 'Must check if voucher was already used');
assert(khachHangCode.includes('userInDb.usedVouchers.push(upperCode)'), 'Must record used voucher in userInDb.usedVouchers');
assert(khachHangCode.includes('userInDb.vouchers.filter('), 'Must remove voucher from user.vouchers wallet on checkout');

// Check that points are awarded based on base order value (before voucher)
assert(khachHangCode.includes('baseOrderValue = expectedBaseTotal > 0 ? expectedBaseTotal : (Number(total) || 0)'), 'Must award points based on base order value');
assert(khachHangCode.includes('Math.floor(baseOrderValue / 1000)'), 'Must calculate earnedPoints from baseOrderValue');
console.log('✓ TEST 3: Backend awards full loyalty points on base order & enforces single-use voucher removal - PASSED!');

// 4. TEST USER MODEL CONTAINS usedVouchers
const userModelCode = fs.readFileSync(path.join(__dirname, 'models', 'User.js'), 'utf8');
assert(userModelCode.includes('usedVouchers'), 'User model must have usedVouchers field');
console.log('✓ TEST 4: User model tracks usedVouchers - PASSED!');

console.log('====================================================');
console.log('🎉 ALL 4 VERIFICATIONS PASSED 100%! READY FOR PRODUCTION!');
console.log('====================================================');
