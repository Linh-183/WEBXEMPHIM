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
        const topVouchers = await Voucher.find({ $or: [{ expiryDate: { $gte: new Date() } }, { expiryDate: null }] }).limit(2);
        res.render('trangchu', { movies, vouchers: topVouchers });
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
        res.render('trangchitietphim', { phim, user: req.session.user || null, title: phim.title });
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
        const safeQuery = escapeRegex(keyword);
        const movies = await Movie.find({ title: { $regex: safeQuery, $options: 'i' } }).sort({ createdAt: -1 });
        res.render('trangtimkiem', { movies, tuKhoa: keyword, user: req.session.user || null, title: `Tìm Kiếm: "${keyword}" — CineGo` });
    } catch (error) { res.status(500).send("Lỗi máy chủ khi tìm kiếm"); }
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
        res.redirect('/tai-khoan/ve-cua-toi');
    } catch (error) { 
        res.redirect('/tai-khoan/ve-cua-toi?error=' + encodeURIComponent(error.message)); 
    }
});

router.get('/dat-ve/:id', async (req, res, next) => {
    try { 
        if (!isValidObjectId(req.params.id)) {
            return res.status(404).render('404', { title: '404 — Không Tìm Thấy Suất Chiếu' });
        }
        const phim = await Movie.findById(req.params.id);
        if (!phim) return res.status(404).render('404', { title: '404 — Không Tìm Thấy Suất Chiếu' });
        res.render('trangdatvephim', { phim, error: req.query.error || null }); 
    } catch (error) { next(error); }
});

router.post('/thanh-toan', checkLogin, async (req, res) => {
    try {
        const { movieId, cinema, showDate, showTime, seats, total, comboDetails, comboTotal } = req.body;
        const phim = await Movie.findById(movieId);
        const selectedCinema = cinema || 'CGV Kim Cúc Plaza';
        const seatList = seats ? seats.split(',').map(s => s.trim()).filter(Boolean) : [];
        const currentUserId = req.session.user._id ? req.session.user._id.toString() : 'guest';

        // 0. Chống đặt vé các suất chiếu trong quá khứ (Thời gian thực)
        const todayZero = new Date();
        todayZero.setHours(0, 0, 0, 0);
        const bookingDate = new Date(showDate);
        bookingDate.setHours(0, 0, 0, 0);
        if (bookingDate < todayZero) {
            return res.redirect(`/dat-ve/${movieId}?error=${encodeURIComponent('Suất chiếu này đã thuộc về quá khứ! Vui lòng chọn lịch chiếu từ hôm nay trở đi.')}`);
        }

        if (seatList.length > 0) {
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
                userId: { $ne: currentUserId }
            });
            if (lockedByOthers.length > 0) {
                const names = lockedByOthers.map(l => l.seat).join(', ');
                return res.redirect(`/dat-ve/${movieId}?error=${encodeURIComponent(`Ghế (${names}) đang được giữ chỗ trong 5 phút bởi khách hàng khác. Vui lòng chọn ghế khác!`)}`);
            }

            // 3. Khóa ghế an toàn trong MongoDB SeatLock (5 phút TTL tự động xóa)
            for (const s of seatList) {
                await SeatLock.findOneAndUpdate(
                    { movieId, cinema: selectedCinema, showDate, showTime, seat: s },
                    { userId: currentUserId, createdAt: new Date() },
                    { upsert: true }
                );
            }
        }

        let savedVouchers = [];
        if (req.session.user && req.session.user._id) {
            const currentUserWithVouchers = await User.findById(req.session.user._id).populate('vouchers');
            if (currentUserWithVouchers && currentUserWithVouchers.vouchers) {
                savedVouchers = currentUserWithVouchers.vouchers;
            }
        }
        const vouchers = await Voucher.find({ $or: [{ expiryDate: { $gte: new Date() } }, { expiryDate: null }] });
        res.render('trangthanhtoan', { phim, cinema: selectedCinema, showDate, showTime, seats: seatList, total: Number(total), comboDetails, comboTotal: Number(comboTotal), vouchers, savedVouchers });
    } catch(error) { 
        console.error("Lỗi thanh toán:", error);
        res.status(500).send("Lỗi thanh toán: " + error.message); 
    }
});

