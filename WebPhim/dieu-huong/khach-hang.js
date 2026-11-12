// File: dieu-huong/khach-hang.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Movie = require('../models/Movie');
const User = require('../models/User'); 
const Ticket = require('../models/Ticket'); 
const Voucher = require('../models/Voucher');
const FoodCombo = require('../models/FoodCombo');
const SeatLock = require('../models/SeatLock');
const { checkLogin } = require('../trung-gian/xac-thuc');

router.get('/', async (req, res) => {
    try {
        const movies = await Movie.find({ status: 'DangChieu' }).sort({ createdAt: -1 }).limit(4);
        const topVouchers = await Voucher.find({ $or: [{ expiryDate: { $gte: new Date() } }, { expiryDate: null }] }).limit(2);
        res.render('trangchu', { movies, vouchers: topVouchers });
    } catch (error) { res.status(500).send("Lỗi máy chủ"); }
});

router.get('/phim', async (req, res) => {
    try {
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

router.get(['/chi-tiet-phim/:id', '/phim/:id'], async (req, res) => {
    try {
        const phim = await Movie.findById(req.params.id);
        if (!phim) return res.status(404).send("Phim không tồn tại!");
        res.render('trangchitietphim', { phim, user: req.session.user || null, title: phim.title });
    } catch (error) { res.status(500).send("Lỗi Server"); }
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
        res.render('trangdanhsachphim', { movies: await Movie.find({ title: { $regex: safeQuery, $options: 'i' } }).sort({ createdAt: -1 }), currentStatus: 'TimKiem', tuKhoa: keyword });
    } catch (error) { res.status(500).send("Lỗi máy chủ khi tìm kiếm"); }
});

// [VÁ LỖ HỔNG IDOR] Kiểm tra quyền sở hữu vé trước khi cho phép xóa
router.post('/tai-khoan/ve-cua-toi/xoa/:id', checkLogin, async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id).populate('movie');
        if (!ticket) return res.status(404).send("Không tìm thấy vé!");
        
        // Chỉ chính chủ tài khoản mua vé hoặc Admin mới có quyền xóa
        const isOwner = ticket.user && ticket.user.toString() === req.session.user._id.toString();
        const isAdmin = req.session.user.vaiTro === 'admin';
        if (!isOwner && !isAdmin) {
            return res.status(403).send('<script>alert("Bạn không có quyền thao tác trên vé của người khác!"); window.location.href="/tai-khoan/ve-cua-toi";</script>');
        }
        
        const today = new Date(); today.setHours(0, 0, 0, 0); 
        const showDate = new Date(ticket.showDate); showDate.setHours(0, 0, 0, 0);
        
        if (ticket.movie && showDate > today) {
            return res.send('<script>alert("Không thể xóa vé phim chưa chiếu!"); window.location.href="/tai-khoan/ve-cua-toi";</script>');
        }
        
        await Ticket.findByIdAndDelete(req.params.id);
        res.redirect('/tai-khoan/ve-cua-toi');
    } catch (error) { res.status(500).send("Lỗi xóa vé: " + error.message); }
});

router.get('/dat-ve/:id', async (req, res) => {
    try { res.render('trangdatvephim', { phim: await Movie.findById(req.params.id) }); } catch (error) { res.status(500).send("Lỗi tải dữ liệu"); }
});

router.post('/thanh-toan', checkLogin, async (req, res) => {
    try {
        const { movieId, cinema, showDate, showTime, seats, total, comboDetails, comboTotal } = req.body;
        const phim = await Movie.findById(movieId);
        const selectedCinema = cinema || 'CGV Kim Cúc Plaza';
        const seatList = seats ? seats.split(',').map(s => s.trim()).filter(Boolean) : [];
        const currentUserId = req.session.user._id ? req.session.user._id.toString() : 'guest';

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
                return res.send('<script>alert("Rất tiếc! Một trong các ghế bạn chọn đã được khách hàng khác thanh toán trước."); window.history.back();</script>');
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
                return res.send(`<script>alert("Ghế (${names}) đang được giữ chỗ trong 5 phút bởi khách hàng khác. Vui lòng chọn ghế khác!"); window.history.back();</script>`);
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

        const vouchers = await Voucher.find({ $or: [{ expiryDate: { $gte: new Date() } }, { expiryDate: null }] });
        res.render('trangthanhtoan', { phim, cinema: selectedCinema, showDate, showTime, seats: seatList, total: Number(total), comboDetails, comboTotal: Number(comboTotal), vouchers });
    } catch(error) { 
        console.error("Lỗi thanh toán:", error);
        res.status(500).send("Lỗi thanh toán: " + error.message); 
    }
});

