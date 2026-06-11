import { firestore, firebaseAuth } from '@/lib/firebase';
import {
  doc, setDoc, getDoc, onSnapshot, addDoc, collection, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

// Ensure we have any Firebase auth session (anonymous is fine for the receiver/TV side)
export async function ensureAuth() {
  if (!firebaseAuth.currentUser) {
    await signInAnonymously(firebaseAuth);
  }
}

export function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── SENDER — captures screen and streams to TV ────────────────────────────────
export async function startSender(roomCode, screenStream, onStateChange) {
  await ensureAuth();
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // Add all tracks from the captured screen
  screenStream.getTracks().forEach(t => pc.addTrack(t, screenStream));

  const roomRef   = doc(firestore, 'mirrorRooms', roomCode);
  const senderRef = collection(roomRef, 'senderCandidates');
  const recvRef   = collection(roomRef, 'receiverCandidates');

  // Send our ICE candidates to Firestore
  pc.onicecandidate = ({ candidate }) => {
    if (candidate) addDoc(senderRef, candidate.toJSON()).catch(() => {});
  };

  pc.onconnectionstatechange = () => onStateChange?.(pc.connectionState);
  pc.oniceconnectionstatechange = () => {
    if (['disconnected','failed','closed'].includes(pc.iceConnectionState)) {
      onStateChange?.('disconnected');
    }
  };

  // Create offer and store in Firestore
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await setDoc(roomRef, { offer: { sdp: offer.sdp, type: offer.type }, active: true, created: serverTimestamp() });

  // Listen for answer from TV
  const unsubRoom = onSnapshot(roomRef, snap => {
    const data = snap.data();
    if (data?.answer && !pc.currentRemoteDescription) {
      pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(() => {});
    }
  });

  // Listen for ICE candidates from TV
  const unsubCandidates = onSnapshot(recvRef, snap => {
    snap.docChanges().filter(c => c.type === 'added').forEach(c => {
      pc.addIceCandidate(new RTCIceCandidate(c.doc.data())).catch(() => {});
    });
  });

  const cleanup = async () => {
    unsubRoom();
    unsubCandidates();
    pc.close();
    screenStream.getTracks().forEach(t => t.stop());
    // Mark room as inactive so TV knows the cast ended
    await setDoc(roomRef, { active: false }, { merge: true }).catch(() => {});
  };

  return { pc, cleanup };
}

// ── RECEIVER — TV opens the URL and displays the stream ───────────────────────
export async function startReceiver(roomCode, onStream, onStateChange) {
  await ensureAuth();
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  const roomRef   = doc(firestore, 'mirrorRooms', roomCode);
  const senderRef = collection(roomRef, 'senderCandidates');
  const recvRef   = collection(roomRef, 'receiverCandidates');

  // Send our ICE candidates
  pc.onicecandidate = ({ candidate }) => {
    if (candidate) addDoc(recvRef, candidate.toJSON()).catch(() => {});
  };

  // Receive the screen stream
  pc.ontrack = e => {
    if (e.streams?.[0]) onStream?.(e.streams[0]);
  };

  pc.onconnectionstatechange = () => onStateChange?.(pc.connectionState);
  pc.oniceconnectionstatechange = () => {
    if (['disconnected','failed','closed'].includes(pc.iceConnectionState)) {
      onStateChange?.('disconnected');
    }
  };

  // Get the offer
  const snap = await getDoc(roomRef);
  if (!snap.exists()) throw new Error('Room not found — the room code may be wrong or the cast has ended.');
  const { offer, active } = snap.data();
  if (active === false) throw new Error('This cast has already ended.');
  if (!offer) throw new Error('Cast not ready yet — wait a moment and try again.');

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await setDoc(roomRef, { answer: { sdp: answer.sdp, type: answer.type } }, { merge: true });

  // Listen for sender ICE candidates
  const unsubCandidates = onSnapshot(senderRef, snap => {
    snap.docChanges().filter(c => c.type === 'added').forEach(c => {
      pc.addIceCandidate(new RTCIceCandidate(c.doc.data())).catch(() => {});
    });
  });

  // Listen for cast ending
  const unsubRoom = onSnapshot(roomRef, snap => {
    if (snap.data()?.active === false) onStateChange?.('ended');
  });

  const cleanup = () => {
    unsubCandidates();
    unsubRoom();
    pc.close();
  };

  return { pc, cleanup };
}

// ── Screen capture helper ─────────────────────────────────────────────────────
export async function captureScreen() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('Screen capture is not supported in this browser. On iOS, use Safari.');
  }
  return navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 30, max: 60 }, cursor: 'always' },
    audio: true,
  });
}
