// File: models/Ticket.js
const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
    cinema: { type: String, required: true },
    showDate: { type: String, required: true }, 
    showTime: { type: String, required: true }, 
    seats: [String],
    // [SỬA #4] Thêm 2 trường này — trước đây bị thiếu khiến dữ liệu combo bị mất khi lưu
    comboDetails: { type: String, default: '' },
    comboTotal: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
    paymentMethod: { type: String }
});

module.exports = mongoose.model('Ticket', ticketSchema);