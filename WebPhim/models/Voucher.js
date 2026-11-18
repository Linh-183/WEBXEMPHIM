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
    applicableTo: { type: String, enum: ['all', 'movie', 'concession'], default: 'all' } // 'all': Tất cả, 'movie': Chỉ vé phim, 'concession': Chỉ bắp nước
}, { timestamps: true });

module.exports = mongoose.model('Voucher', voucherSchema);