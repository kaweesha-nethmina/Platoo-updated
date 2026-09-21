import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { CartModel } from '../../src/models/cartModel';

dotenv.config();

async function probe() {
  await mongoose.connect('mongodb://127.0.0.1:27017/platoo_cart_scan');
  console.log('mongoose version:', mongoose.version, '| strictQuery set?', mongoose.get('strictQuery'));

  await CartModel.deleteMany({});
  await CartModel.create({
    userId: 'real-user-1',
    items: [{ productId: 'secret-item', name: 'Victim Item', price: 99, quantity: 1 }],
  });
  const created = await CartModel.findOne({ userId: 'real-user-1' });
  console.log('seeded cart:', created ? (created as any)._id.toString() : 'FAILED');

  console.log('--- query: findOne({userId: {$ne: null}}) while a real cart exists ---');
  try {
    const r = await CartModel.findOne({ userId: { $ne: null } } as any);
    console.log('RESULT:', r ? `MATCHED ${r.userId} (INJECTION BYPASSED FILTER)` : 'null (filter not bypassed)');
  } catch (e: any) {
    console.log('ERROR (cast):', e.message);
  }

  console.log('--- query: findOne({userId: {$gt: ""}}) ---');
  try {
    const r = await CartModel.findOne({ userId: { $gt: '' } } as any);
    console.log('RESULT:', r ? `MATCHED ${r.userId}` : 'null');
  } catch (e: any) {
    console.log('ERROR (cast):', e.message);
  }

  console.log('--- query: findOne({$or:[{userId:"real-user-1", "__proto__": undefined}]}) ---');
  try {
    const r = await CartModel.findOne({ $or: [{ userId: 'real-user-1' }] } as any);
    console.log('RESULT:', r ? `MATCHED ${r.userId}` : 'null');
  } catch (e: any) {
    console.log('ERROR:', e.message);
  }

  await mongoose.disconnect();
}
probe().catch((e) => console.error(e));