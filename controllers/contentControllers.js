const path = require('path');
const fs = require('fs');
const { db, bucket } = require('../config/firebase');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

let s3Client = null;

function getS3Client() {
  if (s3Client) return s3Client;
  if (process.env.CF_R2_ACCESS_KEY_ID && process.env.CF_R2_SECRET_ACCESS_KEY && process.env.CF_ACCOUNT_ID) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CF_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY,
      }
    });
  }
  return s3Client;
}

async function uploadImage(file, folder) {
  if (!file) return '';
  const filename = `${folder}/${Date.now()}_${uuidv4()}_${file.originalname.replace(/\s+/g, '_')}`;

  const client = getS3Client();

  // If R2 is configured, use it
  if (client && process.env.CF_R2_BUCKET_NAME) {
    try {
      console.log('Uploading to R2 Bucket:', process.env.CF_R2_BUCKET_NAME);
      const command = new PutObjectCommand({
        Bucket: process.env.CF_R2_BUCKET_NAME,
        Key: filename,
        Body: file.buffer,
        ContentType: file.mimetype,
      });
      await client.send(command);
      console.log('R2 Upload Success:', filename);
      return `${process.env.CF_R2_PUBLIC_URL}/${filename}`;
    } catch (r2Error) {
      console.error('R2 Upload Error:', r2Error);
      throw r2Error;
    }
  } else {
    console.log('Falling back to Firebase Storage because client or bucket name is missing');
    console.log('client exists:', !!client, 'Bucket:', process.env.CF_R2_BUCKET_NAME);
  }

  // Otherwise use Firebase Storage
  const fileRef = bucket.file(filename);
  await fileRef.save(file.buffer, { metadata: { contentType: file.mimetype }, public: true });
  return `https://storage.googleapis.com/${bucket.name}/${filename}`;
}

async function logActivity(req, action, target) {
  if (!req.admin) return;
  await db.collection('activityLog').add({ adminUid: req.admin.uid, adminEmail: req.admin.email, action, target, timestamp: new Date().toISOString() });
}

