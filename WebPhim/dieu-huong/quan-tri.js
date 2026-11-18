// File: dieu-huong/quan-tri.js
const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const User = require('../models/User'); 
const Ticket = require('../models/Ticket'); 
const Voucher = require('../models/Voucher');
const FoodCombo = require('../models/FoodCombo');
const Cinema = require('../models/Cinema');
const FlashSale = require('../models/FlashSale');
const SeatConfig = require('../models/SeatConfig');

// Helper chuẩn hóa giờ chiếu: Luôn bảo đảm định dạng HH:mm có dấu : ở giữa (VD: 21 giờ -> 21:00, 21h -> 21:00, 21 -> 21:00)
function normalizeTimeSlot(t) {
    if (!t) return null;
    let s = (t || '').toString().trim().toLowerCase();
    if (!s) return null;
    s = s.replace(/giờ|gio/g, 'h').replace(/\s+/g, '');
    let m = s.match(/^(\d{1,2})[h:.](\d{1,2})$/);
    if (m) {
        let h = parseInt(m[1], 10);
        let min = parseInt(m[2], 10);
        if (h <= 23 && min <= 59) {
            return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
        }
    }
    m = s.match(/^(\d{1,2})h?$/);
    if (m) {
        let h = parseInt(m[1], 10);
        if (h <= 23) {
            return String(h).padStart(2, '0') + ':00';
        }
    }
    if (/^\d{3,4}$/.test(s)) {
        const padded = s.padStart(4, '0');
        const h = parseInt(padded.slice(0, 2), 10);
        const min = parseInt(padded.slice(2), 10);
        if (h <= 23 && min <= 59) {
            return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
        }
    }
    return t.trim();
}

// Helper tính toán doanh số thực tế của đơn vé (kể cả khi khách dùng voucher giảm 100% về 0đ hoặc giảm giá lớn)
function getTicketRevenue(t) {
    if (!t) return 0;
    const orig = Number(t.originalPrice) || 0;
    const tot = Number(t.totalPrice) || 0;
    const disc = Number(t.discountAmount) || 0;
    if (orig > 0) return orig;
    if (tot + disc > 0 && disc > 0) return tot + disc;
    if (tot > 0) return tot;
    // Tự động tính lại giá trị đơn nếu vé cũ chưa lưu originalPrice hoặc giảm về 0đ do voucher
    let seatSum = 0;
    if (Array.isArray(t.seats) && t.seats.length > 0) {
        t.seats.forEach(s => {
            const u = (s || '').toString().toUpperCase();
            if (u.startsWith('F')) seatSum += 170000;
            else if (u.startsWith('D') || u.startsWith('E')) seatSum += 95000;
            else seatSum += 75000;
        });
    }
    const cTotal = Number(t.comboTotal) || 0;
    const fallback = seatSum + cTotal;
    return fallback > 0 ? fallback : tot;
}

