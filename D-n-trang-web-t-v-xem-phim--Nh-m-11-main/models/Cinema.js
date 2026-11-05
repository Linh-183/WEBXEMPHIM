// File: models/Cinema.js
// [SỬA #3] Thêm require mongoose và module.exports — trước đây file bị crash khi import
const mongoose = require('mongoose');

const cinemaSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: String,
    totalSeats: { type: Number, default: 50 },
});

module.exports = mongoose.model('Cinema', cinemaSchema);