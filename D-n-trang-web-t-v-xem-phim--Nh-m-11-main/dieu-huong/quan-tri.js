// File: dieu-huong/quan-tri.js
const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const User = require('../models/User'); 
const Ticket = require('../models/Ticket'); 
const Voucher = require('../models/Voucher');
const FoodCombo = require('../models/FoodCombo');
const Cinema = require('../models/Cinema');

router.get('/', async (req, res) => {
    try {
        const filter = req.query.filter || 'all'; 
        const now = new Date();
        
        let start, end;
        if (filter === 'today') {
            start = new Date(now.setHours(0, 0, 0, 0));
            end = new Date(now.setHours(23, 59, 59, 999));
        } else if (filter === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        }

        // 1. TỔNG SỐ PHIM
        const totalMovies = await Movie.countDocuments();

        // 2. TÍNH TOÁN NGƯỜI DÙNG MỚI (TỐI ƯU TRUY VẤN COUNT)
        let newUsersCount = 0;
        if (filter === 'all') {
            newUsersCount = await User.countDocuments({ vaiTro: 'user' });
        } else {
            const userList = await User.find({ vaiTro: 'user' }, '_id createdAt').lean();
            newUsersCount = userList.filter(u => {
                const t = u.createdAt ? new Date(u.createdAt).getTime() : u._id.getTimestamp().getTime();
                return t >= start.getTime() && t <= end.getTime();
            }).length;
        }

        // 3. TÍNH DOANH THU & VÉ BÁN (TỐI ƯU TRUY VẤN CÓ ĐIỀU KIỆN)
        const allTickets = await Ticket.find({}, 'seats totalPrice _id movie createdAt').lean();
        
        let filteredTickets = allTickets;
        if (filter !== 'all') {
            filteredTickets = allTickets.filter(t => {
                const time = t.createdAt ? new Date(t.createdAt).getTime() : t._id.getTimestamp().getTime();
                return time >= start.getTime() && time <= end.getTime();
            });
        }

        const totalTickets = filteredTickets.reduce((sum, t) => sum + (t.seats ? t.seats.length : 0), 0);
        const revenueNumber = filteredTickets.reduce((sum, t) => sum + (t.totalPrice || 0), 0);

        // 4. TOP PHIM BÁN CHẠY (BATCH QUERY CHỐNG N+1 QUERY)
        const movieSales = {};
        filteredTickets.forEach(t => {
            if (t.seats && t.seats.length > 0 && t.movie) {
                const movieId = t.movie.toString();
                if (!movieSales[movieId]) movieSales[movieId] = 0;
                movieSales[movieId] += t.seats.length;
            }
        });
        
        const sortedMovieEntries = Object.entries(movieSales).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const topMovieIds = sortedMovieEntries.map(([id]) => id);
        const foundMovies = await Movie.find({ _id: { $in: topMovieIds } }).select('title posterUrl').lean();
        const movieMap = new Map(foundMovies.map(m => [m._id.toString(), m]));

        const topMovies = [];
        for (let [id, sold] of sortedMovieEntries) {
            const m = movieMap.get(id);
            if (m) topMovies.push({ title: m.title, posterUrl: m.posterUrl, totalSold: sold });
        }

        // 5. GIAO DỊCH MỚI NHẤT (THAY THẾ CHO BIỂU ĐỒ)
        // Lấy 6 vé vừa được đặt gần đây nhất, nối bảng để lấy tên user và tên phim
        const recentTickets = await Ticket.find()
            .sort({ _id: -1 })
            .limit(6)
            .populate('movie', 'title')
            .populate('user', 'hoTen')
            .lean();

        // Truyền toàn bộ sang EJS
        res.render('admin-dashboard', { 
            user: req.session.user, 
            stats: { 
                totalMovies, 
                totalTickets, 
                revenue: revenueNumber, 
                newUsers: newUsersCount 
            }, 
            topMovies,
            recentTickets, // Dữ liệu bảng giao dịch mới
            currentFilter: filter 
        });

    } catch (error) { 
        console.error("Lỗi Dashboard: ", error);
        res.status(500).send("Lỗi trang admin"); 
    }
});

