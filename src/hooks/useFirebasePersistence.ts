import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User } from '../types';

export const useFirebasePersistence = (
  setRegisteredUsers: React.Dispatch<React.SetStateAction<User[]>>,
  setIsUsersLoaded: React.Dispatch<React.SetStateAction<boolean>>
) => {
  useEffect(() => {
    console.log('DEBUG: Initializing useFirebasePersistence onSnapshot listener');
    
    // Use onSnapshot for real-time updates of the users collection
    // This ensures that as soon as a manager registers, the login screen updates
    const usersRef = collection(db, 'users');
    
    const unsubscribeSnapshot = onSnapshot(usersRef, (snap) => {
      console.log('DEBUG: Users collection snapshot received, count:', snap.size);
      
      const cloudUsersList = snap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          ...data,
          id: data.uid || data.id || docSnap.id,
          name: data.fullName || data.name || 'Unknown',
          phone: data.phoneNumber || data.phone || ''
        } as User;
      });
      
      setRegisteredUsers(cloudUsersList);
      localStorage.setItem('OPay_Registered_Users_v4', JSON.stringify(cloudUsersList));
      setIsUsersLoaded(true);
    }, (err) => {
      console.error('Users collection snapshot failed:', err);
      // Fallback to local storage if firestore fails
      const saved = localStorage.getItem('OPay_Registered_Users_v4');
      if (saved) {
        try {
          setRegisteredUsers(JSON.parse(saved));
        } catch (e) {}
      }
      setIsUsersLoaded(true);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      console.log('DEBUG: Auth state changed. Current user:', user ? user.uid : 'null');
      // Snapshot listener handles data, we just log auth changes here for debugging
    });

    return () => {
      unsubscribeSnapshot();
      unsubscribeAuth();
    };
  }, [setRegisteredUsers, setIsUsersLoaded]);
};
