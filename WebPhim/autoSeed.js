// File: autoSeed.js
const bcrypt = require('bcrypt');
const Movie = require('./models/Movie');
const User = require('./models/User');
const Cinema = require('./models/Cinema');
const SeatConfig = require('./models/SeatConfig');
const FoodCombo = require('./models/FoodCombo');
const Voucher = require('./models/Voucher');

async function autoSeedDatabase() {
    try {
        const movieCount = await Movie.countDocuments();
        if (movieCount > 0) {
            console.log(`[AUTO-SEED] Đã có ${movieCount} phim trong database, bỏ qua bước khởi tạo mẫu.`);
            return;
        }

        console.log('[AUTO-SEED] Database mới chưa có dữ liệu. Đang tự động nạp dữ liệu mẫu ban đầu...');

        // 1. TẠO TÀI KHOẢN ADMIN MẪU
        const adminExists = await User.findOne({ email: 'admin@cinego.vn' });
        if (!adminExists) {
            const hashedAdminPass = await bcrypt.hash('admin123', 10);
            await User.create({
                hoTen: 'Quản Trị Viên CineGo',
                email: 'admin@cinego.vn',
                matKhau: hashedAdminPass,
                soDienThoai: '0901234567',
                vaiTro: 'admin',
                diemTichLuy: 500,
                hangHoiVien: 'KimCuong'
            });
            console.log('  ✓ Đã tạo tài khoản Admin mặc định: admin@cinego.vn / admin123');
        }

        // 2. TẠO CẤU HÌNH GHẾ MẶC ĐỊNH
        const seatConfigExists = await SeatConfig.findOne();
        if (!seatConfigExists) {
            await SeatConfig.create({
                cinema: 'all',
                rows: 6,
                cols: 10,
                priceStandard: 75000,
                priceVIP: 95000,
                priceCouple: 170000,
                seatMatrix: {}
            });
            console.log('  ✓ Đã tạo cấu hình sơ đồ ghế và giá vé.');
        }

        // 3. TẠO CỤM RẠP MẪU
        const cinemaCount = await Cinema.countDocuments();
        if (cinemaCount === 0) {
            await Cinema.create([
                {
                    name: 'CGV Vincom Đồng Khởi',
                    code: 'CGV-DONGKHOI',
                    location: 'Tầng 3, TTTM Vincom Center, 72 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM',
                    phone: '1900 6017',
                    openingHours: '08:30 — 23:30',
                    totalSeats: 350,
                    rooms: [
                        { name: 'Cinema 01', totalSeats: 70, format: '2D Laser Digital' },
                        { name: 'Cinema 02 VIP', totalSeats: 60, format: '2D Premium' }
                    ]
                },
                {
                    name: 'CGV Landmark 81',
                    code: 'CGV-LANDMARK81',
                    location: 'Tầng B1, Vincom Center Landmark 81, 720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP.HCM',
                    phone: '1900 6017',
                    openingHours: '08:30 — 23:30',
                    totalSeats: 400,
                    rooms: [
                        { name: 'IMAX Laser', totalSeats: 120, format: 'IMAX with Laser' },
                        { name: 'Cinema 03', totalSeats: 70, format: '2D Laser Digital' }
                    ]
                },
                {
                    name: 'CGV Hùng Vương Plaza',
                    code: 'CGV-HUNGVUONG',
                    location: 'Tầng 7, 126 Hồng Bàng, Phường 12, Quận 5, TP.HCM',
                    phone: '1900 6017',
                    openingHours: '08:30 — 23:30',
                    totalSeats: 300,
                    rooms: [
                        { name: 'Cinema 01', totalSeats: 70, format: '2D Laser Digital' }
                    ]
                }
            ]);
            console.log('  ✓ Đã tạo danh sách cụm rạp.');
        }

        // 4. TẠO DANH SÁCH PHIM MẪU
        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        await Movie.create([
            {
                title: 'Dune: Hành Tinh Cát (Phần Hai)',
                genre: 'Khoa Học Viễn Tưởng, Hành Động',
                director: 'Denis Villeneuve',
                duration: 166,
                releaseDate: new Date('2026-11-01'),
                ageRating: 'T16',
                price: 75000,
                originalPrice: 95000,
                status: 'DangChieu',
                posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
                trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
                description: 'Paul Atreides hợp lực cùng Chani và tộc người Fremen để trả thù những kẻ đã hủy diệt gia tộc mình, đối mặt với sự lựa chọn giữa tình yêu và số phận vũ trụ.',
                showtimes: [
                    {
                        cinema: 'CGV Vincom Đồng Khởi',
                        room: 'Cinema 01',
                        date: todayStr,
                        times: ['10:00', '13:30', '16:45', '19:30', '21:45']
                    },
                    {
                        cinema: 'CGV Landmark 81',
                        room: 'IMAX Laser',
                        date: todayStr,
                        times: ['14:00', '18:00', '21:15']
                    },
                    {
                        cinema: 'CGV Vincom Đồng Khởi',
                        room: 'Cinema 01',
                        date: tomorrowStr,
                        times: ['13:30', '19:30']
                    }
                ]
            },
            {
                title: 'Mai',
                genre: 'Tâm Lý, Tình Cảm',
                director: 'Trấn Thành',
                duration: 131,
                releaseDate: new Date('2026-11-05'),
                ageRating: 'T18',
                price: 75000,
                originalPrice: 90000,
                status: 'DangChieu',
                posterUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80',
                trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
                description: 'Mai - người phụ nữ massage gần 40 tuổi mang nhiều tổn thương quá khứ - vô tình gặp gỡ chàng trai trẻ lãng tử Dương kém cô 7 tuổi.',
                showtimes: [
                    {
                        cinema: 'CGV Vincom Đồng Khởi',
                        room: 'Cinema 02 VIP',
                        date: todayStr,
                        times: ['11:15', '15:00', '18:30', '21:00']
                    },
                    {
                        cinema: 'CGV Hùng Vương Plaza',
                        room: 'Cinema 01',
                        date: todayStr,
                        times: ['14:30', '19:00', '21:30']
                    }
                ]
            },
            {
                title: 'Kung Fu Panda 4',
                genre: 'Hoạt Hình, Phiêu Lưu, Hài',
                director: 'Mike Mitchell',
                duration: 94,
                releaseDate: new Date('2026-11-10'),
                ageRating: 'P',
                price: 70000,
                originalPrice: 85000,
                status: 'DangChieu',
                posterUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80',
                trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
                description: 'Gấu Po được chọn trở thành Thủ lĩnh Tinh thần của Thung lũng Bình Yên và phải huấn luyện một Chiến binh Rồng mới trong khi đối mặt với Tắc Kè Bông biến hình nguy hiểm.',
                showtimes: [
                    {
                        cinema: 'CGV Landmark 81',
                        room: 'Cinema 03',
                        date: todayStr,
                        times: ['09:30', '11:45', '14:15', '16:30', '19:00']
                    }
                ]
            },
            {
                title: 'Deadpool & Wolverine',
                genre: 'Hành Động, Siêu Anh Hùng, Hài',
                director: 'Shawn Levy',
                duration: 127,
                releaseDate: new Date('2026-12-01'),
                ageRating: 'T18',
                price: 85000,
                originalPrice: 100000,
                status: 'SapChieu',
                posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
                trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
                description: 'Tổ chức TVA kéo Wade Wilson ra khỏi cuộc sống bình lặng để tham gia một nhiệm vụ sinh tử bảo vệ vũ trụ cùng Người Sói Wolverine đầy cộc cằn.',
                showtimes: []
            },
            {
                title: 'Joker: Folie à Deux',
                genre: 'Tội Phạm, Tâm Lý, Âm Nhạc',
                director: 'Todd Phillips',
                duration: 138,
                releaseDate: new Date('2026-12-15'),
                ageRating: 'T18',
                price: 85000,
                originalPrice: 100000,
                status: 'SapChieu',
                posterUrl: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=800&q=80',
                trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
                description: 'Arthur Fleck bị giam giữ tại Arkham chờ xét xử, nơi anh tìm thấy tình yêu đích thực cùng Harley Quinn và bộc lộ âm nhạc bên trong tâm hồn điên loạn.',
                showtimes: []
            }
        ]);
        console.log('  ✓ Đã tạo danh sách phim đang chiếu & sắp chiếu.');

        // 5. TẠO BẮP NƯỚC COMBO MẪU
        const comboCount = await FoodCombo.countDocuments();
        if (comboCount === 0) {
            await FoodCombo.create([
                {
                    name: 'Combo Đôi CineGo',
                    category: 'combo',
                    price: 99000,
                    originalPrice: 120000,
                    description: '1 Bắp lớn (Vị Tùy Chọn) + 2 Nước ngọt tươi mát lạnh cỡ lớn.',
                    imageUrl: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=400&q=80',
                    badge: 'Bán Chạy Nhất',
                    flavors: ['Phô Mai', 'Caramel', 'Ngọt', 'Mặn']
                },
                {
                    name: 'Combo Đơn Tiết Kiệm',
                    category: 'combo',
                    price: 65000,
                    originalPrice: 80000,
                    description: '1 Bắp vừa + 1 Nước ngọt tươi mát lạnh.',
                    imageUrl: 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=400&q=80',
                    badge: 'Phổ Biến',
                    flavors: ['Phô Mai', 'Caramel', 'Ngọt']
                },
                {
                    name: 'Bắp Rang Bơ Caramel Thượng Hạng',
                    category: 'popcorn',
                    price: 49000,
                    originalPrice: 59000,
                    description: 'Bắp rang ngập vị Caramel béo ngậy giòn tan.',
                    imageUrl: 'https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?auto=format&fit=crop&w=400&q=80',
                    badge: '',
                    flavors: ['Caramel']
                },
                {
                    name: 'Coca-Cola Tươi Cỡ Lớn',
                    category: 'drink',
                    price: 32000,
                    originalPrice: 38000,
                    description: 'Nước ngọt Coca-Cola mát lạnh sảng khoái (32oz).',
                    imageUrl: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=400&q=80',
                    badge: '',
                    flavors: []
                }
            ]);
            console.log('  ✓ Đã tạo danh sách bắp nước.');
        }

        // 6. TẠO VOUCHER MẪU
        const voucherCount = await Voucher.countDocuments();
        if (voucherCount === 0) {
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            await Voucher.create([
                {
                    code: 'CINEGO20',
                    title: 'Giảm 20.000đ Cho Vé Đầu Tiên',
                    description: 'Áp dụng cho mọi hóa đơn đặt vé xem phim trên website.',
                    discountType: 'fixed',
                    discountValue: 20000,
                    minOrderValue: 70000,
                    maxDiscountValue: 20000,
                    pointCost: 50,
                    expiryDate: nextYear,
                    isActive: true
                },
                {
                    code: 'WELCOME50',
                    title: 'Ưu Đãi Tân Binh — Giảm 50.000đ',
                    description: 'Dành riêng cho khách hàng mới đặt vé từ 150.000đ.',
                    discountType: 'fixed',
                    discountValue: 50000,
                    minOrderValue: 150000,
                    maxDiscountValue: 50000,
                    pointCost: 100,
                    expiryDate: nextYear,
                    isActive: true
                }
            ]);
            console.log('  ✓ Đã tạo các mã Voucher khuyến mãi mẫu.');
        }

        console.log('🎉 [AUTO-SEED] ĐÃ HOÀN TẤT KHỞI TẠO CƠ SỞ DỮ LIỆU BAN ĐẦU!');
    } catch (error) {
        console.error('⚠️ [AUTO-SEED] Lỗi khi tạo dữ liệu ban đầu:', error.message);
    }
}

module.exports = autoSeedDatabase;