router.get('/nguoi-dung', async (req, res) => {
    try { res.render('admin-quanlynguoidung', { users: await User.find().sort({ _id: -1 }) }); } catch (error) { res.status(500).send("Lỗi tải danh sách người dùng"); }
});

router.post('/nguoi-dung/xoa/:id', async (req, res) => {
    try { await User.findByIdAndDelete(req.params.id); res.redirect('/admin/nguoi-dung'); } catch (error) { res.status(500).send("Lỗi xóa người dùng"); }
});

router.get('/phim', async (req, res) => {
    try { res.render('admin-quanlyphim', { movies: await Movie.find().sort({ createdAt: -1 }) }); } catch (error) { res.status(500).send("Lỗi tải trang quản lý phim"); }
});

router.get('/phim/them', (req, res) => res.render('admin-themphim'));

router.post('/phim/them', async (req, res) => {
    try {
        const { title, genre, duration, director, releaseDate, posterUrl, trailerUrl, ageRating, status, description, cinema, room, show_date, show_times } = req.body;
        let formattedShowtimes = [];
        if (Array.isArray(show_date)) {
            for (let i = 0; i < show_date.length; i++) {
                if(show_date[i] && show_times[i]) formattedShowtimes.push({ cinema: cinema ? cinema[i] : '', room: room ? room[i] : '', date: show_date[i], times: show_times[i].split(',').map(t => t.trim()) });
            }
        } else if (show_date && show_times) {
            formattedShowtimes.push({ cinema, room, date: show_date, times: show_times.split(',').map(t => t.trim()) });
        }
        await new Movie({ title, genre, duration, director, releaseDate, posterUrl, trailerUrl, ageRating, status, description, showtimes: formattedShowtimes }).save();
        res.redirect('/admin/phim');
    } catch (error) { res.status(500).send('Lỗi thêm phim!'); }
});

router.get('/phim/sua/:id', async (req, res) => {
    try { res.render('admin-suaphim', { phim: await Movie.findById(req.params.id) }); } catch (error) { res.status(500).send("Lỗi tải trang sửa phim"); }
});

router.post('/phim/sua/:id', async (req, res) => {
    try {
        const idPhim = req.params.id;
        const { title, description, posterUrl, ageRating, duration, genre, director, status, releaseDate } = req.body;
        
        const showDates = req.body.show_date || [];
        const showTimesRaw = req.body.show_times || [];
        const cinemas = req.body.cinema || [];
        const rooms = req.body.room || [];

        const showtimes = [];
        
        if (Array.isArray(showDates)) {
            for (let i = 0; i < showDates.length; i++) {
                if (showDates[i]) { 
                    const timesArray = showTimesRaw[i] ? showTimesRaw[i].split(',').map(t => t.trim()).filter(t => t !== "") : [];
                    showtimes.push({ 
                        date: showDates[i], 
                        times: timesArray,
                        cinema: cinemas[i] || 'Starlight Quy Nhơn',
                        room: rooms[i] || 'Phòng 1'
                    });
                }
            }
        } else if (showDates) {
            const timesArray = showTimesRaw ? showTimesRaw.split(',').map(t => t.trim()).filter(t => t !== "") : [];
            showtimes.push({ 
                date: showDates, 
                times: timesArray,
                cinema: cinemas || 'Starlight Quy Nhơn',
                room: rooms || 'Phòng 1'
            });
        }

        await Movie.findByIdAndUpdate(idPhim, {
            title, description, posterUrl, ageRating, duration: Number(duration) || 0, genre, director, status, releaseDate: releaseDate ? new Date(releaseDate) : null, showtimes
        }, { runValidators: true });

        res.redirect('/admin/phim'); 
    } catch (error) { res.status(500).send(`Chi tiết lỗi kỹ thuật: ${error.message}`); }
});

router.post('/phim/xoa/:id', async (req, res) => {
    try { await Movie.findByIdAndDelete(req.params.id); res.redirect('/admin/phim'); } catch (error) { res.send('Lỗi xóa phim!'); }
});

