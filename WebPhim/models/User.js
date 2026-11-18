const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    hoTen: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    matKhau: { type: String, required: true },
    soDienThoai: { type: String }, // Khớp với DB
    ngaySinh: { type: Date }, 
    gioiTinh: { type: String, enum: ['Nam', 'Nữ', 'Khác', 'Nu', 'Khac'] },
    vaiTro: { type: String, default: 'user' }, // 'user' hoặc 'admin'
    diemTichLuy: { type: Number, default: 0 },
    diemDaDung: { type: Number, default: 0 }, // Tổng điểm thưởng người dùng đã đổi lấy voucher
    hangHoiVien: { type: String, default: 'Dong', enum: ['Dong', 'Bac', 'Vang', 'KimCuong'] },
    favoriteGenres: [{ type: String }],
    lastBirthdayGiftYear: { type: Number }, // Năm gần nhất đã nhận quà sinh nhật
    vouchers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' }], // Danh sách voucher đã lưu vào ví
    usedVouchers: [{ type: String }], // Danh sách các mã voucher người dùng đã sử dụng (chống tái sử dụng voucher 1 lần)
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
