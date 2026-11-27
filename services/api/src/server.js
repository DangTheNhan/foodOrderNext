import dotenv from 'dotenv';
import { readConfig } from './config.js';
import { createFirebaseServices } from './firebase.js';
import { FirestoreUserRepository } from './users.js';
import { FirestoreCustomerRepository } from './customer.js';
import { FirestoreOrderRepository } from './orders.js';
import { CatalogOperations } from './catalogOperations.js';
import { AdminOperations } from './adminOperations.js';
import { OrderChat } from './orderChat.js';
import { NotificationDelivery } from './notificationDelivery.js';
import { OutboxWorker, startOutboxWorker } from './outboxWorker.js';
import { createApp } from './app.js';
import { aiConfig, OllamaGateway } from './aiGateway.js';
import { AiRepository } from './aiRepository.js';
import { FoodOrderAi } from './aiService.js';

dotenv.config({ quiet: true });
let services, stopWorker;
try {
  const config = readConfig();
  const modelConfig = aiConfig();
  services = createFirebaseServices(config);
  const notificationDelivery = new NotificationDelivery(services.firestore);
  const app = createApp({ ...services, userRepository: new FirestoreUserRepository(services.firestore),
    customerRepository: new FirestoreCustomerRepository(services.firestore), orderRepository: new FirestoreOrderRepository(services.firestore),
    orderChat: new OrderChat(services.firestore), notificationDelivery,
    ai: new FoodOrderAi(new AiRepository(services.firestore, { allowFixture: config.mode === 'emulator' }),
      new OllamaGateway(modelConfig)),
    operations: { catalog: new CatalogOperations(services.firestore, services.publishMenuImage, services.readMenuImage),
      adminUsers: new AdminOperations(services.firestore) } });
  const server = app.listen(config.port, config.bindHost, () => {
    stopWorker = startOutboxWorker(new OutboxWorker({ db: services.firestore, delivery: notificationDelivery, send: services.sendPush }));
    console.info(JSON.stringify({ event: 'api_started', mode: config.mode, port: config.port, fcmEnabled: config.fcmEnabled }));
  });
  const closeServices = async () => {
    try { await stopWorker?.(); await services.close(); }
    catch { console.error('API resource shutdown did not complete.'); process.exitCode = 1; }
  };
  server.on('error', () => { console.error('API failed to listen. Check local port and binding.'); process.exitCode = 1; void closeServices(); });
  const shutdown = () => server.close(() => void closeServices());
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch {
  // Configuration/credential errors can include file contents; never print them.
  console.error('API startup refused: check the documented environment and Firebase mode.');
  process.exitCode = 1;
  if (services) { try { await services.close(); } catch { /* Keep credential details private. */ } }
}