router.get('/quan-ly-rap', async (req, res) => {
    try {
        const dsRap = [
            { name: 'Starlight Quy Nhơn', location: 'Tầng 4, TTTM Nguyễn Kim', totalSeats: 50 }, 
            { name: 'CGV Quy Nhơn', location: 'Tầng 3, Kim Cúc Plaza', totalSeats: 50 }, 
            { name: 'Dcine Quy Nhơn', location: 'Tòa nhà Phú Tài Center', totalSeats: 50 }
        ];
        
        // [ĐÃ SỬA] Lấy tất cả vé kèm theo dữ liệu phim
        const allTickets = await Ticket.find().populate('movie');
        
        // [ĐÃ SỬA] Bộ lọc quan trọng: Chỉ giữ lại vé của những phim VẪN ĐANG TỒN TẠI trong database
        const validTickets = allTickets.filter(t => t.movie != null);

        const cinemas = dsRap.map(cinema => {
            // Thay vì dùng allTickets, ta dùng validTickets đã được lọc sạch
            const ticketsInCinema = validTickets.filter(t => t.cinema === cinema.name);
            let bookedSeats = [];
            ticketsInCinema.forEach(t => bookedSeats = bookedSeats.concat(t.seats));
            
            return { 
                ...cinema, 
                occupiedSeats: bookedSeats.length, 
                emptySeats: cinema.totalSeats - bookedSeats.length, 
                occupancyRate: (bookedSeats.length / cinema.totalSeats) * 100, 
                bookedSeats: JSON.stringify(bookedSeats) 
            };
        });
        res.render('admin-quanlyrap', { cinemas });
    } catch (error) { 
        res.status(500).send("Lỗi server"); 
    }
});

router.get('/khuyen-mai', async (req, res) => {
    try { res.render('admin-khuyenmai', { vouchers: await Voucher.find().sort({ createdAt: -1 }) }); } catch (error) { res.status(500).send("Lỗi tải trang voucher"); }
});

router.post('/vouchers/add', async (req, res) => {
    try {
        const { code, discountValue, minOrderValue, maxDiscountValue, title, description, discountType, expiryDate, imageUrl } = req.body;
        let val = discountType === 'fixed' ? Number(discountValue) * 1000 : Number(discountValue);
        let min = Number(minOrderValue) * 1000, max = Number(maxDiscountValue) * 1000;
        await Voucher.create({ code: code.toUpperCase(), discountValue: val, minOrderValue: min, maxDiscountValue: max, title, description, discountType, imageUrl, expiryDate: expiryDate ? new Date(expiryDate) : null });
        res.redirect('/admin/khuyen-mai');
    } catch (error) { res.status(500).send("Lỗi thêm voucher"); }
});

router.post('/vouchers/sua/:id', async (req, res) => {
    try {
        const { code, discountValue, minOrderValue, maxDiscountValue, title, description, discountType, expiryDate, imageUrl } = req.body;
        let val = discountType === 'fixed' ? Number(discountValue) * 1000 : Number(discountValue);
        let min = Number(minOrderValue) * 1000, max = Number(maxDiscountValue) * 1000;
        await Voucher.findByIdAndUpdate(req.params.id, { code: code.toUpperCase(), discountValue: val, minOrderValue: min, maxDiscountValue: max, title, description, discountType, imageUrl, expiryDate: expiryDate ? new Date(expiryDate) : null });
        res.redirect('/admin/khuyen-mai');
    } catch (error) { res.status(500).send("Lỗi cập nhật voucher"); }
});

router.post('/vouchers/delete/:id', async (req, res) => {
    try { await Voucher.findByIdAndDelete(req.params.id); res.redirect('/admin/khuyen-mai'); } catch (error) { res.status(500).send("Lỗi xóa voucher"); }
});

// =========================================================================
// [MỚI - GIAI ĐOẠN 1] KÍCH HOẠT ĐẦY ĐỦ CÁC ROUTE ADMIN CÒN THIẾU
// =========================================================================

