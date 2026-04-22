import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { Car, Clock, LogOut, Settings, Calendar, Bell } from 'lucide-react';
import axios from 'axios';

// Axios global setup
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 font-sans">
        <Navbar />
        <main className="max-w-7xl mx-auto p-4">
          <Routes>
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/book" element={<BookService />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (!token) return null;

  return (
    <nav className="bg-blue-600 text-white p-4 shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/dashboard" className="text-xl font-bold flex items-center gap-2">
          <Car /> Smart Car Wash
        </Link>
        <div className="flex gap-4">
          {role === 'admin' && (
            <Link to="/admin" className="flex items-center gap-1 hover:text-blue-200">
              <Settings size={18} /> Admin
            </Link>
          )}
          <Link to="/dashboard" className="flex items-center gap-1 hover:text-blue-200">
            <Bell size={18} /> Dashboard
          </Link>
          <button onClick={handleLogout} className="flex items-center gap-1 hover:text-blue-200">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const res = await axios.post('/api/auth/login', { email, password });
        localStorage.setItem('token', res.data.access_token);
        
        // Fetch profile to get role
        const profileRes = await axios.get('/api/auth/profile', {
            headers: { Authorization: `Bearer ${res.data.access_token}` }
        });
        localStorage.setItem('role', profileRes.data.role);
        
        if (profileRes.data.role === 'admin') navigate('/admin');
        else navigate('/dashboard');
      } else {
        await axios.post('/api/auth/signup', { name, email, password });
        alert('Signup successful! Please login.');
        setIsLogin(true);
      }
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-2xl shadow-xl">
      <div className="flex justify-center mb-6">
        <div className="p-3 bg-blue-100 rounded-full text-blue-600">
          <Car size={32} />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-center mb-6 text-slate-800">
        {isLogin ? 'Welcome Back' : 'Create Account'}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!isLogin && (
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          required
        />
        <button type="submit" className="bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition">
          {isLogin ? 'Login' : 'Sign Up'}
        </button>
      </form>
      <p className="text-center mt-4 text-sm text-slate-600">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <button className="text-blue-600 font-semibold" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Sign up' : 'Login'}
        </button>
      </p>
    </div>
  );
}

