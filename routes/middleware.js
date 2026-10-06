function attachLocals(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/');
    if (req.session.user.role !== role) return res.status(403).render('error', { title: 'Access Denied', message: 'You do not have permission to access this page.' });
    next();
  };
}

function flash(req, type, message) {
  req.session.flash = { type, message };
}

module.exports = { attachLocals, requireRole, flash };
