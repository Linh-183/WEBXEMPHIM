// File: dieu-huong/quan-tri.js
const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const User = require('../models/User'); 
const Ticket = require('../models/Ticket'); 
const Voucher = require('../models/Voucher');

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

        // 2. TÍNH TOÁN NGƯỜI DÙNG MỚI
        const allUsers = await User.find({ vaiTro: 'user' }, '_id').lean();
        let newUsersCount = 0;
        if (filter === 'all') {
            newUsersCount = allUsers.length;
        } else {
            newUsersCount = allUsers.filter(u => {
                const t = u._id.getTimestamp().getTime();
                return t >= start.getTime() && t <= end.getTime();
            }).length;
        }

        // 3. TÍNH DOANH THU & VÉ BÁN
        const allTickets = await Ticket.find({}, 'seats totalPrice _id movie').lean();
        
        let filteredTickets = allTickets;
        if (filter !== 'all') {
            filteredTickets = allTickets.filter(t => {
                const time = t._id.getTimestamp().getTime();
                return time >= start.getTime() && time <= end.getTime();
            });
        }

        const totalTickets = filteredTickets.reduce((sum, t) => sum + (t.seats ? t.seats.length : 0), 0);
        const revenueNumber = filteredTickets.reduce((sum, t) => sum + (t.totalPrice || 0), 0);

        // 4. TOP PHIM BÁN CHẠY
        const movieSales = {};
        filteredTickets.forEach(t => {
            if (t.seats && t.seats.length > 0) {
                const movieId = t.movie.toString();
                if (!movieSales[movieId]) movieSales[movieId] = 0;
                movieSales[movieId] += t.seats.length;
            }
        });
        
        const sortedMovies = Object.entries(movieSales).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const topMovies = [];
        for (let [id, sold] of sortedMovies) {
            const m = await Movie.findById(id);
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

module.exports = router;