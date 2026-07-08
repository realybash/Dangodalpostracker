import { useEffect, Dispatch, SetStateAction } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User, AppAction } from '../types';
import { mapFirestoreUser } from '../utils';

export const useFirebasePersistence = (
  setRegisteredUsers: Dispatch<SetStateAction<User[]>>,
  setIsUsersLoaded: Dispatch<SetStateAction<boolean>>,
  dispatch: Dispatch<AppAction>,
  syncOwnerId: string | null
) => {
  useEffect(() => {
    console.log('[Persistence] Initializing real-time users sync with syncOwnerId:', syncOwnerId);
    
    const usersRef = collection(db, 'users');
    
    const unsubscribeSnapshot = onSnapshot(usersRef, (snap) => {
      console.log(`[Persistence] Received users snapshot: ${snap.size} documents`);
      
      const cloudUsersList = snap.docs.map(docSnap => mapFirestoreUser(docSnap.data(), docSnap.id));
      
      let filteredUsers = cloudUsersList;
      if (syncOwnerId) {
        filteredUsers = cloudUsersList.filter(user => 
          user.id === syncOwnerId || user.ownerId === syncOwnerId
        );
      }
      
      setRegisteredUsers(filteredUsers);
      dispatch({ type: 'SET_REGISTERED_USERS', payload: filteredUsers });
      
      localStorage.setItem('OPay_Registered_Users_v4', JSON.stringify(filteredUsers));
      setIsUsersLoaded(true);
    }, (err) => {
      console.error('[Persistence] Users sync failed:', err);
      
      const saved = localStorage.getItem('OPay_Registered_Users_v4');
      if (saved) {
        try {
          let list = JSON.parse(saved);
          if (syncOwnerId) {
            list = list.filter((user: User) => 
              user.id === syncOwnerId || user.ownerId === syncOwnerId
            );
          }
          setRegisteredUsers(list);
          dispatch({ type: 'SET_REGISTERED_USERS', payload: list });
        } catch (e) {
          console.error('[Persistence] Failed to load from local storage fallback');
        }
      }
      setIsUsersLoaded(true);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('[Persistence] Auth state: User logged in', user.uid);
      } else {
        console.log('[Persistence] Auth state: No user');
      }
    });

    return () => {
      unsubscribeSnapshot();
      unsubscribeAuth();
    };
  }, [setRegisteredUsers, setIsUsersLoaded, dispatch, syncOwnerId]);
};
