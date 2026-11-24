import {
  createUserWithEmailAndPassword, getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc, getFirestore, runTransaction, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export function connectCustomerAccounts(app) {
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const profileDoc = (user) => doc(firestore, "users", user.uid);

  return {
    currentUser: () => auth.currentUser,
    subscribe: (callback) => onAuthStateChanged(auth, callback),
    async create(email, password, name) {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      // Keep the name available for a retry if the Firestore write fails.
      await updateProfile(user, { displayName: name }).catch(() => {});
      return user;
    },
    async signIn(email, password) {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      return user;
    },
    signOut: () => signOut(auth),
    getOrCreateProfile(user, details = {}) {
      const ref = profileDoc(user);
      return runTransaction(firestore, async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (snapshot.exists()) return snapshot.data();
        const profile = {
          email: user.email,
          name: (details.name || user.displayName || user.email).trim().slice(0, 200),
          phone: (details.phone || "").trim().slice(0, 100),
          address: (details.address || "").trim().slice(0, 1000),
        };
        transaction.set(ref, { ...profile, createdAt: serverTimestamp() });
        return profile;
      });
    },
    updateDetails: (user, details) => updateDoc(profileDoc(user), details),
  };
}
