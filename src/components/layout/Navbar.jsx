import React, { useState } from 'react';

const Navbar = ({ currentPage, setCurrentPage, handleLogout }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const navigate = (page) => {
        setCurrentPage(page);
        setIsMenuOpen(false);
    };

    return (
        <nav className="navbar">
            <div className="nav-brand">
                <i className="fas fa-calendar-check"></i>
                <span>TFN Digital</span>
            </div>

            <button className={`hamburger ${isMenuOpen ? 'active' : ''}`} onClick={toggleMenu}>
                <span></span>
                <span></span>
                <span></span>
            </button>

            <div className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
                <button
                    className={`nav-btn ${currentPage === 'events' ? 'active' : ''}`}
                    onClick={() => navigate('events')}
                >
                    <i className="fas fa-calendar-alt"></i> Events
                </button>
                <button
                    className={`nav-btn ${currentPage === 'upload' ? 'active' : ''}`}
                    onClick={() => navigate('upload')}
                >
                    <i className="fas fa-file-csv"></i> Upload CSV
                </button>
                <button
                    className={`nav-btn ${currentPage === 'checkin' ? 'active' : ''}`}
                    onClick={() => navigate('checkin')}
                >
                    <i className="fas fa-qrcode"></i> QR Check-In
                </button>
                <button
                    className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
                    onClick={() => navigate('dashboard')}
                >
                    <i className="fas fa-chart-line"></i> Dashboard
                </button>
                <button className="nav-btn logout-btn" onClick={handleLogout}>
                    <i className="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>

            <div className={`nav-overlay ${isMenuOpen ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}></div>
        </nav>
    );
};

export default Navbar;
