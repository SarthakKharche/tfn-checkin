import React, { useState, useEffect } from 'react';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Login from './components/auth/Login';
import Navbar from './components/layout/Navbar';
import EventsManager from './components/events/EventsManager';
import CSVUpload from './components/upload/CSVUpload';
import QRScanner from './components/checkin/QRScanner';
import Dashboard from './components/dashboard/Dashboard';

import PublicQRPanel from './components/public/PublicQRPanel';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('events');
  const [activeEvent, setActiveEvent] = useState(null);
  const [view, setView] = useState('login'); // login, retrieval

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  if (loading) {
    return (
      <div className="login-page">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return view === 'retrieval'
      ? <PublicQRPanel onBack={() => setView('login')} />
      : <Login onGetQR={() => setView('retrieval')} />;
  }

  return (
    <div className="app-container">
      <Navbar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        handleLogout={handleLogout}
      />

      {activeEvent && (
        <div className="global-event-bar">
          <i className="fas fa-calendar-check"></i>
          Currently managing event: <strong>{activeEvent.name}</strong>
        </div>
      )}

      <main>
        {currentPage === 'events' && (
          <div className="container">
            <EventsManager activeEvent={activeEvent} setActiveEvent={setActiveEvent} />
          </div>
        )}
        {currentPage === 'upload' && (
          <div className="container">
            <CSVUpload activeEvent={activeEvent} />
          </div>
        )}
        {currentPage === 'checkin' && (
          <div className="container">
            <QRScanner activeEvent={activeEvent} />
          </div>
        )}
        {currentPage === 'dashboard' && (
          <div className="container">
            <Dashboard activeEvent={activeEvent} />
          </div>
        )}
      </main>

      <div className="toast-container" id="toastContainer"></div>
    </div>
  );
}

export default App;
