// File: models/Cinema.js
const mongoose = require('mongoose');

const cinemaSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    code: { type: String, unique: true },
    location: { type: String, required: true },
    phone: { type: String, default: '12345678' },
    openingHours: { type: String, default: '08:30 — 23:30' },
    totalSeats: { type: Number, default: 270 },
    rooms: [
        {
            name: { type: String, required: true },
            totalSeats: { type: Number, default: 70 },
            format: { type: String, default: '2D Laser Digital' }
        }
    ],
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Cinema', cinemaSchema);
