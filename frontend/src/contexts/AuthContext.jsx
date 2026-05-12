import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext(null);

// Both admins and shop users use the @shopapp.internal synthetic domain.
// Role is distinguished by checking the admins/{uid} Firestore collection.
const USER_DOMAIN = '@shopapp.internal';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole]               = useState(null);
  const [userData, setUserData]       = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true); // keep loading=true during the async Firestore check
      if (user) {
        try {
          const email = user.email || '';

          if (email.endsWith(USER_DOMAIN)) {
            // Check admins/{uid} first — admins take priority over staff.
            const adminSnap = await getDoc(doc(db, 'admins', user.uid));
            if (adminSnap.exists()) {
              setCurrentUser(user);
              setRole('admin');
              setUserData({ id: adminSnap.id, ...adminSnap.data() });
            } else {
              // ── Shop user ──────────────────────────────────
              const userSnap = await getDoc(doc(db, 'users', user.uid));
              if (userSnap.exists() && userSnap.data().status === 'active') {
                setCurrentUser(user);
                setRole('user');
                setUserData({ id: userSnap.id, ...userSnap.data() });
              } else {
                await signOut(auth);
                setCurrentUser(null);
                setRole(null);
                setUserData(null);
              }
            }
          } else {
            // Unknown domain — not a valid account, sign out immediately.
            await signOut(auth);
            setCurrentUser(null);
            setRole(null);
            setUserData(null);
          }
        } catch (err) {
          console.error('Auth check error:', err);
          setCurrentUser(null);
          setRole(null);
          setUserData(null);
        }
      } else {
        setCurrentUser(null);
        setRole(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const value = {
    currentUser,
    role,
    userData,
    loading,
    logout,
    isAdmin: role === 'admin',
    isUser:  role === 'user',
    setAuthLoading: setLoading, // login pages call this before signing in to prevent race
    // Provide a userClaims-shaped object so existing pages need no changes.
    userClaims: userData
      ? {
          shopName: userData.shopName,
          userId:   userData.id || currentUser?.uid,
          username: userData.username,
        }
      : null,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
