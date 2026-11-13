/**
 * CINEGO MAIN JAVASCRIPT - CLIENT INTERACTIONS & UTILITIES
 */

document.addEventListener('DOMContentLoaded', () => {
  initLiveSearch();
  initTrailerModal();
  initMobileMenu();
});

// Toast Notification System: Tích hợp và ưu tiên module chuẩn CineGo Toast (/js/cinego-toast.js)
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

// Live Search with Debounce
function initLiveSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  if (!searchInput || !searchResults) return;

  let debounceTimer = null;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();

    if (!query) {
      searchResults.classList.add('hidden');
      searchResults.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tim-kiem?tuKhoa=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error();
        const movies = await res.json();
        renderSearchResults(movies, searchResults, query);
      } catch (err) {
        // Fallback to client-side mock search if API fails
        renderFallbackSearch(searchResults, query);
      }
    }, 250);
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.classList.add('hidden');
    }
  });
}

function renderSearchResults(movies, container, query) {
  container.innerHTML = '';
  if (!movies || movies.length === 0) {
    container.innerHTML = `
      <div class="p-4 text-center text-slate-400 text-xs">
        Không tìm thấy phim phù hợp với "<strong>${escapeHtml(query)}</strong>"
      </div>
    `;
    container.classList.remove('hidden');
    return;
  }

  const list = document.createElement('div');
  list.className = 'py-2 divide-y divide-white/5';
  movies.forEach(m => {
    const item = document.createElement('a');
    item.href = `/chi-tiet-phim/${m._id}`;
    item.className = 'flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left';
    item.innerHTML = `
      <img src="${m.posterUrl}" class="w-10 h-14 object-cover rounded shadow shrink-0">
      <div class="min-w-0 flex-1">
        <h4 class="text-white text-sm font-bold truncate">${escapeHtml(m.title)}</h4>
        <div class="flex items-center gap-2 mt-1">
          <span class="badge-age badge-t16 text-[10px] py-0.5 px-1.5">${m.ageRating || 'T16'}</span>
          <span class="text-xs text-red-500 font-semibold hover:underline">Đặt vé ngay</span>
        </div>
      </div>
    `;
    list.appendChild(item);
  });

  const viewAll = document.createElement('a');
  viewAll.href = `/tim-kiem?keyword=${encodeURIComponent(query)}`;
  viewAll.className = 'block p-3 text-center text-xs font-bold text-red-500 hover:text-red-400 bg-white/5';
  viewAll.innerText = `Xem tất cả kết quả cho "${query}" →`;

  container.appendChild(list);
  container.appendChild(viewAll);
  container.classList.remove('hidden');
}

function renderFallbackSearch(container, query) {
  container.innerHTML = `
    <div class="p-3 text-center">
      <a href="/tim-kiem?keyword=${encodeURIComponent(query)}" class="text-xs text-red-500 font-bold hover:underline">
        Tìm kiếm tất cả phim với từ khóa "${escapeHtml(query)}"
      </a>
    </div>
  `;
  container.classList.remove('hidden');
}

// Trailer Modal (Global Embed Player)
function initTrailerModal() {
  window.openTrailerModal = function(trailerUrl, movieTitle) {
    movieTitle = movieTitle || 'Trailer Phim';
    let url = (typeof trailerUrl === 'string' && trailerUrl.trim()) 
      ? trailerUrl.trim() 
      : ('https://www.youtube.com/embed?listType=search&list=' + encodeURIComponent(movieTitle + ' trailer'));

    let modal = document.getElementById('cinego-trailer-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'cinego-trailer-modal';
      modal.className = 'fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 transition-opacity';
      modal.innerHTML = `
        <div class="relative w-full max-w-4xl bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
          <div class="flex items-center justify-between p-4 border-b border-white/10">
            <h3 id="trailer-modal-title" class="font-bold text-white text-base truncate">Trailer Phim</h3>
            <button onclick="closeTrailerModal()" class="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-red-600 transition-colors">
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <div class="aspect-video w-full bg-black">
            <iframe id="trailer-iframe" class="w-full h-full" src="" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeTrailerModal();
      });
    }

    const titleElem = document.getElementById('trailer-modal-title');
    const iframe = document.getElementById('trailer-iframe');
    if (titleElem) titleElem.innerText = movieTitle;

    // Convert regular YouTube URL to embed URL if needed
    let embedUrl = url;
    if (url.includes('watch?v=')) {
      const v = url.split('watch?v=')[1]?.split('&')[0];
      embedUrl = v ? `https://www.youtube.com/embed/${v}` : url;
    } else if (url.includes('youtu.be/')) {
      const v = url.split('youtu.be/')[1]?.split('?')[0];
      embedUrl = v ? `https://www.youtube.com/embed/${v}` : url;
    } else if (url.includes('results?search_query=')) {
      embedUrl = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(movieTitle + ' trailer')}`;
    }

    if (!embedUrl.includes('autoplay=1')) {
      embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'autoplay=1';
    }

    if (iframe) iframe.src = embedUrl;
    modal.classList.remove('hidden');
  };

  window.closeTrailerModal = function() {
    const modal = document.getElementById('cinego-trailer-modal');
    const iframe = document.getElementById('trailer-iframe');
    if (iframe) iframe.src = '';
    if (modal) modal.classList.add('hidden');
  };
}

// Mobile Menu Drawer
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const drawer = document.getElementById('mobileDrawer');
  const closeBtn = document.getElementById('closeMobileDrawer');

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener('click', () => drawer.classList.remove('translate-x-full'));
  }
  if (closeBtn && drawer) {
    closeBtn.addEventListener('click', () => drawer.classList.add('translate-x-full'));
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
window.escapeHtml = escapeHtml;
