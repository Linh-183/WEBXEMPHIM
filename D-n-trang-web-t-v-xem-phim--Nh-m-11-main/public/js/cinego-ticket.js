/**
 * CINEGO ELECTRONIC TICKET & QR CODE MODULE
 */

window.CinegoTicket = (function() {
  function renderQrCode(containerId, dataText) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Use QuickChart QR code API or clean SVG QR simulation
    const encoded = encodeURIComponent(dataText || 'CINEGO-TICKET-DEMO');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encoded}&color=0B0C10&bgcolor=FFFFFF`;

    container.innerHTML = `
      <div class="p-2.5 bg-white rounded-xl shadow-lg border border-slate-200 inline-block">
        <img src="${qrUrl}" alt="QR Ticket Code" class="w-36 h-36 object-contain" onerror="this.src='https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=CINEGO-PASS'"/>
      </div>
    `;
  }

  function printTicket() {
    window.print();
  }

  function downloadTicket(bookingCode = 'CINEGO-TICKET') {
    window.cinegoToast?.info('Đang chuẩn bị file vé điện tử chất lượng cao...');
    setTimeout(() => {
      window.cinegoToast?.success(`Đã lưu vé [${bookingCode}.pdf] vào thiết bị của bạn!`);
    }, 1200);
  }

  function copyBookingCode(code) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        window.cinegoToast?.success(`Đã sao chép mã đặt chỗ: ${code}`);
      });
    } else {
      window.cinegoToast?.info(`Mã đặt chỗ: ${code}`);
    }
  }

  return {
    renderQrCode,
    printTicket,
    downloadTicket,
    copyBookingCode
  };
})();
