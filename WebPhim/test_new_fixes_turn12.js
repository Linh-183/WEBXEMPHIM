const fs = require('fs');

// 1. Check isPastShowtime handles past dates
const bookingCode = fs.readFileSync('views/trangdatvephim.ejs', 'utf8');
if (!bookingCode.includes('if (dateIso < todayIso) return true;')) {
  throw new Error('isPastShowtime missing dateIso < todayIso check');
}
if (!bookingCode.includes('if (dIso < initDateIso) return true;')) {
  throw new Error('isShowtimePastServer missing dIso < initDateIso check');
}

// 2. Check quan-tri.js combo router does not re-insert dummy items
const quanTriCode = fs.readFileSync('dieu-huong/quan-tri.js', 'utf8');
if (quanTriCode.includes('FoodCombo.insertMany')) {
  throw new Error('quan-tri.js still contains auto insertMany for combos');
}

// 3. Check trangbapnuoc.ejs does not have hardcoded fallback items
const bapNuocCode = fs.readFileSync('views/trangbapnuoc.ejs', 'utf8');
if (bapNuocCode.includes('<!-- Item 1: Combo Cine Solo -->')) {
  throw new Error('trangbapnuoc.ejs still contains hardcoded fallback items');
}

// 4. Check thongtincanhan.ejs points requirement and uniform styling
const profileCode = fs.readFileSync('views/thongtincanhan.ejs', 'utf8');
if (!profileCode.includes('userPts >= 500')) {
  throw new Error('thongtincanhan.ejs missing userPts >= 500 check');
}
if (!profileCode.includes('500 điểm thưởng')) {
  throw new Error('thongtincanhan.ejs missing 500 points for 50k');
}
if (!profileCode.includes('1.000 điểm thưởng')) {
  throw new Error('thongtincanhan.ejs missing 1000 points for 100k');
}

// 5. Check khach-hang.js point deduction
const khachHangCode = fs.readFileSync('dieu-huong/khach-hang.js', 'utf8');
if (!khachHangCode.includes('let cost = 500;')) {
  throw new Error('khach-hang.js does not charge 500 points for 50k');
}
if (!khachHangCode.includes('cost = 1000;')) {
  throw new Error('khach-hang.js does not charge 1000 points for 100k');
}

// 6. Check checkout excludes isReward vouchers
if (!khachHangCode.includes('isReward: { $ne: true }')) {
  throw new Error('khach-hang.js does not exclude reward vouchers at checkout');
}

// 7. Check flash sale quick buy button
const flashCode = fs.readFileSync('views/trangflashsale.ejs', 'utf8');
if (!flashCode.includes('quickBuyFlashSale')) {
  throw new Error('trangflashsale.ejs missing quickBuyFlashSale');
}

// 8. Check concession ticket link
const lichSuCode = fs.readFileSync('views/lichsudatve.ejs', 'utf8');
if (!lichSuCode.includes('Thẻ Bắp Nước →')) {
  throw new Error('lichsudatve.ejs missing concession pass link');
}

console.log('🎉 ALL 8 TESTS FOR USER TURN 12 PASSED 100%!');
