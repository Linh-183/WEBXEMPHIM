/**
 * CINEGO EDITORIAL TOAST NOTIFICATION SYSTEM
 * Hiển thị thông báo góc phải màn hình cho Khách Hàng (Thành viên) và Quản Trị Viên (Admin)
 * Chuẩn phong cách thiết kế Contemporary Cinema Editorial
 * Tích hợp cơ chế Deduplication & Debounce chống gửi trùng lặp thông báo
 */

(function (window, document) {
  'use strict';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  function getContainer() {
    let container = document.getElementById('cinego-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'cinego-toast-container';
      container.className = 'fixed bottom-6 right-6 z-[99999] flex flex-col gap-2.5 pointer-events-none max-w-sm sm:max-w-md w-full px-4 sm:px-0';
      document.body.appendChild(container);
    }
    return container;
  }

  const toastTheme = {
    success: {
      title: 'THÀNH CÔNG',
      borderColor: 'border-l-[#10B981] border-[#E5E0D5]',
      badgeColor: 'text-[#10B981]',
      badgeBg: 'bg-[#EAFaf1]',
      icon: 'check_circle',
      iconColor: 'text-[#10B981]',
      progressBg: 'bg-[#10B981]'
    },
    error: {
      title: 'THÔNG BÁO LỖI / THẤT BẠI',
      borderColor: 'border-l-[#BA2D27] border-[#E5E0D5]',
      badgeColor: 'text-[#BA2D27]',
      badgeBg: 'bg-[#FFF2F1]',
      icon: 'error',
      iconColor: 'text-[#BA2D27]',
      progressBg: 'bg-[#BA2D27]'
    },
    warning: {
      title: 'LƯU Ý / CẢNH BÁO',
      borderColor: 'border-l-[#F59E0B] border-[#E5E0D5]',
      badgeColor: 'text-[#D97706]',
      badgeBg: 'bg-[#FEF3C7]',
      icon: 'warning',
      iconColor: 'text-[#F59E0B]',
      progressBg: 'bg-[#F59E0B]'
    },
    info: {
      title: 'THÔNG TIN HỆ THỐNG',
      borderColor: 'border-l-[#121316] border-[#E5E0D5]',
      badgeColor: 'text-[#121316]',
      badgeBg: 'bg-[#F3EFE6]',
      icon: 'info',
      iconColor: 'text-[#121316]',
      progressBg: 'bg-[#121316]'
    }
  };

  // Cache kiểm tra trùng lặp thông báo (Deduplication trong 3.5 giây)
  const recentToasts = new Map();

  function isDuplicate(message, type) {
    if (!message) return true;
    const cleanMsg = String(message).trim().toLowerCase();
    const key = (type || 'info') + '::' + cleanMsg;
    const now = Date.now();
    const lastTime = recentToasts.get(key);

    if (lastTime && (now - lastTime) < 3500) {
      // Đã gửi thông báo giống hệt trong 3.5 giây gần nhất -> Bỏ qua không gửi lại
      return true;
    }

    recentToasts.set(key, now);
    // Dọn dẹp bộ nhớ đệm
    if (recentToasts.size > 30) {
      for (const [k, t] of recentToasts.entries()) {
        if (now - t > 10000) recentToasts.delete(k);
      }
    }
    return false;
  }

  const CinegoToast = {
    show: function (message, type, duration, customTitle) {
      if (!message) return;
      type = (type && toastTheme[type]) ? type : 'info';
      
      // Chặn ngay lập tức nếu thông báo bị trùng lặp
      if (isDuplicate(message, type)) {
        return null;
      }

      duration = typeof duration === 'number' ? duration : 4500;
      const theme = toastTheme[type];
      const title = customTitle || theme.title;
      const container = getContainer();

      const toast = document.createElement('div');
      toast.className = `pointer-events-auto relative w-full bg-white border border-l-4 ${theme.borderColor} shadow-2xl p-4 flex items-start gap-3 transition-all duration-300 ease-out transform translate-x-12 opacity-0 font-['Plus_Jakarta_Sans'] select-none overflow-hidden`;

      toast.innerHTML = `
        <div class="shrink-0 mt-0.5">
          <span class="material-symbols-outlined text-2xl ${theme.iconColor}">${theme.icon}</span>
        </div>
        <div class="flex-1 min-w-0 pr-2">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-wider ${theme.badgeColor} ${theme.badgeBg} px-1.5 py-0.5">
              ${escapeHtml(title)}
            </span>
            <span class="text-[10px] font-['JetBrains_Mono'] text-[#7A7E8B]">Vừa xong</span>
          </div>
          <p class="text-xs text-[#121316] font-medium leading-relaxed break-words">${escapeHtml(message)}</p>
        </div>
        <button type="button" class="shrink-0 text-[#7A7E8B] hover:text-[#121316] transition-colors p-1 -mr-1 -mt-1" title="Đóng thông báo">
          <span class="material-symbols-outlined text-base">close</span>
        </button>
        <div class="absolute bottom-0 left-0 h-[2.5px] ${theme.progressBg} transition-all" style="width: 100%; transition: width ${duration}ms linear;"></div>
      `;

      // Nút đóng thủ công
      const closeBtn = toast.querySelector('button');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeToast(toast);
        });
      }

      container.appendChild(toast);

      // Trigger animation trượt từ góc phải vào
      requestAnimationFrame(() => {
        toast.classList.remove('translate-x-12', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
        const progressBar = toast.querySelector('.absolute.bottom-0');
        if (progressBar) {
          requestAnimationFrame(() => {
            progressBar.style.width = '0%';
          });
        }
      });

      // Tự động đóng sau duration ms
      let dismissTimer = setTimeout(() => {
        removeToast(toast);
      }, duration);

      // Tạm dừng khi di chuột vào thông báo để người dùng kịp đọc
      toast.addEventListener('mouseenter', () => {
        clearTimeout(dismissTimer);
        const progressBar = toast.querySelector('.absolute.bottom-0');
        if (progressBar) progressBar.style.transitionPlayState = 'paused';
      });

      toast.addEventListener('mouseleave', () => {
        dismissTimer = setTimeout(() => {
          removeToast(toast);
        }, 1500);
      });

      function removeToast(el) {
        if (!el || !el.parentElement) return;
        el.classList.add('translate-x-16', 'opacity-0');
        setTimeout(() => {
          if (el.parentElement) el.remove();
        }, 300);
      }

      return toast;
    },

    success: function (message, title, duration) {
      return this.show(message, 'success', duration, title);
    },

    error: function (message, title, duration) {
      return this.show(message, 'error', duration, title);
    },

    warning: function (message, title, duration) {
      return this.show(message, 'warning', duration, title);
    },

    info: function (message, title, duration) {
      return this.show(message, 'info', duration, title);
    }
  };

  // Expose ra toàn cục
  window.cinegoToast = CinegoToast;
  window.showToast = function (msg, type, title) {
    return CinegoToast.show(msg, type, 4500, title);
  };

  // Tự động chuyển đổi các lệnh alert() truyền thống sang Cinego Toast góc phải màn hình
  const originalAlert = window.alert;
  window.alert = function (message) {
    if (!message) return;
    const msgLower = String(message).toLowerCase();
    if (msgLower.includes('lỗi') || msgLower.includes('thất bại') || msgLower.includes('không khớp') || msgLower.includes('hết hạn') || msgLower.includes('trùng')) {
      CinegoToast.error(String(message));
    } else if (msgLower.includes('thành công') || msgLower.includes('hoàn tất') || msgLower.includes('đã lưu') || msgLower.includes('đã thêm') || msgLower.includes('đã xóa') || msgLower.includes('đã sao chép')) {
      CinegoToast.success(String(message));
    } else if (msgLower.includes('cảnh báo') || msgLower.includes('tối đa') || msgLower.includes('vui lòng') || msgLower.includes('chưa')) {
      CinegoToast.warning(String(message));
    } else {
      CinegoToast.info(String(message));
    }
    console.info('[CineGo Toast Intercepted Alert]:', message);
  };

  // Tự động quét thông báo khi tải trang (Ưu tiên phân tầng DUY NHẤT 1 thông báo, không gửi trùng lặp)
  document.addEventListener('DOMContentLoaded', () => {
    try {
      let initialNotificationHandled = false;

      // 1. Quét Query Parameters trên URL (Ưu tiên hàng đầu sau redirect của controller)
      const urlParams = new URLSearchParams(window.location.search);
      let hasNotificationParam = false;

      const qError = urlParams.get('error');
      const qSuccess = urlParams.get('success');
      const qWarning = urlParams.get('warning');
      const qInfo = urlParams.get('info');

      if (qError) {
        hasNotificationParam = true;
        let errMsg = qError;
        if (qError === 'unauthorized') errMsg = 'Bạn không có quyền thực hiện thao tác này!';
        else if (qError === 'active_showtime') errMsg = 'Không thể xóa hoặc hoàn vé của suất chiếu đang diễn ra hoặc đã kết thúc.';
        setTimeout(() => CinegoToast.error(errMsg), 200);
        initialNotificationHandled = true;
      } else if (qSuccess) {
        hasNotificationParam = true;
        setTimeout(() => CinegoToast.success(qSuccess), 200);
        initialNotificationHandled = true;
      } else if (qWarning) {
        hasNotificationParam = true;
        setTimeout(() => CinegoToast.warning(qWarning), 200);
        initialNotificationHandled = true;
      } else if (qInfo) {
        hasNotificationParam = true;
        setTimeout(() => CinegoToast.info(qInfo), 200);
        initialNotificationHandled = true;
      }

      // Dọn dẹp thanh URL nếu có query thông báo để tránh lặp lại khi người dùng bấm F5 Reload
      if (hasNotificationParam && window.history && window.history.replaceState) {
        urlParams.delete('error');
        urlParams.delete('success');
        urlParams.delete('warning');
        urlParams.delete('info');
        const newSearch = urlParams.toString();
        const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
        window.history.replaceState(null, '', newUrl);
      }

      // 2. Chỉ quét Data Attributes nếu CHƯA xử lý thông báo từ URL
      if (!initialNotificationHandled) {
        const container = document.getElementById('cinego-toast-container');
        if (container) {
          const dError = container.getAttribute('data-flash-error') || container.getAttribute('data-view-error');
          const dSuccess = container.getAttribute('data-flash-success') || container.getAttribute('data-view-success');
          const dWarning = container.getAttribute('data-flash-warning');
          const dInfo = container.getAttribute('data-flash-info');

          if (dError) {
            setTimeout(() => CinegoToast.error(dError), 200);
            initialNotificationHandled = true;
          } else if (dSuccess) {
            setTimeout(() => CinegoToast.success(dSuccess), 200);
            initialNotificationHandled = true;
          } else if (dWarning) {
            setTimeout(() => CinegoToast.warning(dWarning), 200);
            initialNotificationHandled = true;
          } else if (dInfo) {
            setTimeout(() => CinegoToast.info(dInfo), 200);
            initialNotificationHandled = true;
          }
        }
      }

      // 3. Quét các thẻ data-toast riêng lẻ chỉ khi chưa có thông báo nào được phát đi
      if (!initialNotificationHandled) {
        const errEl = document.querySelector('[data-toast-error]');
        if (errEl) {
          const val = errEl.getAttribute('data-toast-error');
          if (val) {
            setTimeout(() => CinegoToast.error(val), 200);
            initialNotificationHandled = true;
          }
        }
      }

      if (!initialNotificationHandled) {
        const sucEl = document.querySelector('[data-toast-success]');
        if (sucEl) {
          const val = sucEl.getAttribute('data-toast-success');
          if (val) {
            setTimeout(() => CinegoToast.success(val), 200);
            initialNotificationHandled = true;
          }
        }
      }
    } catch (e) {
      console.error('[CineGo Toast Init Error]:', e);
    }
  });

})(window, document);
