// File: models/FoodCombo.js
const mongoose = require('mongoose');

const foodComboSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { 
        type: String, 
        enum: ['combo', 'popcorn', 'drink', 'snack'], 
        default: 'combo' 
    },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    description: { type: String, default: '' },
    imageUrl: { type: String, default: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=400&q=80' },
    badge: { type: String, default: '' },
    flavors: [{ type: String }],
    isActive: { type: Boolean, default: true },
    stock: { type: Number, default: 999 }
}, { timestamps: true });

module.exports = mongoose.model('FoodCombo', foodComboSchema);
