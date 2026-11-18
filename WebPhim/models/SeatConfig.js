// File: models/SeatConfig.js
const mongoose = require('mongoose');

const seatConfigSchema = new mongoose.Schema({
    cinema: { type: String, default: 'all' },
    rows: { type: Number, default: 6 },
    cols: { type: Number, default: 10 },
    priceStandard: { type: Number, default: 75000 },
    priceVIP: { type: Number, default: 95000 },
    priceCouple: { type: Number, default: 170000 },
    seatMatrix: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('SeatConfig', seatConfigSchema);
