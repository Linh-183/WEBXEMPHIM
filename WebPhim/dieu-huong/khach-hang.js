// File: dieu-huong/khach-hang.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Movie = require('../models/Movie');
const User = require('../models/User'); 
const Ticket = require('../models/Ticket'); 
const Voucher = require('../models/Voucher');
const FoodCombo = require('../models/FoodCombo');
const SeatLock = require('../models/SeatLock');
const FlashSale = require('../models/FlashSale');
const SeatConfig = require('../models/SeatConfig');
const Review = require('../models/Review');
const { checkLogin } = require('../trung-gian/xac-thuc');

// Hàm kiểm tra ObjectId MongoDB hợp lệ chống lỗi 500 CastError
function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id) && (String(new mongoose.Types.ObjectId(id)) === String(id));
}

router.get('/', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Tự động chuyển đổi phim sắp chiếu sang đang chiếu trong thời gian thực khi đến ngày khởi chiếu
        await Movie.updateMany(
            { status: 'SapChieu', releaseDate: { $lte: today } },
            { $set: { status: 'DangChieu' } }
        );

        const movies = await Movie.find({ status: 'DangChieu' }).sort({ createdAt: -1 }).limit(4);
        const topVouchers = await Voucher.find({ isReward: { $ne: true }, $or: [{ expiryDate: { $gte: new Date() } }, { expiryDate: null }] }).limit(2);
        const combos = await FoodCombo.find({ isActive: true }).sort({ createdAt: -1 }).limit(2);
        res.render('trangchu', { movies, vouchers: topVouchers, combos });
    } catch (error) { res.status(500).send("Lỗi máy chủ"); }
});

router.get('/phim', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await Movie.updateMany(
            { status: 'SapChieu', releaseDate: { $lte: today } },
            { $set: { status: 'DangChieu' } }
        );

        const currentStatus = req.query.status;
        const query = (!currentStatus || currentStatus === 'TatCa') ? {} : { status: currentStatus };
        const movies = await Movie.find(query).sort({ createdAt: -1 });
        res.render('trangdanhsachphim', { movies: movies, currentStatus: currentStatus || 'TatCa', tuKhoa: '' });
    } catch (error) { res.status(500).send("Lỗi tải danh sách phim"); }
});

router.get('/he-thong-rap', (req, res) => res.render('tranghethongrap'));

// [MỚI - GIAI ĐOẠN 2] Trang mua riêng Bắp Nước & Đồ Ăn Concessions đọc trực tiếp từ MongoDB FoodCombo
router.get(['/bap-nuoc', '/combo', '/am-thuc'], async (req, res) => {
    try {
        const combos = await FoodCombo.find({ isActive: true }).sort({ category: 1, price: 1 }).lean();
        res.render('trangbapnuoc', { user: req.session.user || null, combos });
    } catch (err) {
        console.error("Lỗi tải bắp nước:", err);
        res.render('trangbapnuoc', { user: req.session.user || null, combos: [] });
    }
});

router.get(['/chi-tiet-phim/:id', '/phim/:id'], async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(404).render('404', { title: '404 — Không Tìm Thấy Phim' });
        }
        const phim = await Movie.findById(req.params.id);
        if (!phim) return res.status(404).render('404', { title: '404 — Không Tìm Thấy Phim' });

        // Lấy danh sách đánh giá từ người xem thật
        const reviews = await Review.find({ movie: phim._id }).populate('user', 'hoTen hangHoiVien').sort({ createdAt: -1 });
        const avgRating = reviews.length ? (reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / reviews.length).toFixed(1) : '5.0';

        // Kiểm tra xem người dùng hiện tại đã mua vé xem phim này chưa (chỉ sau khi xem mới được đánh giá)
        let hasWatched = false;
        let alreadyReviewed = false;
        let myReview = null;
        if (req.session.user && req.session.user._id) {
            const ticket = await Ticket.findOne({ user: req.session.user._id, movie: phim._id });
            if (ticket) hasWatched = true;
            myReview = await Review.findOne({ user: req.session.user._id, movie: phim._id });
            if (myReview) alreadyReviewed = true;
        }

        res.render('trangchitietphim', { 
            phim, 
            user: req.session.user || null, 
            title: phim.title,
            reviews,
            avgRating,
            hasWatched,
            alreadyReviewed,
            myReview
        });
    } catch (error) { next(error); }
});

// Hàm bảo mật: Thoát ký tự đặc biệt trong Regex chống tấn công ReDoS
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

router.get('/api/tim-kiem', async (req, res) => {
    try {
        const tuKhoa = req.query.tuKhoa;
        if (!tuKhoa || tuKhoa.trim() === "") return res.json([]); 
        const safeQuery = escapeRegex(tuKhoa.trim());
        res.json(await Movie.find({ title: { $regex: safeQuery, $options: 'i' } }).limit(5).select('title posterUrl ageRating _id'));
    } catch (error) { res.status(500).json({ error: "Lỗi hệ thống" }); }
});

router.get('/tim-kiem', async (req, res) => {
    try {
        const keyword = (req.query.keyword || '').trim();
        const genre = (req.query.genre || '').trim();
        const cinema = (req.query.cinema || '').trim();
        const status = (req.query.status || '').trim();
        const ageRating = (req.query.ageRating || '').trim();

        const mongoQuery = {};

        if (keyword) {
            const safe = escapeRegex(keyword);
            mongoQuery.$or = [
                { title: { $regex: safe, $options: 'i' } },
                { director: { $regex: safe, $options: 'i' } },
                { genre: { $regex: safe, $options: 'i' } },
                { description: { $regex: safe, $options: 'i' } }
            ];
        }

        if (genre && genre !== 'all') {
            mongoQuery.genre = { $regex: escapeRegex(genre), $options: 'i' };
        }

        if (cinema && cinema !== 'all') {
            mongoQuery['showtimes.cinema'] = { $regex: escapeRegex(cinema), $options: 'i' };
        }

        if (status && status !== 'all') {
            mongoQuery.status = status;
        }

        if (ageRating && ageRating !== 'all') {
            mongoQuery.ageRating = ageRating;
        }

        const movies = await Movie.find(mongoQuery).sort({ createdAt: -1 });
        res.render('trangtimkiem', { 
            movies, 
            tuKhoa: keyword, 
            filters: { genre, cinema, status, ageRating },
            user: req.session.user || null, 
            title: `Tìm Kiếm: "${keyword || 'Toàn Bộ Phim'}" — CineGo` 
        });
    } catch (error) { 
        console.error("Lỗi máy chủ khi tìm kiếm:", error);
        res.status(500).send("Lỗi máy chủ khi tìm kiếm"); 
    }
});

// [VÁ LỖ HỔNG IDOR] Kiểm tra quyền sở hữu vé trước khi cho phép xóa
router.post('/tai-khoan/ve-cua-toi/xoa/:id', checkLogin, async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.redirect('/tai-khoan/ve-cua-toi');
        }
        const ticket = await Ticket.findById(req.params.id).populate('movie');
        if (!ticket) return res.redirect('/tai-khoan/ve-cua-toi');
        
        // Chỉ chính chủ tài khoản mua vé hoặc Admin mới có quyền xóa
        const isOwner = ticket.user && ticket.user.toString() === req.session.user._id.toString();
        const isAdmin = req.session.user.vaiTro === 'admin';
        if (!isOwner && !isAdmin) {
            return res.redirect('/tai-khoan/ve-cua-toi?error=unauthorized');
        }
        
        const today = new Date(); today.setHours(0, 0, 0, 0); 
        const showDate = new Date(ticket.showDate); showDate.setHours(0, 0, 0, 0);
        
        if (ticket.movie && showDate > today) {
            return res.redirect('/tai-khoan/ve-cua-toi?error=active_showtime');
        }
        
        await Ticket.findByIdAndDelete(req.params.id);
        res.redirect('/tai-khoan/ve-cua-toi?success=' + encodeURIComponent('Đã xóa vé khỏi lịch sử thành công.'));
    } catch (error) { 
        res.redirect('/tai-khoan/ve-cua-toi?error=' + encodeURIComponent(error.message)); 
    }
});

// Thời gian giữ ghế chuẩn rạp chiếu phim: Đúng 5 phút (300 giây) khớp trọn vẹn với đồng hồ đếm ngược UI và TTL Index MongoDB
const SEAT_HOLD_TIMEOUT_MS = 5 * 60 * 1000; // 300,000 ms (5 phút)
const SEAT_HOLD_LEASE_MS = SEAT_HOLD_TIMEOUT_MS; // Bí danh tương thích
const SEAT_CHECKOUT_GRACE_MS = 5 * 60 * 1000 + 60 * 1000; // 360,000 ms (6 phút: 5 phút giữ chỗ + 1 phút bù trễ mạng/chuyển app ngân hàng)

