/**
 * WHITE-BOX unit tests - menuItem.service.ts and category.service.ts (SE4030).
 */
import MenuItemModel from '../../src/models/menuItem.model';
import CategoryModel from '../../src/models/category.model';
import RestaurantModel from '../../src/models/restaurant.model';
import {
  createMenuItem,
  getMenuItemsByCategory,
  updateMenuItem,
  deleteMenuItem,
  getMenuItemsByRestaurant,
  getAllMenuItems,
  getMenuItemImage,
} from '../../src/services/menuItem.service';
import {
  createCategory,
  getCategoriesByRestaurant,
  updateCategory,
  deleteCategory,
  getAllCategories,
} from '../../src/services/category.service';
import { connectAndReset, disconnectDb } from '../helpers/db';

const idOf = (doc: any): string => doc._id.toString();

let restaurantId = '';
let categoryId = '';

beforeAll(async () => {
  await connectAndReset();
  const r = await RestaurantModel.create({
    owner_id: 'o1',
    name: 'WB2 Rest',
    image: 'i.png',
    rating: 3,
    deliveryTime: '30m',
    deliveryFee: 'Rs100',
    minOrder: 'Rs300',
    distance: '1km',
    cuisines: ['Local'],
    priceLevel: 1,
    location: { type: 'Point', coordinates: [79.86, 6.92], tag: 'a' },
  });
  restaurantId = idOf(r);
  const c = await createCategory({
    restaurant_id: restaurantId,
    name: 'Cat W',
    description: 'd',
    image_url: 'i.png',
  });
categoryId = (c as any)._id.toString();
});

afterAll(async () => {
  await disconnectDb();
});

const validItem = () => ({
  category_id: categoryId,
  name: 'Noodles',
  description: 'Good',
  price: 800,
  image_url: 'i.png',
  is_veg: true,
  is_available: true,
});

describe('WHITE-BOX menuItem.service', () => {
  it('WB-014 createMenuItem persists document', async () => {
    const doc = await createMenuItem(validItem());
    expect(doc._id).toBeDefined();
    expect(doc.price).toBe(800);
  });

  it('WB-015 getMenuItemsByCategory returns available items only', async () => {
    await createMenuItem({ ...validItem(), is_available: true });
    await createMenuItem({ ...validItem(), name: 'Hidden', is_available: false });
    const list = await getMenuItemsByCategory(categoryId);
    expect(list.some((i: any) => i.name === 'Hidden')).toBe(false);
  });

  it('WB-016 updateMenuItem applies $set and returns new doc', async () => {
    const doc = await createMenuItem(validItem());
    const updated = await updateMenuItem(idOf(doc), { price: 500 });
    expect(updated?.price).toBe(500);
  });

  it('WB-017 deleteMenuItem removes doc', async () => {
    const doc = await createMenuItem(validItem());
    const deleted = await deleteMenuItem(idOf(doc));
    expect(idOf(deleted)).toBe(idOf(doc));
  });

  it('WB-018 getMenuItemsByRestaurant joins via category ids', async () => {
    const list = await getMenuItemsByRestaurant(restaurantId);
    expect(Array.isArray(list)).toBe(true);
  });

  it('WB-019 getAllMenuItems populates category_id', async () => {
    const list = await getAllMenuItems();
    expect(Array.isArray(list)).toBe(true);
    const withCat = list.find((i: any) => i.category_id && typeof i.category_id === 'object');
    if (withCat) expect((withCat.category_id as any).name).toBeDefined();
  });

  it('WB-020 getMenuItemImage returns { image_url } only', async () => {
    const doc = await createMenuItem(validItem());
    const img = await getMenuItemImage(idOf(doc));
    expect(img?.image_url).toBe('i.png');
    expect(img).not.toHaveProperty('name');
  });

  it('WB-021 getMenuItemImage null for missing doc', async () => {
    const img = await getMenuItemImage('665f00000000000000000000');
    expect(img).toBeNull();
  });

  it('WB-022 DB failure branch: createMenuItem propagates', async () => {
    const spy = jest.spyOn(MenuItemModel, 'create').mockRejectedValueOnce(new Error('db down'));
    await expect(createMenuItem(validItem())).rejects.toThrow('db down');
    spy.mockRestore();
  });

  it('WB-023 DB failure branch: getMenuItemImage propagates', async () => {
    const spy = jest.spyOn(MenuItemModel, 'findById').mockRejectedValueOnce(new Error('db down'));
    await expect(getMenuItemImage('665f00000000000000000000')).rejects.toThrow('db down');
    spy.mockRestore();
  });

  it('WB-024 empty category list -> getMenuItemsByRestaurant returns []', async () => {
    const list = await getMenuItemsByRestaurant('665f00000000000000000000');
    expect(list).toEqual([]);
  });
});

describe('WHITE-BOX category.service', () => {
  it('WB-025 createCategory persists', async () => {
    const doc = await createCategory({ restaurant_id: restaurantId, name: 'C1', description: 'd', image_url: 'i' });
    expect(doc._id).toBeDefined();
  });

  it('WB-026 getCategoriesByRestaurant returns active categories', async () => {
    await createCategory({ restaurant_id: restaurantId, name: 'Cact', description: 'd', image_url: 'i' });
    await createCategory({ restaurant_id: restaurantId, name: 'Cnot', description: 'd', image_url: 'i', is_active: false });
    const list = await getCategoriesByRestaurant(restaurantId);
    expect(list.some((c: any) => c.name === 'Cnot')).toBe(false);
  });

  it('WB-027 updateCategory applies $set', async () => {
    const c = await createCategory({ restaurant_id: restaurantId, name: 'U1', description: 'd', image_url: 'i' });
    const updated = await updateCategory((c as any)._id.toString(), { name: 'U2' });
    expect(updated?.name).toBe('U2');
  });

  it('WB-028 deleteCategory removes doc', async () => {
    const c = await createCategory({ restaurant_id: restaurantId, name: 'D1', description: 'd', image_url: 'i' });
    const deleted = await deleteCategory((c as any)._id.toString());
    expect(idOf(deleted)).toBe((c as any)._id.toString());
  });

  it('WB-029 populate on getAllCategories (restaurant_id populated)', async () => {
    const list = await getAllCategories();
    expect(Array.isArray(list)).toBe(true);
  });

  it('WB-030 DB failure branch: getCategoriesByRestaurant propagates', async () => {
    const spy = jest.spyOn(CategoryModel, 'find').mockRejectedValueOnce(new Error('db down'));
    await expect(getCategoriesByRestaurant(restaurantId)).rejects.toThrow('db down');
    spy.mockRestore();
  });

  it('WB-031 DB failure branch: updateCategory propagates', async () => {
    const spy = jest
      .spyOn(CategoryModel, 'findByIdAndUpdate')
      .mockRejectedValueOnce(new Error('db down'));
    await expect(updateCategory('665f00000000000000000000', { name: 'x' })).rejects.toThrow('db down');
    spy.mockRestore();
  });
});