router.get('/', async (req, res) => {
    try {
        const filter = req.query.filter || 'all'; 
        const now = new Date();
        
        let start, end;
        if (filter === 'today') {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        } else if (filter === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
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

        // 3. TÍNH DOANH THU & VÉ BÁN (TỪ CƠ SỞ DỮ LIỆU THỰC TẾ)
        const allTickets = await Ticket.find({}, 'seats totalPrice originalPrice comboTotal cinema _id movie createdAt').populate('movie', 'title').lean();
        
        let filteredTickets = allTickets;
        if (filter !== 'all') {
            filteredTickets = allTickets.filter(t => {
                const time = t.createdAt ? new Date(t.createdAt).getTime() : t._id.getTimestamp().getTime();
                return time >= start.getTime() && time <= end.getTime();
            });
        }

        const totalTickets = filteredTickets.reduce((sum, t) => sum + (t.seats ? t.seats.length : 0), 0);
        const revenueNumber = filteredTickets.reduce((sum, t) => sum + getTicketRevenue(t), 0);

        // 4. TOP PHIM BÁN CHẠY (CHỈ LẤY PHIM CÓ PHÁT SINH VÉ THẬT)
        const movieSales = {};
        filteredTickets.forEach(t => {
            if (t.seats && t.seats.length > 0 && t.movie) {
                const movieId = (t.movie._id || t.movie).toString();
                if (!movieSales[movieId]) movieSales[movieId] = 0;
                movieSales[movieId] += t.seats.length;
            }
        });
        
        const sortedMovieEntries = Object.entries(movieSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const topMovieIds = sortedMovieEntries.map(([id]) => id);
        const foundMovies = await Movie.find({ _id: { $in: topMovieIds } }).select('title posterUrl genre').lean();
        const movieMap = new Map(foundMovies.map(m => [m._id.toString(), m]));

        const topMovies = [];
        for (let [id, sold] of sortedMovieEntries) {
            const m = movieMap.get(id);
            if (m) topMovies.push({ title: m.title, posterUrl: m.posterUrl, genre: m.genre, totalSold: sold });
        }

        // 5. TÍNH TOÁN DỮ LIỆU BIỂU ĐỒ 7 NGÀY GẦN NHẤT TỪ DB THỰC TẾ (KHÔNG DÙNG DỮ LIỆU ẢO)
        const chartLabels = [];
        const chartRevenueData = [];
        const chartTicketsData = [];
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
            chartLabels.push(dateStr);

            const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
            const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

            const dayTickets = allTickets.filter(t => {
                const time = t.createdAt ? new Date(t.createdAt).getTime() : t._id.getTimestamp().getTime();
                return time >= dayStart && time <= dayEnd;
            });

            const dayRev = dayTickets.reduce((sum, t) => sum + getTicketRevenue(t), 0);
            const daySeats = dayTickets.reduce((sum, t) => sum + (t.seats ? t.seats.length : 0), 0);

            // Đổi ra triệu đồng
            chartRevenueData.push(Number((dayRev / 1000000).toFixed(2)));
            chartTicketsData.push(daySeats);
        }

        // 6. TÍNH TOÁN TỶ TRỌNG DOANH THU 3 CỤM RẠP THỰC TẾ
        let cgvRev = 0;
        let starlightRev = 0;
        let dcineRev = 0;

        filteredTickets.forEach(t => {
            const cName = (t.cinema || '').toLowerCase();
            const price = getTicketRevenue(t);
            if (cName.includes('cgv')) cgvRev += price;
            else if (cName.includes('starlight')) starlightRev += price;
            else if (cName.includes('dcine') || cName.includes('d-cine')) dcineRev += price;
            else cgvRev += price;
        });

        const totalCinemaRev = cgvRev + starlightRev + dcineRev;
        let cinemaShare = { cgv: 0, starlight: 0, dcine: 0 };
        if (totalCinemaRev > 0) {
            cinemaShare.cgv = Math.round((cgvRev / totalCinemaRev) * 100);
            cinemaShare.starlight = Math.round((starlightRev / totalCinemaRev) * 100);
            cinemaShare.dcine = 100 - cinemaShare.cgv - cinemaShare.starlight;
        }

        // 7. GIAO DỊCH MỚI NHẤT (POPULATE CHUẨN XÁC VỚI TICKET SCHEMA)
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
            recentTickets,
            chartLabels,
            chartRevenueData,
            chartTicketsData,
            cinemaShare,
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
    try { 
        await User.findByIdAndDelete(req.params.id); 
        res.redirect('/admin/nguoi-dung?success=' + encodeURIComponent('Đã xóa người dùng khỏi hệ thống thành công!')); 
    } catch (error) { 
        res.redirect('/admin/nguoi-dung?error=' + encodeURIComponent('Lỗi xóa người dùng: ' + error.message)); 
    }
});

router.get('/phim', async (req, res) => {
    try { 
        res.render('admin-quanlyphim', { 
            movies: await Movie.find().sort({ createdAt: -1 }),
            action: req.query.action || req.query.tab || null,
            success: req.query.success || null,
            error: req.query.error || null
        }); 
    } catch (error) { res.status(500).send("Lỗi tải trang quản lý phim"); }
});

router.get('/phim/them', (req, res) => res.redirect('/admin/phim?action=them'));

router.post('/phim/them', async (req, res) => {
    try {
        const { title, genre, duration, director, releaseDate, posterUrl, trailerUrl, ageRating, status, description, cinema, room, show_date, show_times, price, originalPrice } = req.body;
        if (!title || !title.trim()) {
            return res.redirect('/admin/phim?action=them&error=' + encodeURIComponent('Vui lòng nhập tên phim!'));
        }

        let formattedShowtimes = [];
        if (Array.isArray(show_date)) {
            for (let i = 0; i < show_date.length; i++) {
                const cVal = Array.isArray(cinema) ? (cinema[i] || 'CGV Kim Cúc Plaza') : (cinema || 'CGV Kim Cúc Plaza');
                const rVal = Array.isArray(room) ? (room[i] || 'Phòng 1 (IMAX)') : (room || 'Phòng 1 (IMAX)');
                if (show_date[i] && show_times && show_times[i]) {
                    const timesParsed = show_times[i].split(',').map(normalizeTimeSlot).filter(Boolean);
                    if (timesParsed.length > 0) {
                        formattedShowtimes.push({
                            cinema: cVal,
                            room: rVal,
                            date: show_date[i],
                            times: timesParsed
                        });
                    }
                }
            }
        } else if (show_date && show_times) {
            const timesParsed = show_times.split(',').map(normalizeTimeSlot).filter(Boolean);
            if (timesParsed.length > 0) {
                formattedShowtimes.push({
                    cinema: cinema || 'CGV Kim Cúc Plaza',
                    room: room || 'Phòng 1 (IMAX)',
                    date: show_date,
                    times: timesParsed
                });
            }
        }

        const safeReleaseDate = (releaseDate && !isNaN(new Date(releaseDate).getTime())) ? new Date(releaseDate) : new Date();
        const safeDuration = Number(duration) || 120;
        const safePrice = Number(price) > 0 ? Number(price) : 75000;
        const safeOriginalPrice = Number(originalPrice) > 0 ? Number(originalPrice) : 95000;
        const safeFormat = (req.body.format && ['2D Standard', 'IMAX Laser', '3D Standard'].includes(req.body.format)) ? req.body.format : '2D Standard';

        await new Movie({ 
            title: title.trim(), 
            genre: genre ? genre.trim() : 'Điện ảnh', 
            duration: safeDuration, 
            director: director ? director.trim() : '', 
            releaseDate: safeReleaseDate, 
            posterUrl: posterUrl ? posterUrl.trim() : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80', 
            trailerUrl: trailerUrl ? trailerUrl.trim() : '', 
            ageRating: ageRating || 'T16', 
            price: safePrice,
            originalPrice: safeOriginalPrice,
            format: safeFormat,
            status: status || 'DangChieu', 
            description: description ? description.trim() : '', 
            showtimes: formattedShowtimes 
        }).save();

        res.redirect('/admin/phim?success=' + encodeURIComponent(`Đã thêm phim "${title.trim()}" vào hệ thống thành công!`));
    } catch (error) { 
        console.error("Lỗi thêm phim:", error);
        res.redirect('/admin/phim?action=them&error=' + encodeURIComponent('Lỗi thêm phim: ' + error.message)); 
    }
});

router.get('/phim/sua/:id', async (req, res) => {
    try { res.render('admin-suaphim', { phim: await Movie.findById(req.params.id) }); } catch (error) { res.status(500).send("Lỗi tải trang sửa phim"); }
});

router.post('/phim/sua/:id', async (req, res) => {
    try {
        const idPhim = req.params.id;
        const { title, description, posterUrl, trailerUrl, ageRating, duration, genre, director, status, releaseDate, price, originalPrice } = req.body;
        
        const showDates = req.body.show_date || [];
        const showTimesRaw = req.body.show_times || [];
        const cinemas = req.body.cinema || [];
        const rooms = req.body.room || [];

        const showtimes = [];
        
        if (Array.isArray(showDates)) {
            for (let i = 0; i < showDates.length; i++) {
                if (showDates[i]) { 
                    const timesArray = showTimesRaw[i] ? showTimesRaw[i].split(',').map(normalizeTimeSlot).filter(Boolean) : [];
                    const cVal = Array.isArray(cinemas) ? (cinemas[i] || 'Starlight Nguyễn Kim') : (cinemas || 'Starlight Nguyễn Kim');
                    const rVal = Array.isArray(rooms) ? (rooms[i] || 'Phòng 1 (IMAX)') : (rooms || 'Phòng 1 (IMAX)');
                    if (timesArray.length > 0) {
                        showtimes.push({ 
                            date: showDates[i], 
                            times: timesArray,
                            cinema: cVal,
                            room: rVal
                        });
                    }
                }
            }
        } else if (showDates) {
            const timesArray = showTimesRaw ? showTimesRaw.split(',').map(normalizeTimeSlot).filter(Boolean) : [];
            const cVal = Array.isArray(cinemas) ? (cinemas[0] || 'Starlight Nguyễn Kim') : (cinemas || 'Starlight Nguyễn Kim');
            const rVal = Array.isArray(rooms) ? (rooms[0] || 'Phòng 1 (IMAX)') : (rooms || 'Phòng 1 (IMAX)');
            if (timesArray.length > 0) {
                showtimes.push({ 
                    date: showDates, 
                    times: timesArray,
                    cinema: cVal,
                    room: rVal
                });
            }
        }

        const safePrice = Number(price) > 0 ? Number(price) : 75000;
        const safeOriginalPrice = Number(originalPrice) > 0 ? Number(originalPrice) : 95000;
        const safeFormat = (req.body.format && ['2D Standard', 'IMAX Laser', '3D Standard'].includes(req.body.format)) ? req.body.format : '2D Standard';

        await Movie.findByIdAndUpdate(idPhim, {
            title, 
            description, 
            posterUrl, 
            trailerUrl: trailerUrl ? trailerUrl.trim() : '',
            ageRating, 
            price: safePrice,
            originalPrice: safeOriginalPrice,
            format: safeFormat,
            duration: Number(duration) || 0, 
            genre, 
            director, 
            status, 
            releaseDate: releaseDate ? new Date(releaseDate) : null, 
            showtimes
        }, { runValidators: true });

        res.redirect('/admin/phim?success=' + encodeURIComponent(`Đã cập nhật thông tin tác phẩm "${title}" thành công!`)); 
    } catch (error) { 
        res.redirect('/admin/phim?error=' + encodeURIComponent(`Chi tiết lỗi kỹ thuật: ${error.message}`)); 
    }
});

router.post('/phim/xoa/:id', async (req, res) => {
    try { 
        await Movie.findByIdAndDelete(req.params.id); 
        res.redirect('/admin/phim?success=' + encodeURIComponent('Đã xóa phim khỏi danh mục hệ thống thành công!')); 
    } catch (error) { 
        res.redirect('/admin/phim?error=' + encodeURIComponent('Lỗi xóa phim: ' + error.message)); 
    }
});

router.get('/quan-ly-rap', (req, res) => res.redirect('/admin/so-do-ghe'));

router.get('/khuyen-mai', async (req, res, next) => {
    try { 
        const tab = req.query.tab || 'voucher';
        // Chỉ lấy những voucher do Admin trực tiếp quản lý/phát hành, không lấy các mã sinh ngẫu nhiên từ đổi điểm thưởng
        const vouchers = await Voucher.find({ isReward: { $ne: true } }).sort({ createdAt: -1 });
        const flashSales = await FlashSale.find().populate('movie').sort({ createdAt: -1 });
        const movies = await Movie.find().select('title posterUrl').sort({ title: 1 });
        res.render('admin-khuyenmai', { user: req.session.user, vouchers, flashSales, movies, tab }); 
    } catch (error) { next(error); }
});

router.post('/vouchers/add', async (req, res) => {
    try {
        const { code, discountValue, minOrderValue, maxDiscountValue, title, description, discountType, expiryDate, imageUrl, applicableTo } = req.body;
        let val = discountType === 'fixed' ? Number(discountValue) * 1000 : Number(discountValue);
        let min = Number(minOrderValue) * 1000, max = Number(maxDiscountValue) * 1000;
        await Voucher.create({ 
            code: code.toUpperCase(), 
            discountValue: val, 
            minOrderValue: min, 
            maxDiscountValue: max, 
            title, 
            description, 
            discountType, 
            imageUrl, 
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            applicableTo: applicableTo || 'all'
        });
        res.redirect('/admin/khuyen-mai?tab=voucher&success=' + encodeURIComponent(`Đã tạo mã voucher "${code.toUpperCase()}" thành công!`));
    } catch (error) { 
        res.redirect('/admin/khuyen-mai?tab=voucher&error=' + encodeURIComponent('Lỗi thêm voucher: ' + error.message)); 
    }
});

router.post('/vouchers/sua/:id', async (req, res) => {
    try {
        const { code, discountValue, minOrderValue, maxDiscountValue, title, description, discountType, expiryDate, imageUrl, applicableTo } = req.body;
        let val = discountType === 'fixed' ? Number(discountValue) * 1000 : Number(discountValue);
        let min = Number(minOrderValue) * 1000, max = Number(maxDiscountValue) * 1000;
        await Voucher.findByIdAndUpdate(req.params.id, { 
            code: code.toUpperCase(), 
            discountValue: val, 
            minOrderValue: min, 
            maxDiscountValue: max, 
            title, 
            description, 
            discountType, 
            imageUrl, 
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            applicableTo: applicableTo || 'all'
        });
        res.redirect('/admin/khuyen-mai?tab=voucher&success=' + encodeURIComponent(`Đã cập nhật thông tin voucher "${code.toUpperCase()}"!`));
    } catch (error) { 
        res.redirect('/admin/khuyen-mai?tab=voucher&error=' + encodeURIComponent('Lỗi cập nhật voucher: ' + error.message)); 
    }
});

router.post('/vouchers/delete/:id', async (req, res) => {
    try { 
        await Voucher.findByIdAndDelete(req.params.id); 
        res.redirect('/admin/khuyen-mai?tab=voucher&success=' + encodeURIComponent('Đã xóa voucher khỏi hệ thống!')); 
    } catch (error) { 
        res.redirect('/admin/khuyen-mai?tab=voucher&error=' + encodeURIComponent('Lỗi xóa voucher: ' + error.message)); 
    }
});

// [MỚI] QUẢN LÝ CÁC ĐỢT SĂN VÉ FLASH SALE (CHỦ ĐỘNG BẬT/TẮT TẠI ADMIN)
router.post('/flash-sale/add', async (req, res, next) => {
    try {
        const { title, movieId, cinema, salePrice, originalPrice, startTime, endTime, totalQuantity, voucherCode, description } = req.body;
        await FlashSale.create({
            title: title ? title.trim() : 'Săn Vé Đồng Giá Flash Sale',
            movie: movieId && mongoose.Types.ObjectId.isValid(movieId) ? movieId : null,
            cinema: cinema || 'Tất cả các rạp',
            salePrice: Number(salePrice) || 19000,
            originalPrice: Number(originalPrice) || 95000,
            startTime: startTime ? new Date(startTime) : new Date(),
            endTime: endTime ? new Date(endTime) : new Date(Date.now() + 2 * 3600 * 1000),
            totalQuantity: Number(totalQuantity) || 50,
            claimedQuantity: 0,
            voucherCode: (voucherCode ? voucherCode.trim() : 'FLASH19K').toUpperCase(),
            description: description ? description.trim() : '',
            isActive: true
        });
        res.redirect('/admin/khuyen-mai?tab=flashsale&success=' + encodeURIComponent('Đã tạo chương trình Flash Sale thành công!'));
    } catch (error) { 
        res.redirect('/admin/khuyen-mai?tab=flashsale&error=' + encodeURIComponent('Lỗi tạo Flash Sale: ' + error.message)); 
    }
});

router.post('/flash-sale/toggle/:id', async (req, res, next) => {
    try {
        const fs = await FlashSale.findById(req.params.id);
        if (fs) {
            fs.isActive = !fs.isActive;
            await fs.save();
        }
        res.redirect('/admin/khuyen-mai?tab=flashsale&success=' + encodeURIComponent('Đã cập nhật trạng thái hoạt động của Flash Sale!'));
    } catch (error) { 
        res.redirect('/admin/khuyen-mai?tab=flashsale&error=' + encodeURIComponent('Lỗi cập nhật Flash Sale: ' + error.message)); 
    }
});

router.post('/flash-sale/delete/:id', async (req, res, next) => {
    try {
        await FlashSale.findByIdAndDelete(req.params.id);
        res.redirect('/admin/khuyen-mai?tab=flashsale&success=' + encodeURIComponent('Đã xóa chương trình Flash Sale thành công!'));
    } catch (error) { 
        res.redirect('/admin/khuyen-mai?tab=flashsale&error=' + encodeURIComponent('Lỗi xóa Flash Sale: ' + error.message)); 
    }
});

// =========================================================================
// [MỚI - GIAI ĐOẠN 1] KÍCH HOẠT ĐẦY ĐỦ CÁC ROUTE ADMIN CÒN THIẾU
// =========================================================================

// 1. Báo cáo Doanh thu & Hiệu suất rạp (Dữ liệu thời gian thực từ MongoDB)
router.get('/bao-cao', async (req, res) => {
    try {
        const [tickets, movies] = await Promise.all([
            Ticket.find().populate('movie').lean(),
            Movie.find().lean()
        ]);

        const totalRevenue = tickets.reduce((sum, t) => sum + getTicketRevenue(t), 0);
        const totalFnb = tickets.reduce((sum, t) => sum + (t.comboTotal || 0), 0);
        const totalSeatsSold = tickets.reduce((sum, t) => sum + (t.seats && Array.isArray(t.seats) ? t.seats.length : 1), 0);
        const aov = tickets.length > 0 ? Math.round(totalRevenue / tickets.length) : 0;
        const avgSeatsPerOrder = tickets.length > 0 ? (totalSeatsSold / tickets.length).toFixed(1) : '0';

        const cinemaNames = ['CGV Kim Cúc Plaza', 'Starlight Nguyễn Kim', 'DCine Quy Nhơn'];
        const cinemaReports = cinemaNames.map(name => {
            // Đếm số suất chiếu thực tế từ danh sách phim trong MongoDB
            let showCount = 0;
            movies.forEach(m => {
                if (m.showtimes && Array.isArray(m.showtimes)) {
                    m.showtimes.forEach(st => {
                        if (st.cinema === name) {
                            showCount += (st.times && Array.isArray(st.times) ? st.times.length : 1);
                        }
                    });
                }
            });

            const list = tickets.filter(t => t.cinema === name);
            const tRevenue = list.reduce((s, t) => s + getTicketRevenue(t), 0);
            const fnbRevenue = list.reduce((s, t) => s + (t.comboTotal || 0), 0);
            const ticketRevenue = Math.max(0, tRevenue - fnbRevenue);
            const ticketCount = list.reduce((s, t) => s + (t.seats && Array.isArray(t.seats) ? t.seats.length : 1), 0);

            // Tỷ lệ lấp đầy tính theo số vé bán / sức chứa các suất chiếu (ước tính 70 ghế/suất)
            const roomCapacity = showCount > 0 ? showCount * 70 : (ticketCount > 0 ? ticketCount : 70);
            const occupancyRate = (ticketCount > 0 && roomCapacity > 0)
                ? Math.min(100, Math.round((ticketCount / roomCapacity) * 100))
                : 0;

            return {
                name,
                showCount,
                ticketCount,
                occupancyRate,
                ticketRevenue,
                fnbRevenue,
                totalRevenue: tRevenue
            };
        });

        res.render('admin-baocaodoanhthu', {
            user: req.session.user,
            totalRevenue,
            totalFnb,
            aov,
            avgSeatsPerOrder,
            cinemaReports
        });
    } catch (error) {
        console.error("Lỗi Báo Cáo:", error);
        res.status(500).send("Lỗi tải báo cáo doanh thu: " + error.message);
    }
});

// 2. Quản lý Giao dịch & Đơn vé (Dữ liệu thời gian thực từ MongoDB)
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
        res.status(500).send("Lỗi tải trang quản lý giao dịch: " + error.message);
    }
});