function Dashboard() {
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const bkRes = await axios.get('/api/booking/my-bookings');
      setBookings(bkRes.data);
      const notifRes = await axios.get('/api/notifications/notifications');
      setNotifications(notifRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-6 mt-6">
      <div className="md:col-span-2 space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">My Bookings</h2>
            <p className="text-slate-500">Track your current and past washes</p>
          </div>
          <Link to="/book" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 transition shadow-md shadow-blue-200">
             <Calendar size={18} /> Book Hash
          </Link>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-white p-10 text-center rounded-2xl border border-slate-100 shadow-sm">
            <Car size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">You have no bookings yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map(b => (
              <div key={b.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{b.service_name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Clock size={16} /> Created: {new Date(b.created_at).toLocaleDateString()}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      b.status === 'completed' ? 'bg-green-100 text-green-700' :
                      b.status === 'washing' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {b.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                {['in_queue', 'washing'].includes(b.status) && (
                  <div className="bg-slate-50 p-4 rounded-xl border flex flex-col items-center min-w-[120px]">
                     <div className="text-sm font-medium text-slate-500">Wait Time</div>
                     <div className="text-2xl font-bold text-blue-600">{b.estimated_time}m</div>
                     <div className="text-xs text-slate-400 mt-1">Queue Pos: #{b.queue_position}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden sticky top-24">
          <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center gap-2">
            <Bell className="text-slate-500" size={20} />
            <h3 className="font-bold text-slate-800">Notifications</h3>
          </div>
          <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
             {notifications.length === 0 ? (
               <p className="text-sm text-slate-500 text-center py-4">No new notifications</p>
             ) : (
               notifications.map(n => (
                 <div key={n.id} className="text-sm border-l-2 border-blue-500 pl-3">
                   <p className="text-slate-800">{n.message}</p>
                   <p className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleTimeString()}</p>
                 </div>
               ))
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BookService() {
  const [services, setServices] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/services/services').then(res => setServices(res.data)).catch(console.error);
  }, []);

  const handleBook = async (service) => {
    try {
      await axios.post('/api/booking/book', {
        service_id: service.id,
        service_name: service.name,
        service_duration: service.duration
      });
      alert('Booking successful!');
      navigate('/dashboard');
    } catch (e) {
      alert('Error booking: ' + e.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800">Select Service</h2>
        <p className="text-slate-500 mt-2">Choose the wash package that fits your needs</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {services.map(s => (
          <div key={s.id} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-slate-800">{s.name}</h3>
              <div className="text-2xl font-bold text-blue-600">${s.price}</div>
            </div>
            <div className="flex items-center gap-2 text-slate-500 mb-6">
              <Clock size={16} /> Est. Time: {s.duration} mins
            </div>
            <button 
              onClick={() => handleBook(s)}
              className="w-full bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 font-semibold py-3 rounded-xl transition border border-transparent shadow-sm"
            >
              Book Now
            </button>
          </div>
        ))}
        {services.length === 0 && (
          <div className="col-span-full p-10 text-center bg-slate-50 rounded-2xl border border-dashed">
            <p className="text-slate-500">No services available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPanel() {
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [newSvc, setNewSvc] = useState({ name: '', price: '', duration: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [svcRes, bkRes] = await Promise.all([
        axios.get('/api/services/services'),
        axios.get('/api/booking/all-active-bookings') // Note: need to implement this endpoint or just fetch my-bookings if it wasn't filtered
      ]);
      setServices(svcRes.data);
      setBookings(bkRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/services/service', {
        name: newSvc.name, price: Number(newSvc.price), duration: Number(newSvc.duration)
      });
      setNewSvc({ name: '', price: '', duration: '' });
      fetchData();
    } catch (e) { alert(e.message); }
  };

  const deleteService = async (id) => {
    try {
      await axios.delete(`/api/services/service/${id}`);
      fetchData();
    } catch(e) { alert(e.message); }
  }

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`/api/booking/booking/${id}/status`, { status });
      fetchData();
    } catch(e) { alert(e.message); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-8 mt-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Manage Services</h2>
        <div className="bg-white p-6 rounded-2xl shadow-sm border mb-6">
           <form onSubmit={handleCreateService} className="flex flex-col gap-3">
             <input placeholder="Service Name" required value={newSvc.name} onChange={e => setNewSvc({...newSvc, name: e.target.value})} className="border p-2 rounded" />
             <input placeholder="Price ($)" type="number" required value={newSvc.price} onChange={e => setNewSvc({...newSvc, price: e.target.value})} className="border p-2 rounded" />
             <input placeholder="Duration (mins)" type="number" required value={newSvc.duration} onChange={e => setNewSvc({...newSvc, duration: e.target.value})} className="border p-2 rounded" />
             <button type="submit" className="bg-slate-800 text-white p-2 rounded font-semibold">Add Service</button>
           </form>
        </div>

        <div className="space-y-3">
           {services.map(s => (
             <div key={s.id} className="bg-white p-4 rounded-xl border flex justify-between items-center">
                <div>
                   <div className="font-bold">{s.name}</div>
                   <div className="text-sm text-slate-500">${s.price} • {s.duration} mins</div>
                </div>
                <button onClick={() => deleteService(s.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Delete</button>
             </div>
           ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Active Queue</h2>
        <div className="space-y-4">
           {bookings.map(b => (
             <div key={b.id} className="bg-white p-4 rounded-xl border">
               <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-bold text-lg">{b.service_name}</div>
                    <div className="text-sm text-slate-500">ID: {b.id.substring(0, 8)}...</div>
                  </div>
                  <div className="bg-slate-100 px-3 py-1 rounded text-sm text-slate-600 font-medium">Pos: {b.queue_position}</div>
               </div>
               
               <div className="flex gap-2 text-sm mt-4">
                  <button 
                    disabled={b.status === 'washing'}
                    onClick={() => updateStatus(b.id, 'washing')} 
                    className="flex-1 bg-orange-100 text-orange-700 py-2 rounded-lg font-semibold hover:bg-orange-200 disabled:opacity-50">
                    Set Washing
                  </button>
                  <button 
                    onClick={() => updateStatus(b.id, 'completed')} 
                    className="flex-1 bg-green-100 text-green-700 py-2 rounded-lg font-semibold hover:bg-green-200">
                    Complete
                  </button>
               </div>
             </div>
           ))}
           {bookings.length === 0 && <p className="text-slate-500">No active bookings.</p>}
        </div>
      </div>
    </div>
  );
}

export default App;
