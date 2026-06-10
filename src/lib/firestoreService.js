import {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where, orderBy, limit,
  serverTimestamp, Timestamp, writeBatch, onSnapshot,
} from 'firebase/firestore';
import { firestore } from './firebase.js';

// ── User document ──────────────────────────────────────────────────────────
export const getUserDoc = (uid) => doc(firestore, 'users', uid);

export async function getOrCreateUser(uid, defaults = {}) {
  const ref = getUserDoc(uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  const data = {
    createdAt: serverTimestamp(),
    colourPreference: 'cyan',
    connectedCalendars: [],
    globalBookingRules: {
      bufferMinutes: 15,
      noBookingBefore: '09:00',
      noBookingAfter: '18:00',
      weekdaysOnly: true,
      maxBookingsPerDay: 8,
    },
    ...defaults,
  };
  await setDoc(ref, data);
  return { id: uid, ...data };
}

export async function updateUserDoc(uid, data) {
  await updateDoc(getUserDoc(uid), data);
}

// ── Generic subcollection helpers ──────────────────────────────────────────
const sub = (uid, col) => collection(firestore, 'users', uid, col);

async function listSub(uid, col, opts = {}) {
  const { orderField = 'createdAt', dir = 'desc', max = 100, filters = [] } = opts;
  let q = query(sub(uid, col), orderBy(orderField, dir), limit(max));
  for (const [field, op, val] of filters) {
    q = query(q, where(field, op, val));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function createSub(uid, col, data) {
  const ref = await addDoc(sub(uid, col), { ...data, createdAt: serverTimestamp() });
  return { id: ref.id, ...data };
}

async function updateSub(uid, col, docId, data) {
  await updateDoc(doc(firestore, 'users', uid, col, docId), { ...data, updatedAt: serverTimestamp() });
}

async function deleteSub(uid, col, docId) {
  await deleteDoc(doc(firestore, 'users', uid, col, docId));
}

async function getSub(uid, col, docId) {
  const snap = await getDoc(doc(firestore, 'users', uid, col, docId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Notes ──────────────────────────────────────────────────────────────────
export const notesService = {
  list: (uid, opts) => listSub(uid, 'notes', opts),
  get: (uid, id) => getSub(uid, 'notes', id),
  create: (uid, data) => createSub(uid, 'notes', data),
  update: (uid, id, data) => updateSub(uid, 'notes', id, data),
  delete: (uid, id) => deleteSub(uid, 'notes', id),
};

// ── Shopping Lists ─────────────────────────────────────────────────────────
export const shoppingListsService = {
  list: (uid, opts) => listSub(uid, 'shoppingLists', opts),
  get: (uid, id) => getSub(uid, 'shoppingLists', id),
  create: (uid, data) => createSub(uid, 'shoppingLists', data),
  update: (uid, id, data) => updateSub(uid, 'shoppingLists', id, data),
  delete: (uid, id) => deleteSub(uid, 'shoppingLists', id),
};

// ── Recipes ────────────────────────────────────────────────────────────────
export const recipesService = {
  list: (uid, opts) => listSub(uid, 'recipes', opts),
  get: (uid, id) => getSub(uid, 'recipes', id),
  create: (uid, data) => createSub(uid, 'recipes', data),
  update: (uid, id, data) => updateSub(uid, 'recipes', id, data),
  delete: (uid, id) => deleteSub(uid, 'recipes', id),
};

// ── Meeting Summaries ──────────────────────────────────────────────────────
export const meetingSummariesService = {
  list: (uid, opts) => listSub(uid, 'meetingSummaries', opts),
  get: (uid, id) => getSub(uid, 'meetingSummaries', id),
  create: (uid, data) => createSub(uid, 'meetingSummaries', data),
  update: (uid, id, data) => updateSub(uid, 'meetingSummaries', id, data),
  delete: (uid, id) => deleteSub(uid, 'meetingSummaries', id),
};

// ── Calendar Events ────────────────────────────────────────────────────────
export const calendarEventsService = {
  list: (uid, opts) => listSub(uid, 'calendarEvents', opts),
  create: (uid, data) => createSub(uid, 'calendarEvents', data),
  update: (uid, id, data) => updateSub(uid, 'calendarEvents', id, data),
  delete: (uid, id) => deleteSub(uid, 'calendarEvents', id),
};

// ── Contacts ───────────────────────────────────────────────────────────────
export const contactsService = {
  list: (uid, opts) => listSub(uid, 'contacts', opts),
  get: (uid, id) => getSub(uid, 'contacts', id),
  create: (uid, data) => createSub(uid, 'contacts', data),
  update: (uid, id, data) => updateSub(uid, 'contacts', id, data),
  delete: (uid, id) => deleteSub(uid, 'contacts', id),
};

// ── Expenses ───────────────────────────────────────────────────────────────
export const expensesService = {
  list: (uid, opts) => listSub(uid, 'expenses', opts),
  create: (uid, data) => createSub(uid, 'expenses', data),
  update: (uid, id, data) => updateSub(uid, 'expenses', id, data),
  delete: (uid, id) => deleteSub(uid, 'expenses', id),
};

// ── Follow-Ups ─────────────────────────────────────────────────────────────
export const followUpsService = {
  list: (uid, opts) => listSub(uid, 'followUps', opts),
  create: (uid, data) => createSub(uid, 'followUps', data),
  update: (uid, id, data) => updateSub(uid, 'followUps', id, data),
  delete: (uid, id) => deleteSub(uid, 'followUps', id),
};

// ── Booking Links ──────────────────────────────────────────────────────────
export const bookingLinksService = {
  list: (uid, opts) => listSub(uid, 'bookingLinks', opts),
  get: (uid, id) => getSub(uid, 'bookingLinks', id),
  create: (uid, data) => createSub(uid, 'bookingLinks', data),
  update: (uid, id, data) => updateSub(uid, 'bookingLinks', id, data),
  delete: (uid, id) => deleteSub(uid, 'bookingLinks', id),
  getBySlug: async (uid, slug) => {
    const snap = await getDocs(
      query(sub(uid, 'bookingLinks'), where('slug', '==', slug), limit(1))
    );
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  },
};

// ── Bookings ───────────────────────────────────────────────────────────────
export const bookingsService = {
  list: (uid, opts) => listSub(uid, 'bookings', opts),
  create: (uid, data) => createSub(uid, 'bookings', data),
  update: (uid, id, data) => updateSub(uid, 'bookings', id, data),
  listByLink: (uid, linkId) =>
    listSub(uid, 'bookings', { filters: [['linkId', '==', linkId]] }),
};

// ── Suggested Items (90-day delete) ───────────────────────────────────────
export const suggestedItemsService = {
  list: (uid, opts) => listSub(uid, 'suggestedItems', opts),
  create: (uid, data) => createSub(uid, 'suggestedItems', data),
  update: (uid, id, data) => updateSub(uid, 'suggestedItems', id, data),
  delete: (uid, id) => deleteSub(uid, 'suggestedItems', id),
};

// ── Map Sessions (90-day delete) ───────────────────────────────────────────
export const mapSessionsService = {
  list: (uid, opts) => listSub(uid, 'mapSessions', opts),
  create: (uid, data) => createSub(uid, 'mapSessions', data),
};

// ── Raw Transcriptions (90-day delete) ────────────────────────────────────
export const rawTranscriptionsService = {
  create: (uid, data) => createSub(uid, 'rawTranscriptions', data),
};

// ── AI Processing Logs (90-day delete) ────────────────────────────────────
export const aiLogsService = {
  create: (uid, data) => createSub(uid, 'aiProcessingLogs', data),
};

// ── Chat History (90-day delete) ──────────────────────────────────────────
export const chatHistoryService = {
  list: (uid, opts) => listSub(uid, 'chatHistory', { ...opts, orderField: 'createdAt', dir: 'asc' }),
  create: (uid, data) => createSub(uid, 'chatHistory', data),
};

// ── Dismissed Actions (90-day delete) ─────────────────────────────────────
export const dismissedActionsService = {
  create: (uid, data) => createSub(uid, 'dismissedActions', data),
};

// ── Invites (admin collection, top-level) ─────────────────────────────────
export const invitesService = {
  list: async () => {
    const snap = await getDocs(collection(firestore, 'invites'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  create: async (data) => {
    // Use setDoc with data.id as the document path so Register.jsx can look it up by that ID
    const ref = doc(firestore, 'invites', data.id);
    await setDoc(ref, { ...data, used: false, createdAt: serverTimestamp() });
    return { id: data.id, ...data };
  },
  get: async (id) => {
    const snap = await getDoc(doc(firestore, 'invites', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },
  markUsed: async (id) => {
    await updateDoc(doc(firestore, 'invites', id), { used: true, usedAt: serverTimestamp() });
  },
};

// ── Tasks ──────────────────────────────────────────────────────────────────
export const tasksService = {
  list: (uid, opts) => listSub(uid, 'tasks', opts),
  get: (uid, id) => getSub(uid, 'tasks', id),
  create: (uid, data) => createSub(uid, 'tasks', { created_date: new Date().toISOString(), ...data }),
  update: (uid, id, data) => updateSub(uid, 'tasks', id, data),
  delete: (uid, id) => deleteSub(uid, 'tasks', id),
};

// ── Recordings ─────────────────────────────────────────────────────────────
export const recordingsService = {
  list: (uid, opts) => listSub(uid, 'recordings', opts),
  get: (uid, id) => getSub(uid, 'recordings', id),
  create: (uid, data) => createSub(uid, 'recordings', { created_date: new Date().toISOString(), ...data }),
  update: (uid, id, data) => updateSub(uid, 'recordings', id, data),
  delete: (uid, id) => deleteSub(uid, 'recordings', id),
};

// ── Availability Slots ─────────────────────────────────────────────────────
export const availabilityService = {
  list: (uid, opts) => listSub(uid, 'availability', opts),
  get: (uid, id) => getSub(uid, 'availability', id),
  create: (uid, data) => createSub(uid, 'availability', data),
  update: (uid, id, data) => updateSub(uid, 'availability', id, data),
  delete: (uid, id) => deleteSub(uid, 'availability', id),
};

// ── Timeline Events ────────────────────────────────────────────────────────
export const timelineEventsService = {
  list: (uid, opts) => listSub(uid, 'timelineEvents', opts),
  create: (uid, data) => createSub(uid, 'timelineEvents', data),
  delete: (uid, id) => deleteSub(uid, 'timelineEvents', id),
};

// ── Memories ───────────────────────────────────────────────────────────────
export const memoriesService = {
  list: (uid, opts) => listSub(uid, 'memories', opts),
  create: (uid, data) => createSub(uid, 'memories', data),
  delete: (uid, id) => deleteSub(uid, 'memories', id),
};

// ── Firestore Timestamp helpers ────────────────────────────────────────────
export { serverTimestamp, Timestamp };
