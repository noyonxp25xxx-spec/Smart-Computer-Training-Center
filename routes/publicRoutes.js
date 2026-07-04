const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { contactController } = require('../controllers/adminControllers');


// Helper to fetch collection as array
async function fetchCollection(col, orderField = 'createdAt', dir = 'desc', limit = 50) {
  try {
    const snap = await db.collection(col).orderBy(orderField, dir).limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

// HOME
router.get('/', async (req, res) => {
  let allCourses = await fetchCollection('courses', 'createdAt', 'desc', 50);
  allCourses.sort((a, b) => (a.sortOrder || 9999) - (b.sortOrder || 9999));
  const courses = allCourses.slice(0, 6);

  const [sliders, notices, teachers, posts, directors, coursesCountSnap, studentsCountSnap] = await Promise.all([
    fetchCollection('sliders', 'order', 'asc', 10),
    fetchCollection('notices', 'date', 'desc', 5),
    fetchCollection('teachers', 'order', 'asc', 8),
    fetchCollection('blogPosts', 'date', 'desc', 3),
    fetchCollection('directors', 'order', 'asc', 10),
    db.collection('courses').count().get(),
    db.collection('admissions').count().get(),
  ]);
  const settingsDoc = await db.collection('settings').doc('siteConfig').get();
  const counters = settingsDoc.exists ? (settingsDoc.data().counters || {}) : {};
  
  // Use actual counts from database instead of static settings
  counters.courses = coursesCountSnap.data().count;
  counters.students = studentsCountSnap.data().count;

  res.render('public/home', { title: res.locals.site.name, sliders, courses, notices, teachers, posts, directors, counters });
});

// ABOUT
router.get('/about', async (req, res) => {
  const settingsDoc = await db.collection('settings').doc('siteConfig').get();
  const about = settingsDoc.exists ? (settingsDoc.data().about || {}) : {};
  res.render('public/about', { title: 'প্রতিষ্ঠান সম্পর্কে', about });
});

// DIRECTOR
router.get('/director', async (req, res) => {
  const snap = await db.collection('directors').orderBy('order', 'asc').get();
  const directors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  res.render('public/director', { title: 'পরিচালকদের বাণী', directors });
});

// COMMITTEE
router.get('/committee', async (req, res) => {
  const members = await fetchCollection('committee', 'order', 'asc', 50);
  res.render('public/committee', { title: 'পরিচালনা কমিটি', members });
});

// TEACHERS
router.get('/teachers', async (req, res) => {
  const teachers = await fetchCollection('teachers', 'order', 'asc', 50);
  res.render('public/teachers', { title: 'শিক্ষকমণ্ডলী', teachers });
});

// COURSES LIST
router.get('/courses', async (req, res) => {
  const courses = await fetchCollection('courses', 'createdAt', 'desc', 50);
  courses.sort((a, b) => (a.sortOrder || 9999) - (b.sortOrder || 9999));
  res.render('public/courses', { title: 'কোর্সসমূহ', courses });
});

// COURSE DETAIL
router.get('/courses/:id', async (req, res) => {
  try {
    const doc = await db.collection('courses').doc(req.params.id).get();
    if (!doc.exists) return res.redirect('/courses');
    const course = { id: doc.id, ...doc.data() };
    res.render('public/course-detail', { title: course.name, course });
  } catch { res.redirect('/courses'); }
});

// BLOG LIST
router.get('/blog', async (req, res) => {
  const posts = await fetchCollection('blogPosts', 'date', 'desc', 20);
  res.render('public/blog', { title: 'আইটি তথ্য ও ব্লগ', posts });
});

// BLOG DETAIL
router.get('/blog/:id', async (req, res) => {
  try {
    const doc = await db.collection('blogPosts').doc(req.params.id).get();
    if (!doc.exists) return res.redirect('/blog');
    const post = { id: doc.id, ...doc.data() };
    res.render('public/blog-detail', { title: post.title, post });
  } catch { res.redirect('/blog'); }
});

// NOTICES
router.get('/notices', async (req, res) => {
  const notices = await fetchCollection('notices', 'date', 'desc', 50);
  const published = notices.filter(n => n.status === 'published');
  res.render('public/notices', { title: 'নোটিশ বোর্ড', notices: published });
});

// ADMISSION FORM
router.get('/admission', async (req, res) => {
  const courses = await fetchCollection('courses', 'createdAt', 'desc', 50);
  let activeSessions = [];
  try {
    const doc = await db.collection('settings').doc('siteConfig').get();
    if (doc.exists && doc.data().activeSessions) {
      activeSessions = doc.data().activeSessions.split(',').map(s => s.trim()).filter(s => s);
    }
  } catch (err) {}
  res.render('public/admission', { title: 'অনলাইন ভর্তি ফরম', courses, activeSessions });
});

// STUDENTS
router.get('/students', async (req, res) => {
  const students = await fetchCollection('students', 'createdAt', 'desc', 50);
  res.render('public/students', { title: 'শিক্ষার্থীবৃন্দ', students });
});

// RESULT PAGE
router.get('/result', (req, res) => {
  res.render('public/result', { title: 'ফলাফল দেখুন' });
});

// GALLERY
router.get('/gallery', async (req, res) => {
  const items = await fetchCollection('gallery', 'uploadedAt', 'desc', 100);
  res.render('public/gallery', { title: 'গ্যালারি', items });
});

// CONTACT
router.get('/contact', (req, res) => {
  res.render('public/contact', { title: 'যোগাযোগ' });
});

router.post('/api/contact', contactController.submit);

// TRACK APPLICATION
router.get('/track-application', (req, res) => {
  res.render('public/track-application', { title: 'আবেদন ট্র্যাক করুন' });
});

router.get('/api/track/:id', async (req, res) => {
  try {
    let docId = req.params.id.trim();
    // In case user searches with SCT- prefix we can query by applicationId or doc id
    let snap = await db.collection('admissions').where('applicationId', '==', docId).get();
    let docData = null;
    
    if (!snap.empty) {
      docData = snap.docs[0].data();
    } else {
      // fallback to searching by document ID directly
      const docRef = await db.collection('admissions').doc(docId).get();
      if (docRef.exists) docData = docRef.data();
    }

    if (!docData) {
      return res.json({ success: false, message: 'এই আইডির কোনো আবেদন পাওয়া যায়নি।' });
    }

    return res.json({
      success: true,
      data: {
        name: docData.name,
        status: docData.status,
        session: docData.session || '—',
        classRoll: docData.classRoll || '—',
        course: docData.trade || docData.course || '—',
        paymentStatus: docData.paymentStatus || 'unpaid',
        registrationNo: docData.registrationNo || ''
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি।' });
  }
});

// APPLICATION COPY (Printable Teletalk style)
router.get('/application-copy/:id', async (req, res) => {
  try {
    const docId = req.params.id.trim();
    // Search by applicationId (e.g. SCT-XXXXX) or document ID
    let snap = await db.collection('admissions').where('applicationId', '==', docId).get();
    let admission = null;
    if (!snap.empty) {
      admission = snap.docs[0].data();
    } else {
      const docRef = await db.collection('admissions').doc(docId).get();
      if (docRef.exists) admission = docRef.data();
    }
    
    if (!admission) {
      return res.status(404).render('public/404', { title: 'আবেদন খুঁজে পাওয়া যায়নি' });
    }

    let courseFee = '—';
    let courseFeeTotal = 0;
    let courseFeeBreakdown = [];
    const rawCourse = admission.trade || admission.course || '';
    
    // Handle multiple courses (comma-separated)
    const courseNames = rawCourse.split(',').map(c => c.trim()).filter(c => c.length > 0);
    
    if (courseNames.length > 0) {
      // Fetch fees for all courses
      for (const cName of courseNames) {
        const snap = await db.collection('courses').where('name', '==', cName).get();
        if (!snap.empty) {
          const fee = parseFloat(snap.docs[0].data().fee || 0);
          if (fee > 0) {
            courseFeeTotal += fee;
            courseFeeBreakdown.push({ name: cName, fee });
          }
        }
      }
      if (courseFeeTotal > 0) {
        courseFee = courseFeeTotal.toString();
      }
    }

    res.render('public/application-copy', { title: 'Applicant Copy', admission, courseFee, courseFeeBreakdown });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// 404
router.get('/404', (req, res) => {
  res.status(404).render('public/404', { title: 'পেজ পাওয়া যায়নি' });
});

// Proxy route for html2canvas to fetch cross-origin images
router.get('/proxy-image', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('No URL provided');
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch image');
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (error) {
    console.error('Proxy Error:', error.message);
    res.status(500).send('Error fetching image');
  }
});

module.exports = router;
