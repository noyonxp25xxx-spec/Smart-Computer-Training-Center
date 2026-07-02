const { db } = require('../config/firebase');

// GET /result/:regNo — Fetch result by registration number
async function getResult(req, res) {
  const { regNo } = req.params;
  try {
    const doc = await db.collection('results').doc(regNo.trim()).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'এই রেজিস্ট্রেশন নম্বরে কোনো রেজাল্ট পাওয়া যায়নি।' });
    }
    return res.json({ success: true, result: { id: doc.id, ...doc.data() } });
  } catch (err) {
    console.error('getResult error:', err);
    return res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি। পুনরায় চেষ্টা করুন।' });
  }
}

// Admin: Add or update result
async function upsertResult(req, res) {
  const {
    regNo, studentName, courseName, session,
    subjects, totalGPA, status, publishDate,
    rollNo, phone, fatherName,
  } = req.body;

  if (!regNo || !studentName) {
    return res.status(400).json({ success: false, message: 'রেজিস্ট্রেশন নম্বর ও নাম আবশ্যক।' });
  }

  // Parse subjects from JSON string if sent as form field
  let parsedSubjects = subjects;
  if (typeof subjects === 'string') {
    try { parsedSubjects = JSON.parse(subjects); } catch { parsedSubjects = []; }
  }

  const data = {
    regNo: regNo.trim(),
    studentName,
    courseName: courseName || '',
    session: session || '',
    rollNo: rollNo || '',
    phone: phone || '',
    fatherName: fatherName || '',
    subjects: parsedSubjects || [],
    totalGPA: totalGPA || '',
    status: status || 'Pass',
    publishDate: publishDate || new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString(),
  };

  try {
    await db.collection('results').doc(regNo.trim()).set(data, { merge: true });
    // Log activity
    if (req.admin) {
      await db.collection('activityLog').add({
        adminUid: req.admin.uid,
        adminEmail: req.admin.email,
        action: 'upsert_result',
        target: regNo.trim(),
        timestamp: new Date().toISOString(),
      });
    }
    return res.json({ success: true, message: 'রেজাল্ট সফলভাবে সংরক্ষিত হয়েছে।' });
  } catch (err) {
    console.error('upsertResult error:', err);
    return res.status(500).json({ success: false, message: 'সংরক্ষণে ত্রুটি হয়েছে।' });
  }
}

// Admin: Delete result
async function deleteResult(req, res) {
  const { regNo } = req.params;
  try {
    await db.collection('results').doc(regNo.trim()).delete();
    if (req.admin) {
      await db.collection('activityLog').add({
        adminUid: req.admin.uid,
        adminEmail: req.admin.email,
        action: 'delete_result',
        target: regNo.trim(),
        timestamp: new Date().toISOString(),
      });
    }
    return res.json({ success: true, message: 'রেজাল্ট মুছে ফেলা হয়েছে।' });
  } catch (err) {
    console.error('deleteResult error:', err);
    return res.status(500).json({ success: false, message: 'মুছতে ত্রুটি হয়েছে।' });
  }
}

// Admin: List all results (paginated)
async function listResults(req, res) {
  try {
    const snap = await db.collection('results').orderBy('updatedAt', 'desc').limit(100).get();
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, results });
  } catch (err) {
    console.error('listResults error:', err);
    return res.status(500).json({ success: false, message: 'তথ্য লোডে ত্রুটি।' });
  }
}

// Admin: Bulk CSV import
const csv = require('csv-parser');
const { Readable } = require('stream');

async function bulkImportResults(req, res) {
  if (!req.file) return res.status(400).json({ success: false, message: 'CSV ফাইল আবশ্যক।' });

  const results = [];
  const stream = Readable.from(req.file.buffer.toString());

  stream
    .pipe(csv())
    .on('data', row => results.push(row))
    .on('end', async () => {
      try {
        const batch = db.batch();
        for (const row of results) {
          if (!row.regNo) continue;
          const ref = db.collection('results').doc(row.regNo.trim());
          batch.set(ref, {
            regNo: row.regNo.trim(),
            studentName: row.studentName || '',
            courseName: row.courseName || '',
            session: row.session || '',
            rollNo: row.rollNo || '',
            totalGPA: row.totalGPA || '',
            status: row.status || 'Pass',
            subjects: [],
            publishDate: row.publishDate || new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
        await batch.commit();
        return res.json({ success: true, message: `${results.length}টি রেজাল্ট সফলভাবে আমদানি হয়েছে।` });
      } catch (err) {
        console.error('bulkImport error:', err);
        return res.status(500).json({ success: false, message: 'আমদানিতে ত্রুটি হয়েছে।' });
      }
    });
}

module.exports = { getResult, upsertResult, deleteResult, listResults, bulkImportResults };
