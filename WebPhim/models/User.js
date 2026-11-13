const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    hoTen: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    matKhau: { type: String, required: true },
    soDienThoai: { type: String }, // Bắt buộc phải là soDienThoai để khớp với DB
    ngaySinh: { type: Date }, 
    gioiTinh: { type: String, enum: ['Nam', 'Nữ', 'Khác'] },
    vaiTro: { type: String, default: 'user' }, // Bắt buộc phải có để giữ quyền Admin
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);