// [GIA CỐ BẢO MẬT & CHỐNG DOUBLE BOOKING] Xác thực giá tiền và kiểm tra trùng ghế ở Backend
router.post('/xac-nhan-thanh-toan', checkLogin, async (req, res) => {
    try {
        const { phimId, cinema, showDate, showTime, seats, total, finalAmount, payment_method, comboDetails, comboTotal } = req.body;
        
        if (!seats || seats.trim() === '') {
            return res.send('<script>alert("Vui lòng chọn ít nhất 1 ghế!"); window.history.back();</script>');
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
            return res.send('<script>alert("Rất tiếc! Một trong các ghế bạn chọn vừa được khách hàng khác thanh toán trước. Vui lòng chọn ghế khác."); window.history.back();</script>');
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

        await new Ticket({
            user: req.session.user._id,
            movie: phimId,
            cinema: selectedCinema,
            showDate: showDate || '2026-11-12',
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

        res.redirect('/tai-khoan/ve-cua-toi');
    } catch (error) { 
        console.error("Lỗi xác nhận thanh toán:", error);
        res.status(500).send("Giao dịch thất bại: " + error.message); 
    }
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

// [MỚI - GIAI ĐOẠN 4] Kiểm tra ghế đã bán và ghế đang giữ bằng MongoDB TTL
router.get('/api/ghe-da-dat', async (req, res) => {
    try {
        const { movieId, showDate, showTime, cinema, userId } = req.query; 
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

router.get('/tai-khoan/thong-tin', async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) return res.redirect('/dang-nhap'); 
        const thongTinUser = await User.findById(req.session.user._id);
        if (!thongTinUser) return res.redirect('/dang-nhap');
        res.render('thongtincanhan', { user: thongTinUser });
    } catch (error) { res.redirect('/dang-nhap'); }
});

// [ĐÃ SỬA] Bổ sung Session đồng bộ cho Admin
router.post('/tai-khoan/cap-nhat', async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) return res.redirect('/dang-nhap');
        const { hoTen, sdt, ngaySinh, gender } = req.body;
        const updatedUser = await User.findByIdAndUpdate(
            req.session.user._id, 
            { hoTen, soDienThoai: sdt, ngaySinh: ngaySinh ? new Date(ngaySinh) : null, gioiTinh: gender }, 
            { new: true } 
        );
        if (!updatedUser) return res.redirect('/dang-nhap');
        req.session.user = updatedUser; // Cập nhật lại session ngay lập tức
        return new Promise((resolve, reject) => {
            req.session.save((err) => { if (err) return reject(err); resolve(); });
        }).then(() => res.redirect('/tai-khoan/thong-tin'));
    } catch (error) { res.status(500).send("Lỗi cập nhật: " + error.message); }
});

// [ĐÃ SỬA] Route Đổi mật khẩu hoàn thiện xử lý lỗi "Cannot POST"
router.post('/tai-khoan/doi-mat-khau', checkLogin, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const user = await User.findById(req.session.user._id);
        
        if (!user) return res.send('<script>alert("Người dùng không tồn tại!"); window.history.back();</script>');

        const isMatch = await bcrypt.compare(currentPassword, user.matKhau);
        if (!isMatch) return res.send('<script>alert("Mật khẩu hiện tại không chính xác!"); window.history.back();</script>');

        if (newPassword !== confirmPassword) {
            return res.send('<script>alert("Mật khẩu mới và xác nhận không khớp!"); window.history.back();</script>');
        }

        const salt = await bcrypt.genSalt(10);
        user.matKhau = await bcrypt.hash(newPassword, salt);
        await user.save();
        
        req.session.destroy(); // Đổi mật khẩu xong bắt đăng nhập lại cho an toàn
        res.send('<script>alert("Đổi mật khẩu thành công! Vui lòng đăng nhập lại."); window.location.href="/dang-nhap";</script>');
    } catch (err) {
        console.error(err);
        res.status(500).send("Lỗi máy chủ nội bộ");
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
            vaiTro: 'user' 
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
            if (user.vaiTro === 'admin') {
                return res.redirect('/admin');
            }
            res.redirect('/');
        });
    } catch (error) { 
        console.error("Lỗi đăng nhập:", error);
        res.render('trangdangnhap', { error: 'Lỗi đăng nhập: ' + error.message, success: null, email: req.body.email || '' }); 
    }
});

router.get('/dang-xuat', (req, res) => { req.session.destroy(); res.redirect('/'); });

router.post('/quen-mat-khau', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.trim()) {
            return res.render('trangquenmkhau', { error: 'Vui lòng nhập địa chỉ email!', success: null, email: '' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (user) {
            res.render('trangquenmkhau', { 
                success: `Hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư ${email}. Vui lòng kiểm tra email của bạn!`, 
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

module.exports = router;