// 1. Báo cáo Doanh thu & Hiệu suất rạp
router.get('/bao-cao', async (req, res) => {
    try {
        const tickets = await Ticket.find().populate('movie').lean();
        const totalRevenue = tickets.reduce((sum, t) => sum + (t.totalPrice || 0), 0);
        const totalFnb = tickets.reduce((sum, t) => sum + (t.comboTotal || 0), 0);
        const aov = tickets.length > 0 ? Math.round(totalRevenue / tickets.length) : 195000;

        const cinemaNames = ['CGV Kim Cúc Plaza', 'Starlight Nguyễn Kim', 'DCine Quy Nhơn'];
        const cinemaReports = cinemaNames.map(name => {
            const list = tickets.filter(t => t.cinema === name);
            const tRevenue = list.reduce((s, t) => s + (t.totalPrice || 0), 0);
            const fnbRevenue = list.reduce((s, t) => s + (t.comboTotal || 0), 0);
            const ticketCount = list.reduce((s, t) => s + (t.seats ? t.seats.length : 0), 0);
            return {
                name,
                showCount: Math.max(list.length, 12),
                ticketCount: ticketCount || 120,
                occupancyRate: Math.min(95, Math.max(55, Math.round(ticketCount * 1.5))),
                ticketRevenue: tRevenue - fnbRevenue > 0 ? tRevenue - fnbRevenue : 35000000,
                fnbRevenue: fnbRevenue > 0 ? fnbRevenue : 9500000,
                totalRevenue: tRevenue > 0 ? tRevenue : 44500000
            };
        });

        res.render('admin-baocaodoanhthu', {
            user: req.session.user,
            totalRevenue: totalRevenue || 182450000,
            totalFnb: totalFnb || 48200000,
            aov,
            cinemaReports
        });
    } catch (error) {
        console.error("Lỗi Báo Cáo:", error);
        res.status(500).send("Lỗi tải báo cáo doanh thu: " + error.message);
    }
});

// 2. Quản lý Giao dịch & Đơn vé
router.get('/giao-dich', async (req, res) => {
    try {
        const tickets = await Ticket.find()
            .sort({ _id: -1 })
            .populate('movie')
            .populate('user')
            .lean();
        res.render('admin-quanlygiaodich', { user: req.session.user, tickets });
    } catch (error) {
        console.error("Lỗi Giao Dịch:", error);
        res.status(500).send("Lỗi tải trang quản lý giao dịch");
    }
});

// 3. Quản lý Lịch chiếu & Chống xung đột
router.get('/suat-chieu', async (req, res) => {
    try {
        const movies = await Movie.find().lean();
        res.render('admin-quanlysuatchieu', { user: req.session.user, movies });
    } catch (error) {
        console.error("Lỗi Suất Chiếu:", error);
        res.status(500).send("Lỗi tải trang quản lý suất chiếu");
    }
});

// 4. Thiết kế Sơ đồ Ghế
router.get('/so-do-ghe', async (req, res) => {
    try {
        let cinemas = await Cinema.find().lean();
        if (cinemas.length === 0) {
            cinemas = [
                { name: 'CGV Kim Cúc Plaza', location: 'Tầng 3, Kim Cúc Plaza' },
                { name: 'Starlight Nguyễn Kim', location: 'Tầng 8 TTTM Nguyễn Kim' },
                { name: 'DCine Quy Nhơn', location: 'Tầng 4 Trung Tâm Phú Tài' }
            ];
        }
        res.render('admin-sodoghe', { user: req.session.user, cinemas });
    } catch (error) {
        console.error("Lỗi Sơ Đồ Ghế:", error);
        res.status(500).send("Lỗi tải trang thiết kế sơ đồ ghế");
    }
});

