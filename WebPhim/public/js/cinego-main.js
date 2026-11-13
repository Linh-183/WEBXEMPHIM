/**
 * CINEGO MAIN JAVASCRIPT - CLIENT UTILITIES
 * Contemporary Cinema Editorial Suite
 */

// Toast Notification System: Fallback nếu module chuẩn CineGo Toast chưa khởi tạo
if (!window.cinegoToast) {
  window.cinegoToast = {
    show(message, type = 'info', duration = 3500) {
      if (window.showToast) return window.showToast(message, type);
      console.info('[CineGo Toast]:', message);
    },
    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    warning(msg) { this.show(msg, 'warning'); },
    info(msg) { this.show(msg, 'info'); }
  };
}

// Xử lý an toàn chuỗi HTML hiển thị động
function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
window.escapeHtml = escapeHtml;
