function requireAdmin(req, res, next) {
  if (!req.session?.adminId) {
    return res.status(401).json({ error: 'Sign in to continue.' });
  }
  next();
}

function requireCsrf(req, res, next) {
  const expected = req.session?.csrfToken;
  const supplied = req.get('X-CSRF-Token');
  if (!expected || !supplied || expected.length !== supplied.length) {
    return res.status(403).json({ error: 'Security token expired. Refresh the page and try again.' });
  }
  const crypto = require('node:crypto');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    return res.status(403).json({ error: 'Security token expired. Refresh the page and try again.' });
  }
  next();
}

module.exports = { requireAdmin, requireCsrf };
