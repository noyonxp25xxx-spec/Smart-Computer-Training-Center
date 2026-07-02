require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.CF_R2_ACCESS_KEY_ID, secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY }
});
const command = new PutObjectCommand({ Bucket: process.env.CF_R2_BUCKET_NAME, Key: 'test.txt', Body: 'test' });
s3Client.send(command).then(() => console.log('Success')).catch(e => { console.log('Error Name:', e.name); console.log('Message:', e.message); });
