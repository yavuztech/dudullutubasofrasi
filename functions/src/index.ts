import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';
import {
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

initializeApp();
const db = getFirestore();
const messaging = getMessaging();
const adminAuth = getAuth();

// ─── Callable: Delete staff user from Auth + Firestore ──────────────────────
export const deleteStaffUser = onCall(async (request) => {
  // Only admins can call this
  if (!request.auth) throw new HttpsError('unauthenticated', 'Giriş gerekli.');

  const callerDoc = await db.collection('staff').doc(request.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Yalnızca yöneticiler personel silebilir.');
  }

  const { uid } = request.data as { uid: string };
  if (!uid) throw new HttpsError('invalid-argument', 'UID gerekli.');
  if (uid === request.auth.uid) throw new HttpsError('invalid-argument', 'Kendinizi silemezsiniz.');

  await adminAuth.deleteUser(uid);
  await db.collection('staff').doc(uid).delete();
  logger.info(`Staff user ${uid} deleted by ${request.auth.uid}`);
  return { success: true };
});

// ─── Helper: send FCM to a single token ────────────────────────────────────
async function sendPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  try {
    await messaging.send({
      token,
      notification: { title, body },
      data,
      android: { priority: 'high', notification: { sound: 'default', vibrateTimingsMillis: [200, 100, 200] } },
      apns: {
        payload: {
          aps: { sound: 'default', badge: 1 },
        },
      },
      webpush: {
        notification: { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', vibrate: [200, 100, 200] },
        headers: { Urgency: 'high' },
      },
    });
  } catch (e) {
    logger.warn('FCM send failed', { token: token.slice(0, 20), error: e });
  }
}

// ─── Helper: get all FCM tokens for a role ─────────────────────────────────
async function getTokensForRole(role: string): Promise<string[]> {
  const roles = role === 'kitchen_waiter' ? ['kitchen', 'waiter'] : [role];
  const snapshots = await Promise.all(roles.flatMap((staffRole) => [
    db.collection('staff').where('roles', 'array-contains', staffRole).get(),
    db.collection('staff').where('role', '==', staffRole).get(),
  ]));
  const tokens = new Set<string>();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((staffDoc) => {
    const token = staffDoc.data().fcmToken;
    if (typeof token === 'string' && token) tokens.add(token);
  }));
  return [...tokens];
}

// ─── Trigger: Order status changes ─────────────────────────────────────────
export const onOrderStatusChanged = onDocumentUpdated(
  'orders/{orderId}',
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    const orderId   = event.params.orderId;
    const orderType = after.type as string;
    const tableNum  = after.tableNumber as number | undefined;

    // ── ORDER READY ──────────────────────────────────────────────────────
    if (after.status === 'ready') {
      if (orderType === 'table') {
        // Notify waiters
        const waiterRole = after.tableSection === 'ladies' ? 'waiter_ladies' : 'waiter';
        const waiterTokens = await getTokensForRole(waiterRole);
        const msg = `${after.tableLabel || `Masa ${tableNum}`} siparişi hazır! 🔔`;
        await Promise.all(waiterTokens.map((t) => sendPush(t, 'Sipariş Hazır', msg, { type: 'order_ready', orderId })));
        logger.info(`Notified ${waiterTokens.length} waiters for table ${tableNum}`);
      }

      if (orderType === 'takeaway') {
        // Notify customer device
        const customerToken = after.customerPushToken as string | undefined;
        if (customerToken) {
          await sendPush(
            customerToken,
            '🎉 Siparişiniz Hazır!',
            'Gel Al siparişiniz hazır. Gelebilirsiniz!',
            { type: 'takeaway_ready', orderId }
          );
        }
        logger.info(`Notified takeaway customer for order ${orderId}`);
      }
    }

    // ── TABLE CUSTOMER NOTIFICATION (table order ready → customer in-app) ─
    if (after.status === 'ready' && orderType === 'table') {
      const customerToken = after.customerPushToken as string | undefined;
      if (customerToken) {
        await sendPush(
          customerToken,
          '🍽️ Siparişiniz Geliyor',
          `${after.tableLabel || `Masa ${tableNum}`} siparişiniz hazırlandı, garsonumuz getiriyor.`,
          { type: 'order_coming', orderId }
        );
      }
    }
  }
);

// ─── Trigger: Notification document created → push matching staff ───────────
export const onNotificationCreated = onDocumentUpdated(
  'notifications/{notifId}',
  async (event) => {
    const after = event.data?.after.data();
    if (!after || after.pushed) return;

    const targetRole = after.targetRole as string;
    if (targetRole === 'customer') return; // handled via order trigger

    const tokens = await getTokensForRole(targetRole);
    const message = after.message as string;

    await Promise.all(tokens.map((t) => sendPush(t, 'Tuba Sofrası', message, { notifId: event.params.notifId })));

    // Mark as pushed to avoid re-sending
    await event.data!.after.ref.update({ pushed: true, pushedAt: FieldValue.serverTimestamp() });
    logger.info(`Pushed notification to ${tokens.length} ${targetRole} staff`);
  }
);
