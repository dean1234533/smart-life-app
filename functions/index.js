const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");

initializeApp();
const db = getFirestore();

// Collections that auto-delete after 90 days
const EXPIRING_SUBCOLLECTIONS = [
  "chatHistory",
  "mapSessions",
  "rawTranscriptions",
  "aiProcessingLogs",
  "dismissedActions",
];

// suggestedItems: only delete where accepted === false
const CONDITIONAL_EXPIRY = {
  suggestedItems: { field: "accepted", value: false },
};

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

async function deleteExpiredDocs(uid, subcollection, cutoff, condition = null) {
  const colRef = db.collection("users").doc(uid).collection(subcollection);
  let q = colRef.where("createdAt", "<", Timestamp.fromMillis(cutoff));
  if (condition) {
    q = q.where(condition.field, "==", condition.value);
  }

  const snap = await q.get();
  if (snap.empty) return 0;

  const BATCH_SIZE = 400;
  let deleted = 0;
  let batch = db.batch();
  let count = 0;

  for (const docSnap of snap.docs) {
    batch.delete(docSnap.ref);
    count++;
    deleted++;
    if (count >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
  return deleted;
}

exports.autoCleanup90Days = onSchedule(
  {
    schedule: "0 3 * * *", // Run daily at 3am UTC
    timeZone: "UTC",
    memory: "256MiB",
  },
  async () => {
    const cutoff = Date.now() - NINETY_DAYS_MS;
    const stats = {};

    // Get all user UIDs
    const usersSnap = await db.collection("users").get();
    if (usersSnap.empty) {
      logger.info("No users found.");
      return;
    }

    logger.info(`Running 90-day cleanup for ${usersSnap.size} users. Cutoff: ${new Date(cutoff).toISOString()}`);

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const userStats = {};

      // Delete expiring subcollections
      for (const sub of EXPIRING_SUBCOLLECTIONS) {
        try {
          const count = await deleteExpiredDocs(uid, sub, cutoff);
          if (count > 0) userStats[sub] = count;
        } catch (err) {
          logger.error(`Error cleaning ${sub} for user ${uid}:`, err.message);
        }
      }

      // Delete conditional expiry (suggestedItems where accepted = false)
      for (const [sub, cond] of Object.entries(CONDITIONAL_EXPIRY)) {
        try {
          const count = await deleteExpiredDocs(uid, sub, cutoff, cond);
          if (count > 0) userStats[sub] = count;
        } catch (err) {
          logger.error(`Error cleaning ${sub} for user ${uid}:`, err.message);
        }
      }

      if (Object.keys(userStats).length > 0) {
        stats[uid] = userStats;
      }
    }

    const totalDeleted = Object.values(stats).reduce((sum, u) =>
      sum + Object.values(u).reduce((s, n) => s + n, 0), 0
    );

    logger.info(`Cleanup complete. Total documents deleted: ${totalDeleted}`, { stats });
  }
);
