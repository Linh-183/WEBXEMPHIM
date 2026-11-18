// File: trung-gian/xac-thuc.js
const checkLogin = (req, res, next) => {
    if (req.session && req.session.user) return next();
    const returnUrl = req.originalUrl || req.url || '/';
    if (req.session) {
        req.session.returnTo = returnUrl;
    }
    const isApi = (req.xhr || (req.headers.accept && req.headers.accept.includes('json')) || (req.path && req.path.startsWith('/api')) || (req.originalUrl && req.originalUrl.startsWith('/api')));
    if (isApi) {
        return res.status(401).json({
            success: false,
            requireLogin: true,
            message: 'Vui lòng đăng nhập tài khoản để lưu và sử dụng mã ưu đãi!'
        });
    }
    return res.redirect('/dang-nhap?returnTo=' + encodeURIComponent(returnUrl) + '&warning=' + encodeURIComponent('Vui lòng đăng nhập tài khoản để tiếp tục!'));
};

const checkAdmin = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/dang-nhap');
    }
    if (req.session.user.vaiTro === 'admin') {
        return next();
    }
    res.status(403).render('403', { title: '403 — Từ Chối Truy Cập Quản Trị' });
};

module.exports = { checkLogin, checkAdmin };
