/**
 * CINEGO CINEMA PLATFORM - FRONTEND MOCK DATA & REPOSITORIES
 * Comprehensive, realistic data for Quy Nhon Cinemas, Showtimes, Combos, Vouchers, Flashsales
 */

window.CINEGO_DATA = {
  // 3 Cụm rạp chính tại Quy Nhơn theo đặc tả SRS
  cinemas: [
    {
      id: "cgv-quynhon",
      name: "CGV Kim Cúc Plaza Quy Nhơn",
      shortName: "CGV Kim Cúc",
      address: "Tầng 3, Kim Cúc Plaza, Khu đô thị An Phú Thịnh, P. Ghềnh Ráng, TP. Quy Nhơn, Bình Định",
      phone: "12345678",
      rooms: [
        { id: "cgv-r1", name: "Cinema 1 (IMAX Laser)", seats: 120, format: "IMAX 2D/3D" },
        { id: "cgv-r2", name: "Cinema 2 (Dolby Atmos)", seats: 90, format: "2D Digital" },
        { id: "cgv-r3", name: "Cinema 3 (Sweetbox Gold)", seats: 60, format: "2D Digital" }
      ],
      totalSeats: 270,
      image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80",
      rating: 4.8,
      amenities: ["Màn hình IMAX", "Âm thanh Dolby Atmos", "Ghế đôi Sweetbox", "Bãi đỗ xe ô tô", "Khu F&B cao cấp"]
    },
    {
      id: "starlight-quynhon",
      name: "Starlight Nguyễn Kim Quy Nhơn",
      shortName: "Starlight Quy Nhơn",
      address: "Tầng 4, TTTM Nguyễn Kim, Số 06 Trần Phú, TP. Quy Nhơn, Bình Định",
      phone: "12345678",
      rooms: [
        { id: "sl-r1", name: "Phòng chiếu 1", seats: 100, format: "2D Digital" },
        { id: "sl-r2", name: "Phòng chiếu 2 (3D)", seats: 80, format: "3D Digital" },
        { id: "sl-r3", name: "Phòng chiếu 3", seats: 70, format: "2D Digital" }
      ],
      totalSeats: 250,
      image: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80",
      rating: 4.6,
      amenities: ["Phòng chiếu 3D", "Khu Game Arcade", "Trà sữa & Bắp ngọt", "Bãi xe máy rộng"]
    },
    {
      id: "dcine-quynhon",
      name: "DCine Quy Nhơn",
      shortName: "DCine Quy Nhơn",
      address: "Ngã ba Đống Đa, P. Thị Nại, TP. Quy Nhơn, Bình Định",
      phone: "12345678",
      rooms: [
        { id: "dc-r1", name: "Hall A (Laser Projector)", seats: 110, format: "2D Laser" },
        { id: "dc-r2", name: "Hall B (VIP Lounge)", seats: 50, format: "VIP Gold Class" }
      ],
      totalSeats: 160,
      image: "https://images.unsplash.com/photo-1574267432553-4b4628081c31?auto=format&fit=crop&w=1200&q=80",
      rating: 4.7,
      amenities: ["Máy chiếu Laser 4K", "Ghế ngả da VIP", "Free Popcorn Refill", "Cafe tầng 5"]
    }
  ],

  // Danh mục Combo Bắp Nước F&B
  combos: [
    {
      id: "cb-solo",
      name: "Combo Cine Solo",
      description: "1 Bắp rang bơ thơm giòn (vị ngọt/mặn 64oz) + 1 Nước ngọt có ga lớn (32oz)",
      price: 75000,
      image: "https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=400&q=80",
      badge: "Bán chạy"
    },
    {
      id: "cb-couple",
      name: "Combo Cine Couple",
      description: "1 Bắp rang bơ khổng lồ (vị phô mai/caramel) + 2 Nước ngọt có ga lớn",
      price: 115000,
      image: "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=400&q=80",
      badge: "Tiết kiệm 30K"
    },
    {
      id: "cb-party",
      name: "Combo Cine Party",
      description: "2 Bắp vị tùy chọn + 4 Nước ngọt + 1 Khoai tây chiên lắc phô mai giòn rụm",
      price: 195000,
      image: "https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?auto=format&fit=crop&w=400&q=80",
      badge: "Gia đình"
    },
    {
      id: "cb-snack",
      name: "Snack Xúc Xích Phô Mai",
      description: "2 Xúc xích nướng tiêu đen phô mai que nóng giòn",
      price: 45000,
      image: "https://images.unsplash.com/photo-1627042633706-01a5e040c837?auto=format&fit=crop&w=400&q=80",
      badge: "Ăn vặt"
    }
  ],

  // Bảng giá vé quy chuẩn theo loại ghế & suất
  seatPricing: {
    standard: 75000,
    vip: 95000,
    couple: 170000 // Ghế đôi tính cho 2 người
  },

  // Danh sách sự kiện Flash Sale theo khung giờ
  flashSales: [
    {
      id: "fs-12h",
      slot: "12:00 - 14:00",
      title: "Săn Vé Đồng Giá 19K - Trưa Rực Rỡ",
      discountCode: "FLASH19K",
      totalAvailable: 50,
      claimed: 42,
      discountText: "Đồng giá vé 19.000đ",
      condition: "Áp dụng cho mọi suất chiếu thứ 2 - thứ 5",
      status: "active" // active, upcoming, ended
    },
    {
      id: "fs-20h",
      slot: "20:00 - 22:00",
      title: "Khung Giờ Vàng - Giảm 50% Combo F&B",
      discountCode: "FLASHCOMBO50",
      totalAvailable: 100,
      claimed: 68,
      discountText: "Giảm 50% khi mua kèm combo bắp nước",
      condition: "Đơn tối thiểu 100.000đ",
      status: "upcoming"
    }
  ],

  // Voucher mẫu cho ví người dùng
  sampleVouchers: [
    {
      code: "CINEGO50",
      title: "Giảm 50K cho đơn từ 150K",
      discountType: "fixed",
      discountValue: 50000,
      minOrderValue: 150000,
      maxDiscountValue: 50000,
      expiryDate: "2026-12-31",
      status: "available"
    },
    {
      code: "VIPMEMBER",
      title: "Ưu đãi thành viên vàng - Giảm 20%",
      discountType: "percentage",
      discountValue: 20,
      minOrderValue: 100000,
      maxDiscountValue: 80000,
      expiryDate: "2026-11-30",
      status: "available"
    },
    {
      code: "POPCORNFREE",
      title: "Tặng 01 Bắp Ngọt 45oz",
      discountType: "fixed",
      discountValue: 45000,
      minOrderValue: 80000,
      maxDiscountValue: 45000,
      expiryDate: "2026-10-15",
      status: "expired"
    }
  ]
};
