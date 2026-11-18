const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
    title: { type: String, required: true },
    genre: { type: String },           // Thể loại
    director: { type: String },        // Đạo diễn
    duration: { type: Number },        // Thời lượng
    releaseDate: { type: Date },       // Ngày khởi chiếu
    trailerUrl: { type: String },      // Link Trailer (Youtube)
    posterUrl: { type: String },       // Link Ảnh Poster
    ageRating: { type: String, enum: ['P', 'K', 'T13', 'T16', 'T18', 'C'], default: 'P' },
    price: { type: Number, default: 75000 },          // Giá bán vé (VNĐ)
    originalPrice: { type: Number, default: 95000 },  // Giá gốc niêm yết (VNĐ)
    format: { 
        type: String, 
        enum: ['2D Standard', 'IMAX Laser', '3D Standard'], 
        default: '2D Standard' 
    },
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

movieSchema.index({ status: 1 });
movieSchema.index({ releaseDate: 1 });

module.exports = mongoose.model('Movie', movieSchema);