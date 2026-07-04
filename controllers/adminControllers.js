const { db } = require('../config/firebase');

async function logActivity(req, action, target) {
  if (!req.admin) return;
  await db.collection('activityLog').add({ adminUid: req.admin.uid, adminEmail: req.admin.email, action, target, timestamp: new Date().toISOString() });
}

const path = require('path');
const fs = require('fs');

const { uploadImage } = require('./contentControllers');

async function generateApplicationId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  while (true) {
    result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (/[A-Z]/.test(result) && /[0-9]/.test(result)) break;
  }
  const id = result;
  const check = await db.collection('admissions').where('applicationId', '==', id).get();
  if (!check.empty) return generateApplicationId();
  return id;
}

const admissionController = {
  submit: async (req, res) => {
    try {
      const {
        name, fatherName, motherName, classRoll, gender, dob, religion,
        trade, nationality, medium, bloodGroup,
        jscBoard, jscRoll, jscYear, jscResult,
        phone, nid, session, sessionTo, address, email,
        duration, fee
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
        duration: duration || '', fee: fee || '',
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
      const { status, session, sessionId, classRoll, registrationNo } = req.body;
      
      const doc = await db.collection('admissions').doc(id).get();
      if (!doc.exists) return res.status(404).json({ success: false, message: 'আবেদন খুঁজে পাওয়া যায়নি' });
      
      const admission = doc.data();

      if (status === 'approved') {
        if (!session || !classRoll) {
          return res.status(400).json({ success: false, message: 'অনুমোদনের জন্য সেশন ও রোল আবশ্যক' });
        }
      }

      const updates = { status, updatedAt: new Date().toISOString() };
      if (status === 'approved') {
        updates.session = session;
        if (sessionId) updates.sessionId = sessionId;
        updates.classRoll = classRoll;
        if (registrationNo) updates.registrationNo = registrationNo;
      }

      // If approved and wasn't already approved, add/update to students collection
      if (status === 'approved' && admission.status !== 'approved') {
        const finalRegNo = registrationNo || admission.applicationId || id;
        updates.paymentStatus = 'paid';
        await db.collection('students').doc(finalRegNo).set({
          ...admission,
          name: admission.name,
          resultPaymentStatus: 'unpaid',
          regNo: finalRegNo,
          course: admission.trade || admission.course || '—',
          session: session,
          sessionId: sessionId || '',
          classRoll: classRoll,
          registrationNo: registrationNo || '',
          phone: admission.phone || '',
          imageUrl: admission.photoUrl || '',
          status: 'active',
          createdAt: new Date().toISOString()
        }, { merge: true });
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
  resultPaymentsList: async (req, res) => {
    try {
      const snap = await db.collection('students').orderBy('createdAt', 'desc').get();
      const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.render('admin/result-payments', {
        title: 'রেজাল্ট পেমেন্ট',
        path: '/admin/result-payments',
        students,
        admin: req.admin
      });
    } catch (err) {
      res.status(500).send('Server Error');
    }
  },
  updateResultPaymentStatus: async (req, res) => {
    try {
      const { regNo } = req.params;
      const { resultPaymentStatus } = req.body;
      await db.collection('students').doc(regNo).update({ resultPaymentStatus, updatedAt: new Date().toISOString() });
      await logActivity(req, 'update_result_payment_status', regNo);
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
      const simpleFields = ['name','tagline','code','phone','whatsappNumber','email','address','mapEmbed','footerText','fbUrl','ytUrl','activeSessions','paymentInstructions'];
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
      const { email, password, role, isMainAdmin } = req.body;
      if (!password || !email) return res.status(400).json({ success: false, message: 'ইমেইল এবং পাসওয়ার্ড প্রদান করুন' });
      
      const ref = await db.collection('admins').add({ 
        email, 
        password, 
        role: 'admin',
        isAdmin: true,
        createdAt: new Date().toISOString() 
      });
      await logActivity(req, 'add_admin', ref.id);
      return res.json({ success: true, uid: ref.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  updateAdmin: async (req, res) => {
    try {
      const { uid } = req.params;
      const { email, password, role, isMainAdmin } = req.body;
      if (uid === 'system-admin') {
         return res.status(403).json({ success: false, message: 'সিস্টেম অ্যাডমিন অ্যাকাউন্ট পরিবর্তন করা যাবে না।' });
      }
      const updates = { updatedAt: new Date().toISOString() };
      if (email) updates.email = email;
      if (password) updates.password = password;
      if (role) updates.role = role;
      if (isMainAdmin !== undefined) updates.isMainAdmin = isMainAdmin === 'true' || isMainAdmin === true;
      
      await db.collection('admins').doc(uid).update(updates);
      await logActivity(req, 'update_admin', uid);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
  deleteAdmin: async (req, res) => {
    try {
      const { uid } = req.params;
      if (uid === 'system-admin' || uid === req.admin.uid) {
        return res.status(403).json({ success: false, message: 'এই অ্যাকাউন্ট মুছে ফেলা যাবে না।' });
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
      const { password } = req.body;
      const uid = req.admin.uid;
      
      if (!password) {
        return res.status(400).json({ success: false, message: 'পাসওয়ার্ড প্রদান করুন।' });
      }

      if (uid === 'system-admin') {
        const docRef = db.collection('admins').doc('system-admin');
        await docRef.set({ password, role: 'superadmin', updatedAt: new Date().toISOString() }, { merge: true });
      } else {
        await db.collection('admins').doc(uid).update({ password, updatedAt: new Date().toISOString() });
      }

      await logActivity(req, 'update_account', uid);
      return res.json({ success: true, message: 'অ্যাকাউন্ট সফলভাবে আপডেট হয়েছে।' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = { admissionController, contactController, siteController, adminController };
