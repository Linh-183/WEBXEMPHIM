// File: dieu-huong/khach-hang.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Movie = require('../models/Movie');
const User = require('../models/User'); 
const Ticket = require('../models/Ticket'); 
const Voucher = require('../models/Voucher');
const { checkLogin } = require('../trung-gian/xac-thuc');

const lockedSeats = new Map();

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

router.get(['/chi-tiet-phim/:id', '/phim/:id'], async (req, res) => {
    try {
        const phim = await Movie.findById(req.params.id);
        if (!phim) return res.status(404).send("Phim không tồn tại!");
        res.render('trangchitietphim', { phim, user: req.session.user || null, title: phim.title });
    } catch (error) { res.status(500).send("Lỗi Server"); }
});

router.get('/api/tim-kiem', async (req, res) => {
    try {
        const tuKhoa = req.query.tuKhoa;
        if (!tuKhoa || tuKhoa.trim() === "") return res.json([]); 
        res.json(await Movie.find({ title: { $regex: tuKhoa, $options: 'i' } }).limit(5).select('title posterUrl ageRating _id'));
    } catch (error) { res.status(500).json({ error: "Lỗi hệ thống" }); }
});

router.get('/tim-kiem', async (req, res) => {
    try {
        const keyword = req.query.keyword || '';
        res.render('trangdanhsachphim', { movies: await Movie.find({ title: { $regex: keyword, $options: 'i' } }).sort({ createdAt: -1 }), currentStatus: 'TimKiem', tuKhoa: keyword });
    } catch (error) { res.status(500).send("Lỗi máy chủ khi tìm kiếm"); }
});

router.post('/tai-khoan/ve-cua-toi/xoa/:id', checkLogin, async (req, res) => {
    try {
        // 1. Thêm .populate('movie') để lấy dữ liệu phim
        const ticket = await Ticket.findById(req.params.id).populate('movie');
        if (!ticket) return res.status(404).send("Không tìm thấy vé!");
        
        const today = new Date(); today.setHours(0, 0, 0, 0); 
        const showDate = new Date(ticket.showDate); showDate.setHours(0, 0, 0, 0);
        
        // 2. Thêm "ticket.movie &&" vào câu điều kiện
        if (ticket.movie && showDate > today) {
            return res.send('<script>alert("Không thể xóa vé phim chưa chiếu!"); window.location.href="/tai-khoan/ve-cua-toi";</script>');
        }
        
        await Ticket.findByIdAndDelete(req.params.id);
        res.redirect('/tai-khoan/ve-cua-toi');
    } catch (error) { res.status(500).send("Lỗi xóa vé"); }
});

router.get('/dat-ve/:id', async (req, res) => {
    try { res.render('trangdatvephim', { phim: await Movie.findById(req.params.id) }); } catch (error) { res.status(500).send("Lỗi tải dữ liệu"); }
});

router.post('/thanh-toan', checkLogin, async (req, res) => {
    try {
        const { movieId, cinema, showDate, showTime, seats, total, comboDetails, comboTotal } = req.body;
        const phim = await Movie.findById(movieId);
        const vouchers = await Voucher.find({ $or: [{ expiryDate: { $gte: new Date() } }, { expiryDate: null }] });
        res.render('trangthanhtoan', { phim, cinema, showDate, showTime, seats: seats ? seats.split(',') : [], total: Number(total), comboDetails, comboTotal: Number(comboTotal), vouchers });
    } catch(error) { res.status(500).send("Lỗi thanh toán"); }
});

router.post('/xac-nhan-thanh-toan', checkLogin, async (req, res) => {
    try {
        const { phimId, cinema, showDate, showTime, seats, total, finalAmount, payment_method, comboDetails, comboTotal } = req.body;
        await new Ticket({ user: req.session.user._id, movie: phimId, cinema: cinema || 'Starlight Quy Nhơn', showDate, showTime, seats: seats.split(','), comboDetails, comboTotal: Number(comboTotal), totalPrice: finalAmount ? Number(finalAmount) : Number(total), paymentMethod: payment_method }).save();
        seats.split(',').forEach(seatId => lockedSeats.delete(`${phimId}_${showDate}_${showTime}_${seatId}`));
        res.redirect('/tai-khoan/ve-cua-toi');
    } catch (error) { res.status(500).send("Giao dịch thất bại!"); }
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

router.get('/api/ghe-da-dat', async (req, res) => {
    try {
        const { movieId, showDate, showTime, cinema, userId } = req.query; 
        const tickets = await Ticket.find({ movie: movieId, cinema: cinema, showDate, showTime });
        let bookedSeats = [];
        tickets.forEach(t => bookedSeats.push(...t.seats));
        let tempLocked = [];
        for (let [key, lockData] of lockedSeats.entries()) {
            if (Date.now() > lockData.expires) { lockedSeats.delete(key); } 
            else if (key.startsWith(`${movieId}_${showDate}_${showTime}_`) && lockData.userId !== userId) tempLocked.push(key.split('_')[3]);
        }
        res.json({ bookedSeats, tempLocked });
    } catch (error) { res.status(500).json({ error: "Lỗi" }); }
});

router.post('/api/khoa-ghe', (req, res) => {
    const { movieId, showDate, showTime, seatId, userId } = req.body;
    const key = `${movieId}_${showDate}_${showTime}_${seatId}`;
    if (lockedSeats.has(key) && Date.now() < lockedSeats.get(key).expires && lockedSeats.get(key).userId !== userId) return res.status(400).json({ success: false });
    lockedSeats.set(key, { userId, expires: Date.now() + 300000 });
    res.json({ success: true });
});

router.post('/api/mo-khoa-ghe', (req, res) => {
    const { movieId, showDate, showTime, seatId, userId } = req.body;
    const key = `${movieId}_${showDate}_${showTime}_${seatId}`;
    if (lockedSeats.get(key)?.userId === userId) lockedSeats.delete(key);
    res.json({ success: true });
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

router.get('/dang-nhap', (req, res) => res.render('trangdangnhap'));
router.get('/dang-ky', (req, res) => res.render('trangdangky'));
router.get('/quen-mat-khau', (req, res) => res.render('trangquenmkhau'));

router.post('/dang-ky', async (req, res) => {
    try {
        const { hoTen, email, matKhau, soDienThoai } = req.body;
        if (await User.findOne({ email })) return res.send('Email đã tồn tại!');
        const hashedPassword = await bcrypt.hash(matKhau, 10);
        await User.create({ hoTen, email, matKhau: hashedPassword, soDienThoai, vaiTro: 'user' });
        res.redirect('/dang-nhap');
    } catch (error) { res.status(500).send("Lỗi"); }
});

// [ĐÃ SỬA] Cập nhật toàn bộ object User vào Session để giải quyết lỗi không vào được trang Admin
router.post('/dang-nhap', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) return res.send('Sai thông tin!');
        const isMatch = await bcrypt.compare(req.body.matKhau, user.matKhau);
        if (isMatch) { 
            req.session.user = user; // Gán toàn bộ info từ MongoDB vào session bao gồm cả vaiTro
            res.redirect('/'); 
        } else {
            res.send('Sai thông tin!');
        }
    } catch (error) { res.status(500).send("Lỗi"); }
});

router.get('/dang-xuat', (req, res) => { req.session.destroy(); res.redirect('/'); });

router.post('/quen-mat-khau', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (user) res.send('Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn (tính năng đang phát triển).');
        else res.send('Không tìm thấy tài khoản với email này!');
    } catch (error) { res.status(500).send("Lỗi"); }
});

module.exports = router;