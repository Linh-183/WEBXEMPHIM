// File: trung-gian/xac-thuc.js
const checkLogin = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/dang-nhap');
};

const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.vaiTro === 'admin') {
        return next();
    }
    res.status(403).send('<h1 style="color:red; text-align:center; margin-top:50px;">CẢNH BÁO: Chỉ Admin mới được vào khu vực này!</h1><p style="text-align:center;"><a href="/">Về trang chủ</a></p>');
};

module.exports = { checkLogin, checkAdmin };