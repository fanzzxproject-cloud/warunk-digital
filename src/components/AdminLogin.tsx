import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, Lock, Mail, UtensilsCrossed } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      if (authError.message.includes('Invalid login credentials')) {
        setError('Email atau password salah. Pastikan User sudah ada di Supabase Authentication.');
      } else if (authError.message.includes('Email not confirmed')) {
        setError('Email belum dikonfirmasi. Buka Dashboard Supabase > Authentication > Providers > Email, lalu matikan "Confirm Email" atau konfirmasi email Anda.');
      } else {
        setError(`Login gagal: ${authError.message}`);
      }
      setLoading(false);
    } else {
      // Small delay to let session propagate
      setTimeout(() => {
        onLogin();
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-600 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-600 rounded-full blur-[150px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white/10 backdrop-blur-3xl p-10 rounded-[40px] border border-white/10 shadow-2xl relative z-10"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-600/30 rotate-3">
             <UtensilsCrossed className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white italic tracking-tight uppercase">Warunk Digital Admin</h1>
          <p className="text-neutral-400 font-medium mt-2">Sign in to manage your restaurant</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl mb-6 text-sm font-bold text-center">
            {error}
          </div>
        )}

        {(!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_URL.includes('supabase.co')) && (typeof process === 'undefined' || !process.env.SUPABASE_URL) && (
          <div className="bg-orange-500/10 border border-orange-500/20 text-orange-500 p-4 rounded-2xl mb-6 text-xs font-bold text-center">
            ⚠️ Supabase URL belum diatur di Secrets (Gunakan SUPABASE_URL atau VITE_SUPABASE_URL).
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
              <input 
                type="email"
                placeholder="Admin Email"
                className="w-full bg-white/5 border border-white/10 p-5 pl-12 rounded-[24px] text-white focus:ring-2 focus:ring-orange-600 outline-none transition-all"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
              <input 
                type="password"
                placeholder="Password"
                className="w-full bg-white/5 border border-white/10 p-5 pl-12 rounded-[24px] text-white focus:ring-2 focus:ring-orange-600 outline-none transition-all"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 text-white p-5 rounded-[24px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-orange-600/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
                <>
                    <LogIn className="w-6 h-6" />
                    Sign In to Cloud
                </>
            )}
          </button>
        </form>

        <p className="mt-10 text-center text-neutral-500 text-xs font-bold uppercase tracking-widest">
            © 2026 Warunk Digital Enterprise
        </p>
      </motion.div>
    </div>
  );
}
