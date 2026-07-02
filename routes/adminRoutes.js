const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAdmin, requirePermission } = require('../middleware/authMiddleware');
const { auth, db, firebaseClientConfig, isMockFirebase } = require('../config/firebase');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const { listCourses, addCourse, updateCourse, deleteCourse } = require('../controllers/courseController');
const noticeCtrl = require('../controllers/noticeController');
const { blogController: blog, teacherController: teacher, committeeController: committee,
        galleryController: gallery, studentController: student, sliderController: slider } = require('../controllers/contentControllers');
const { upsertResult, deleteResult, listResults, bulkImportResults } = require('../controllers/resultController');
const { admissionController, contactController, siteController, adminController } = require('../controllers/adminControllers');

// ─── LOGIN ───────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session && req.session.idToken) return res.redirect('/admin');
  const error = req.query.error || null;
  res.render('admin/login', { title: 'অ্যাডমিন লগইন', firebaseConfig: firebaseClientConfig, error });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const configuredPassword = process.env.ADMIN_PASSWORD || '805222';
  const configuredEmail = process.env.ADMIN_EMAIL || 'admin@gmail.com';

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'ইমেইল এবং পাসওয়ার্ড প্রদান করুন।' });
  }

  // Fallback for default setup
  if (email === configuredEmail && password === configuredPassword) {
    req.session.idToken = 'mock-id-token';
    req.session.mockUser = {
      uid: 'system-admin',
      email: configuredEmail,
      role: 'superadmin',
      name: 'System Admin',
      permissions: [],
    };
    return res.json({ success: true, redirect: '/admin' });
  }

  try {
    const snap = await db.collection('admins').where('email', '==', email).where('password', '==', password).limit(1).get();
    if (!snap.empty) {
      const adminDoc = snap.docs[0];
      const adminData = adminDoc.data();
      req.session.idToken = 'mock-id-token-' + adminDoc.id;
      req.session.mockUser = { uid: adminDoc.id, email: adminData.email, role: adminData.role || 'admin', name: 'Staff', permissions: [] };
      return res.json({ success: true, redirect: '/admin' });
    }
  } catch (err) {}

  return res.status(401).json({ success: false, message: 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।' });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/admin/login');
});

// ─── ALL BELOW REQUIRE AUTH ──────────────────────────────────────────────────
router.use(requireAdmin);

// DASHBOARD
router.get('/', async (req, res) => {
  try {
    const [studentsSnap, admissionsSnap, resultsSnap, messagesSnap, coursesSnap] = await Promise.all([
      db.collection('students').count().get(),
      db.collection('admissions').where('status', '==', 'pending').count().get(),
      db.collection('results').count().get(),
      db.collection('contactMessages').where('read', '==', false).count().get(),
      db.collection('courses').count().get(),
    ]);
    const recentAdmissions = await db.collection('admissions').orderBy('submittedAt', 'desc').limit(5).get();
    const recentMessages = await db.collection('contactMessages').orderBy('date', 'desc').limit(5).get();
    const stats = {
      totalStudents: studentsSnap.data().count,
      pendingAdmissions: admissionsSnap.data().count,
      totalResults: resultsSnap.data().count,
      unreadMessages: messagesSnap.data().count,
      totalCourses: coursesSnap.data().count,
    };
    res.render('admin/dashboard', {
      title: 'ড্যাশবোর্ড', admin: req.admin, stats,
      recentAdmissions: recentAdmissions.docs.map(d => ({ id: d.id, ...d.data() })),
      recentMessages: recentMessages.docs.map(d => ({ id: d.id, ...d.data() })),
    });
  } catch (err) {
    res.render('admin/dashboard', { title: 'ড্যাশবোর্ড', admin: req.admin, stats: {}, recentAdmissions: [], recentMessages: [], error: err.message });
  }
});

// SITE SETTINGS
router.get('/settings', async (req, res) => {
  const doc = await db.collection('settings').doc('siteConfig').get();
  res.render('admin/settings', { title: 'সাইট সেটিংস', admin: req.admin, settings: doc.exists ? doc.data() : {} });
});
router.post('/settings', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'favicon', maxCount: 1 }]), siteController.updateSettings);

