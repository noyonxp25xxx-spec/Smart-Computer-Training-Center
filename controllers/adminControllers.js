const { db } = require('../config/firebase');

async function logActivity(req, action, target) {
  if (!req.admin) return;
  await db.collection('activityLog').add({ adminUid: req.admin.uid, adminEmail: req.admin.email, action, target, timestamp: new Date().toISOString() });
}

const path = require('path');
const fs = require('fs');

const { uploadImage } = require('./contentControllers');

async function generateApplicationId() {
  const year = new Date().getFullYear();
  const snap = await db.collection('admissions').get();
  const seq = String(snap.size + 1).padStart(4, '0');
  return `SCT-${year}-${seq}`;
}

const admissionController = {
  submit: async (req, res) => {
    try {
      const {
        name, fatherName, motherName, classRoll, gender, dob, religion,
        trade, nationality, medium, bloodGroup,
        jscBoard, jscRoll, jscYear, jscResult,
        phone, nid, session, sessionTo, address, email
      } = req.body;

      // Handle photo and signature uploads
      const photoFile = req.files && req.files['photo'] ? req.files['photo'][0] : null;
      const signatureFile = req.files && req.files['signature'] ? req.files['signature'][0] : null;
      const photoUrl = await uploadImage(photoFile, 'admissions/photos');
      const signatureUrl = await uploadImage(signatureFile, 'admissions/signatures');

      const applicationId = await generateApplicationId();

      const ref = await db.collection('admissions').add({
        applicationId,
        name, fatherName, motherName, classRoll: classRoll || '',
        gender: gender || '', dob: dob || '', religion: religion || '',
        trade: trade || '', nationality: nationality || '',
        medium: medium || '', bloodGroup: bloodGroup || '',
        jscBoard: jscBoard || '', jscRoll: jscRoll || '',
        jscYear: jscYear || '', jscResult: jscResult || '',
        phone, nid: nid || '',
        session: session || '', sessionTo: sessionTo || '',
        address: address || '', email: email || '',
        photoUrl, signatureUrl,
        status: 'pending',
        paymentStatus: 'unpaid',
        submittedAt: new Date().toISOString(),
      });

      return res.json({
        success: true,
        id: ref.id,
        applicationId,
        message: 'আপনার ভর্তি আবেদন সফলভাবে জমা হয়েছে।'
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  list: async (req, res) => {
    try {
      const snap = await db.collection('admissions').orderBy('submittedAt', 'desc').get();
      return res.json({ success: true, admissions: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, session, classRoll, registrationNo } = req.body;
      
      const doc = await db.collection('admissions').doc(id).get();
      if (!doc.exists) return res.status(404).json({ success: false, message: 'আবেদন খুঁজে পাওয়া যায়নি' });
      
      const admission = doc.data();

      if (status === 'approved') {
        if (!session || !classRoll) {
          return res.status(400).json({ success: false, message: 'অনুমোদনের জন্য সেশন এবং রোল নম্বর আবশ্যক।' });
        }
      }

      const updates = { status, updatedAt: new Date().toISOString() };
      if (status === 'approved') {
        updates.session = session;
        updates.classRoll = classRoll;
        if (registrationNo) updates.registrationNo = registrationNo;
      }

      // If approved and wasn't already approved, add to students collection
      if (status === 'approved' && admission.status !== 'approved') {
        await db.collection('students').add({
          name: admission.name,
          regNo: registrationNo || admission.applicationId || id,
          course: admission.trade || admission.course || '—',
          session: session,
          classRoll: classRoll,
          registrationNo: registrationNo || '',
          phone: admission.phone || '',
          imageUrl: admission.photoUrl || '',
          status: 'active',
          createdAt: new Date().toISOString()
        });
      }
      
      await db.collection('admissions').doc(id).update(updates);
      await logActivity(req, 'update_admission_status', id);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  updatePaymentStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentStatus } = req.body;
      await db.collection('admissions').doc(id).update({ paymentStatus, updatedAt: new Date().toISOString() });
      await logActivity(req, 'update_payment_status', id);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  delete: async (req, res) => {
    try {
      await db.collection('admissions').doc(req.params.id).delete();
      await logActivity(req, 'delete_admission', req.params.id);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

const contactController = {
  submit: async (req, res) => {
    try {
      const { name, email, phone, message } = req.body;
      await db.collection('contactMessages').add({ name, email: email || '', phone: phone || '', message, date: new Date().toISOString(), read: false });
      return res.json({ success: true, message: 'আপনার বার্তা পাঠানো হয়েছে। আমরা শীঘ্রই যোগাযোগ করব।' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  list: async (req, res) => {
    try {
      const snap = await db.collection('contactMessages').orderBy('date', 'desc').get();
      return res.json({ success: true, messages: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  markRead: async (req, res) => {
    try {
      await db.collection('contactMessages').doc(req.params.id).update({ read: true });
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  delete: async (req, res) => {
    try {
      await db.collection('contactMessages').doc(req.params.id).delete();
      await logActivity(req, 'delete_message', req.params.id);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

const siteController = {
  getSettings: async (req, res) => {
    try {
      const doc = await db.collection('settings').doc('siteConfig').get();
      return res.json({ success: true, settings: doc.exists ? doc.data() : {} });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  updateSettings: async (req, res) => {
    try {
      const { uploadImage } = require('./contentControllers');
      
      // Build settings object - handle nested fields like counters[students]
      const body = req.body;
      const data = {};
      
      // Simple fields
      const simpleFields = ['name','tagline','code','phone','email','address','mapEmbed','footerText','fbUrl','ytUrl','activeSessions','paymentInstructions'];
      simpleFields.forEach(f => { if (body[f] !== undefined) data[f] = body[f]; });
      // Removed counters, director, about from global site settings
      data.updatedAt = new Date().toISOString();
      
      if (req.files && req.files.logo) data.logoUrl = await uploadImage(req.files.logo[0], 'site');
      if (req.files && req.files.favicon) data.faviconUrl = await uploadImage(req.files.favicon[0], 'site');
      
      await db.collection('settings').doc('siteConfig').set(data, { merge: true });
      await logActivity(req, 'update_site_settings', 'siteConfig');
      return res.json({ success: true, message: 'সাইট সেটিংস আপডেট হয়েছে।' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

const adminController = {
  getDashboardStats: async (req, res) => {
    try {
      const [students, admissions, results, messages, courses] = await Promise.all([
        db.collection('students').count().get(),
        db.collection('admissions').where('status', '==', 'pending').count().get(),
        db.collection('results').count().get(),
        db.collection('contactMessages').where('read', '==', false).count().get(),
        db.collection('courses').count().get(),
      ]);
      const recentAdmissions = await db.collection('admissions').orderBy('submittedAt', 'desc').limit(5).get();
      const recentMessages = await db.collection('contactMessages').orderBy('date', 'desc').limit(5).get();
      return res.json({
        success: true,
        stats: {
          totalStudents: students.data().count,
          pendingAdmissions: admissions.data().count,
          totalResults: results.data().count,
          unreadMessages: messages.data().count,
          totalCourses: courses.data().count,
        },
        recentAdmissions: recentAdmissions.docs.map(d => ({ id: d.id, ...d.data() })),
        recentMessages: recentMessages.docs.map(d => ({ id: d.id, ...d.data() })),
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  listAdmins: async (req, res) => {
    try {
      const snap = await db.collection('admins').get();
      return res.json({ success: true, admins: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  addAdmin: async (req, res) => {
    try {
      if (req.admin.uid !== 'system-admin') {
        return res.status(403).json({ success: false, message: 'শুধুমাত্র প্রধান অ্যাডমিন নতুন অ্যাকাউন্ট তৈরি করতে পারবেন।' });
      }
      
      const { email, password, role } = req.body;
      if (!password || !email) return res.status(400).json({ success: false, message: 'ইমেইল এবং পাসওয়ার্ড প্রদান করুন' });
      
      const ref = await db.collection('admins').add({ email, password, role: role || 'admin', createdAt: new Date().toISOString() });
      await logActivity(req, 'add_admin', ref.id);
      return res.json({ success: true, uid: ref.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  deleteAdmin: async (req, res) => {
    try {
      const { uid } = req.params;
      if (req.admin.uid !== 'system-admin') {
        return res.status(403).json({ success: false, message: 'শুধুমাত্র প্রধান অ্যাডমিন অন্যান্য অ্যাকাউন্ট মুছতে পারবেন।' });
      }
      
      await db.collection('admins').doc(uid).delete();
      await logActivity(req, 'delete_admin', uid);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  getActivityLog: async (req, res) => {
    try {
      const snap = await db.collection('activityLog').orderBy('timestamp', 'desc').limit(100).get();
      return res.json({ success: true, logs: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  updateAccount: async (req, res) => {
    try {
      const { email, password } = req.body;
      const uid = req.admin.uid;
      
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'ইমেইল এবং পাসওয়ার্ড আবশ্যক।' });
      }

      if (uid === 'system-admin') {
        // System admin uses .env or default fallback, but we can't write to .env easily.
        // Actually, if it's 'system-admin', we shouldn't allow changing it from the DB unless we create a DB record for them.
        // Let's create an admin record if it doesn't exist.
        const docRef = db.collection('admins').doc('system-admin');
        await docRef.set({ email, password, role: 'superadmin', updatedAt: new Date().toISOString() }, { merge: true });
        req.session.mockUser.email = email;
      } else {
        await db.collection('admins').doc(uid).update({ email, password, updatedAt: new Date().toISOString() });
        req.session.mockUser.email = email;
      }

      await logActivity(req, 'update_account', uid);
      return res.json({ success: true, message: 'অ্যাকাউন্ট সফলভাবে আপডেট হয়েছে।' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = { admissionController, contactController, siteController, adminController };