// Xóa giao dịch / Hủy vé (Cho phép Admin dọn dẹp các đơn vé thử nghiệm hoặc hoàn hủy)
router.post('/giao-dich/xoa/:id', async (req, res) => {
    try {
        await Ticket.findByIdAndDelete(req.params.id);
        res.redirect('/admin/giao-dich?success=' + encodeURIComponent('Đã xóa đơn vé giao dịch thành công!'));
    } catch (error) {
        console.error("Lỗi xóa đơn vé:", error);
        res.redirect('/admin/giao-dich?error=' + encodeURIComponent('Lỗi khi xóa đơn vé: ' + error.message));
    }
});

// 3. Quản lý Lịch chiếu & Chống xung đột (Dữ liệu thời gian thực từ MongoDB)
router.get('/suat-chieu', async (req, res) => {
    try {
        const movies = await Movie.find().lean();
        const showtimesList = [];
        movies.forEach(m => {
            if (m.showtimes && Array.isArray(m.showtimes)) {
                m.showtimes.forEach(st => {
                    const timesArr = Array.isArray(st.times) ? st.times : [st.times].filter(Boolean);
                    if (timesArr.length > 0) {
                        showtimesList.push({
                            movieTitle: m.title,
                            cinema: st.cinema,
                            room: st.room,
                            date: st.date,
                            times: timesArr.join(', '),
                            duration: m.duration || 120
                        });
                    }
                });
            }
        });

        res.render('admin-quanlysuatchieu', {
            user: req.session.user,
            movies,
            showtimesList
        });
    } catch (error) {
        console.error("Lỗi Suất Chiếu:", error);
        res.status(500).send("Lỗi tải trang quản lý suất chiếu");
    }
});

