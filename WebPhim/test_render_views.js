const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

const viewsDir = path.join(__dirname, 'views');

const mockUser = {
  _id: '65f1234567890abcdef12345',
  hoTen: 'Nguyễn Văn An',
  email: 'an.nguyen@example.com',
  soDienThoai: '0912345678',
  ngaySinh: new Date('1998-05-15'),
  gioiTinh: 'Nam',
  vaiTro: 'admin',
  diemTichLuy: 185,
  hangHoiVien: 'Bac',
  favoriteGenres: ['Hành Động', 'Khoa Học Viễn Tưởng']
};

const mockMovie = {
  _id: '65f1234567890abcdef99999',
  title: 'Dune: Hành Tinh Cát (Phần Hai)',
  director: 'Denis Villeneuve',
  genre: 'Khoa Học Viễn Tưởng, Hành Động',
  duration: 166,
  releaseDate: new Date('2026-11-01'),
  status: 'DangChieu',
  ageRating: 'T16',
  posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
  trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
  description: 'Paul Atreides hợp lực cùng Chani và tộc người Fremen để trả thù những kẻ đã hủy diệt gia tộc mình...'
};

const mockVoucher = {
  _id: '65f1234567890abcdef88888',
  code: 'FLASH19K',
  title: 'Vé Đồng Giá 19K',
  discountType: 'fixed',
  discountValue: 19000,
  minOrderValue: 75000,
  maxDiscountValue: 60000,
  expiryDate: new Date('2026-12-31')
};

const mockFlashSale = {
  _id: '65f1234567890abcdef44444',
  title: 'Khung Giờ Vàng — Đồng Giá 19K',
  movie: mockMovie,
  cinema: 'Tất cả các rạp',
  salePrice: 19000,
  originalPrice: 95000,
  startTime: new Date(Date.now() - 3600000),
  endTime: new Date(Date.now() + 3600000),
  totalQuantity: 50,
  claimedQuantity: 24,
  description: 'Áp dụng cho mọi suất chiếu trong tuần',
  voucherCode: 'FLASH19K',
  isActive: true
};

const mockTicket = {
  _id: '65f1234567890abcdef77777',
  movie: mockMovie,
  user: mockUser,
  cinema: 'CGV Kim Cúc Plaza',
  showDate: '2026-11-12',
  showTime: '19:30',
  seats: ['D5', 'D6'],
  comboDetails: 'Combo Cine Couple x1',
  comboTotal: 115000,
  totalPrice: 305000
};

const mockCinema = {
  name: 'CGV Kim Cúc Plaza',
  location: 'Tầng 3, Kim Cúc Plaza, TP. Quy Nhơn',
  totalSeats: 270,
  occupiedSeats: 42,
  emptySeats: 228,
  occupancyRate: 15.5,
  bookedSeats: JSON.stringify(['A1', 'B2', 'D5'])
};