router.get('/dat-ve/:id', checkLogin, async (req, res, next) => {
    try { 
        if (!isValidObjectId(req.params.id)) {
            return res.status(404).render('404', { title: '404 — Không Tìm Thấy Suất Chiếu' });
        }
        // 1. Dọn dẹp ghế giữ quá hạn 5 phút trong toàn hệ thống
        const lockThreshold = new Date(Date.now() - SEAT_HOLD_TIMEOUT_MS);
        await SeatLock.deleteMany({ createdAt: { $lt: lockThreshold } });

        // 2. Tự động giải phóng ghế của chính tài khoản này khi họ quay về trang chọn ghế
        // (Xử lý dứt điểm khi người dùng bấm 'Hủy giữ ghế & đổi suất', reload trang, mất wifi quay lại)
        const currentUserId = req.session.user && req.session.user._id 
            ? req.session.user._id.toString() 
            : (req.session.id || 'guest');

        if (currentUserId && currentUserId !== 'guest') {
            await SeatLock.deleteMany({ movieId: req.params.id, userId: currentUserId });
        }
        if (req.query.seats) {
            const seatsToClear = req.query.seats.split(',').map(s => s.trim()).filter(Boolean);
            if (seatsToClear.length > 0) {
                await SeatLock.deleteMany({ movieId: req.params.id, seat: { $in: seatsToClear } });
            }
        }

        const phim = await Movie.findById(req.params.id);
        if (!phim) return res.status(404).render('404', { title: '404 — Không Tìm Thấy Suất Chiếu' });
        const seatConfig = await SeatConfig.findOne().lean();
        const combos = await FoodCombo.find({ isActive: true }).sort({ category: 1, price: 1 }).lean();
        
        // Lấy danh sách voucher trong ví người dùng và voucher công khai khả dụng cho đặt vé
        let savedVouchers = [];
        if (req.session.user && req.session.user._id) {
            const currentUserWithVouchers = await User.findById(req.session.user._id).populate('vouchers');
            if (currentUserWithVouchers && currentUserWithVouchers.vouchers) {
                const usedList = Array.isArray(currentUserWithVouchers.usedVouchers) ? currentUserWithVouchers.usedVouchers : [];
                savedVouchers = currentUserWithVouchers.vouchers.filter(v => v && v.code && !usedList.includes(v.code.toUpperCase()));
            }
        }
        const now = new Date();
        const vouchers = await Voucher.find({ 
            isReward: { $ne: true },
            applicableTo: { $in: ['all', 'movie'] },
            $or: [{ expiryDate: { $gte: now } }, { expiryDate: null }] 
        }).sort({ discountValue: -1 }).lean();

        res.render('trangdatvephim', { phim, seatConfig, combos, vouchers: vouchers || [], savedVouchers: savedVouchers || [], error: req.query.error || null }); 
    } catch (error) { next(error); }
});

// Điều hướng an toàn nếu người dùng refresh trang thanh toán hoặc truy cập trực tiếp
router.get('/thanh-toan', checkLogin, (req, res) => {
    res.redirect('/phim?warning=' + encodeURIComponent('Vui lòng chọn phim và suất chiếu trước khi thanh toán!'));
});

router.post('/thanh-toan', checkLogin, async (req, res) => {
    try {
        const { movieId, cinema, showDate, showTime, seats, total, comboDetails, comboTotal, preVoucher, payment_method, voucherCode, discountAmount, finalAmount } = req.body;
        const phim = await Movie.findById(movieId);
        const selectedCinema = cinema || 'CGV Kim Cúc Plaza';
        const seatList = seats ? seats.split(',').map(s => s.trim()).filter(Boolean) : [];
        const currentUserId = req.session.user._id ? req.session.user._id.toString() : 'guest';

        // 0. Chống đặt vé các suất chiếu trong quá khứ (Thời gian thực)
        const now = new Date();
        const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        let bookingDate = null;
        if (showDate && typeof showDate === 'string' && showDate.includes('-')) {
            const [bYear, bMonth, bDay] = showDate.split('-').map(Number);
            if (bYear && bMonth && bDay) {
                bookingDate = new Date(bYear, bMonth - 1, bDay, 0, 0, 0, 0);
            }
        }
        if (!bookingDate) {
            bookingDate = new Date(showDate);
            bookingDate.setHours(0, 0, 0, 0);
        }

        if (bookingDate < todayZero) {
            return res.redirect(`/dat-ve/${movieId}?error=${encodeURIComponent('Suất chiếu này đã thuộc về ngày trong quá khứ! Vui lòng chọn lịch chiếu từ hôm nay trở đi.')}`);
        }
        if (bookingDate.getTime() === todayZero.getTime() && showTime) {
            const [shHour, shMin] = showTime.split(':').map(Number);
            const showtimeMoment = new Date(now.getFullYear(), now.getMonth(), now.getDate(), shHour || 0, shMin || 0, 0, 0);
            if (now >= showtimeMoment) {
                return res.redirect(`/dat-ve/${movieId}?error=${encodeURIComponent(`Suất chiếu lúc ${showTime} hôm nay đã bắt đầu hoặc đã qua giờ chiếu! Vui lòng chọn suất chiếu khác.`)}`);
            }
        }

        if (seatList.length > 0) {
            // 0.1 Tự động giải phóng toàn bộ các ghế giữ đã quá hạn 5 phút trong DB
            const lockThreshold = new Date(Date.now() - SEAT_HOLD_TIMEOUT_MS);
            await SeatLock.deleteMany({ createdAt: { $lt: lockThreshold } });

            // 1. Kiểm tra xem các ghế này đã được xuất vé trong DB chưa
            const soldTickets = await Ticket.findOne({
                movie: movieId,
                cinema: selectedCinema,
                showDate,
                showTime,
                seats: { $in: seatList }
            });
            if (soldTickets) {
                return res.redirect(`/dat-ve/${movieId}?error=${encodeURIComponent('Rất tiếc! Một trong các ghế bạn chọn đã được khách hàng khác thanh toán trước.')}`);
            }

            // 2. Kiểm tra xem có người khác đang giữ ghế trong 5 phút không
            const lockedByOthers = await SeatLock.find({
                movieId,
                cinema: selectedCinema,
                showDate,
                showTime,
                seat: { $in: seatList },
                userId: { $ne: currentUserId },
                createdAt: { $gte: lockThreshold }
            });
            if (lockedByOthers.length > 0) {
                const names = lockedByOthers.map(l => l.seat).join(', ');
                return res.redirect(`/dat-ve/${movieId}?error=${encodeURIComponent(`Ghế (${names}) đang có người chọn. Vui lòng chọn ghế khác!`)}`);
            }

            // 3. Khóa ghế nguyên tử chống Race Condition từng mili-giây (Atomic Conditional Lock & Rollback)
            const acquiredLocks = [];
            let conflictSeat = null;

            for (const s of seatList) {
                // 3.1 Thử cập nhật nếu ghế đã thuộc về chính mình hoặc khóa cũ đã quá hạn nhịp tim (45s)
                const updated = await SeatLock.findOneAndUpdate(
                    {
                        movieId,
                        cinema: selectedCinema,
                        showDate,
                        showTime,
                        seat: s,
                        $or: [
                            { userId: currentUserId },
                            { createdAt: { $lt: lockThreshold } }
                        ]
                    },
                    { 
                        $set: { userId: currentUserId, createdAt: new Date() },
                        $inc: { version: 1 } // Tăng version theo chuẩn CAS (Compare-And-Swap)
                    },
                    { new: true }
                );

                if (updated) {
                    acquiredLocks.push(s);
                    continue;
                }

                // 3.2 Nếu chưa có trong DB, thử chèn mới (Insert)
                try {
                    await SeatLock.create({
                        movieId,
                        cinema: selectedCinema,
                        showDate,
                        showTime,
                        seat: s,
                        userId: currentUserId,
                        createdAt: new Date()
                    });
                    acquiredLocks.push(s);
                } catch (insertErr) {
                    // Mã lỗi E11000: Có khách khác vừa chiếm ghế này trước đúng vài mili-giây
                    conflictSeat = s;
                    break;
                }
            }

            // Nếu có ghế bị tranh chấp mili-giây hoặc không khóa đủ toàn bộ ghế yêu cầu:
            if (conflictSeat || acquiredLocks.length !== seatList.length) {
                // Rollback: Giải phóng ngay các ghế vừa giữ dở dang để trả lại kho cho khách khác
                if (acquiredLocks.length > 0) {
                    await SeatLock.deleteMany({
                        movieId,
                        cinema: selectedCinema,
                        showDate,
                        showTime,
                        seat: { $in: acquiredLocks },
                        userId: currentUserId
                    });
                }
                return res.redirect(`/dat-ve/${movieId}?error=${encodeURIComponent(`Rất tiếc! Ghế (${conflictSeat || 'đã chọn'}) vừa có khách hàng khác nhanh tay chọn trước trong tích tắc. Vui lòng chọn ghế khác!`)}`);
            }
        }

        let savedVouchers = [];
        if (req.session.user && req.session.user._id) {
            const currentUserWithVouchers = await User.findById(req.session.user._id).populate('vouchers');
            if (currentUserWithVouchers && currentUserWithVouchers.vouchers) {
                const usedList = Array.isArray(currentUserWithVouchers.usedVouchers) ? currentUserWithVouchers.usedVouchers : [];
                savedVouchers = currentUserWithVouchers.vouchers.filter(v => v && v.code && !usedList.includes(v.code.toUpperCase()));
            }
        }
        // Chỉ hiển thị voucher công khai do rạp phát hành cho phim, TUYỆT ĐỐI KHÔNG hiển thị voucher đổi điểm thưởng cá nhân
        const vouchers = await Voucher.find({ 
            isReward: { $ne: true },
            applicableTo: { $in: ['all', 'movie'] },
            $or: [{ expiryDate: { $gte: new Date() } }, { expiryDate: null }] 
        }).lean();
        const availableCombos = await FoodCombo.find({ isActive: true }).sort({ category: 1, price: 1 }).lean();
        const safeDiscount = Number(discountAmount) || 0;
        const safeTotal = Number(total) || 0;
        const calcFinal = Number(finalAmount) > 0 ? Number(finalAmount) : Math.max(0, safeTotal - safeDiscount);
        res.render('trangthanhtoan', { 
            phim, 
            cinema: selectedCinema, 
            showDate, 
            showTime, 
            seats: seatList, 
            total: safeTotal, 
            comboDetails, 
            comboTotal: Number(comboTotal) || 0, 
            vouchers, 
            savedVouchers, 
            availableCombos, 
            preVoucher: preVoucher || voucherCode || '',
            selectedPaymentMethod: payment_method || 'momo',
            appliedVoucherCode: voucherCode || '',
            voucherDiscount: safeDiscount,
            finalAmount: calcFinal
        });
    } catch(error) { 
        console.error("Lỗi thanh toán:", error);
        res.status(500).send("Lỗi thanh toán: " + error.message); 
    }
});

