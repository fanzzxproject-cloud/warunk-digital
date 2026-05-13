import React, { useState, useEffect } from 'react';
import UserView from './components/UserView';
import AdminView from './components/AdminView';
import AdminLogin from './components/AdminLogin';
import { supabase } from './lib/supabase';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // Check if the URL has an admin flag or just use a state toggle for the demo
    const urlParams = new URLSearchParams(window.location.search);
    setIsAdmin(urlParams.get('mode') === 'admin');

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  // For the purpose of this applet environment, we might want a way to toggle modes easily
  // In a real app, these would be separate routes or subdomains
  if (isAdmin) {
    if (!session) {
      return <AdminLogin onLogin={() => {
        // Force session check update
        supabase.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
        });
      }} />;
    }
    return <AdminView />;
  }

  return <UserView />;
}
