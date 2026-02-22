import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';
import { formatDate, formatDateTime } from '../../lib/dateUtils';

const PublicQRPanel = ({ onBack }) => {
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [attendee, setAttendee] = useState(null);
    const [error, setError] = useState('');
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('');

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const q = query(collection(db, 'events'), orderBy('date', 'desc'));
                const snapshot = await getDocs(q);
                const eventList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setEvents(eventList);
                if (eventList.length > 0) {
                    setSelectedEventId(eventList[0].id);
                }
            } catch (err) {
                console.error("Error fetching events:", err);
            }
        };
        fetchEvents();
    }, []);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!identifier.trim() || !selectedEventId) {
            setError('Please select an event and enter your PRN/Email.');
            return;
        }

        setLoading(true);
        setAttendee(null);
        setError('');

        try {
            const searchVal = identifier.trim();
            let foundDoc = null;

            // 1. Try PRN Search scoped by event
            const prnQ = query(
                collection(db, 'attendees'),
                where('prn', '==', searchVal),
                where('eventId', '==', selectedEventId),
                limit(1)
            );
            const prnSnap = await getDocs(prnQ);
            if (!prnSnap.empty) {
                foundDoc = prnSnap.docs[0];
            }

            // 2. Try Email Search scoped by event
            if (!foundDoc) {
                const emailQ = query(
                    collection(db, 'attendees'),
                    where('email', '==', searchVal.toLowerCase()),
                    where('eventId', '==', selectedEventId),
                    limit(1)
                );
                const emailSnap = await getDocs(emailQ);
                if (!emailSnap.empty) {
                    foundDoc = emailSnap.docs[0];
                }
            }

            if (foundDoc) {
                setAttendee(foundDoc.data());
            } else {
                setError('No registration found for this event with the provided PRN or Email.');
            }
        } catch (err) {
            console.error("Search error:", err);
            setError('An error occurred. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const downloadQR = () => {
        const canvas = document.querySelector(".qr-display canvas");
        if (!canvas) {
            console.error("Canvas not found");
            return;
        }

        try {
            const padding = 60;
            const size = 1024;
            const downloadCanvas = document.createElement("canvas");
            downloadCanvas.width = size + (padding * 2);
            downloadCanvas.height = size + (padding * 2);
            const ctx = downloadCanvas.getContext("2d");

            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);
            ctx.drawImage(canvas, padding, padding, size, size);

            const pngUrl = downloadCanvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = `QR-${attendee.prn || attendee.name.replace(/\s+/g, '_')}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        } catch (err) {
            console.error("Download failed:", err);
            alert("Download failed. Please try a different browser or take a screenshot.");
        }
    };

    return (
        <div className="login-page">
            <div className="login-card" style={{ maxWidth: '500px' }}>
                <div className="login-header">
                    <div className="login-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        <i className="fas fa-qrcode"></i>
                    </div>
                    <h1>Get Your QR Code</h1>
                    <p>Select your event and enter details to retrieve your check-in code.</p>
                </div>

                {!attendee ? (
                    <form onSubmit={handleSearch} autoComplete="off">
                        <div className="form-group">
                            <label htmlFor="eventSelect">
                                <i className="fas fa-calendar-alt"></i> Select Event
                            </label>
                            <select
                                id="eventSelect"
                                value={selectedEventId}
                                onChange={(e) => setSelectedEventId(e.target.value)}
                                style={{ width: '100%', padding: '0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', fontFamily: 'inherit' }}
                                required
                            >
                                <option value="" disabled>Choose an event...</option>
                                {events.map(event => (
                                    <option key={event.id} value={event.id}>
                                        {event.name} ({formatDate(event.date)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="searchIdentifier">
                                <i className="fas fa-id-card"></i> PRN or Email Address
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

                        <button type="submit" className="btn btn-success btn-lg" disabled={loading || events.length === 0}>
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
                            <QRCodeCanvas
                                value={attendee.prn || attendee.email}
                                size={256}
                                includeMargin={true}
                                level="H"
                            />
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
                                <span className="detail-label">Event</span>
                                <span className="detail-value">{events.find(e => e.id === attendee.eventId)?.name || 'Event Details'}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Status</span>
                                <span className={`status-badge ${attendee.checkedIn ? 'checked-in' : 'pending'}`}>
                                    <i className={`fas ${attendee.checkedIn ? 'fa-check' : 'fa-clock'}`}></i> {attendee.checkedIn ? `Checked In (${formatDateTime(attendee.checkInTime)})` : 'Registered'}
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
