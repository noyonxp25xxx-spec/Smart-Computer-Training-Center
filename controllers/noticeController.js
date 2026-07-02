const { db } = require('../config/firebase');

async function logActivity(req, action, target) {
  if (!req || !req.admin) return;
  await db.collection('activityLog').add({ adminUid: req.admin.uid, adminEmail: req.admin.email, action, target, timestamp: new Date().toISOString() });
}

// ───── Notice Controller ─────
const noticeController = {
  list: async (req, res) => {
    const snap = await db.collection('notices').orderBy('date', 'desc').get();
    res.json({ success: true, notices: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  },
  add: async (req, res) => {
    const { title, body, date, status } = req.body;
    const ref = await db.collection('notices').add({ title, body, date, status: status || 'published', createdAt: new Date().toISOString() });
    await logActivity(req, 'add_notice', ref.id);
    res.json({ success: true, id: ref.id });
  },
  update: async (req, res) => {
    const { id } = req.params;
    await db.collection('notices').doc(id).update({ ...req.body, updatedAt: new Date().toISOString() });
    await logActivity(req, 'update_notice', id);
    res.json({ success: true });
  },
  delete: async (req, res) => {
    const { id } = req.params;
    await db.collection('notices').doc(id).delete();
    await logActivity(req, 'delete_notice', id);
    res.json({ success: true });
  },
};

module.exports = noticeController;