const blogController = {
  list: async (req, res) => {
    const snap = await db.collection('blogPosts').orderBy('date', 'desc').get();
    res.json({ success: true, posts: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  },
  add: async (req, res) => {
    const { title, content, date, author } = req.body;
    let imageUrl = '';
    if (req.file) imageUrl = await uploadImage(req.file, 'blog');
    const ref = await db.collection('blogPosts').add({ title, content, imageUrl, date: date || new Date().toISOString().split('T')[0], author: author || 'Admin', createdAt: new Date().toISOString() });
    await logActivity(req, 'add_blog', ref.id);
    res.json({ success: true, id: ref.id });
  },
  update: async (req, res) => {
    const { id } = req.params;
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    if (req.file) update.imageUrl = await uploadImage(req.file, 'blog');
    await db.collection('blogPosts').doc(id).update(update);
    await logActivity(req, 'update_blog', id);
    res.json({ success: true });
  },
  delete: async (req, res) => {
    await db.collection('blogPosts').doc(req.params.id).delete();
    await logActivity(req, 'delete_blog', req.params.id);
    res.json({ success: true });
  },
};

const teacherController = {
  list: async (req, res) => {
    const snap = await db.collection('teachers').orderBy('order', 'asc').get();
    res.json({ success: true, teachers: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  },
  add: async (req, res) => {
    const { name, designation, bio, order } = req.body;
    let imageUrl = '';
    if (req.file) imageUrl = await uploadImage(req.file, 'teachers');
    const ref = await db.collection('teachers').add({ name, designation, bio: bio || '', imageUrl, order: parseInt(order) || 99, createdAt: new Date().toISOString() });
    await logActivity(req, 'add_teacher', ref.id);
    res.json({ success: true, id: ref.id });
  },
  update: async (req, res) => {
    const { id } = req.params;
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    if (req.file) update.imageUrl = await uploadImage(req.file, 'teachers');
    await db.collection('teachers').doc(id).update(update);
    await logActivity(req, 'update_teacher', id);
    res.json({ success: true });
  },
  delete: async (req, res) => {
    await db.collection('teachers').doc(req.params.id).delete();
    await logActivity(req, 'delete_teacher', req.params.id);
    res.json({ success: true });
  },
};

const committeeController = {
  list: async (req, res) => {
    const snap = await db.collection('committee').orderBy('order', 'asc').get();
    res.json({ success: true, members: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  },
  add: async (req, res) => {
    const { name, designation, order } = req.body;
    let imageUrl = '';
    if (req.file) imageUrl = await uploadImage(req.file, 'committee');
    const ref = await db.collection('committee').add({ name, designation, imageUrl, order: parseInt(order) || 99, createdAt: new Date().toISOString() });
    await logActivity(req, 'add_committee', ref.id);
    res.json({ success: true, id: ref.id });
  },
  update: async (req, res) => {
    const { id } = req.params;
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    if (req.file) update.imageUrl = await uploadImage(req.file, 'committee');
    await db.collection('committee').doc(id).update(update);
    await logActivity(req, 'update_committee', id);
    res.json({ success: true });
  },
  delete: async (req, res) => {
    await db.collection('committee').doc(req.params.id).delete();
    await logActivity(req, 'delete_committee', req.params.id);
    res.json({ success: true });
  },
};

const galleryController = {
  list: async (req, res) => {
    const snap = await db.collection('gallery').orderBy('uploadedAt', 'desc').get();
    res.json({ success: true, items: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  },
  add: async (req, res) => {
    const { caption, type } = req.body;
    let url = req.body.videoUrl || '';
    if (req.file) url = await uploadImage(req.file, 'gallery');
    const ref = await db.collection('gallery').add({ url, type: type || 'image', caption: caption || '', uploadedAt: new Date().toISOString() });
    await logActivity(req, 'add_gallery', ref.id);
    res.json({ success: true, id: ref.id });
  },
  delete: async (req, res) => {
    await db.collection('gallery').doc(req.params.id).delete();
    await logActivity(req, 'delete_gallery', req.params.id);
    res.json({ success: true });
  },
};

const studentController = {
  list: async (req, res) => {
    const snap = await db.collection('students').orderBy('createdAt', 'desc').get();
    res.json({ success: true, students: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  },
  add: async (req, res) => {
    const { name, regNo, course, session, phone, status } = req.body;
    let imageUrl = '';
    if (req.file) imageUrl = await uploadImage(req.file, 'students');
    const ref = await db.collection('students').add({ name, regNo, course, session, phone: phone || '', imageUrl, status: status || 'active', createdAt: new Date().toISOString() });
    await logActivity(req, 'add_student', ref.id);
    res.json({ success: true, id: ref.id });
  },
  update: async (req, res) => {
    const { id } = req.params;
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    if (req.file) update.imageUrl = await uploadImage(req.file, 'students');
    await db.collection('students').doc(id).update(update);
    await logActivity(req, 'update_student', id);
    res.json({ success: true });
  },
  delete: async (req, res) => {
    await db.collection('students').doc(req.params.id).delete();
    await logActivity(req, 'delete_student', req.params.id);
    res.json({ success: true });
  },
};

const sliderController = {
  list: async (req, res) => {
    const snap = await db.collection('sliders').orderBy('order', 'asc').get();
    res.json({ success: true, sliders: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  },
  add: async (req, res) => {
    const { caption, order, active } = req.body;
    let imageUrl = '';
    if (req.file) imageUrl = await uploadImage(req.file, 'sliders');
    const ref = await db.collection('sliders').add({ imageUrl, caption: caption || '', order: parseInt(order) || 99, active: active !== 'false', createdAt: new Date().toISOString() });
    await logActivity(req, 'add_slider', ref.id);
    res.json({ success: true, id: ref.id });
  },
  delete: async (req, res) => {
    await db.collection('sliders').doc(req.params.id).delete();
    await logActivity(req, 'delete_slider', req.params.id);
    res.json({ success: true });
  },
};

const directorController = {
  add: async (req, res) => {
    const { name, designation, institution, address, message, order } = req.body;
    let imageUrl = '';
    if (req.file) imageUrl = await uploadImage(req.file, 'directors');
    const ref = await db.collection('directors').add({ 
      name, designation, institution, address, message, order: Number(order) || 0, imageUrl, createdAt: new Date().toISOString() 
    });
    await logActivity(req, 'add_director', ref.id);
    res.json({ success: true, id: ref.id });
  },
  update: async (req, res) => {
    const { id } = req.params;
    const { name, designation, institution, address, message, order } = req.body;
    const update = { name, designation, institution, address, message, order: Number(order) || 0, updatedAt: new Date().toISOString() };
    if (req.file) update.imageUrl = await uploadImage(req.file, 'directors');
    await db.collection('directors').doc(id).update(update);
    await logActivity(req, 'update_director', id);
    res.json({ success: true });
  },
  delete: async (req, res) => {
    await db.collection('directors').doc(req.params.id).delete();
    await logActivity(req, 'delete_director', req.params.id);
    res.json({ success: true });
  },
};

module.exports = { blogController, teacherController, committeeController, galleryController, studentController, sliderController, directorController, uploadImage };
