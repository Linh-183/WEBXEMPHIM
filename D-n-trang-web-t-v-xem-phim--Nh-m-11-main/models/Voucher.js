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
    expiryDate: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Voucher', voucherSchema);