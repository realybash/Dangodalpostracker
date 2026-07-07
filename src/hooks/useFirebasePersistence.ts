import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User } from '../types';

export const useFirebasePersistence = (
  setRegisteredUsers: React.Dispatch<React.SetStateAction<User[]>>,
  setIsUsersLoaded: React.Dispatch<React.SetStateAction<boolean>>
) => {
  useEffect(() => {
    // Immediate fetch on mount to ensure we have data as fast as possible
    const fetchInitial = async () => {
      try {
        const usersRef = collection(db, 'users');
        const snap = await getDocs(usersRef);
        if (!snap.empty) {
          const cloudUsersList = snap.docs.map(docSnap => docSnap.data() as User);
          setRegisteredUsers(cloudUsersList);
          localStorage.setItem('OPay_Registered_Users_v4', JSON.stringify(cloudUsersList));
        }
      } catch (err) {
        console.error('Initial user fetch failed:', err);
      } finally {
        setIsUsersLoaded(true);
      }
    };

    fetchInitial();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('DEBUG: Auth state changed. Current user:', user ? user.uid : 'null');
      
      try {
        const usersRef = collection(db, 'users');
        const snap = await getDocs(usersRef);
        
        const cloudUsersList = snap.docs.map(docSnap => docSnap.data() as User);
        setRegisteredUsers(cloudUsersList);
        localStorage.setItem('OPay_Registered_Users_v4', JSON.stringify(cloudUsersList));
      } catch (err) {
        console.error('Failed to sync users on auth change:', err);
      }
    });

    return () => unsubscribe();
  }, [setRegisteredUsers, setIsUsersLoaded]);
};
