// src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient'; // Make sure this path is correct

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    setAuthLoading(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        setAuthLoading(false); // Core auth state known

        if (currentUser) {
          try {
            const { data: userProfile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', currentUser.id)
              .single();

            if (profileError && profileError.code !== 'PGRST116') {
              console.error('[AuthContext] Error fetching profile:', profileError.message);
              setProfile(null);
            } else {
              setProfile(userProfile || null);
            }
          } catch (err) {
            console.error("[AuthContext] Exception during profile fetch:", err);
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const value = {
    user,
    profile,
    loading: authLoading,
    login: async (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signup: async (email, password) => supabase.auth.signUp({ email, password }),
    logout: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('[AuthContext] Logout Error:', error.message);
        return { error };
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {authLoading ? (
        <div style={{ /* Simple loading spinner or message styles */
            display: 'flex', justifyContent: 'center', alignItems: 'center', 
            height: '100vh', fontSize: '1.2em', fontFamily: 'sans-serif' 
        }}>
          Loading Application...
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};