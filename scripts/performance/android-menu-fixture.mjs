import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readConfig } from '../../services/api/src/config.js';
import { createFirebaseServices } from '../../services/api/src/firebase.js';
import { assertLocalEmulators } from '../seed/emulator-guard.mjs';
import { DATASET_ID } from '../seed/plan.mjs';

const project = assertLocalEmulators();
const config = readConfig();
assert.equal(config.mode, 'emulator');
assert.equal(config.projectId, project);
const services = createFirebaseServices(config);
try {
  const db = services.firestore;
  const manifest = await db.doc('seedManifests/' + DATASET_ID).get();
  assert.equal(manifest.get('fake'), true, 'Apply the synthetic demo seed first.');
  const shop = await db.doc('shops/shop1').get();
  assert.equal(shop.get('ownerUid'), 'demo-merchant-1');
  const template = (await db.doc('menuItems/shop1-rice').get()).data();
  assert.equal(template?.shopId, 'shop1');
  const ids = Array.from({ length: 45 }, (_, index) => 'p08-android-food-' + String(index).padStart(2, '0'));
  const existing = await db.getAll(...ids.map(id => db.doc('menuItems/' + id)));
  assert.equal(existing.filter(doc => doc.exists).length, 0, 'Use a fresh local demo session for the Android fixture.');
  const photo = await readFile(new URL('../../apps/mobile/src/assets/images/onboarding/onboarding_1.jpg', import.meta.url));
  const pending = 'shops/shop1/menu/p08-android-local-image.jpg';
  await services.storage.bucket().file(pending).save(photo, { resumable: false, metadata: {
    contentType: 'image/jpeg', metadata: { state: 'pending', ownerUid: 'demo-merchant-1' },
  } });
  const imagePath = await services.publishMenuImage('demo-merchant-1', 'shop1', ids[0], pending);
  const batch = db.batch();
  for (const [index, id] of ids.entries()) {
    const label = String(index).padStart(2, '0');
    batch.create(db.doc('menuItems/' + id), { ...template, name: 'Món đo Android ' + label,
      nameKey: 'a p08 android ' + label, availablePortions: 50, reservedPortions: 0, soldPortions: 0,
      imagePath: index === 0 ? imagePath : null });
  }
  await batch.commit();
  console.log(JSON.stringify({ fixture: 'p08-native-menu', addedItems: ids.length, samplePhotoBytes: photo.byteLength }));
} finally {
  await services.close();
}
