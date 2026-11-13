// File: trung-gian/xac-thuc.js
const checkLogin = (req, res, next) => {
    if (req.session && req.session.user) return next();
    const returnUrl = req.originalUrl || req.url || '/';
    if (req.session) {
        req.session.returnTo = returnUrl;
    }
    return res.redirect('/dang-nhap?returnTo=' + encodeURIComponent(returnUrl) + '&warning=' + encodeURIComponent('Vui lòng đăng nhập tài khoản để đặt vé!'));
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
