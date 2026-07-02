const { auth, db } = require('../config/firebase');

/**
 * Middleware to protect admin routes.
 * Verifies Firebase ID token stored in session.
 */
async function requireAdmin(req, res, next) {
  const idToken = req.session && req.session.idToken;

  if (!idToken) {
    return res.redirect('/admin/login?error=session_expired');
  }

  if (req.session && req.session.mockUser) {
    req.admin = req.session.mockUser;
    return next();
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    const adminDoc = await db.collection('admins').doc(decoded.uid).get();

    if (!adminDoc.exists) {
      req.session = null;
      return res.redirect('/admin/login?error=not_admin');
    }

    req.admin = {
      uid: decoded.uid,
      email: decoded.email,
      ...adminDoc.data(),
    };
  } catch (err) {
    console.error('Auth error:', err.message);
    req.session = null;
    return res.redirect('/admin/login?error=invalid_token');
  }

  next();
}

/**
 * Middleware to check specific permission.
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.admin) return res.redirect('/admin/login');
    if (
      req.admin.role === 'superadmin' ||
      (req.admin.permissions && req.admin.permissions.includes(permission))
    ) {
      return next();
    }
    return res.status(403).render('admin/error', {
      title: 'অ্যাক্সেস নেই',
      message: 'আপনার এই পেজে প্রবেশের অনুমতি নেই।',
    });
  };
}

module.exports = { requireAdmin, requirePermission };