// [GIA CỐ BẢO MẬT & CHỐNG DOUBLE BOOKING] Xác thực giá tiền và kiểm tra trùng ghế ở Backend
router.post('/xac-nhan-thanh-toan', checkLogin, async (req, res, next) => {
    try {
        const { phimId, cinema, showDate, showTime, seats, total, finalAmount, payment_method, comboDetails, comboTotal, voucherCode, discountAmount } = req.body;
        
        if (!seats || seats.trim() === '') {
            return res.redirect(`/dat-ve/${phimId}?error=${encodeURIComponent('Vui lòng chọn ít nhất 1 ghế trước khi thanh toán!')}`);
        }

        const now = new Date();
        const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        let bookingDate = null;
        if (showDate && typeof showDate === 'string' && showDate.includes('-')) {
            const [bYear, bMonth, bDay] = showDate.split('-').map(Number);
            if (bYear && bMonth && bDay) {
                bookingDate = new Date(bYear, bMonth - 1, bDay, 0, 0, 0, 0);
            }
        }
        if (!bookingDate) {
            bookingDate = new Date(showDate);
            bookingDate.setHours(0, 0, 0, 0);
        }

        if (bookingDate < todayZero) {
            return res.redirect(`/dat-ve/${phimId}?error=${encodeURIComponent('Suất chiếu này đã thuộc về ngày trong quá khứ!')}`);
        }
        if (bookingDate.getTime() === todayZero.getTime() && showTime) {
            const [shHour, shMin] = showTime.split(':').map(Number);
            const showtimeMoment = new Date(now.getFullYear(), now.getMonth(), now.getDate(), shHour || 0, shMin || 0, 0, 0);
            if (now >= showtimeMoment) {
                return res.redirect(`/dat-ve/${phimId}?error=${encodeURIComponent(`Suất chiếu lúc ${showTime} hôm nay đã qua giờ bắt đầu! Vui lòng chọn suất chiếu khác.`)}`);
            }
        }

        const seatList = seats.split(',').map(s => s.trim()).filter(Boolean);
        const selectedCinema = cinema || 'CGV Kim Cúc Plaza';

        // 1. Kiểm tra chống trùng ghế: Ghế đã được đặt trong DB cho cùng suất chưa?
        const duplicateBooking = await Ticket.findOne({
            movie: phimId,
            cinema: selectedCinema,
            showDate: showDate,
            showTime: showTime,
            seats: { $in: seatList }
        });

        if (duplicateBooking) {
            return res.redirect(`/dat-ve/${phimId}?error=${encodeURIComponent('Rất tiếc! Một trong các ghế bạn chọn vừa được khách hàng khác thanh toán trước. Vui lòng chọn ghế khác.')}`);
        }

        // 1.1 Kiểm tra quyền sở hữu phiên giữ ghế (Chống thanh toán chéo, đảm bảo trọn vẹn 5 phút cho khách)
        const currentUserId = req.session.user._id.toString();
        const checkoutGraceThreshold = new Date(Date.now() - SEAT_CHECKOUT_GRACE_MS); // Bảo đảm thời hạn đủ 5 phút (+ 1 phút bù trễ mạng)
        const myValidLocks = await SeatLock.find({
            movieId: phimId,
            cinema: selectedCinema,
            showDate: showDate,
            showTime: showTime,
            seat: { $in: seatList },
            userId: currentUserId,
            createdAt: { $gte: checkoutGraceThreshold }
        });

        if (myValidLocks.length !== seatList.length) {
            return res.redirect(`/dat-ve/${phimId}?error=${encodeURIComponent('Phiên giữ ghế của bạn đã hết hạn do không phát hiện tín hiệu hoạt động, hoặc ghế đã được giải phóng. Vui lòng chọn lại ghế!')}`);
        }

        // 2. Tính toán lại giá vé ở Backend theo cấu hình giá của Admin (Chống gian lận Client sửa giá POST request)
        const seatCfg = await SeatConfig.findOne().lean();
        const cfgStd = seatCfg?.priceStandard || 75000;
        const cfgVIP = seatCfg?.priceVIP || 95000;
        const cfgCouple = seatCfg?.priceCouple || 170000;

        let calculatedSeatPrice = 0;
        const totalRows = seatCfg?.rows || 6;
        const lastRowChar = String.fromCharCode(65 + totalRows - 1);
        const vipStartRowIdx = Math.max(1, Math.floor(totalRows * 0.45));

        seatList.forEach(code => {
            const upper = code.toUpperCase();
            const rowChar = upper.charAt(0);
            const rowIdx = rowChar.charCodeAt(0) - 65;

            // Ghế đôi Sweetbox luôn ở hàng dưới cùng (hoặc có định dạng cặp như F1-F2, H1-H2)
            if (upper.includes('-') || rowChar === lastRowChar) {
                calculatedSeatPrice += cfgCouple;
            } else if (rowIdx >= vipStartRowIdx && rowIdx < totalRows - 1) {
                calculatedSeatPrice += cfgVIP;
            } else {
                calculatedSeatPrice += cfgStd;
            }
        });

        const safeComboTotal = Number(comboTotal) || 0;
        const expectedBaseTotal = calculatedSeatPrice + safeComboTotal;

        // 3. Xử lý Voucher và Kiểm tra tính hợp lệ, trừ voucher 1 lần duy nhất
        let appliedDiscount = 0;
        let validVoucherCode = '';
        let voucherToRemoveId = null;
        const userInDb = await User.findById(req.session.user._id);

        if (voucherCode && voucherCode.trim()) {
            const upperCode = voucherCode.trim().toUpperCase();
            const v = await Voucher.findOne({ code: upperCode });
            const hasUsed = userInDb && Array.isArray(userInDb.usedVouchers) && userInDb.usedVouchers.includes(upperCode);

            if (hasUsed) {
                return res.redirect(`/dat-ve/${phimId}?error=${encodeURIComponent(`Mã voucher ${upperCode} đã được bạn sử dụng trước đó. Mỗi voucher chỉ dùng được 1 lần duy nhất!`)}`);
            }

            if (v) {
                if (v.applicableTo === 'concession') {
                    return res.redirect(`/dat-ve/${phimId}?error=${encodeURIComponent(`Mã voucher ${upperCode} chỉ dành riêng cho Bắp Nước & Đồ Ăn, không áp dụng cho vé xem phim!`)}`);
                }
                if (v.expiryDate && new Date(v.expiryDate) < new Date()) {
                    return res.redirect(`/dat-ve/${phimId}?error=${encodeURIComponent(`Mã voucher ${upperCode} đã hết hạn sử dụng!`)}`);
                }
                if (expectedBaseTotal < (v.minOrderValue || 0)) {
                    return res.redirect(`/dat-ve/${phimId}?error=${encodeURIComponent(`Đơn hàng tối thiểu để áp dụng mã ${upperCode} là ${v.minOrderValue.toLocaleString('vi-VN')}đ`)}`);
                }
                if (v.discountType === 'fixed') {
                    appliedDiscount = v.discountValue;
                } else if (v.discountType === 'percentage') {
                    appliedDiscount = Math.round((expectedBaseTotal * v.discountValue) / 100);
                    if (v.maxDiscountValue > 0 && appliedDiscount > v.maxDiscountValue) {
                        appliedDiscount = v.maxDiscountValue;
                    }
                }
                validVoucherCode = upperCode;
                voucherToRemoveId = v._id;

                // Nếu là mã voucher cá nhân (mã đổi điểm VCH- hoặc mã sinh nhật BDAY-) thì xóa vĩnh viễn khỏi DB
                if (upperCode.startsWith('VCH') || upperCode.startsWith('BDAY')) {
                    await Voucher.deleteOne({ _id: v._id });
                }
            } else {
                // Hỗ trợ mã voucher đặc biệt nếu có từ client gửi lên (VD: CINEGO300 v.v.)
                const clientDiscount = Math.max(0, expectedBaseTotal - (Number(finalAmount) || 0));
                if (clientDiscount > 0) {
                    appliedDiscount = Math.min(clientDiscount, expectedBaseTotal);
                    validVoucherCode = upperCode;
                }
            }
        }

        // Tính số tiền thực thanh toán (tối thiểu là 0đ)
        let verifiedTotalPrice = Math.max(0, expectedBaseTotal - appliedDiscount);
        // Nếu không có voucher nhưng client gửi finalAmount hợp lệ
        if (!validVoucherCode && typeof finalAmount !== 'undefined') {
            const fNum = Number(finalAmount);
            if (!isNaN(fNum) && fNum >= 0 && fNum <= expectedBaseTotal) {
                verifiedTotalPrice = fNum;
            }
        }

        const submittedTotal = Number(total) || 0;
        const submittedFinal = Number(finalAmount);
        const submittedDiscount = Number(discountAmount) || 0;
        const grossSum = (!isNaN(submittedFinal) ? submittedFinal : 0) + submittedDiscount;
        const grossOrderValue = Math.max(submittedTotal, expectedBaseTotal, grossSum);
        const finalDiscountAmount = Math.max(appliedDiscount, submittedDiscount, Math.max(0, grossOrderValue - verifiedTotalPrice));

        const savedTicket = await new Ticket({
            user: req.session.user._id,
            movie: phimId,
            cinema: selectedCinema,
            showDate: showDate || new Date().toISOString().split('T')[0],
            showTime: showTime || '19:30',
            seats: seatList,
            comboDetails: comboDetails || '',
            comboTotal: safeComboTotal,
            originalPrice: grossOrderValue,
            discountAmount: finalDiscountAmount,
            voucherCode: validVoucherCode,
            totalPrice: verifiedTotalPrice,
            paymentMethod: payment_method || 'vietqr'
        }).save();

        // Giải phóng khóa ghế trong MongoDB SeatLock ngay khi thanh toán thành công
        await SeatLock.deleteMany({
            movieId: phimId,
            cinema: selectedCinema,
            showDate: showDate,
            showTime: showTime,
            seat: { $in: seatList }
        });

        // Cập nhật User một lần duy nhất: gỡ voucher khỏi ví, ghi nhận mã đã dùng, và CỘNG ĐIỂM THƯỞNG
        const earnedPoints = Math.max(Math.floor(grossOrderValue / 1000), Math.floor(verifiedTotalPrice / 1000));

        if (userInDb) {
            if (validVoucherCode) {
                if (!userInDb.usedVouchers) userInDb.usedVouchers = [];
                if (!userInDb.usedVouchers.includes(validVoucherCode)) {
                    userInDb.usedVouchers.push(validVoucherCode);
                }
                if (voucherToRemoveId && Array.isArray(userInDb.vouchers)) {
                    userInDb.vouchers = userInDb.vouchers.filter(id => id.toString() !== voucherToRemoveId.toString());
                }
            }

            if (earnedPoints > 0) {
                userInDb.diemTichLuy = (userInDb.diemTichLuy || 0) + earnedPoints;
                if (userInDb.diemTichLuy >= 1000) userInDb.hangHoiVien = 'KimCuong';
                else if (userInDb.diemTichLuy >= 600) userInDb.hangHoiVien = 'Vang';
                else if (userInDb.diemTichLuy >= 300) userInDb.hangHoiVien = 'Bac';
                else userInDb.hangHoiVien = 'Dong';
            }

            await userInDb.save();
            req.session.user = userInDb;
            await new Promise((resolve) => req.session.save(resolve));
        }

        // Chuyển hướng trực tiếp đến trang Thẻ Vé Điện Tử có mã QR CineGo Pass
        res.redirect(`/ve/${savedTicket._id}`);
    } catch (error) { 
        console.error("Lỗi xác nhận thanh toán:", error);
        next(error); 
    }
});