// SLIDERS
router.get('/sliders', async (req, res) => {
  const snap = await db.collection('sliders').orderBy('order', 'asc').get();
  res.render('admin/sliders', { title: 'ব্যানার/স্লাইডার', admin: req.admin, sliders: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});
router.post('/sliders', upload.single('image'), slider.add);
router.delete('/sliders/:id', slider.delete);

// COURSES
router.get('/courses', async (req, res) => {
  const snap = await db.collection('courses').orderBy('createdAt', 'desc').get();
  res.render('admin/courses', { title: 'কোর্স ম্যানেজার', admin: req.admin, courses: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});
router.post('/courses', upload.single('image'), addCourse);
router.put('/courses/:id', upload.single('image'), updateCourse);
router.delete('/courses/:id', deleteCourse);

// NOTICES
router.get('/notices', async (req, res) => {
  const snap = await db.collection('notices').orderBy('date', 'desc').get();
  res.render('admin/notices', { title: 'নোটিশ ম্যানেজার', admin: req.admin, notices: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});
router.post('/notices', noticeCtrl.add);
router.put('/notices/:id', noticeCtrl.update);
router.delete('/notices/:id', noticeCtrl.delete);

// BLOG
router.get('/blog', async (req, res) => {
  const snap = await db.collection('blogPosts').orderBy('date', 'desc').get();
  res.render('admin/blog', { title: 'ব্লগ/আইটি তথ্য', admin: req.admin, posts: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});
router.post('/blog', upload.single('image'), blog.add);
router.put('/blog/:id', upload.single('image'), blog.update);
router.delete('/blog/:id', blog.delete);

// TEACHERS
router.get('/teachers', async (req, res) => {
  const snap = await db.collection('teachers').orderBy('order', 'asc').get();
  res.render('admin/teachers', { title: 'শিক্ষক ম্যানেজার', admin: req.admin, teachers: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});
router.post('/teachers', upload.single('image'), teacher.add);
router.put('/teachers/:id', upload.single('image'), teacher.update);
router.delete('/teachers/:id', teacher.delete);

// COMMITTEE
router.get('/committee', async (req, res) => {
  const snap = await db.collection('committee').orderBy('order', 'asc').get();
  res.render('admin/committee', { title: 'কমিটি ম্যানেজার', admin: req.admin, members: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});
router.post('/committee', upload.single('image'), committee.add);
router.put('/committee/:id', upload.single('image'), committee.update);
router.delete('/committee/:id', committee.delete);

// STUDENTS
router.get('/students', async (req, res) => {
  const snap = await db.collection('students').orderBy('createdAt', 'desc').get();
  res.render('admin/students', { title: 'শিক্ষার্থী ম্যানেজার', admin: req.admin, students: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});
router.post('/students', upload.single('image'), student.add);
router.put('/students/:id', upload.single('image'), student.update);
router.delete('/students/:id', student.delete);

// RESULTS
router.get('/results', async (req, res) => {
  const snap = await db.collection('results').orderBy('updatedAt', 'desc').limit(100).get();
  const courses = await db.collection('courses').orderBy('createdAt', 'desc').get();
  res.render('admin/results', {
    title: 'রেজাল্ট ম্যানেজার', admin: req.admin,
    results: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    courses: courses.docs.map(d => ({ id: d.id, ...d.data() })),
  });
});
router.post('/results', upsertResult);
router.delete('/results/:regNo', deleteResult);
router.post('/results/import', upload.single('csv'), bulkImportResults);

// RESULT — search by regNo for admin edit
router.get('/results/search/:regNo', async (req, res) => {
  const doc = await db.collection('results').doc(req.params.regNo.trim()).get();
  if (!doc.exists) return res.json({ success: false });
  return res.json({ success: true, result: { id: doc.id, ...doc.data() } });
});

// ADMISSIONS
router.get('/admissions', async (req, res) => {
  const snap = await db.collection('admissions').orderBy('submittedAt', 'desc').get();
  const siteConfig = await db.collection('settings').doc('siteConfig').get();
  const activeSessions = siteConfig.exists ? (siteConfig.data().activeSessions || []) : [];
  res.render('admin/admissions', { title: 'ভর্তি আবেদন', admin: req.admin, admissions: snap.docs.map(d => ({ id: d.id, ...d.data() })), activeSessions });
});
router.put('/admissions/:id', admissionController.updateStatus);
router.put('/admissions/:id/payment', admissionController.updatePaymentStatus);
router.delete('/admissions/:id', admissionController.delete);

// GALLERY
router.get('/gallery', async (req, res) => {
  const snap = await db.collection('gallery').orderBy('uploadedAt', 'desc').get();
  res.render('admin/gallery', { title: 'গ্যালারি ম্যানেজার', admin: req.admin, items: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});
router.post('/gallery', upload.single('image'), gallery.add);
router.delete('/gallery/:id', gallery.delete);

// CONTACT MESSAGES
router.get('/messages', async (req, res) => {
  const snap = await db.collection('contactMessages').orderBy('date', 'desc').get();
  res.render('admin/messages', { title: 'যোগাযোগ বার্তা', admin: req.admin, messages: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});
router.put('/messages/:id/read', contactController.markRead);
router.delete('/messages/:id', contactController.delete);

// ADMIN USERS
router.get('/users', async (req, res) => {
  const snap = await db.collection('admins').get();
  res.render('admin/users', { title: 'অ্যাডমিন ব্যবস্থাপনা', admin: req.admin, admins: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});
router.post('/users', adminController.addAdmin);
router.delete('/users/:uid', adminController.deleteAdmin);

// ACTIVITY LOG
router.get('/activity-log', async (req, res) => {
  const snap = await db.collection('activityLog').orderBy('timestamp', 'desc').limit(200).get();
  res.render('admin/activity-log', { title: 'কার্যক্রম লগ', admin: req.admin, logs: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});

// ACCOUNT SETTINGS
router.get('/account', (req, res) => {
  res.render('admin/account', { title: 'অ্যাকাউন্ট সেটিংস', admin: req.admin });
});
router.post('/account', adminController.updateAccount);

// DIRECTORS
const { directorController } = require('../controllers/contentControllers');
router.get('/directors', async (req, res) => {
  const snap = await db.collection('directors').orderBy('order', 'asc').get();
  res.render('admin/directors', { title: 'পরিচালক ম্যানেজমেন্ট', admin: req.admin, directors: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});
router.post('/directors', upload.single('image'), directorController.add);
router.put('/directors/:id', upload.single('image'), directorController.update);
router.delete('/directors/:id', directorController.delete);

module.exports = router;
