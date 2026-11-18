// File: server.js
process.env.TZ = 'Asia/Ho_Chi_Minh'; // Cố định múi giờ Việt Nam (UTC+7) trên mọi nền tảng server/cloud
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const cron = require('node-cron');

// Khai báo các Model cần thiết cho Cron Job
const Movie = require('./models/Movie');
const Voucher = require('./models/Voucher');
const FlashSale = require('./models/FlashSale');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. CẤU HÌNH GIAO DIỆN VÀ TÀI NGUYÊN TĨNH
// ==========================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Cấp quyền truy cập công khai cho thư mục public (chứa CSS, JS, hình ảnh)
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 2. MIDDLEWARE XỬ LÝ DỮ LIỆU TỪ FORM (Rất quan trọng)
// ==========================================
// Đọc dữ liệu gửi lên từ thẻ <form> (ví dụ form cập nhật thông tin cá nhân)
app.use(express.urlencoded({ extended: true }));
// Đọc dữ liệu định dạng JSON (dùng khi fetch/axios API)
app.use(express.json());

// ==========================================
// 3. CẤU HÌNH SESSION ĐỂ QUẢN LÝ ĐĂNG NHẬP
// ==========================================
app.use(session({
    secret: process.env.SESSION_SECRET || 'cinego_secret_key_sieu_bao_mat_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly: true, // Bảo vệ cookie phiên chống truy cập trộm bằng JavaScript XSS
        sameSite: 'lax', // Phòng chống tấn công CSRF
        secure: false, // Để false khi chạy localhost, đổi thành true nếu dùng HTTPS trên host thật
        maxAge: 1000 * 60 * 60 * 24 // Giữ session trong 24 giờ
    }
}));

// Middleware chuyển dữ liệu người dùng và thông báo toàn cục sang biến cục bộ của Views
// Giúp mọi file .ejs đều có thể tự động kích hoạt hệ thống CineGo Toast góc phải màn hình
app.use(async (req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.currentPath = req.path || '/';
    res.locals.flashError = req.query.error || null;
    res.locals.flashSuccess = req.query.success || null;
    res.locals.flashWarning = req.query.warning || null;
    res.locals.flashInfo = req.query.info || null;
    res.locals.activeFlashSale = null;
    res.locals.upcomingFlashSale = null;

    if (isConnected) {
        try {
            const now = new Date();
            // 1. Tìm đợt Flash Sale đang diễn ra trong khung giờ hiện tại
            let active = await FlashSale.findOne({
                isActive: true,
                startTime: { $lte: now },
                endTime: { $gte: now }
            }).sort({ startTime: -1 }).lean();

            // Nếu không có trong bảng FlashSale, kiểm tra xem có Voucher Flash Sale nào đang trong khung giờ
            if (!active) {
                const activeVoucher = await Voucher.findOne({
                    isFlashSale: true,
                    flashStartTime: { $lte: now },
                    flashEndTime: { $gte: now }
                }).sort({ flashStartTime: -1 }).lean();

                if (activeVoucher) {
                    active = {
                        title: activeVoucher.title,
                        startTime: activeVoucher.flashStartTime,
                        endTime: activeVoucher.flashEndTime,
                        salePrice: (activeVoucher.discountType === 'fixed' ? activeVoucher.discountValue : 19000),
                        totalQuantity: activeVoucher.maxQuantity || 50,
                        claimedQuantity: activeVoucher.claimedQuantity || 0,
                        voucherCode: activeVoucher.code
                    };
                }
            }

            if (active) {
                res.locals.activeFlashSale = active;
            } else {
                // 2. Tìm đợt Flash Sale sắp diễn ra trong ngày hôm nay
                let upcoming = await FlashSale.findOne({
                    isActive: true,
                    startTime: { $gt: now }
                }).sort({ startTime: 1 }).lean();

                if (!upcoming) {
                    const upVoucher = await Voucher.findOne({
                        isFlashSale: true,
                        flashStartTime: { $gt: now }
                    }).sort({ flashStartTime: 1 }).lean();

                    if (upVoucher) {
                        upcoming = {
                            title: upVoucher.title,
                            startTime: upVoucher.flashStartTime,
                            endTime: upVoucher.flashEndTime,
                            salePrice: (upVoucher.discountType === 'fixed' ? upVoucher.discountValue : 19000),
                            totalQuantity: upVoucher.maxQuantity || 50,
                            claimedQuantity: upVoucher.claimedQuantity || 0,
                            voucherCode: upVoucher.code
                        };
                    }
                }
                if (upcoming) {
                    res.locals.upcomingFlashSale = upcoming;
                }
            }
        } catch (e) {
            // Không bao giờ để lỗi flash sale chặn luồng tải trang
        }
    }
    next();
});

