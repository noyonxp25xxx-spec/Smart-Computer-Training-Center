const { db, bucket } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const { uploadImage } = require('./contentControllers');

// List all courses
async function listCourses(req, res) {
  try {
    const snap = await db.collection('courses').orderBy('createdAt', 'desc').get();
    return res.json({ success: true, courses: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Add course
async function addCourse(req, res) {
  try {
    const { name, code, description, active, durationsData } = req.body;
    let imageUrl = '';
    if (req.file) imageUrl = await uploadImage(req.file, 'courses');

    let durations = [];
    if (durationsData) durations = JSON.parse(durationsData);

    const ref = await db.collection('courses').add({
      name, code, description,
      durations,
      imageUrl,
      active: active === 'true' || active === true,
      createdAt: new Date().toISOString(),
    });
    await logActivity(req, 'add_course', ref.id);
    return res.json({ success: true, id: ref.id, message: 'কোর্স সফলভাবে যোগ করা হয়েছে।' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Update course
async function updateCourse(req, res) {
  try {
    const { id } = req.params;
    const { name, code, description, active, durationsData } = req.body;
    
    let durations = [];
    if (durationsData) durations = JSON.parse(durationsData);

    const update = { name, code, description, durations, active: active === 'true' || active === true, updatedAt: new Date().toISOString() };
    if (req.file) update.imageUrl = await uploadImage(req.file, 'courses');
    await db.collection('courses').doc(id).update(update);
    await logActivity(req, 'update_course', id);
    return res.json({ success: true, message: 'কোর্স আপডেট হয়েছে।' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Delete course
async function deleteCourse(req, res) {
  try {
    const { id } = req.params;
    await db.collection('courses').doc(id).delete();
    await logActivity(req, 'delete_course', id);
    return res.json({ success: true, message: 'কোর্স মুছে ফেলা হয়েছে।' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function logActivity(req, action, target) {
  if (!req.admin) return;
  await db.collection('activityLog').add({
    adminUid: req.admin.uid,
    adminEmail: req.admin.email,
    action, target,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { listCourses, addCourse, updateCourse, deleteCourse };
