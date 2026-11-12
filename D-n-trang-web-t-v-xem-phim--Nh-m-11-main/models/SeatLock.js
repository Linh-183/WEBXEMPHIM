// File: models/SeatLock.js
const mongoose = require('mongoose');

const seatLockSchema = new mongoose.Schema({
    movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
    cinema: { type: String, required: true },
    showDate: { type: String, required: true },
    showTime: { type: String, required: true },
    seat: { type: String, required: true },
    userId: { type: String, required: false },
    createdAt: { 
        type: Date, 
        default: Date.now, 
        expires: 300 // MongoDB TTL Index: Tự động xóa sau 300s (5 phút)
    }
});

// Compound unique index: Trong cùng một suất chiếu, một ghế chỉ có thể được khóa bởi 1 phiên
seatLockSchema.index({ movieId: 1, cinema: 1, showDate: 1, showTime: 1, seat: 1 }, { unique: true });

module.exports = mongoose.model('SeatLock', seatLockSchema);
