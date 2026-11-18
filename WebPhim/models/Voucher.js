const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    title: { type: String, required: true },
    description: { type: String },
    discountType: { type: String, enum: ['fixed', 'percentage'], required: true },
    discountValue: { type: Number, required: true },
    minOrderValue: { type: Number, default: 0 },
    maxDiscountValue: { type: Number, default: 0 }, // THÊM DÒNG NÀY: Mức giảm tối đa
    imageUrl: { type: String }, 
    expiryDate: { type: Date },
    isReward: { type: Boolean, default: false }, // true: Voucher đổi từ điểm thưởng / sinh nhật của khách (không hiển thị trong danh sách Admin)
    rewardUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    applicableTo: { type: String, enum: ['all', 'movie', 'concession'], default: 'all' }, // 'all': Tất cả, 'movie': Chỉ vé phim, 'concession': Chỉ bắp nước

    // TÙY CHỌN RIÊNG CHO VOUCHER KHUNG GIỜ FLASH SALE
    isFlashSale: { type: Boolean, default: false },
    flashStartTime: { type: Date }, // Khung giờ bắt đầu
    flashEndTime: { type: Date },   // Khung giờ kết thúc
    maxQuantity: { type: Number, default: 50 },   // Giới hạn số lượng voucher được lưu trong khung giờ
    claimedQuantity: { type: Number, default: 0 } // Số voucher đã được lưu
}, { timestamps: true });

module.exports = mongoose.model('Voucher', voucherSchema);