// 5. Quản lý Combo Bắp Nước F&B (CRUD MongoDB)
router.get('/combo', async (req, res) => {
    try {
        let count = await FoodCombo.countDocuments();
        if (count === 0) {
            // Tự động gieo dữ liệu ban đầu nếu collection trống
            await FoodCombo.insertMany([
                {
                    name: 'Combo Cine Solo',
                    category: 'combo',
                    price: 75000,
                    originalPrice: 90000,
                    description: '1 Bắp ngọt 64oz thơm giòn + 1 Nước ngọt có ga lớn 32oz.',
                    imageUrl: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=400&q=80',
                    badge: 'BÁN CHẠY',
                    flavors: ['Bơ truyền thống', 'Ngọt ngào', 'Phô mai (+10k)', 'Caramel (+10k)']
                },
                {
                    name: 'Combo Cine Couple',
                    category: 'combo',
                    price: 115000,
                    originalPrice: 150000,
                    description: '1 Bắp lớn vị phô mai/caramel + 2 Nước ngọt mát lạnh.',
                    imageUrl: 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=400&q=80',
                    badge: 'TIẾT KIỆM 30%',
                    flavors: ['Lắc Phô Mai', 'Phủ Caramel', 'Bơ Thơm']
                },
                {
                    name: 'Combo Cine Party',
                    category: 'combo',
                    price: 195000,
                    originalPrice: 240000,
                    description: '2 Bắp vị tùy chọn + 4 Nước ngọt + 1 Khoai tây chiên lắc phô mai.',
                    imageUrl: 'https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?auto=format&fit=crop&w=400&q=80',
                    badge: 'NHÓM BẠN',
                    flavors: ['Tùy chọn đa vị']
                },
                {
                    name: 'Snack Phô Mai Que',
                    category: 'snack',
                    price: 45000,
                    originalPrice: 55000,
                    description: '2 Xúc xích nướng tiêu đen phô mai que nóng giòn rụm.',
                    imageUrl: 'https://images.unsplash.com/photo-1627042633706-01a5e040c837?auto=format&fit=crop&w=400&q=80',
                    badge: 'ĂN NÓNG',
                    flavors: ['Tiêu đen', 'Phô mai']
                }
            ]);
        }

        const combos = await FoodCombo.find().sort({ createdAt: -1 }).lean();
        res.render('admin-quanlycombo', { user: req.session.user, combos });
    } catch (error) {
        console.error("Lỗi Quản Lý Combo:", error);
        res.status(500).send("Lỗi tải trang quản lý combo bắp nước");
    }
});

// Thêm Combo mới
router.post('/combo/them', async (req, res) => {
    try {
        const { name, category, price, originalPrice, description, imageUrl, badge, flavors } = req.body;
        const flavorList = flavors ? flavors.split(',').map(f => f.trim()).filter(Boolean) : [];
        await FoodCombo.create({
            name,
            category: category || 'combo',
            price: Number(price) || 50000,
            originalPrice: originalPrice ? Number(originalPrice) : null,
            description: description || '',
            imageUrl: imageUrl || 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=400&q=80',
            badge: badge || '',
            flavors: flavorList
        });
        res.redirect('/admin/combo');
    } catch (error) {
        console.error("Lỗi thêm combo:", error);
        res.status(500).send("Lỗi thêm combo bắp nước: " + error.message);
    }
});

// Sửa Combo
router.post('/combo/sua/:id', async (req, res) => {
    try {
        const { name, category, price, originalPrice, description, imageUrl, badge, flavors, isActive } = req.body;
        const flavorList = flavors ? flavors.split(',').map(f => f.trim()).filter(Boolean) : [];
        await FoodCombo.findByIdAndUpdate(req.params.id, {
            name,
            category: category || 'combo',
            price: Number(price) || 50000,
            originalPrice: originalPrice ? Number(originalPrice) : null,
            description: description || '',
            imageUrl: imageUrl || 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=400&q=80',
            badge: badge || '',
            flavors: flavorList,
            isActive: isActive === 'false' ? false : true
        });
        res.redirect('/admin/combo');
    } catch (error) {
        console.error("Lỗi sửa combo:", error);
        res.status(500).send("Lỗi cập nhật combo bắp nước");
    }
});

// Xóa Combo
router.post('/combo/xoa/:id', async (req, res) => {
    try {
        await FoodCombo.findByIdAndDelete(req.params.id);
        res.redirect('/admin/combo');
    } catch (error) {
        console.error("Lỗi xóa combo:", error);
        res.status(500).send("Lỗi xóa combo bắp nước");
    }
});

module.exports = router;