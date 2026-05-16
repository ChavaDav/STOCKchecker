import { useState, useEffect } from 'react';
import { fetchApi } from '../api';
import { Search, TrendingUp, TrendingDown, LogOut, Star, Bell, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getLocalSuggestions } from '../utils/stockDictionary';

export default function Dashboard({ token, user, onLogout }) {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const data = await fetchApi('/favorites/prices');
      setFavorites(data.stocks || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (val.length > 0) {
      setSuggestions(getLocalSuggestions(val));
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (symbol) => {
    setSearch(symbol);
    setSuggestions([]);
    viewStock(symbol);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search) return;
    
    setSuggestions([]);
    setLoading(true);
    setError('');
    try {
      const data = await fetchApi(`/stocks/search?q=${search}`);
      setSearchResults(data.results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const viewStock = async (symbol) => {
    setLoading(true);
    setError('');
    setSearchResults([]); // Limpiar resultados de búsqueda al seleccionar
    try {
      const quote = await fetchApi(`/stocks/${symbol}`);
      const history = await fetchApi(`/stocks/${symbol}/history?period=1mo&interval=1d`);
      
      setSelectedStock(quote);
      setStockHistory(history.data.map(d => ({
        date: new Date(d.date).toLocaleDateString(),
        price: d.close
      })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (stock) => {
    try {
      const isFav = favorites.find(f => f.symbol === stock.symbol);
      if (isFav) {
        await fetchApi(`/favorites/${stock.symbol}`, { method: 'DELETE' });
      } else {
        await fetchApi('/favorites', { 
          method: 'POST', 
          body: JSON.stringify({ symbol: stock.symbol, name: stock.name })
        });
      }
      loadFavorites();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container animate-fade-in">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 glass-card" style={{ padding: '1rem 2rem' }}>
        <div className="flex items-center gap-2">
          <Activity color="var(--primary)" size={28} />
          <h2 className="gradient-text" style={{ fontSize: '1.5rem', margin: 0 }}>StockSense</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted">Hello, <strong style={{ color: 'white' }}>{user?.username}</strong></span>
          <button className="btn-icon" onClick={onLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '2rem' }}>
        {/* Sidebar: Search & Favorites */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem', position: 'relative' }}>
            <h3 className="mb-4">Search Stocks</h3>
            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
              <input 
                type="text" 
                placeholder="AAPL, MSFT..." 
                value={search}
                onChange={handleSearchChange}
              />
              <button type="submit" className="btn" style={{ padding: '0.75rem' }}>
                <Search size={18} />
              </button>
            </form>

            {suggestions.length > 0 && (
              <div 
                className="glass-card" 
                style={{ 
                  position: 'absolute', top: '5.5rem', left: '1.5rem', right: '1.5rem', 
                  zIndex: 10, padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' 
                }}
              >
                {suggestions.map(s => (
                  <div 
                    key={s.symbol}
                    onClick={() => handleSuggestionClick(s.symbol)}
                    style={{ 
                      padding: '0.5rem 0.75rem', cursor: 'pointer', borderRadius: '4px',
                      background: 'rgba(255,255,255,0.02)', transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  >
                    <strong>{s.symbol}</strong> <span className="text-muted" style={{ fontSize: '0.85rem' }}>- {s.name}</span>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="glass-card mb-4" style={{ padding: '0.75rem', color: 'var(--danger)', borderLeft: '4px solid var(--danger)', fontSize: '0.9rem' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {searchResults.map(res => (
                <div 
                  key={res.symbol} 
                  className="glass-card flex justify-between items-center" 
                  style={{ padding: '0.75rem', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}
                  onClick={() => viewStock(res.symbol)}
                >
                  <div>
                    <strong>{res.symbol}</strong>
                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>{res.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 className="mb-4 flex items-center gap-2"><Star size={18} color="var(--secondary)" /> Watchlist</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {favorites.map(fav => (
                <div 
                  key={fav.symbol} 
                  className="glass-card flex justify-between items-center" 
                  style={{ padding: '1rem', cursor: 'pointer' }}
                  onClick={() => viewStock(fav.symbol)}
                >
                  <div>
                    <strong>{fav.symbol}</strong>
                    <div style={{ fontSize: '1.1rem' }}>${fav.price?.toFixed(2)}</div>
                  </div>
                  <div className={fav.changePercent >= 0 ? 'positive' : 'negative'} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {fav.changePercent >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {Math.abs(fav.changePercent || 0).toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content: Chart & Details */}
        <div className="glass-card" style={{ padding: '2rem', minHeight: '600px' }}>
          {loading ? (
            <div className="flex items-center justify-center" style={{ height: '100%' }}>
              <div className="text-muted">Loading data...</div>
            </div>
          ) : selectedStock ? (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>{selectedStock.name}</h1>
                  <div className="text-muted" style={{ fontSize: '1.1rem' }}>{selectedStock.symbol} • {selectedStock.exchange}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 600 }}>${selectedStock.price?.toFixed(2)}</div>
                  <div className={selectedStock.changePercent >= 0 ? 'positive' : 'negative'} style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    {selectedStock.changePercent >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                    {selectedStock.change > 0 ? '+' : ''}{selectedStock.change?.toFixed(2)} ({selectedStock.changePercent?.toFixed(2)}%)
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mb-8">
                <button className="btn flex items-center gap-2" onClick={() => toggleFavorite(selectedStock)}>
                  <Star size={18} fill={favorites.find(f => f.symbol === selectedStock.symbol) ? 'white' : 'none'} />
                  {favorites.find(f => f.symbol === selectedStock.symbol) ? 'Remove Watchlist' : 'Add Watchlist'}
                </button>
                <button className="btn flex items-center gap-2" style={{ background: 'var(--bg-input)' }}>
                  <Bell size={18} /> Create Alert
                </button>
              </div>

              {/* Chart */}
              <div style={{ height: '400px', width: '100%', marginTop: '2rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stockHistory}>
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip 
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', backdropFilter: 'blur(12px)' }}
                      itemStyle={{ color: 'var(--primary)' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="url(#colorGradient)" 
                      strokeWidth={3} 
                      dot={false}
                      activeDot={{ r: 8, fill: 'var(--primary)' }} 
                    />
                    <defs>
                      <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--primary)" />
                        <stop offset="100%" stopColor="var(--secondary)" />
                      </linearGradient>
                    </defs>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center flex-column gap-4" style={{ height: '100%', flexDirection: 'column' }}>
              <Activity size={64} color="var(--border)" />
              <h2 className="text-muted">Search for a stock or select from your watchlist</h2>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