// 4. Thiết kế Sơ đồ Ghế & Định Giá Vé Từng Loại Ghế (CRUD MongoDB)
router.get('/so-do-ghe', async (req, res) => {
    try {
        let cinemas = await Cinema.find().lean();
        if (cinemas.length === 0) {
            cinemas = [
                { name: 'CGV Kim Cúc Plaza', location: 'Tầng 3, Kim Cúc Plaza' },
                { name: 'Starlight Nguyễn Kim', location: 'Tầng 4 TTTM Nguyễn Kim, 06 Trần Phú' },
                { name: 'DCine Quy Nhơn', location: 'Ngã ba Đống Đa, P. Thị Nại, TP. Quy Nhơn' }
            ];
        }
        let seatConfig = await SeatConfig.findOne().lean();
        if (!seatConfig) {
            const created = await new SeatConfig({
                rows: 6,
                cols: 10,
                priceStandard: 75000,
                priceVIP: 95000,
                priceCouple: 170000
            }).save();
            seatConfig = created.toObject();
        }
        res.render('admin-sodoghe', { 
            user: req.session.user, 
            cinemas, 
            seatConfig,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error("Lỗi Sơ Đồ Ghế:", error);
        res.status(500).send("Lỗi tải trang thiết kế sơ đồ ghế");
    }
});

router.post('/so-do-ghe', async (req, res) => {
    try {
        const { rows, cols, priceStandard, priceVIP, priceCouple, seatMatrix } = req.body;
        const rNum = Math.max(1, Math.min(26, Number(rows) || 6));
        const cNum = Math.max(1, Math.min(30, Number(cols) || 10));
        const pStd = Math.max(0, Number(priceStandard) || 75000);
        const pVIP = Math.max(0, Number(priceVIP) || 95000);
        const pCouple = Math.max(0, Number(priceCouple) || 170000);

        let parsedMatrix = {};
        if (typeof seatMatrix === 'string' && seatMatrix.trim()) {
            try { parsedMatrix = JSON.parse(seatMatrix); } catch(e) {}
        } else if (typeof seatMatrix === 'object' && seatMatrix !== null) {
            parsedMatrix = seatMatrix;
        }

        let cfg = await SeatConfig.findOne();
        if (!cfg) {
            cfg = new SeatConfig({
                rows: rNum,
                cols: cNum,
                priceStandard: pStd,
                priceVIP: pVIP,
                priceCouple: pCouple,
                seatMatrix: parsedMatrix
            });
        } else {
            cfg.rows = rNum;
            cfg.cols = cNum;
            cfg.priceStandard = pStd;
            cfg.priceVIP = pVIP;
            cfg.priceCouple = pCouple;
            if (Object.keys(parsedMatrix).length > 0) {
                cfg.seatMatrix = parsedMatrix;
            }
        }
        await cfg.save();

        if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
            return res.json({ success: true, message: 'Đã lưu cấu hình sơ đồ ghế và giá vé thành công!', cfg });
        }
        res.redirect('/admin/so-do-ghe?success=' + encodeURIComponent('Đã lưu cấu hình số hàng ghế và giá vé thành công!'));
    } catch (err) {
        console.error('Lỗi lưu sơ đồ ghế:', err);
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
            return res.status(500).json({ success: false, message: err.message });
        }
        res.redirect('/admin/so-do-ghe?error=' + encodeURIComponent(err.message));
    }
});

