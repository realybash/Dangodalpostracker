import { useEffect, Dispatch, SetStateAction } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where, or } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User, AppAction } from '../types';
import { mapFirestoreUser } from '../utils';

export const useFirebasePersistence = (
  setRegisteredUsers: Dispatch<SetStateAction<User[]>>,
  setIsUsersLoaded: Dispatch<SetStateAction<boolean>>,
  dispatch: Dispatch<AppAction>,
  syncOwnerId: string | null
) => {
  useEffect(() => {
    // If we have a local cache, load it immediately to speed up UI
    const saved = localStorage.getItem('OPay_Registered_Users_v4');
    if (saved) {
      try {
        const list = JSON.parse(saved);
        setRegisteredUsers(list);
        dispatch({ type: 'SET_REGISTERED_USERS', payload: list });
        setIsUsersLoaded(true); // Allow login immediately if we have cached users
      } catch (e) {
        console.error('[Persistence] Failed to load from local storage');
      }
    }

    if (!syncOwnerId && !auth.currentUser) {
      console.log('[Persistence] Real-time users sync starting in public mode (no syncOwnerId)');
    }

    console.log('[Persistence] Initializing real-time users sync. Auth UID:', auth.currentUser?.uid);
    
    const usersRef = collection(db, 'users');
    
    // In public mode or logged in mode, we fetch users to allow login lookups and team management.
    // Security rules allow public read for users to facilitate the phone-based login.
    const usersQuery = usersRef;
    
    const unsubscribeSnapshot = onSnapshot(usersQuery, (snap) => {
      console.log(`[Persistence] Received users snapshot: ${snap.size} documents`);
      
      const cloudUsersList = snap.docs.map(docSnap => mapFirestoreUser(docSnap.data(), docSnap.id));
      
      setRegisteredUsers(cloudUsersList);
      dispatch({ type: 'SET_REGISTERED_USERS', payload: cloudUsersList });
      
      localStorage.setItem('OPay_Registered_Users_v4', JSON.stringify(cloudUsersList));
      
      // Also cache in IndexedDB for robust offline login
      import('../lib/offlineDb').then(({ saveCachedUsersBatch }) => {
        saveCachedUsersBatch(cloudUsersList).catch(err => console.error('[Persistence] IndexedDB user cache failed:', err));
      });
      
      setIsUsersLoaded(true);
    }, (err) => {
      console.error('[Persistence] Users sync failed:', err);
      handleFirestoreError(err, OperationType.LIST, 'users_sync');
      
      const saved = localStorage.getItem('OPay_Registered_Users_v4');
      if (saved) {
        try {
          const list = JSON.parse(saved);
          setRegisteredUsers(list);
          dispatch({ type: 'SET_REGISTERED_USERS', payload: list });
        } catch (e) {
          console.error('[Persistence] Failed to load from local storage fallback');
        }
      }
      setIsUsersLoaded(true);
    });

    return () => {
      unsubscribeSnapshot();
    };
  }, [setRegisteredUsers, setIsUsersLoaded, dispatch, syncOwnerId]);
};
