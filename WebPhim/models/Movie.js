const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
    title: { type: String, required: true },
    genre: { type: String },           // Thể loại
    director: { type: String },        // Đạo diễn
    duration: { type: Number },        // Thời lượng
    releaseDate: { type: Date },       // Ngày khởi chiếu
    trailerUrl: { type: String },      // Link Trailer (Youtube)
    posterUrl: { type: String },       // Link Ảnh Poster
    ageRating: { type: String, enum: ['P', 'T13', 'T16', 'T18'], default: 'P' },
    status: { type: String, enum: ['DangChieu', 'SapChieu', 'NgungChieu'], default: 'DangChieu' },
    description: { type: String },
    
    // LỊCH CHIẾU CHI TIẾT (Rạp + Phòng + Ngày + Giờ)
    showtimes: [{
        cinema: { type: String, required: true }, 
        room: { type: String, required: true },   // Tên phòng (Cinema 01, VIP...)
        date: { type: String, required: true },   // Ngày (YYYY-MM-DD)
        times: [String]                           // Mảng giờ (["19:00", "21:00"])
    }]
}, { timestamps: true });

module.exports = mongoose.model('Movie', movieSchema);