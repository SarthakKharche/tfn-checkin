import React, { useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';

const PublicQRPanel = ({ onBack }) => {
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [attendee, setAttendee] = useState(null);
    const [error, setError] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!identifier.trim()) return;

        setLoading(true);
        setAttendee(null);
        setError('');

        try {
            const searchVal = identifier.trim();
            let foundDoc = null;

            // 1. Try PRN Search
            const prnQ = query(collection(db, 'attendees'), where('prn', '==', searchVal), limit(1));
            const prnSnap = await getDocs(prnQ);
            if (!prnSnap.empty) {
                foundDoc = prnSnap.docs[0];
            }

            // 2. Try Email Search if PRN fails
            if (!foundDoc) {
                const emailQ = query(collection(db, 'attendees'), where('email', '==', searchVal.toLowerCase()), limit(1));
                const emailSnap = await getDocs(emailQ);
                if (!emailSnap.empty) {
                    foundDoc = emailSnap.docs[0];
                }
            }

            if (foundDoc) {
                setAttendee(foundDoc.data());
            } else {
                setError('No registration found with this PRN or Email.');
            }
        } catch (err) {
            console.error("Search error:", err);
            setError('An error occurred. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const downloadQR = () => {
        const svg = document.querySelector(".qr-display svg");
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        const svgBlob = new Blob([svgData], { type: "image/xml+svg;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            const size = 1024;
            const padding = 80; // Quiet zone for better scanning
            canvas.width = size + (padding * 2);
            canvas.height = size + (padding * 2);

            // Draw white background
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw QR code with padding
            ctx.drawImage(img, padding, padding, size, size);

            URL.revokeObjectURL(url);
            const pngUrl = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = `QR-${attendee.prn || attendee.name.replace(/\s+/g, '_')}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        };
        img.src = url;
    };

    return (
        <div className="login-page">
            <div className="login-card" style={{ maxWidth: '500px' }}>
                <div className="login-header">
                    <div className="login-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        <i className="fas fa-qrcode"></i>
                    </div>
                    <h1>Get Your QR Code</h1>
                    <p>Enter your PRN or registered Email to retrieve your check-in code.</p>
                </div>

                {!attendee ? (
                    <form onSubmit={handleSearch} autoComplete="off">
                        <div className="form-group">
                            <label htmlFor="searchIdentifier">
                                <i className="fas fa-search"></i> PRN or Email Address
                            </label>
                            <input
                                type="text"
                                id="searchIdentifier"
                                placeholder="e.g. 2021001234 or email@example.com"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                            />
                        </div>

                        {error && <div className="login-error" style={{ marginBottom: '1rem' }}>{error}</div>}

                        <button type="submit" className="btn btn-success btn-lg" disabled={loading}>
                            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-search"></i>}
                            {loading ? ' Searching...' : ' Find My QR Code'}
                        </button>

                        <button type="button" className="btn btn-link" style={{ width: '100%', marginTop: '0.5rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }} onClick={onBack}>
                            <i className="fas fa-arrow-left"></i> Back to Login
                        </button>
                    </form>
                ) : (
                    <div className="result-state" style={{ padding: '0' }}>
                        <div className="qr-display" style={{ background: '#fff', padding: '1.5rem', borderRadius: 'var(--radius)', boxShadow: 'inset 0 0 0 1px var(--border)', marginBottom: '1.5rem' }}>
                            <QRCodeSVG value={attendee.prn || attendee.email} size={256} />
                        </div>

                        <div className="attendee-details" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                            <div className="detail-row">
                                <span className="detail-label">Name</span>
                                <span className="detail-value">{attendee.name}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">PRN</span>
                                <span className="detail-value">{attendee.prn || 'N/A'}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Status</span>
                                <span className={`status-badge ${attendee.checkedIn ? 'checked-in' : 'pending'}`}>
                                    <i className={`fas ${attendee.checkedIn ? 'fa-check' : 'fa-clock'}`}></i> {attendee.checkedIn ? 'Checked In' : 'Registered'}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={downloadQR}>
                                <i className="fas fa-download"></i> Download QR
                            </button>
                            <button className="btn btn-success" style={{ flex: 1 }} onClick={() => setAttendee(null)}>
                                <i className="fas fa-search"></i> New Search
                            </button>
                        </div>

                        <button type="button" className="btn btn-link" style={{ width: '100%', marginTop: '1rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }} onClick={onBack}>
                            <i className="fas fa-arrow-left"></i> Back to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicQRPanel;