// [MỚI] THẺ VÉ ĐIỆN TỬ CÓ MÃ QR CINEGO PASS
router.get(['/ve/:id', '/ve-dien-tu/:id'], checkLogin, async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(404).render('404', { title: '404 — Không Tìm Thấy Vé' });
        }
        const ticket = await Ticket.findById(req.params.id).populate('movie').populate('user');
        if (!ticket) {
            return res.status(404).render('404', { title: '404 — Không Tìm Thấy Vé' });
        }
        // Kiểm tra quyền: Chỉ chính chủ mua vé hoặc Admin mới xem được vé điện tử
        const isOwner = ticket.user && ticket.user._id.toString() === req.session.user._id.toString();
        const isAdmin = req.session.user.vaiTro === 'admin';
        if (!isOwner && !isAdmin) {
            return res.redirect('/tai-khoan/ve-cua-toi');
        }
        res.render('trangve', { ticket, user: req.session.user, title: `Vé Điện Tử — ${ticket.movie ? ticket.movie.title : 'CineGo Pass'}` });
    } catch (error) { next(error); }
});

// [MỚI] CÁC ROUTE PHỤ TRỢ: HỒ SƠ RẠP, FLASH SALE, BÌNH PHẨM ĐIỆN ẢNH
router.get(['/he-thong-rap/:id', '/chi-tiet-rap/:id', '/rap/:id'], async (req, res) => {
    try {
        const movies = await Movie.find({ status: 'DangChieu' }).sort({ createdAt: -1 });
        res.render('trangchitietrap', { user: req.session.user || null, movies, title: 'Hồ Sơ Cụm Rạp — CineGo Quy Nhơn' });
    } catch (err) {
        res.render('trangchitietrap', { user: req.session.user || null, movies: [], title: 'Hồ Sơ Cụm Rạp — CineGo Quy Nhơn' });
    }
});

router.get('/flash-sale', async (req, res) => {
    try {
        const now = new Date();
        const activeSales = await FlashSale.find({
            isActive: true,
            startTime: { $lte: now },
            endTime: { $gte: now }
        }).populate('movie').lean();

        const upcomingSales = await FlashSale.find({
            isActive: true,
            startTime: { $gt: now }
        }).populate('movie').sort({ startTime: 1 }).lean();

        // Lấy thêm các Voucher Flash Sale được thiết lập theo khung giờ
        const activeVouchers = await Voucher.find({
            isFlashSale: true,
            flashStartTime: { $lte: now },
            flashEndTime: { $gte: now }
        }).lean();

        const upcomingVouchers = await Voucher.find({
            isFlashSale: true,
            flashStartTime: { $gt: now }
        }).sort({ flashStartTime: 1 }).lean();

        activeVouchers.forEach(v => {
            activeSales.push({
                _id: v._id,
                title: v.title,
                startTime: v.flashStartTime,
                endTime: v.flashEndTime,
                salePrice: v.discountType === 'fixed' ? v.discountValue : 19000,
                originalPrice: 95000,
                totalQuantity: v.maxQuantity || 50,
                claimedQuantity: v.claimedQuantity || 0,
                voucherCode: v.code,
                cinema: 'Tất cả các rạp Quy Nhơn',
                description: v.description || 'Voucher Flash Sale theo khung giờ giới hạn.',
                isVoucher: true
            });
        });

        upcomingVouchers.forEach(v => {
            upcomingSales.push({
                _id: v._id,
                title: v.title,
                startTime: v.flashStartTime,
                endTime: v.flashEndTime,
                salePrice: v.discountType === 'fixed' ? v.discountValue : 19000,
                originalPrice: 95000,
                totalQuantity: v.maxQuantity || 50,
                claimedQuantity: v.claimedQuantity || 0,
                voucherCode: v.code,
                cinema: 'Tất cả các rạp Quy Nhơn',
                description: v.description || 'Voucher Flash Sale theo khung giờ giới hạn.',
                isVoucher: true
            });
        });

        res.render('trangflashsale', {
            user: req.session.user || null,
            activeSales,
            upcomingSales,
            title: 'Khung Giờ Vàng Flash Sale — CineGo'
        });
    } catch (err) {
        res.render('trangflashsale', {
            user: req.session.user || null,
            activeSales: [],
            upcomingSales: [],
            title: 'Khung Giờ Vàng Flash Sale — CineGo'
        });
    }
});

// API Người Dùng Nhận Mã Ưu Đãi Flash Sale Vào Ví (Bắt buộc phải có tài khoản)
router.post('/api/nhan-flash-voucher', async (req, res) => {
    try {
        if (!req.session || !req.session.user || !req.session.user._id) {
            return res.status(401).json({
                success: false,
                requireLogin: true,
                message: 'Vui lòng đăng nhập tài khoản để lưu mã Flash Sale vào ví!'
            });
        }

        const { saleId } = req.body;
        if (!isValidObjectId(saleId)) return res.json({ success: false, message: 'Đợt Flash Sale không hợp lệ.' });
        
        const user = await User.findById(req.session.user._id);
        if (!user) {
            return res.status(401).json({
                success: false,
                requireLogin: true,
                message: 'Tài khoản không tồn tại hoặc phiên đăng nhập đã hết hạn!'
            });
        }
        if (!user.vouchers) user.vouchers = [];

        let sale = await FlashSale.findById(saleId);
        let targetVoucher = null;
        const now = new Date();

        if (sale) {
            if (!sale.isActive) return res.json({ success: false, message: 'Đợt Flash Sale này không khả dụng.' });
            if (now < sale.startTime || now > sale.endTime) {
                return res.json({ success: false, message: 'Khung giờ Flash Sale chưa bắt đầu hoặc đã kết thúc.' });
            }
            if (sale.claimedQuantity >= sale.totalQuantity) {
                return res.json({ success: false, message: 'Rất tiếc! Số lượng vé trong khung giờ Flash Sale này đã được săn hết.' });
            }

            // Tự động tạo voucher trong bảng Voucher nếu chưa có
            targetVoucher = await Voucher.findOne({ code: sale.voucherCode });
            if (!targetVoucher) {
                targetVoucher = await Voucher.create({
                    code: sale.voucherCode,
                    title: sale.title,
                    discountType: 'fixed',
                    discountValue: sale.originalPrice - sale.salePrice,
                    minOrderValue: sale.originalPrice,
                    maxDiscountValue: sale.originalPrice - sale.salePrice,
                    expiryDate: sale.endTime,
                    applicableTo: 'all'
                });
            }

            // Kiểm tra xem người dùng đã lưu mã này chưa
            if (user.vouchers.some(vId => vId.toString() === targetVoucher._id.toString())) {
                return res.json({
                    success: false,
                    message: `Mã ${targetVoucher.code} đã có trong ví của bạn rồi! Hãy áp dụng khi đặt vé.`
                });
            }

            sale.claimedQuantity += 1;
            await sale.save();
        } else {
            // Kiểm tra xem có phải là Voucher Flash Sale không
            targetVoucher = await Voucher.findById(saleId);
            if (!targetVoucher || !targetVoucher.isFlashSale) {
                return res.json({ success: false, message: 'Không tìm thấy chiến dịch Flash Sale tương ứng.' });
            }

            if (targetVoucher.flashStartTime && now < targetVoucher.flashStartTime) {
                return res.json({ success: false, message: 'Khung giờ Flash Sale của voucher này chưa bắt đầu.' });
            }
            if (targetVoucher.flashEndTime && now > targetVoucher.flashEndTime) {
                return res.json({ success: false, message: 'Khung giờ Flash Sale của voucher này đã kết thúc.' });
            }
            const maxL = targetVoucher.maxQuantity || 50;
            if ((targetVoucher.claimedQuantity || 0) >= maxL) {
                return res.json({ success: false, message: 'Rất tiếc! Số lượng voucher Flash Sale trong khung giờ đã được lưu hết.' });
            }

            // Kiểm tra xem người dùng đã lưu mã này chưa
            if (user.vouchers.some(vId => vId.toString() === targetVoucher._id.toString())) {
                return res.json({
                    success: false,
                    message: `Mã ${targetVoucher.code} đã có trong ví của bạn rồi! Hãy áp dụng khi thanh toán.`
                });
            }

            targetVoucher.claimedQuantity = (targetVoucher.claimedQuantity || 0) + 1;
            await targetVoucher.save();
        }

        // Lưu voucher vào tài khoản của khách hàng
        user.vouchers.push(targetVoucher._id);
        await user.save();
        req.session.user.vouchers = user.vouchers;

        res.json({ 
            success: true, 
            message: `Bạn đã lưu mã Flash Sale ${targetVoucher.code} vào ví thành công! Hãy kiểm tra ví để áp dụng khi đặt vé.` 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + err.message });
    }
});

