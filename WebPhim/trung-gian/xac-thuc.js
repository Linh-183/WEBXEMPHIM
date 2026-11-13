// File: trung-gian/xac-thuc.js
const checkLogin = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/dang-nhap');
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
