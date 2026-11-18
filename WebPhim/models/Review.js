// File: models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: false },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    comment: { type: String, required: true },
    isVerifiedViewer: { type: Boolean, default: true }
}, { timestamps: true });

reviewSchema.index({ movie: 1, createdAt: -1 });
reviewSchema.index({ user: 1, movie: 1 });

module.exports = mongoose.model('Review', reviewSchema);
