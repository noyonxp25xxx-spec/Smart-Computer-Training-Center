const { db } = require('../config/firebase');

/**
 * Injects site settings into res.locals so every EJS template can access them.
 */
async function siteSettingsMiddleware(req, res, next) {
  // 1. Fetch site settings
  try {
    const doc = await db.collection('settings').doc('siteConfig').get();
    if (doc.exists) {
      res.locals.site = doc.data();
    } else {
      res.locals.site = {
        name: 'Smart Computer Training',
        tagline: 'আধুনিক প্রযুক্তিতে দক্ষ হয়ে উঠুন',
        code: 'SCT-2024',
        logoUrl: '/images/default-logo.png',
        faviconUrl: '/images/favicon.png',
        themeColor: '#1E90FF',
        footerText: '© 2024 Smart Computer Training. সর্বস্বত্ব সংরক্ষিত।',
        address: 'আপনার ঠিকানা, পাবনা',
        phone: '01700-000000',
        email: 'info@smartcomputertraining.com',
        mapEmbed: '',
        fbUrl: '#',
        ytUrl: '#',
      };
    }
  } catch (err) {
    console.error('Site settings fetch error:', err.message);
    res.locals.site = { name: 'Smart Computer Training', tagline: '' };
  }

  // 2. Fetch active notices for ticker
  try {
    const noticesSnap = await db
      .collection('notices')
      .where('status', '==', 'published')
      .orderBy('date', 'desc')
      .limit(5)
      .get();
    res.locals.tickerNotices = noticesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Notices fetch error:', err.message);
    res.locals.tickerNotices = [];
  }
  
  res.locals.currentPath = req.path;
  next();
}

module.exports = siteSettingsMiddleware;
