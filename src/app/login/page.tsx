'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '../actions';
import { ShieldAlert, KeyRound, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await login(password);
      if (res.success) {
        router.push('/');
        router.refresh();
      } else if (res.error) {
        setError(res.error);
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-glow" />
      
      <div className="auth-card">
        <div className="auth-logo">
          <ShieldAlert size={32} />
        </div>
        
        <h1 className="auth-title">MK Manager</h1>
        <p className="auth-subtitle">Admin Dashboard Control Center</p>

        {error && (
          <div className="error-message">
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Admin Password
            </label>
            <div className="input-wrapper">
              <KeyRound className="input-icon" size={18} />
              <input
                id="password"
                type="password"
                placeholder="Enter password..."
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                Authenticating...
              </>
            ) : (
              <>
                Access Dashboard
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
