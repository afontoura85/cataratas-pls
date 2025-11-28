import { collection, doc, setDoc, query, where, getDocs, getDoc, documentId } from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from 'firebase/auth';
import { UserProfile } from '../types';

// Creates or updates a user's profile document in Firestore
export const createUserProfile = async (user: User): Promise<void> => {
  const userRef = doc(db, 'users', user.uid);
  try {
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      await setDoc(userRef, {
        email: user.email?.toLowerCase(),
      });
    }
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw new Error("Falha ao criar o perfil do usuário no banco de dados.");
  }
};

// Finds a user by their email address
export const findUserByEmail = async (email: string): Promise<UserProfile | null> => {
  if (!email) return null;
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where("email", "==", email.toLowerCase()));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return null;
  }
  
  const userDoc = querySnapshot.docs[0];
  const data = userDoc.data() as { email: string };
  return {
    uid: userDoc.id,
    email: data.email,
  };
};

// Fetches user profiles for a list of UIDs
export const getUsersFromIds = async (uids: string[]): Promise<Map<string, UserProfile>> => {
    const userMap = new Map<string, UserProfile>();
    if (!uids || uids.length === 0) return userMap;

    const BATCH_SIZE = 10;
    const batches: string[][] = [];
    for (let i = 0; i < uids.length; i += BATCH_SIZE) {
        batches.push(uids.slice(i, i + BATCH_SIZE));
    }

    const fetchPromises = batches.map(batch => {
        const q = query(collection(db, 'users'), where(documentId(), 'in', batch));
        return getDocs(q);
    });
    
    const snapshots = await Promise.all(fetchPromises);

    snapshots.forEach(snapshot => {
        snapshot.forEach(docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data() as { email: string };
                userMap.set(docSnap.id, {
                    uid: docSnap.id,
                    email: data.email,
                });
            }
        });
    });

    return userMap;
};