// 5. Quản lý Combo Bắp Nước F&B (CRUD MongoDB)
router.get('/combo', async (req, res) => {
    try {
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
        res.redirect('/admin/combo?success=' + encodeURIComponent(`Đã thêm combo "${name}" mới thành công!`));
    } catch (error) {
        console.error("Lỗi thêm combo:", error);
        res.redirect('/admin/combo?error=' + encodeURIComponent('Lỗi thêm combo: ' + error.message));
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
        res.redirect('/admin/combo?success=' + encodeURIComponent(`Đã cập nhật combo "${name}" thành công!`));
    } catch (error) {
        console.error("Lỗi sửa combo:", error);
        res.redirect('/admin/combo?error=' + encodeURIComponent('Lỗi cập nhật combo: ' + error.message));
    }
});

// Xóa Combo
router.post('/combo/xoa/:id', async (req, res) => {
    try {
        await FoodCombo.findByIdAndDelete(req.params.id);
        res.redirect('/admin/combo?success=' + encodeURIComponent('Đã xóa combo bắp nước khỏi thực đơn!'));
    } catch (error) {
        console.error("Lỗi xóa combo:", error);
        res.redirect('/admin/combo?error=' + encodeURIComponent('Lỗi xóa combo: ' + error.message));
    }
});

module.exports = router;