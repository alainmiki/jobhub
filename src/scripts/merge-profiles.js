import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

const profile1 = db.collection('userProfile');
const profile2 = db.collection('userprofiles');

const p1Count = await profile1.countDocuments();
const p2Count = await profile2.countDocuments();

console.log('userProfile:', p1Count, 'documents');
console.log('userprofiles:', p2Count, 'documents');

if (p2Count > 0) {
  const p2Docs = await profile2.find().toArray();
  for (const doc of p2Docs) {
    await profile1.updateOne(
      { userId: doc.userId },
      { $set: doc },
      { upsert: true }
    );
  }
  console.log('Merged', p2Count, 'documents into userProfile');
  await profile2.drop();
  console.log('Dropped userprofiles collection');
}

console.log('Done!');
await mongoose.disconnect();
process.exit(0);