router.get('/danh-gia', (req, res) => {
    res.render('trangdanhgia', { user: req.session.user || null, title: 'Bình Phẩm & Đánh Giá Điện Ảnh — CineGo' });
});

// [ĐÃ SỬA] API Kiểm tra Voucher (Chống tái sử dụng voucher 1 lần, phân biệt voucher Phim vs Bắp Nước)
router.post('/api/kiem-tra-voucher', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.json({ success: false, requireLogin: true, message: "Vui lòng đăng nhập tài khoản để áp dụng mã ưu đãi/voucher!" });
        }
        const { code, currentTotal, orderType } = req.body;
        const upperCode = (code || '').trim().toUpperCase();
        if (!upperCode) return res.json({ success: false, message: "Vui lòng nhập mã voucher!" });

        let v = await Voucher.findOne({ code: upperCode });
        if (!v) {
            if (upperCode === 'CINEGO50K') {
                v = { code: 'CINEGO50K', title: 'Voucher CineGo 50.000đ', discountType: 'fixed', discountValue: 50000, minOrderValue: 0, applicableTo: 'all' };
            } else if (upperCode === 'CHAOBANMOI') {
                v = { code: 'CHAOBANMOI', title: 'Ưu đãi Chào Bạn Mới 20.000đ', discountType: 'fixed', discountValue: 20000, minOrderValue: 0, applicableTo: 'all' };
            } else if (upperCode === 'VIP20') {
                v = { code: 'VIP20', title: 'Giảm 20% Cho Thành Viên', discountType: 'percentage', discountValue: 20, minOrderValue: 0, applicableTo: 'all' };
            } else {
                return res.json({ success: false, message: "Mã voucher không tồn tại!" });
            }
        }
        if (v.expiryDate && new Date(v.expiryDate) < new Date()) return res.json({ success: false, message: "Mã voucher này đã hết hạn sử dụng!" });
        
        // Phân biệt voucher dành riêng cho Vé Xem Phim hoặc Bắp Nước
        const curType = orderType || 'movie';
        if (v.applicableTo === 'movie' && curType === 'concession') {
            return res.json({ success: false, message: "Voucher này chỉ áp dụng cho Vé xem phim, không áp dụng cho đơn bắp nước!" });
        }
        if (v.applicableTo === 'concession' && curType === 'movie') {
            return res.json({ success: false, message: "Voucher này chỉ áp dụng cho Bắp nước & Ẩm thực, không áp dụng cho vé xem phim!" });
        }

        // Kiểm tra xem người dùng hiện tại đã dùng mã voucher này chưa
        if (req.session.user && req.session.user._id) {
            const userInDb = await User.findById(req.session.user._id);
            if (userInDb && Array.isArray(userInDb.usedVouchers) && userInDb.usedVouchers.includes(upperCode)) {
                return res.json({ success: false, message: "Bạn đã sử dụng mã voucher này rồi! Mỗi voucher chỉ dùng được 1 lần." });
            }
        }

        const totalNum = Number(currentTotal) || 0;
        if (totalNum < (v.minOrderValue || 0)) {
            return res.json({ success: false, message: `Đơn tối thiểu để áp dụng mã này là ${v.minOrderValue.toLocaleString('vi-VN')}đ` });
        }

        res.json({ 
            success: true, 
            code: v.code,
            applicableTo: v.applicableTo || 'all',
            discountType: v.discountType, 
            discountValue: v.discountValue, 
            maxDiscountValue: v.maxDiscountValue || 0, 
            message: `Áp dụng mã ${v.code} (${v.applicableTo === 'concession' ? 'Bắp Nước' : (v.applicableTo === 'movie' ? 'Vé Phim' : 'Tất Cả')}) thành công!` 
        });
    } catch (error) { 
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi kiểm tra voucher" }); 
    }
});

// [MỚI] API ĐÁNH GIÁ PHIM (BẮT BUỘC ĐÃ MUA VÉ XEM PHIM)
router.post('/api/danh-gia', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để gửi đánh giá phim!' });
        }
        const { movieId, rating, comment } = req.body;
        if (!movieId || !isValidObjectId(movieId)) {
            return res.status(400).json({ success: false, message: 'Mã phim không hợp lệ!' });
        }
        if (!comment || !comment.trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung đánh giá/bình phẩm!' });
        }

        // BẮT BUỘC: Khách hàng phải có vé xem phim này thì mới được đánh giá sau khi xem
        const ticket = await Ticket.findOne({ user: req.session.user._id, movie: movieId });
        if (!ticket) {
            return res.status(403).json({ 
                success: false, 
                message: 'Chính sách CineGo: Bạn cần mua vé xem phim này trước thì mới có thể gửi đánh giá & bình phẩm!' 
            });
        }

        const existingReview = await Review.findOne({ user: req.session.user._id, movie: movieId });
        if (existingReview) {
            existingReview.rating = Math.min(5, Math.max(1, Number(rating) || 5));
            existingReview.comment = comment.trim();
            await existingReview.save();
            return res.json({ success: true, message: 'Đã cập nhật bài đánh giá của bạn thành công!' });
        }

        await Review.create({
            movie: movieId,
            user: req.session.user._id,
            ticket: ticket._id,
            rating: Math.min(5, Math.max(1, Number(rating) || 5)),
            comment: comment.trim(),
            isVerifiedViewer: true
        });

        res.json({ success: true, message: 'Cảm ơn bạn! Đánh giá của bạn đã được xuất bản công khai.' });
    } catch (err) {
        console.error('Lỗi gửi đánh giá:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống khi gửi đánh giá: ' + err.message });
    }
});

// [MỚI] API LƯU VOUCHER VÀO VÍ CÁ NHÂN CỦA KHÁCH HÀNG
router.post('/api/luu-voucher', async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).json({ success: false, message: "Vui lòng đăng nhập để lưu mã ưu đãi vào ví cá nhân!" });
        }

        const { code, voucherId } = req.body;
        let voucher = null;
        if (voucherId && isValidObjectId(voucherId)) {
            voucher = await Voucher.findById(voucherId);
        } else if (code) {
            voucher = await Voucher.findOne({ code: code.trim().toUpperCase() });
        }

        if (!voucher) {
            return res.status(404).json({ success: false, message: "Mã khuyến mãi không tồn tại trên hệ thống!" });
        }

        if (voucher.isReward) {
            return res.status(400).json({ success: false, message: "Mã ưu đãi này chỉ dành cho đổi điểm thưởng thành viên, không thể lưu trực tiếp!" });
        }

        // Kiểm tra ràng buộc khung giờ & số lượng giới hạn nếu là Voucher Flash Sale
        if (voucher.isFlashSale) {
            const now = new Date();
            if (voucher.flashStartTime && now < voucher.flashStartTime) {
                const sStr = voucher.flashStartTime.toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});
                return res.json({ success: false, message: `Voucher Flash Sale này chưa bắt đầu mở lưu (Mở lúc ${sStr})!` });
            }
            if (voucher.flashEndTime && now > voucher.flashEndTime) {
                return res.json({ success: false, message: "Khung giờ Flash Sale của voucher này đã kết thúc!" });
            }
            const maxL = voucher.maxQuantity || 50;
            const claimed = voucher.claimedQuantity || 0;
            if (claimed >= maxL) {
                return res.json({ success: false, message: `Rất tiếc! Số lượng voucher Flash Sale trong khung giờ này đã được lưu hết (${maxL}/${maxL})!` });
            }
        }

        if (voucher.expiryDate && new Date(voucher.expiryDate) < new Date()) {
            return res.json({ success: false, message: "Mã khuyến mãi này đã hết hạn sử dụng!" });
        }

        const user = await User.findById(req.session.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: "Không tìm thấy thông tin tài khoản!" });
        }

        if (!user.vouchers) user.vouchers = [];

        // Kiểm tra xem đã lưu voucher này chưa
        const isAlreadySaved = user.vouchers.some(vId => vId.toString() === voucher._id.toString());
        if (isAlreadySaved) {
            return res.json({ success: false, message: `Mã ${voucher.code} đã có trong ví của bạn rồi!` });
        }

        user.vouchers.push(voucher._id);
        await user.save();
        req.session.user.vouchers = user.vouchers;

        if (voucher.isFlashSale) {
            voucher.claimedQuantity = (voucher.claimedQuantity || 0) + 1;
            await voucher.save();
        }

        res.json({ 
            success: true, 
            message: `Đã lưu mã ${voucher.code} vào ví cá nhân thành công!`,
            voucher: {
                _id: voucher._id,
                code: voucher.code,
                title: voucher.title,
                discountType: voucher.discountType,
                discountValue: voucher.discountValue
            }
        });
    } catch (error) {
        console.error("Lỗi lưu voucher vào ví:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi lưu voucher: " + error.message });
    }
});

// [MỚI] API BỎ LƯU VOUCHER KHỎI VÍ
router.post('/api/xoa-voucher-vi', async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).json({ success: false, message: "Vui lòng đăng nhập!" });
        }

        const { voucherId, code } = req.body;
        const user = await User.findById(req.session.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: "Tài khoản không tồn tại!" });
        }

        if (!user.vouchers || user.vouchers.length === 0) {
            return res.json({ success: true, message: "Ví hiện không có mã này." });
        }

        let targetId = voucherId;
        if (!targetId && code) {
            const v = await Voucher.findOne({ code: code.trim().toUpperCase() });
            if (v) targetId = v._id.toString();
        }

        if (targetId) {
            user.vouchers = user.vouchers.filter(id => id.toString() !== targetId.toString());
            await user.save();
            req.session.user.vouchers = user.vouchers;
        }

        res.json({ success: true, message: "Đã bỏ lưu voucher khỏi ví thành công!" });
    } catch (error) {
        console.error("Lỗi bỏ lưu voucher:", error);
        res.status(500).json({ success: false, message: "Lỗi khi bỏ lưu voucher: " + error.message });
    }
});