const pagesToTest = [
  { file: 'trangchu.ejs', data: { user: mockUser, movies: [mockMovie], vouchers: [mockVoucher] } },
  { file: 'trangchu.ejs (empty movies test)', target: 'trangchu.ejs', data: { user: mockUser, movies: [], vouchers: [] } },
  { file: 'trangdanhsachphim.ejs', data: { user: mockUser, movies: [mockMovie], currentStatus: 'DangChieu', tuKhoa: '' } },
  { file: 'trangchitietphim.ejs', data: { user: mockUser, phim: mockMovie, title: mockMovie.title } },
  { file: 'tranghethongrap.ejs', data: { user: mockUser } },
  { file: 'trangchitietrap.ejs', data: { user: mockUser, movies: [mockMovie] } },
  { file: 'trangdatvephim.ejs', data: { user: mockUser, phim: mockMovie } },
  { file: 'trangthanhtoan.ejs', data: { user: mockUser, phim: mockMovie, cinema: 'CGV Kim Cúc Plaza', showDate: '2026-11-12', showTime: '19:30', seats: ['D5', 'D6'], total: 305000, comboDetails: 'Combo Cine Couple x1', comboTotal: 115000, vouchers: [mockVoucher], savedVouchers: [mockVoucher] } },
  { file: 'trangve.ejs', data: { user: mockUser } },
  { file: 'trangve.ejs (with ticket data)', target: 'trangve.ejs', data: { user: mockUser, ticket: mockTicket } },
  { file: '404.ejs', data: { user: mockUser, title: '404' } },
  { file: '500.ejs', data: { user: mockUser, title: '500', error: new Error('Test') } },
  { file: '403.ejs', data: { user: mockUser, title: '403' } },
  { file: 'lichsudatve.ejs (has tickets)', target: 'lichsudatve.ejs', data: { user: mockUser, tickets: [mockTicket] } },
  { file: 'lichsudatve.ejs (empty tickets - no dune)', target: 'lichsudatve.ejs', data: { user: mockUser, tickets: [] } },
  { file: 'thongtincanhan.ejs (admin)', target: 'thongtincanhan.ejs', data: { user: mockUser, vouchers: [mockVoucher], savedVouchers: [mockVoucher] } },
  { file: 'thongtincanhan.ejs (new user 0 points)', target: 'thongtincanhan.ejs', data: { user: { hoTen: 'Linh Nguyễn', email: 'linh@example.com', diemTichLuy: 0, hangHoiVien: 'Dong', favoriteGenres: [] }, vouchers: [], savedVouchers: [] } },
  { file: 'trangkhuyenmai.ejs', data: { user: mockUser, vouchers: [mockVoucher] } },
  { file: 'trangbapnuoc.ejs', data: { user: mockUser } },
  { file: 'trangflashsale.ejs (with active sale)', target: 'trangflashsale.ejs', data: { user: mockUser, activeSales: [mockFlashSale], upcomingSales: [] } },
  { file: 'trangflashsale.ejs (empty sales)', target: 'trangflashsale.ejs', data: { user: mockUser, activeSales: [], upcomingSales: [] } },
  { file: 'trangtimkiem.ejs', data: { user: mockUser, movies: [mockMovie], tuKhoa: 'Dune' } },
  { file: 'trangdanhgia.ejs', data: { user: mockUser } },
  { file: 'trangdangnhap.ejs', data: { user: null } },
  { file: 'trangdangky.ejs', data: { user: null } },
  { file: 'trangquenmkhau.ejs', data: { user: null } },
  { file: 'trangdatlaimk.ejs', data: { user: null, token: 'demo-token-123456' } },
  { file: 'admin-dashboard.ejs', data: { user: mockUser, stats: { totalMovies: 4, totalTickets: 125, revenue: 12500000, newUsers: 48 }, topMovies: [{ title: 'Dune 2', posterUrl: mockMovie.posterUrl, totalSold: 85 }], recentTickets: [mockTicket], currentFilter: 'all' } },
  { file: 'admin-quanlyphim.ejs', data: { user: mockUser, movies: [mockMovie] } },
  { file: 'admin-themphim.ejs', data: { user: mockUser } },
  { file: 'admin-suaphim.ejs', data: { user: mockUser, phim: mockMovie } },
  { file: 'admin-quanlyrap.ejs', data: { user: mockUser, cinemas: [mockCinema] } },
  { file: 'admin-quanlysuatchieu.ejs', data: { user: mockUser } },
  { file: 'admin-sodoghe.ejs', data: { user: mockUser } },
  { file: 'admin-quanlycombo.ejs', data: { user: mockUser } },
  { file: 'admin-khuyenmai.ejs (voucher tab)', target: 'admin-khuyenmai.ejs', data: { user: mockUser, vouchers: [mockVoucher], flashSales: [mockFlashSale], movies: [mockMovie], tab: 'voucher' } },
  { file: 'admin-khuyenmai.ejs (flashsale tab)', target: 'admin-khuyenmai.ejs', data: { user: mockUser, vouchers: [mockVoucher], flashSales: [mockFlashSale], movies: [mockMovie], tab: 'flashsale' } },
  { file: 'admin-quanlynguoidung.ejs', data: { user: mockUser, users: [mockUser] } },
  { file: 'admin-quanlygiaodich.ejs', data: { user: mockUser } },
  { file: 'admin-baocaodoanhthu.ejs', data: { user: mockUser } }
];

let errors = 0;
let success = 0;

for (let p of pagesToTest) {
  const targetFile = p.target || p.file;
  const filePath = path.join(viewsDir, targetFile);
  try {
    const html = ejs.render(fs.readFileSync(filePath, 'utf8'), p.data, {
      filename: filePath,
      views: [viewsDir]
    });
    console.log(`[PASS] ${p.file} (HTML Length: ${html.length})`);
    success++;
  } catch (err) {
    console.error(`[FAIL] ${p.file}:`, err.message);
    errors++;
  }
}

console.log(`\n================================`);
console.log(`TEST COMPLETED: ${success} passed, ${errors} failed.`);
console.log(`================================`);
process.exit(errors > 0 ? 1 : 0);
