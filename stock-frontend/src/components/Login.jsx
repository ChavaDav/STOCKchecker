import { useState } from 'react';
import { fetchApi } from '../api';
import { TrendingUp, Lock, Mail, User } from 'lucide-react';

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const payload = isRegister ? formData : { email: formData.email, password: formData.password };
      
      const data = await fetchApi(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      onLogin(data.accessToken);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
        <div className="flex items-center justify-center gap-2 mb-6">
          <div style={{ background: 'var(--primary)', padding: '10px', borderRadius: '12px' }}>
            <TrendingUp size={28} color="white" />
          </div>
          <h1 className="gradient-text" style={{ fontSize: '1.75rem', margin: 0 }}>StockSense</h1>
        </div>

        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontWeight: 500 }}>
          {isRegister ? 'Create an Account' : 'Welcome Back'}
        </h2>

        {error && <div className="glass-card mb-4" style={{ padding: '0.75rem', color: 'var(--danger)', borderLeft: '4px solid var(--danger)' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {isRegister && (
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Username" 
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
                style={{ paddingLeft: '2.5rem' }}
                required 
              />
            </div>
          )}
          
          <div style={{ position: 'relative' }}>
            <Mail size={18} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="email" 
              placeholder="Email address" 
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              style={{ paddingLeft: '2.5rem' }}
              required 
            />
          </div>
          
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="password" 
              placeholder="Password" 
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              style={{ paddingLeft: '2.5rem' }}
              required 
            />
          </div>

          <button type="submit" className="btn" disabled={loading} style={{ marginTop: '0.5rem' }}>
            <span>{loading ? 'Processing...' : (isRegister ? 'Sign Up' : 'Sign In')}</span>
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <span 
            style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister ? 'Log in' : 'Sign up'}
          </span>
        </p>
      </div>
    </div>
  );
}
