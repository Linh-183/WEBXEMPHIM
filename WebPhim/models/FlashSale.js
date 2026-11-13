const mongoose = require('mongoose');

const flashSaleSchema = new mongoose.Schema({
    title: { type: String, required: true },
    movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie' },
    cinema: { type: String, default: 'Tất cả các rạp' },
    salePrice: { type: Number, required: true, default: 19000 },
    originalPrice: { type: Number, default: 95000 },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    totalQuantity: { type: Number, default: 50 },
    claimedQuantity: { type: Number, default: 0 },
    description: { type: String },
    voucherCode: { type: String, default: 'FLASH19K' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('FlashSale', flashSaleSchema);