// ==========================================
// 4. KẾT NỐI CƠ SỞ DỮ LIỆU MONGODB
// ==========================================
const dns = require('dns');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cinego_db';

if (MONGODB_URI.startsWith('mongodb+srv://')) {
    try {
        dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
    } catch (dnsErr) {
        console.warn('DNS resolver set warning:', dnsErr.message);
    }
}

let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    try {
        await mongoose.connect(MONGODB_URI, { 
            serverSelectionTimeoutMS: 30000,
            connectTimeoutMS: 30000
        });
        isConnected = true;
        console.log('✅ KẾT NỐI MONGODB THÀNH CÔNG!');
        // Tự động phân loại toàn bộ voucher đổi bằng điểm thưởng cá nhân (không xuất hiện trên thanh toán chung)
        Voucher.updateMany({ code: { $regex: /^(CINEGO50K-|CINEGO100K-)/i } }, { $set: { isReward: true } }).catch(() => {});
    } catch (err) {
        console.error('❌ LỖI KẾT NỐI MONGODB! Đang tự động kết nối lại sau 5 giây...', err.message);
        setTimeout(connectDB, 5000);
    }
};
connectDB();

// ==========================================
// 5. ĐIỀU HƯỚNG ROUTER (ROUTING)
// ==========================================
const { checkAdmin } = require('./trung-gian/xac-thuc');
const duongDanQuanTri = require('./dieu-huong/quan-tri');
const duongDanKhachHang = require('./dieu-huong/khach-hang');

// Phân luồng: Mọi đường dẫn bắt đầu bằng /admin sẽ đi qua khâu kiểm tra xác thực
app.use('/admin', checkAdmin, duongDanQuanTri); 
// Phân luồng: Các đường dẫn dành cho khách (Trang chủ, đăng nhập, thông tin cá nhân...)
app.use('/', duongDanKhachHang);

// ==========================================
// 5.1. XỬ LÝ NGOẠI LỆ 404 & 500 CHUẨN CINEGO EDITORIAL
// ==========================================
// Bắt toàn bộ các đường dẫn không tồn tại (404 Not Found)
app.use((req, res, next) => {
    res.status(404).render('404', { title: '404 — Không Tìm Thấy Trang' });
});

// Bắt lỗi máy chủ nội bộ (500 Error Recovery Handler)
app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]:', err);
    res.status(500).render('500', { title: '500 — Sự Cố Kỹ Thuật Máy Chủ', error: err });
});

// ==========================================
// 6. HỆ THỐNG TỰ ĐỘNG HÓA (CRON JOB)
// ==========================================
// Chạy tự động vào đúng 00:00 mỗi ngày để bảo trì dữ liệu
cron.schedule('0 0 * * *', async () => {
    try {
        // Cập nhật trạng thái phim từ "Sắp chiếu" sang "Đang chiếu" nếu đến ngày
        const today = new Date(); 
        today.setHours(0, 0, 0, 0);
        
        await Movie.updateMany(
            { status: 'SapChieu', releaseDate: { $lte: today } }, 
            { $set: { status: 'DangChieu' } }
        );

        // Dọn dẹp các voucher đã hết hạn quá 30 ngày để giảm tải database
        const thirtyDaysAgo = new Date(); 
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        await Voucher.deleteMany({ expiryDate: { $lt: thirtyDaysAgo } });
        
        console.log(`[CRON JOB] Hệ thống cập nhật trạng thái phim và dọn dẹp voucher thành công!`);
    } catch (error) { 
        console.error("[CRON JOB] Lỗi trong quá trình chạy tự động:", error); 
    }
});

// ==========================================
// 7. KHỞI CHẠY MÁY CHỦ
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server CineGo đang chạy tại http://0.0.0.0:${PORT}`);
}); 