// [MỚI - GIAI ĐOẠN 4] Kiểm tra ghế đã bán và ghế đang giữ bằng MongoDB TTL (Phòng thủ CastError)
router.get('/api/ghe-da-dat', async (req, res) => {
    try {
        const { movieId, showDate, showTime, cinema, userId } = req.query; 
        if (movieId && !isValidObjectId(movieId)) {
            return res.json({ bookedSeats: [], tempLocked: [] });
        }
        const cinemaRegex = cinema ? new RegExp(cinema.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
        const ticketQuery = { movie: movieId, showDate, showTime };
        if (cinemaRegex) ticketQuery.cinema = cinemaRegex;
        const tickets = await Ticket.find(ticketQuery);

        let bookedSeats = [];
        tickets.forEach(t => {
            if (Array.isArray(t.seats)) {
                t.seats.forEach(s => {
                    if (typeof s === 'string' && s.includes(',')) {
                        s.split(',').forEach(sub => {
                            const trimmed = sub.trim();
                            if (trimmed) bookedSeats.push(trimmed);
                        });
                    } else if (s && typeof s === 'string') {
                        bookedSeats.push(s.trim());
                    }
                });
            } else if (typeof t.seats === 'string') {
                t.seats.split(',').forEach(sub => {
                    const trimmed = sub.trim();
                    if (trimmed) bookedSeats.push(trimmed);
                });
            }
        });
        bookedSeats = [...new Set(bookedSeats)];

        // Tự động giải phóng toàn bộ các ghế giữ đã quá hạn 5 phút trong MongoDB
        const lockThreshold = new Date(Date.now() - SEAT_HOLD_TIMEOUT_MS);
        await SeatLock.deleteMany({ createdAt: { $lt: lockThreshold } });

        // Lấy ID người dùng từ session hiện tại
        const currentUserId = req.session.user && req.session.user._id 
            ? req.session.user._id.toString() 
            : (userId || 'guest');

        const lockQuery = { 
            movieId, 
            showDate, 
            showTime,
            createdAt: { $gte: lockThreshold }
        };
        if (cinemaRegex) lockQuery.cinema = cinemaRegex;
        // Loại trừ ghế của chính người dùng hiện tại để họ không bao giờ bị chặn bởi chính mình khi reload/quay lại
        if (currentUserId && currentUserId !== 'guest') {
            lockQuery.userId = { $ne: currentUserId };
        } else if (userId) {
            lockQuery.userId = { $ne: userId };
        }
        const activeLocks = await SeatLock.find(lockQuery);
        const tempLocked = [...new Set(activeLocks.map(l => (l.seat ? l.seat.trim() : '')).filter(Boolean))];

        res.json({ bookedSeats, tempLocked });
    } catch (error) { 
        res.status(500).json({ error: "Lỗi tải sơ đồ ghế" }); 
    }
});

// [MỚI] API NHỊP TIM (HEARTBEAT) DUY TRÌ GIỮ GHẾ KHI KHÁCH ĐANG Ở TRANG THANH TOÁN
// Cứ 15s gửi ping một lần để gia hạn thêm 45s. Nếu khách mất mạng, tắt máy hoặc kill app -> sau 45s ghế tự nhả ngay!
router.post('/api/heartbeat-giu-ghe', async (req, res) => {
    try {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch(e) { body = {}; }
        }
        let { movieId, cinema, showDate, showTime, seats } = body || {};
        const currentUserId = req.session.user && req.session.user._id ? req.session.user._id.toString() : 'guest';
        const seatList = Array.isArray(seats)
            ? seats
            : (typeof seats === 'string' ? seats.split(',').map(s => s.trim()).filter(Boolean) : []);

        if (movieId && showDate && showTime && seatList.length > 0) {
            const filter = {
                movieId,
                showDate,
                showTime,
                seat: { $in: seatList }
            };
            if (cinema) {
                const escaped = escapeRegex(cinema);
                filter.cinema = { $regex: new RegExp(`^${escaped}$`, 'i') };
            }
            if (currentUserId && currentUserId !== 'guest') {
                filter.userId = currentUserId;
            }

            // Gia hạn thời hạn giữ ghế thêm 45s
            await SeatLock.updateMany(filter, { $set: { createdAt: new Date() } });
            return res.json({ success: true, refreshed: true });
        }
        res.json({ success: false, message: 'Dữ liệu không hợp lệ' });
    } catch(err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// [MỚI] API GIẢI PHÓNG GHẾ GIỮ CHỖ TỨC THÌ (Khi khách rời khỏi trang thanh toán, đóng tab hoặc click link khác)
router.post('/api/huy-giu-ghe', async (req, res) => {
    try {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch(e) { body = {}; }
        }
        let { movieId, cinema, showDate, showTime, seats } = body || {};

        const seatList = Array.isArray(seats)
            ? seats
            : (typeof seats === 'string' ? seats.split(',').map(s => s.trim()).filter(Boolean) : []);

        const filter = {};
        if (movieId) filter.movieId = movieId;
        if (cinema) {
            const escaped = escapeRegex(cinema);
            filter.cinema = { $regex: new RegExp(`^${escaped}$`, 'i') };
        }
        if (showDate) filter.showDate = showDate;
        if (showTime) filter.showTime = showTime;
        if (seatList.length > 0) filter.seat = { $in: seatList };

        const result = await SeatLock.deleteMany(filter);
        res.json({ success: true, released: result.deletedCount });
    } catch (error) {
        console.error("Lỗi giải phóng giữ ghế:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// [MỚI] API ĐẶT BẮP NƯỚC RIÊNG LẺ (CONCESSIONS FAST-TRACK CÓ ÁP DỤNG VOUCHER)
router.post('/api/dat-bap-nuoc', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ 
                success: false, 
                requireLogin: true, 
                error: 'Vui lòng đăng nhập tài khoản CineGo để thanh toán đơn bắp nước!' 
            });
        }
        const { cinema, custName, custPhone, comboDetails, totalAmount, voucherCode, discountAmount, originalPrice } = req.body;
        const total = Number(totalAmount) || 0;
        const discount = Number(discountAmount) || 0;
        const origPrice = Number(originalPrice) || (total + discount);
        const currentCinema = cinema || 'CGV Kim Cúc Plaza';

        if (voucherCode) {
            const vCheck = await Voucher.findOne({ code: voucherCode.trim().toUpperCase() });
            if (vCheck && vCheck.applicableTo === 'movie') {
                return res.status(400).json({ success: false, error: 'Mã voucher này chỉ dành riêng cho Vé xem phim, không áp dụng cho đơn bắp nước!' });
            }
        }

        const userId = req.session.user._id;

        const savedTicket = await new Ticket({
            user: userId,
            movie: null,
            cinema: currentCinema,
            showDate: new Date().toISOString().split('T')[0],
            showTime: 'Fast-Track',
            seats: ['Quầy F&B'],
            comboDetails: comboDetails || 'Combo Bắp Nước Online',
            comboTotal: origPrice,
            originalPrice: origPrice,
            discountAmount: discount,
            voucherCode: voucherCode || '',
            totalPrice: total,
            paymentMethod: 'vietqr'
        }).save();

        if (userId) {
            // Nếu có áp dụng mã voucher, ghi nhận voucher đã dùng để không dùng lại
            if (voucherCode) {
                await User.findByIdAndUpdate(userId, {
                    $addToSet: { usedVouchers: voucherCode.trim().toUpperCase() }
                });
            }

            // Tích điểm cho đơn bắp nước
            const earnedPoints = Math.floor(total / 1000);
            if (earnedPoints > 0) {
                const userInDb = await User.findById(userId);
                if (userInDb) {
                    userInDb.diemTichLuy = (userInDb.diemTichLuy || 0) + earnedPoints;
                    if (userInDb.diemTichLuy >= 1000) userInDb.hangHoiVien = 'KimCuong';
                    else if (userInDb.diemTichLuy >= 600) userInDb.hangHoiVien = 'Vang';
                    else if (userInDb.diemTichLuy >= 300) userInDb.hangHoiVien = 'Bac';
                    else userInDb.hangHoiVien = 'Dong';
                    await userInDb.save();
                    req.session.user = userInDb;
                }
            }
        }

        res.json({ 
            success: true, 
            ticketId: savedTicket._id, 
            message: 'Đơn bắp nước đã được xác nhận thành công! Vé nhận đồ ăn đã được tạo.' 
        });
    } catch (error) {
        console.error("Lỗi đặt bắp nước:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/api/khoa-ghe', async (req, res) => {
    try {
        const { movieId, showDate, showTime, seatId, userId, cinema } = req.body;
        const selectedCinema = cinema || 'CGV Kim Cúc Plaza';
        const existing = await SeatLock.findOne({ movieId, cinema: selectedCinema, showDate, showTime, seat: seatId });
        if (existing && existing.userId !== userId) {
            return res.status(400).json({ success: false, message: "Ghế đang được người khác giữ" });
        }
        await SeatLock.findOneAndUpdate(
            { movieId, cinema: selectedCinema, showDate, showTime, seat: seatId },
            { userId, createdAt: new Date() },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/api/mo-khoa-ghe', async (req, res) => {
    try {
        const { movieId, showDate, showTime, seatId, userId, cinema } = req.body;
        const selectedCinema = cinema || 'CGV Kim Cúc Plaza';
        await SeatLock.deleteOne({ movieId, cinema: selectedCinema, showDate, showTime, seat: seatId, userId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/khuyen-mai', async (req, res) => {
    try { 
        res.render('trangkhuyenmai', { 
            vouchers: await Voucher.find({ isReward: { $ne: true } }).sort({ createdAt: -1 }) 
        }); 
    } catch (error) { 
        res.status(500).send("Lỗi tải trang"); 
    }
});
router.get('/uu-dai', (req, res) => res.redirect('/khuyen-mai'));

router.get('/tai-khoan', checkLogin, (req, res) => res.redirect('/tai-khoan/thong-tin'));
router.get('/tai-khoan/ve-cua-toi', checkLogin, async (req, res) => {
    try { 
        res.render('lichsudatve', { 
            tickets: await Ticket.find({ user: req.session.user._id }).populate('movie').sort({ _id: -1 }),
            user: req.session.user || null
        }); 
    } catch (error) { 
        res.status(500).send("Lỗi tải lịch sử"); 
    }
});

// Helper kiểm tra và trao quà sinh nhật hàng năm tự động
async function checkAndAwardBirthdayGift(user) {
    if (!user || !user.ngaySinh) return false;
    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const birth = new Date(user.ngaySinh);
        
        // Kiểm tra đúng ngày và tháng sinh
        const isBirthdayToday = (now.getMonth() === birth.getMonth() && now.getDate() === birth.getDate());
        
        if (isBirthdayToday && user.lastBirthdayGiftYear !== currentYear) {
            const bdayCode = `BDAY${currentYear}-${user._id.toString().slice(-4).toUpperCase()}`;
            let bdayVoucher = await Voucher.findOne({ code: bdayCode });
            if (!bdayVoucher) {
                bdayVoucher = await new Voucher({
                    code: bdayCode,
                    title: `Ưu Đãi Mừng Sinh Nhật ${currentYear} (Giảm 100K)`,
                    discountType: 'fixed',
                    discountValue: 100000,
                    minOrderValue: 100000,
                    expiryDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
                    isReward: true,
                    rewardUser: user._id
                }).save();
            }
            
            if (!user.vouchers) user.vouchers = [];
            if (!user.vouchers.some(v => v.toString() === bdayVoucher._id.toString())) {
                user.vouchers.push(bdayVoucher._id);
            }
            
            // Tặng thêm 100 điểm thưởng mừng sinh nhật
            user.diemTichLuy = (user.diemTichLuy || 0) + 100;
            user.lastBirthdayGiftYear = currentYear;
            await user.save();
            return true;
        }
    } catch (err) {
        console.warn('Lỗi kiểm tra ưu đãi sinh nhật:', err);
    }
    return false;
}

router.get('/tai-khoan/thong-tin', checkLogin, async (req, res) => {
    try {
        const thongTinUser = await User.findById(req.session.user._id).populate('vouchers');
        if (!thongTinUser) return res.redirect('/dang-nhap');
        
        const birthdayAwarded = await checkAndAwardBirthdayGift(thongTinUser);
        if (birthdayAwarded) {
            await thongTinUser.populate('vouchers');
        }

        // Tự động kiểm tra và bù điểm cho mọi vé mà người dùng đã mua trong hệ thống (kể cả vé dùng voucher)
        const myTickets = await Ticket.find({ user: thongTinUser._id }).lean();
        if (myTickets.length > 0) {
            let totalOrderPoints = 0;
            myTickets.forEach(t => {
                let orderVal = 0;
                const orig = Number(t.originalPrice) || 0;
                const tot = Number(t.totalPrice) || 0;
                const disc = Number(t.discountAmount) || 0;
                if (orig > 0) orderVal = orig;
                else if (tot + disc > 0 && disc > 0) orderVal = tot + disc;
                else if (tot > 0) orderVal = tot;
                else {
                    let seatSum = 0;
                    if (Array.isArray(t.seats)) {
                        t.seats.forEach(s => {
                            const u = (s || '').toString().toUpperCase();
                            if (u.startsWith('F')) seatSum += 170000;
                            else if (u.startsWith('D') || u.startsWith('E')) seatSum += 95000;
                            else seatSum += 75000;
                        });
                    }
                    orderVal = seatSum + (Number(t.comboTotal) || 0);
                }
                totalOrderPoints += Math.floor(orderVal / 1000);
            });

            // Tính số điểm tích lũy sau khi trừ đi các điểm đã sử dụng để đổi voucher:
            const netExpectedPoints = Math.max(0, totalOrderPoints - (thongTinUser.diemDaDung || 0));
            // Nếu điểm tích lũy hiện tại thấp hơn số điểm xứng đáng từ lịch sử vé đã đặt:
            if ((thongTinUser.diemTichLuy || 0) < netExpectedPoints) {
                thongTinUser.diemTichLuy = netExpectedPoints;
                if (thongTinUser.diemTichLuy >= 1000) thongTinUser.hangHoiVien = 'KimCuong';
                else if (thongTinUser.diemTichLuy >= 600) thongTinUser.hangHoiVien = 'Vang';
                else if (thongTinUser.diemTichLuy >= 300) thongTinUser.hangHoiVien = 'Bac';
                else thongTinUser.hangHoiVien = 'Dong';
                await thongTinUser.save();
            }
        }
        req.session.user = thongTinUser;

        const allVouchers = await Voucher.find({ $or: [{ expiryDate: { $gte: new Date() } }, { expiryDate: null }] }).sort({ createdAt: -1 });
        const usedList = Array.isArray(thongTinUser.usedVouchers) ? thongTinUser.usedVouchers : [];
        const activeSavedVouchers = (Array.isArray(thongTinUser.vouchers) ? thongTinUser.vouchers : []).filter(v => v && v.code && !usedList.includes(v.code.toUpperCase()));
        const activeSystemVouchers = allVouchers.filter(v => v && v.code && !usedList.includes(v.code.toUpperCase()));

        res.render('thongtincanhan', { 
            user: thongTinUser, 
            vouchers: activeSystemVouchers || [], 
            savedVouchers: activeSavedVouchers || [],
            birthdayCelebration: birthdayAwarded,
            error: req.query.error || null, 
            success: req.query.success || (birthdayAwarded ? 'Chúc mừng sinh nhật! Bạn vừa nhận được Voucher Sinh Nhật 100K và +100 điểm thưởng!' : null)
        });
    } catch (error) { res.redirect('/dang-nhap'); }
});

// [ĐÃ SỬA] Cập nhật thông tin cá nhân và lưu thể loại phim yêu thích
router.post('/tai-khoan/cap-nhat', checkLogin, async (req, res) => {
    try {
        const { hoTen, sdt, ngaySinh, gender, favoriteGenres } = req.body;
        const genresList = favoriteGenres ? favoriteGenres.split(',').map(s => s.trim()).filter(Boolean) : [];
        const normalizedGender = (gender === 'Nu' || gender === 'Nữ') ? 'Nữ' : ((gender === 'Khac' || gender === 'Khác') ? 'Khác' : 'Nam');

        const updatedUser = await User.findByIdAndUpdate(
            req.session.user._id, 
            { 
                hoTen: hoTen ? hoTen.trim() : undefined, 
                soDienThoai: sdt ? sdt.trim() : undefined, 
                ngaySinh: ngaySinh ? new Date(ngaySinh) : null, 
                gioiTinh: normalizedGender,
                favoriteGenres: genresList
            }, 
            { new: true } 
        );
        if (!updatedUser) return res.redirect('/dang-nhap');
        
        const bdayAwarded = await checkAndAwardBirthdayGift(updatedUser);
        req.session.user = updatedUser; // Cập nhật lại session ngay lập tức
        
        let successMsg = 'Cập nhật hồ sơ thành công!';
        if (bdayAwarded) {
            successMsg = 'Chúc mừng sinh nhật! Bạn vừa nhận được Voucher Sinh Nhật 100K và +100 điểm thưởng!';
        }

        return new Promise((resolve, reject) => {
            req.session.save((err) => { if (err) return reject(err); resolve(); });
        }).then(() => res.redirect('/tai-khoan/thong-tin?success=' + encodeURIComponent(successMsg)));
    } catch (error) { res.status(500).send("Lỗi cập nhật: " + error.message); }
});

// [MỚI] API ĐỔI ĐIỂM THƯỞNG LẤY VOUCHER (50K, 100K) - KHẤU TRỪ ĐIỂM THỰC TẾ
router.post('/api/doi-diem-voucher', checkLogin, async (req, res) => {
    try {
        const { rewardType } = req.body;
        const user = await User.findById(req.session.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản!' });
        }

        let cost = 500; // Tăng lên 500 điểm cho voucher 50.000đ
        let discountVal = 50000;
        let voucherTitle = 'Voucher 50.000đ Đổi Bằng Điểm Thưởng';
        let baseCode = 'CINEGO50K';

        if (rewardType === '100k') {
            cost = 1000; // Tăng lên 1.000 điểm cho voucher 100.000đ
            discountVal = 100000;
            voucherTitle = 'Voucher 100.000đ Đổi Bằng Điểm Thưởng';
            baseCode = 'CINEGO100K';
        }

        if ((user.diemTichLuy || 0) < cost) {
            return res.status(400).json({ 
                success: false, 
                message: `Bạn không đủ điểm! Cần tối thiểu ${cost} điểm thưởng để đổi voucher này (Hiện có: ${user.diemTichLuy || 0} điểm).` 
            });
        }

        // Khấu trừ điểm tích lũy thật vào MongoDB và ghi nhận số điểm đã sử dụng
        user.diemTichLuy -= cost;
        user.diemDaDung = (user.diemDaDung || 0) + cost;

        // Cập nhật lại cấp bậc hội viên
        if (user.diemTichLuy >= 1000) user.hangHoiVien = 'KimCuong';
        else if (user.diemTichLuy >= 600) user.hangHoiVien = 'Vang';
        else if (user.diemTichLuy >= 300) user.hangHoiVien = 'Bac';
        else user.hangHoiVien = 'Dong';

        // Tạo mới voucher ưu đãi cho người dùng (đánh dấu isReward: true để không làm loạn danh sách voucher của Admin)
        const now = new Date();
        const code = `${baseCode}-${Date.now().toString(36).toUpperCase()}`;
        const newVoucher = await new Voucher({
            code: code,
            title: voucherTitle,
            discountType: 'fixed',
            discountValue: discountVal,
            minOrderValue: discountVal,
            expiryDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
            isReward: true,
            rewardUser: user._id
        }).save();

        if (!user.vouchers) user.vouchers = [];
        user.vouchers.push(newVoucher._id);
        await user.save();
        req.session.user = user;

        res.json({
            success: true,
            message: `Đổi thành công Voucher ${discountVal.toLocaleString('vi-VN')}đ! Bạn đã trừ ${cost} điểm. Số điểm còn lại: ${user.diemTichLuy}`,
            remainingPoints: user.diemTichLuy,
            voucher: {
                _id: newVoucher._id,
                code: newVoucher.code,
                title: newVoucher.title,
                discountValue: newVoucher.discountValue
            }
        });
    } catch (err) {
        console.error('Lỗi đổi điểm voucher:', err);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đổi điểm: ' + err.message });
    }
});

// [ĐÃ SỬA] Route Đổi mật khẩu an toàn, dùng flash message thay cho script alert
router.post('/tai-khoan/doi-mat-khau', checkLogin, async (req, res, next) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const user = await User.findById(req.session.user._id).populate('vouchers');
        
        if (!user) return res.redirect('/dang-nhap');

        const renderError = async (errMsg) => {
            const vouchers = await Voucher.find({ $or: [{ expiryDate: { $gte: new Date() } }, { expiryDate: null }] }).sort({ createdAt: -1 });
            return res.render('thongtincanhan', { 
                user, 
                vouchers: vouchers || [], 
                savedVouchers: user.vouchers || [],
                error: errMsg, 
                success: null 
            });
        };

        const isMatch = await bcrypt.compare(currentPassword, user.matKhau);
        if (!isMatch) return renderError('Mật khẩu hiện tại không chính xác! Vui lòng thử lại.');

        if (newPassword !== confirmPassword) {
            return renderError('Mật khẩu mới và xác nhận không khớp!');
        }

        if (newPassword.length < 6) {
            return renderError('Mật khẩu mới phải có tối thiểu 6 ký tự!');
        }

        const salt = await bcrypt.genSalt(10);
        user.matKhau = await bcrypt.hash(newPassword, salt);
        await user.save();
        
        req.session.destroy(); // Đổi mật khẩu xong bắt đăng nhập lại cho an toàn
        res.render('trangdangnhap', { 
            success: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.', 
            error: null, 
            email: user.email 
        });
    } catch (err) {
        console.error(err);
        next(err);
    }
});

// [GIAI ĐOẠN 3] NÂNG CẤP XÁC THỰC, VALIDATION & FLASH MESSAGES
router.get('/dang-nhap', (req, res) => {
    const returnTo = req.query.returnTo || (req.session && req.session.returnTo) || '';
    if (req.session.user) {
        return res.redirect(returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/');
    }
    const warning = req.query.warning || null;
    res.render('trangdangnhap', { error: null, success: null, warning, email: '', returnTo });
});

router.get('/dang-ky', (req, res) => {
    const returnTo = req.query.returnTo || (req.session && req.session.returnTo) || '';
    if (req.session.user) {
        return res.redirect(returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/');
    }
    res.render('trangdangky', { error: null, success: null, formData: {}, returnTo });
});

router.get('/quen-mat-khau', (req, res) => {
    res.render('trangquenmkhau', { error: null, success: null, email: '' });
});

router.post('/dang-ky', async (req, res) => {
    try {
        const { hoTen, email, matKhau, soDienThoai, returnTo } = req.body;
        const formData = { hoTen, email, soDienThoai };
        const safeReturnTo = returnTo || req.query.returnTo || '';

        if (!hoTen || hoTen.trim().length < 2) {
            return res.render('trangdangky', { error: 'Họ và tên tối thiểu 2 ký tự.', formData, returnTo: safeReturnTo });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email.trim())) {
            return res.render('trangdangky', { error: 'Địa chỉ email không đúng định dạng.', formData, returnTo: safeReturnTo });
        }
        if (!soDienThoai || !/^[0-9]{10}$/.test(soDienThoai.trim())) {
            return res.render('trangdangky', { error: 'Số điện thoại phải gồm đúng 10 chữ số.', formData, returnTo: safeReturnTo });
        }
        if (!matKhau || matKhau.length < 6) {
            return res.render('trangdangky', { error: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.', formData, returnTo: safeReturnTo });
        }

        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            return res.render('trangdangky', { error: 'Địa chỉ email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.', formData, returnTo: safeReturnTo });
        }

        const hashedPassword = await bcrypt.hash(matKhau, 10);
        await User.create({ 
            hoTen: hoTen.trim(), 
            email: email.toLowerCase().trim(), 
            matKhau: hashedPassword, 
            soDienThoai: soDienThoai.trim(), 
            vaiTro: 'user',
            diemTichLuy: 0,
            hangHoiVien: 'Dong',
            favoriteGenres: []
        });

        res.render('trangdangnhap', { 
            success: 'Đăng ký tài khoản thành công! Vui lòng đăng nhập để tiếp tục đặt vé.', 
            error: null, 
            warning: null,
            email: email.toLowerCase().trim(),
            returnTo: safeReturnTo
        });
    } catch (error) { 
        console.error("Lỗi đăng ký:", error);
        res.render('trangdangky', { error: 'Lỗi đăng ký: ' + error.message, formData: req.body, returnTo: req.body.returnTo || '' }); 
    }
});

router.post('/dang-nhap', async (req, res) => {
    try {
        const { email, matKhau, returnTo } = req.body;
        const safeReturnTo = returnTo || req.query.returnTo || (req.session && req.session.returnTo) || '';
        if (!email || !matKhau) {
            return res.render('trangdangnhap', { error: 'Vui lòng nhập đầy đủ email và mật khẩu.', success: null, warning: null, email: email || '', returnTo: safeReturnTo });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.render('trangdangnhap', { error: 'Email hoặc mật khẩu không chính xác. Vui lòng thử lại!', success: null, warning: null, email, returnTo: safeReturnTo });
        }

        const isMatch = await bcrypt.compare(matKhau, user.matKhau);
        if (!isMatch) { 
            return res.render('trangdangnhap', { error: 'Email hoặc mật khẩu không chính xác. Vui lòng thử lại!', success: null, warning: null, email, returnTo: safeReturnTo });
        }

        req.session.user = user;
        req.session.save((err) => {
            if (err) console.error("Session save error:", err);
            if (safeReturnTo && safeReturnTo.startsWith('/') && !safeReturnTo.startsWith('//')) {
                delete req.session.returnTo;
                return res.redirect(safeReturnTo);
            }
            res.redirect('/?success=' + encodeURIComponent('Đăng nhập thành công! Chào mừng ' + (user.hoTen || 'bạn') + ' trở lại CineGo.'));
        });
    } catch (error) { 
        console.error("Lỗi đăng nhập:", error);
        res.render('trangdangnhap', { error: 'Lỗi đăng nhập: ' + error.message, success: null, warning: null, email: req.body.email || '', returnTo: req.body.returnTo || '' }); 
    }
});

router.get('/dang-xuat', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error("Lỗi hủy session khi đăng xuất:", err);
        res.clearCookie('connect.sid');
        res.redirect('/?info=' + encodeURIComponent('Đã đăng xuất tài khoản an toàn.'));
    });
});

router.post('/quen-mat-khau', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.trim()) {
            return res.render('trangquenmkhau', { error: 'Vui lòng nhập địa chỉ email!', success: null, email: '' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (user) {
            const token = crypto.randomBytes(24).toString('hex');
            user.resetPasswordToken = token;
            user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 phút hiệu lực
            await user.save();

            res.render('trangquenmkhau', { 
                success: `Mã bảo mật đặt lại mật khẩu đã được khởi tạo thành công (Hiệu lực 15 phút).`, 
                resetLink: `/dat-lai-mat-khau/${token}`,
                error: null, 
                email 
            });
        } else {
            res.render('trangquenmkhau', { 
                error: 'Không tìm thấy tài khoản nào liên kết với địa chỉ email này.', 
                success: null, 
                email 
            });
        }
    } catch (error) { 
        console.error("Lỗi quên mật khẩu:", error);
        res.render('trangquenmkhau', { error: 'Lỗi hệ thống: ' + error.message, success: null, email: req.body.email || '' }); 
    }
});

// [MỚI] TRANG NHẬP MẬT KHẨU MỚI TỪ TOKEN BẢO MẬT
router.get('/dat-lai-mat-khau/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        if (!user) {
            return res.render('trangquenmkhau', {
                error: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn (quá 15 phút). Vui lòng gửi lại yêu cầu.',
                success: null,
                email: ''
            });
        }
        res.render('trangdatlaimk', { token: req.params.token, error: null, title: 'Thiết Lập Mật Khẩu Mới — CineGo' });
    } catch (error) {
        console.error("Lỗi liên kết đặt lại mật khẩu:", error);
        res.redirect('/quen-mat-khau');
    }
});

// [MỚI] XÁC NHẬN LƯU MẬT KHẨU MỚI
router.post('/dat-lai-mat-khau/:token', async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body;
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.render('trangquenmkhau', {
                error: 'Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thực hiện lại yêu cầu.',
                success: null,
                email: ''
            });
        }

        if (!newPassword || newPassword.length < 6) {
            return res.render('trangdatlaimk', {
                token: req.params.token,
                error: 'Mật khẩu mới phải có tối thiểu 6 ký tự!',
                title: 'Thiết Lập Mật Khẩu Mới — CineGo'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.render('trangdatlaimk', {
                token: req.params.token,
                error: 'Mật khẩu mới và xác nhận mật khẩu không khớp!',
                title: 'Thiết Lập Mật Khẩu Mới — CineGo'
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.matKhau = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.render('trangdangnhap', {
            success: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.',
            error: null,
            email: user.email
        });
    } catch (error) {
        console.error("Lỗi lưu mật khẩu mới:", error);
        res.render('trangdatlaimk', {
            token: req.params.token,
            error: 'Lỗi cập nhật mật khẩu: ' + error.message,
            title: 'Thiết Lập Mật Khẩu Mới — CineGo'
        });
    }
});

module.exports = router;