// [GIA CỐ BẢO MẬT & CHỐNG DOUBLE BOOKING] Xác thực giá tiền và kiểm tra trùng ghế ở Backend
router.post('/xac-nhan-thanh-toan', checkLogin, async (req, res, next) => {
    try {
        const { phimId, cinema, showDate, showTime, seats, total, finalAmount, payment_method, comboDetails, comboTotal } = req.body;
        
        if (!seats || seats.trim() === '') {
            return res.redirect(`/dat-ve/${phimId}?error=${encodeURIComponent('Vui lòng chọn ít nhất 1 ghế trước khi thanh toán!')}`);
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

        // 2. Tính toán lại giá vé ở Backend (Chống gian lận Client sửa giá POST request)
        let calculatedSeatPrice = 0;
        seatList.forEach(code => {
            const upper = code.toUpperCase();
            if (upper.startsWith('F')) {
                calculatedSeatPrice += 170000; // Ghế đôi Sweetbox
            } else if (upper.startsWith('D') || upper.startsWith('E')) {
                calculatedSeatPrice += 95000;  // Ghế VIP
            } else {
                calculatedSeatPrice += 75000;  // Ghế tiêu chuẩn
            }
        });

        const safeComboTotal = Number(comboTotal) || 0;
        const expectedBaseTotal = calculatedSeatPrice + safeComboTotal;

        // Kiểm tra finalAmount hợp lệ (không âm và không vượt quá tổng tạm tính)
        let verifiedTotalPrice = finalAmount ? Number(finalAmount) : Number(total);
        if (isNaN(verifiedTotalPrice) || verifiedTotalPrice < 0 || verifiedTotalPrice > expectedBaseTotal) {
            verifiedTotalPrice = expectedBaseTotal;
        }

        const savedTicket = await new Ticket({
            user: req.session.user._id,
            movie: phimId,
            cinema: selectedCinema,
            showDate: showDate || new Date().toISOString().split('T')[0],
            showTime: showTime || '19:30',
            seats: seatList,
            comboDetails: comboDetails || '',
            comboTotal: safeComboTotal,
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

        // Tích điểm tự động: 10.000đ = 1 Điểm & Cập nhật hạng hội viên (Đồng -> Bạc -> Vàng -> Kim Cương)
        const earnedPoints = Math.floor(verifiedTotalPrice / 10000);
        if (earnedPoints > 0 && req.session.user && req.session.user._id) {
            const userInDb = await User.findById(req.session.user._id);
            if (userInDb) {
                userInDb.diemTichLuy = (userInDb.diemTichLuy || 0) + earnedPoints;
                if (userInDb.diemTichLuy >= 600) userInDb.hangHoiVien = 'KimCuong';
                else if (userInDb.diemTichLuy >= 300) userInDb.hangHoiVien = 'Vang';
                else if (userInDb.diemTichLuy >= 100) userInDb.hangHoiVien = 'Bac';
                else userInDb.hangHoiVien = 'Dong';
                await userInDb.save();
                req.session.user = userInDb;
            }
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
        }).populate('movie');

        const upcomingSales = await FlashSale.find({
            isActive: true,
            startTime: { $gt: now }
        }).populate('movie').sort({ startTime: 1 });

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

// API Người Dùng Nhận Mã Ưu Đãi Flash Sale Vào Ví
router.post('/api/nhan-flash-voucher', checkLogin, async (req, res) => {
    try {
        const { saleId } = req.body;
        if (!isValidObjectId(saleId)) return res.json({ success: false, message: 'Đợt Flash Sale không hợp lệ.' });
        const sale = await FlashSale.findById(saleId);
        if (!sale || !sale.isActive) return res.json({ success: false, message: 'Đợt Flash Sale này không khả dụng.' });

        const now = new Date();
        if (now < sale.startTime || now > sale.endTime) {
            return res.json({ success: false, message: 'Khung giờ Flash Sale chưa bắt đầu hoặc đã kết thúc.' });
        }
        if (sale.claimedQuantity >= sale.totalQuantity) {
            return res.json({ success: false, message: 'Đợt Flash Sale này đã hết số lượng vé mở bán.' });
        }

        // Tự động tạo voucher trong bảng Voucher nếu chưa có
        let v = await Voucher.findOne({ code: sale.voucherCode });
        if (!v) {
            v = await Voucher.create({
                code: sale.voucherCode,
                title: sale.title,
                discountType: 'fixed',
                discountValue: sale.originalPrice - sale.salePrice,
                minOrderValue: sale.originalPrice,
                maxDiscountValue: sale.originalPrice - sale.salePrice,
                expiryDate: sale.endTime
            });
        }

        sale.claimedQuantity += 1;
        await sale.save();

        res.json({ 
            success: true, 
            message: `Bạn đã nhận mã ${sale.voucherCode} thành công! Hãy kiểm tra ví voucher để áp dụng khi đặt vé.` 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + err.message });
    }
});

router.get('/danh-gia', (req, res) => {
    res.render('trangdanhgia', { user: req.session.user || null, title: 'Bình Phẩm & Đánh Giá Điện Ảnh — CineGo' });
});

// [ĐÃ SỬA] API Kiểm tra Voucher
router.post('/api/kiem-tra-voucher', checkLogin, async (req, res) => {
    try {
        const { code, currentTotal } = req.body;
        const v = await Voucher.findOne({ code: code.toUpperCase() });
        if (!v) return res.json({ success: false, message: "Mã không tồn tại!" });
        if (v.expiryDate && new Date(v.expiryDate) < new Date()) return res.json({ success: false, message: "Mã đã hết hạn!" });
        if (currentTotal < (v.minOrderValue || 0)) return res.json({ success: false, message: `Đơn tối thiểu là ${v.minOrderValue.toLocaleString('vi-VN')}đ` });
        res.json({ success: true, discountType: v.discountType, discountValue: v.discountValue, maxDiscountValue: v.maxDiscountValue || 0, message: "Áp dụng mã thành công!" });
    } catch (error) { res.status(500).json({ success: false, message: "Lỗi hệ thống khi kiểm tra voucher" }); }
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
        const tickets = await Ticket.find({ movie: movieId, cinema: cinema, showDate, showTime });
        let bookedSeats = [];
        tickets.forEach(t => bookedSeats.push(...t.seats));

        const lockQuery = { movieId, cinema, showDate, showTime };
        if (userId) lockQuery.userId = { $ne: userId };
        const activeLocks = await SeatLock.find(lockQuery);
        const tempLocked = activeLocks.map(l => l.seat);

        res.json({ bookedSeats, tempLocked });
    } catch (error) { res.status(500).json({ error: "Lỗi tải sơ đồ ghế" }); }
});

// [MỚI] API ĐẶT BẮP NƯỚC RIÊNG LẺ (CONCESSIONS FAST-TRACK)
router.post('/api/dat-bap-nuoc', async (req, res) => {
    try {
        const { cinema, custName, custPhone, comboDetails, totalAmount } = req.body;
        const total = Number(totalAmount) || 0;
        const currentCinema = cinema || 'CGV Kim Cúc Plaza';

        if (req.session.user && req.session.user._id) {
            await new Ticket({
                user: req.session.user._id,
                movie: null,
                cinema: currentCinema,
                showDate: new Date().toISOString().split('T')[0],
                showTime: 'Fast-Track',
                seats: ['Quầy F&B'],
                comboDetails: comboDetails || 'Combo Bắp Nước Online',
                comboTotal: total,
                totalPrice: total,
                paymentMethod: 'vietqr'
            }).save();
        }

        res.json({ success: true, message: 'Đơn bắp nước đã được xác nhận thành công!' });
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
    try { res.render('trangkhuyenmai', { vouchers: await Voucher.find().sort({ createdAt: -1 }) }); } catch (error) { res.status(500).send("Lỗi tải trang"); }
});
router.get('/uu-dai', (req, res) => res.redirect('/khuyen-mai'));

router.get('/tai-khoan', checkLogin, (req, res) => res.redirect('/tai-khoan/thong-tin'));
router.get('/tai-khoan/ve-cua-toi', checkLogin, async (req, res) => {
    try { res.render('lichsudatve', { tickets: await Ticket.find({ user: req.session.user._id }).populate('movie').sort({ _id: -1 }) }); } catch (error) { res.status(500).send("Lỗi tải lịch sử"); }
});

router.get('/tai-khoan/thong-tin', checkLogin, async (req, res) => {
    try {
        const thongTinUser = await User.findById(req.session.user._id).populate('vouchers');
        if (!thongTinUser) return res.redirect('/dang-nhap');
        const vouchers = await Voucher.find({ $or: [{ expiryDate: { $gte: new Date() } }, { expiryDate: null }] }).sort({ createdAt: -1 });
        res.render('thongtincanhan', { 
            user: thongTinUser, 
            vouchers: vouchers || [], 
            savedVouchers: thongTinUser.vouchers || [],
            error: req.query.error || null, 
            success: req.query.success || null 
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
        req.session.user = updatedUser; // Cập nhật lại session ngay lập tức
        return new Promise((resolve, reject) => {
            req.session.save((err) => { if (err) return reject(err); resolve(); });
        }).then(() => res.redirect('/tai-khoan/thong-tin?success=' + encodeURIComponent('Cập nhật hồ sơ thành công!')));
    } catch (error) { res.status(500).send("Lỗi cập nhật: " + error.message); }
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
    if (req.session.user) return res.redirect('/');
    res.render('trangdangnhap', { error: null, success: null, email: '' });
});

router.get('/dang-ky', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('trangdangky', { error: null, success: null, formData: {} });
});

router.get('/quen-mat-khau', (req, res) => {
    res.render('trangquenmkhau', { error: null, success: null, email: '' });
});

router.post('/dang-ky', async (req, res) => {
    try {
        const { hoTen, email, matKhau, soDienThoai } = req.body;
        const formData = { hoTen, email, soDienThoai };

        if (!hoTen || hoTen.trim().length < 2) {
            return res.render('trangdangky', { error: 'Họ và tên tối thiểu 2 ký tự.', formData });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email.trim())) {
            return res.render('trangdangky', { error: 'Địa chỉ email không đúng định dạng.', formData });
        }
        if (!soDienThoai || !/^[0-9]{10}$/.test(soDienThoai.trim())) {
            return res.render('trangdangky', { error: 'Số điện thoại phải gồm đúng 10 chữ số.', formData });
        }
        if (!matKhau || matKhau.length < 6) {
            return res.render('trangdangky', { error: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.', formData });
        }

        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            return res.render('trangdangky', { error: 'Địa chỉ email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.', formData });
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
            success: 'Đăng ký tài khoản thành công! Vui lòng đăng nhập.', 
            error: null, 
            email: email.toLowerCase().trim() 
        });
    } catch (error) { 
        console.error("Lỗi đăng ký:", error);
        res.render('trangdangky', { error: 'Lỗi đăng ký: ' + error.message, formData: req.body }); 
    }
});

router.post('/dang-nhap', async (req, res) => {
    try {
        const { email, matKhau } = req.body;
        if (!email || !matKhau) {
            return res.render('trangdangnhap', { error: 'Vui lòng nhập đầy đủ email và mật khẩu.', success: null, email: email || '' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.render('trangdangnhap', { error: 'Email hoặc mật khẩu không chính xác. Vui lòng thử lại!', success: null, email });
        }

        const isMatch = await bcrypt.compare(matKhau, user.matKhau);
        if (!isMatch) { 
            return res.render('trangdangnhap', { error: 'Email hoặc mật khẩu không chính xác. Vui lòng thử lại!', success: null, email });
        }

        req.session.user = user;
        req.session.save((err) => {
            if (err) console.error("Session save error:", err);
            // Cả tài khoản thường và Admin khi đăng nhập đều về trang chủ (Admin có nút Quản Trị trên Header)
            res.redirect('/');
        });
    } catch (error) { 
        console.error("Lỗi đăng nhập:", error);
        res.render('trangdangnhap', { error: 'Lỗi đăng nhập: ' + error.message, success: null, email: req.body.email || '' }); 
    }
});

router.get('/dang-xuat', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error("Lỗi hủy session khi đăng xuất:", err);
        res.clearCookie('connect.sid');
        res.redirect('/');
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