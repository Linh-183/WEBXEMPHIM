/**
 * CINEGO PAYMENT & CHECKOUT ENGINE
 * Handles Voucher Application, Loyalty Points Redemption, and Payment Simulation
 */

window.CinegoPayment = (function() {
  const STATE = {
    originalTotal: 0,
    currentTotal: 0,
    discountAmount: 0,
    pointsUsed: 0,
    pointsValue: 0, // 1 point = 1,000 VND discount (Earn: 10,000 VND = 1 point)
    appliedVoucher: null,
    paymentMethod: 'momo'
  };

  function init(initialTotal) {
    STATE.originalTotal = Number(initialTotal) || 0;
    STATE.currentTotal = STATE.originalTotal;
    updateSummary();
    setupListeners();
  }

  function setupListeners() {
    // Payment method tabs
    document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        STATE.paymentMethod = e.target.value;
        const note = document.getElementById('payment-method-note');
        if (note) {
          const names = {
            momo: 'Quét mã QR MoMo trên ứng dụng điện thoại để hoàn tất',
            zalopay: 'Mở ứng dụng ZaloPay hoặc Zalo để quét mã thanh toán',
            vnpay: 'Chuyển hướng cổng thanh toán VNPAY-QR hỗ trợ hơn 30 ngân hàng',
            atm: 'Thanh toán qua thẻ ATM nội địa có đăng ký Internet Banking',
            credit_card: 'Chấp nhận thẻ Visa, Mastercard, JCB quốc tế'
          };
          note.innerText = names[STATE.paymentMethod] || '';
        }
      });
    });
  }

  function applyVoucherCode(code) {
    if (!code || !code.trim()) {
      window.cinegoToast?.warning('Vui lòng nhập mã ưu đãi!');
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    
    // Check against mock data or vouchers list
    let voucher = null;
    if (window.CINEGO_DATA && window.CINEGO_DATA.sampleVouchers) {
      voucher = window.CINEGO_DATA.sampleVouchers.find(v => v.code === cleanCode && v.status === 'available');
    }

    if (!voucher) {
      // Allow popular codes for demo
      if (cleanCode === 'CINEGO50' || cleanCode === 'GIAM50K') {
        voucher = { code: cleanCode, discountType: 'fixed', discountValue: 50000, minOrderValue: 150000, maxDiscountValue: 50000 };
      } else if (cleanCode === 'VIPMEMBER' || cleanCode === 'GIAM20') {
        voucher = { code: cleanCode, discountType: 'percentage', discountValue: 20, minOrderValue: 100000, maxDiscountValue: 60000 };
      } else {
        window.cinegoToast?.error(`Mã voucher "${cleanCode}" không hợp lệ hoặc đã hết hạn!`);
        return;
      }
    }

    // Check min order
    if (STATE.originalTotal < (voucher.minOrderValue || 0)) {
      window.cinegoToast?.warning(`Đơn hàng tối thiểu để áp dụng mã là ${voucher.minOrderValue.toLocaleString('vi-VN')} đ`);
      return;
    }

    // Calculate discount
    let discount = 0;
    if (voucher.discountType === 'percentage') {
      discount = (STATE.originalTotal * voucher.discountValue) / 100;
      if (voucher.maxDiscountValue && discount > voucher.maxDiscountValue) {
        discount = voucher.maxDiscountValue;
      }
    } else {
      discount = voucher.discountValue;
    }

    STATE.appliedVoucher = voucher;
    STATE.discountAmount = discount;

    window.cinegoToast?.success(`Áp dụng mã ${voucher.code} thành công! Giảm ${discount.toLocaleString('vi-VN')} đ`);
    updateSummary();

    const voucherInput = document.getElementById('voucherInput');
    if (voucherInput) voucherInput.value = voucher.code;

    const voucherTag = document.getElementById('applied-voucher-badge');
    if (voucherTag) {
      voucherTag.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold">
          <span class="material-symbols-outlined text-[14px]">check</span> ${voucher.code} (-${discount.toLocaleString('vi-VN')}đ)
          <button type="button" onclick="CinegoPayment.removeVoucher()" class="hover:text-white ml-1">✕</button>
        </span>
      `;
      voucherTag.classList.remove('hidden');
    }
  }

  function removeVoucher() {
    STATE.appliedVoucher = null;
    STATE.discountAmount = 0;
    const voucherTag = document.getElementById('applied-voucher-badge');
    if (voucherTag) voucherTag.classList.add('hidden');
    updateSummary();
    window.cinegoToast?.info('Đã hủy áp dụng mã giảm giá');
  }

  function applyLoyaltyPoints(pointsToUse) {
    const pts = parseInt(pointsToUse, 10) || 0;
    if (pts < 0) return;

    // Rule: 1 point = 1,000 VND discount
    const value = pts * 1000;
    if (value > STATE.originalTotal - STATE.discountAmount) {
      window.cinegoToast?.warning('Số điểm sử dụng không thể vượt quá giá trị đơn hàng!');
      return;
    }

    STATE.pointsUsed = pts;
    STATE.pointsValue = value;
    updateSummary();
    window.cinegoToast?.success(`Đã dùng ${pts} điểm thưởng (giảm ${value.toLocaleString('vi-VN')} đ)`);
  }

  function updateSummary() {
    const finalAmount = Math.max(0, STATE.originalTotal - STATE.discountAmount - STATE.pointsValue);
    STATE.currentTotal = finalAmount;

    // Update displays
    const discountDisplay = document.getElementById('discount-display');
    const pointsDisplay = document.getElementById('points-discount-display');
    const finalDisplay = document.getElementById('final-total-display');
    const finalInput = document.getElementById('finalAmountInput');

    if (discountDisplay) discountDisplay.innerText = `-${STATE.discountAmount.toLocaleString('vi-VN')} đ`;
    if (pointsDisplay) pointsDisplay.innerText = `-${STATE.pointsValue.toLocaleString('vi-VN')} đ`;
    if (finalDisplay) finalDisplay.innerText = `${finalAmount.toLocaleString('vi-VN')} đ`;
    if (finalInput) finalInput.value = finalAmount;
  }

  return {
    init,
    applyVoucherCode,
    removeVoucher,
    applyLoyaltyPoints
  };
})();
