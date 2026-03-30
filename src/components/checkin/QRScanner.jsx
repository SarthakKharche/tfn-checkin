import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Html5Qrcode } from 'html5-qrcode';
import { formatDateTime } from '../../lib/dateUtils';

const QRScanner = ({ activeEvent }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [manualInput, setManualInput] = useState('');
    const [status, setStatus] = useState('default'); // default, loading, success, already, notFound
    const [attendee, setAttendee] = useState(null);
    const [attendeeRef, setAttendeeRef] = useState(null);
    const html5QrCodeRef = useRef(null);

    const stopAndCleanupScanner = async (updateState = true) => {
        const scanner = html5QrCodeRef.current;
        if (!scanner) {
            if (updateState) setIsScanning(false);
            return;
        }

        try {
            await scanner.stop();
        } catch (error) {
            // Scanner may already be stopped; ignore this and continue cleanup.
        }

        try {
            await scanner.clear();
        } catch (error) {
            // Ignore clear errors to avoid breaking UI on stop.
        }

        html5QrCodeRef.current = null;
        if (updateState) setIsScanning(false);
    };

    const isEventDateComplete = () => {
        if (!activeEvent?.date) return false;
        const eventDate = activeEvent.date?.toDate ? activeEvent.date.toDate() : new Date(activeEvent.date);
        if (Number.isNaN(eventDate.getTime())) return false;
        const endOfDay = new Date(eventDate);
        endOfDay.setHours(23, 59, 59, 999);
        return Date.now() > endOfDay.getTime();
    };

    useEffect(() => {
        return () => {
            stopAndCleanupScanner(false).catch(console.error);
        };
    }, []);

    const startScanner = async () => {
        if (!activeEvent) {
            alert("Please select an event first!");
            return;
        }

        if (isEventDateComplete()) {
            setStatus('eventClosed');
            return;
        }

        if (isScanning) return;

        try {
            if (html5QrCodeRef.current) {
                await stopAndCleanupScanner(false);
            }

            const html5QrCode = new Html5Qrcode("qr-reader");
            html5QrCodeRef.current = html5QrCode;

            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1
            };

            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                onScanSuccess,
                (err) => { } // Silently ignore scan failures
            );

            setIsScanning(true);
            setStatus('default');
        } catch (err) {
            console.error("Scanner error:", err);
            alert("Could not start camera. Check permissions.");
        }
    };

    const stopScanner = async () => {
        await stopAndCleanupScanner(true);
    };

    const onScanSuccess = (decodedText) => {
        lookupAndCheckIn(decodedText.trim(), false);
    };

    const lookupAndCheckIn = async (identifier, isManual = true) => {
        if (!identifier) return;
        if (!activeEvent) return;

        if (isEventDateComplete()) {
            setStatus('eventClosed');
            setAttendee(null);
            setAttendeeRef(null);
            return;
        }

        setStatus('loading');
        setAttendee(null);
        setAttendeeRef(null);

        try {
            let attendeeDoc = null;

            // 1. Try PRN lookup
            const prnQ = query(collection(db, 'attendees'), where('prn', '==', identifier), where('eventId', '==', activeEvent.id));
            const prnSnap = await getDocs(prnQ);
            if (!prnSnap.empty) {
                attendeeDoc = prnSnap.docs[0];
            }

            // 2. Try Email lookup
            if (!attendeeDoc) {
                const emailQ = query(collection(db, 'attendees'), where('email', '==', identifier.toLowerCase()), where('eventId', '==', activeEvent.id));
                const emailSnap = await getDocs(emailQ);
                if (!emailSnap.empty) {
                    attendeeDoc = emailSnap.docs[0];
                }
            }

            if (!attendeeDoc) {
                setStatus('notFound');
                return;
            }

            const data = attendeeDoc.data();
            setAttendee(data);
            setAttendeeRef(attendeeDoc.ref);

            if (data.checkedIn) {
                setStatus('already');
                return;
            }

            if (isManual) {
                setStatus('pendingCheckIn');
            } else {
                // Auto check-in for QR scans
                await updateDoc(attendeeDoc.ref, {
                    checkedIn: true,
                    checkInTime: serverTimestamp()
                });
                setStatus('success');
                playBeep();
            }
        } catch (error) {
            console.error("Check-in error:", error);
            setStatus('notFound');
        }
    };

    const handleConfirmCheckIn = async () => {
        if (!attendeeRef) return;
        setStatus('loading');
        try {
            await updateDoc(attendeeRef, {
                checkedIn: true,
                checkInTime: serverTimestamp()
            });
            const updatedDoc = { ...attendee, checkedIn: true, checkInTime: new Date() };
            setAttendee(updatedDoc);
            setStatus('success');
            playBeep();
        } catch (error) {
            console.error("Confirm check-in error:", error);
            setStatus('notFound');
        }
    };

    const playBeep = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.value = 0.15;
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } catch (_) { }
    };

    const AttendeeDetails = ({ data }) => (
        <div className="attendee-details">
            <div className="detail-row">
                <span className="detail-label">Name</span>
                <span className="detail-value">{data.name}</span>
            </div>
            <div className="detail-row">
                <span className="detail-label">PRN</span>
                <span className="detail-value">{data.prn || 'N/A'}</span>
            </div>
            <div className="detail-row">
                <span className="detail-label">Email</span>
                <span className="detail-value">{data.email}</span>
            </div>
            <div className="detail-row">
                <span className="detail-label">Year</span>
                <span className="detail-value">{data.year}</span>
            </div>
        </div>
    );

    return (
        <section className="page active">
            <div className="page-header">
                <h1><i className="fas fa-qrcode"></i> QR Check-In</h1>
                <p>Scan an attendee's QR code or search manually for <strong>{activeEvent?.name}</strong>.</p>
            </div>

            <div className="checkin-grid">
                <div className="scanner-panel">
                    <div className="card">
                        <h3><i className="fas fa-camera"></i> QR Scanner</h3>
                        <div id="qr-reader" className="qr-reader"></div>
                        <div className="scanner-controls">
                            {!isScanning ? (
                                <button className="btn btn-primary" onClick={startScanner}>
                                    <i className="fas fa-play"></i> Start Scanner
                                </button>
                            ) : (
                                <button className="btn btn-danger" onClick={stopScanner}>
                                    <i className="fas fa-stop"></i> Stop Scanner
                                </button>
                            )}
                        </div>

                        <div className="manual-entry">
                            <p>Or enter PRN / email manually:</p>
                            <div className="input-group">
                                <input
                                    type="text"
                                    placeholder="Enter PRN or email..."
                                    value={manualInput}
                                    onChange={(e) => setManualInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && lookupAndCheckIn(manualInput, true)}
                                />
                                <button className="btn btn-primary" onClick={() => lookupAndCheckIn(manualInput, true)}>
                                    <i className="fas fa-search"></i> Look Up
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="result-panel">
                    <div className="card">
                        {status === 'default' && (
                            <div className="result-state">
                                <div className="result-icon"><i className="fas fa-qrcode"></i></div>
                                <h3>Waiting for Scan</h3>
                                <p>Point the camera at an attendee's QR code to begin check-in.</p>
                            </div>
                        )}

                        {status === 'loading' && (
                            <div className="result-state">
                                <div className="spinner"></div>
                                <h3>Fetching Details...</h3>
                            </div>
                        )}

                        {status === 'success' && attendee && (
                            <div className="result-state">
                                <div className="result-icon success"><i className="fas fa-user-check"></i></div>
                                <h3>Checked In Successfully!</h3>
                                <AttendeeDetails data={attendee} />
                            </div>
                        )}

                        {status === 'pendingCheckIn' && attendee && (
                            <div className="result-state">
                                <div className="result-icon warning"><i className="fas fa-user-clock"></i></div>
                                <h3>Attendee Found</h3>
                                <p style={{ marginBottom: '1rem' }}>Click below to confirm check-in.</p>
                                <AttendeeDetails data={attendee} />
                                <button
                                    className="btn btn-success btn-lg"
                                    style={{ marginTop: '1.5rem', width: '100%' }}
                                    onClick={handleConfirmCheckIn}
                                >
                                    <i className="fas fa-user-check"></i> Confirm Check In
                                </button>
                            </div>
                        )}

                        {status === 'already' && attendee && (
                            <div className="result-state">
                                <div className="result-icon warning"><i className="fas fa-exclamation-triangle"></i></div>
                                <h3>Already Checked In!</h3>
                                {attendee.checkInTime && (
                                    <p className="already-time">
                                        Checked in at: {formatDateTime(attendee.checkInTime)}
                                    </p>
                                )}
                                <AttendeeDetails data={attendee} />
                            </div>
                        )}

                        {status === 'notFound' && (
                            <div className="result-state">
                                <div className="result-icon error"><i className="fas fa-times-circle"></i></div>
                                <h3>Attendee Not Found</h3>
                                <p>No registration found. Please verify the attendee's registration.</p>
                            </div>
                        )}

                        {status === 'eventClosed' && (
                            <div className="result-state">
                                <div className="result-icon warning"><i className="fas fa-calendar-times"></i></div>
                                <h3>Check-In Closed</h3>
                                <p>This event date is complete. Registered attendee check-in is blocked.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default QRScanner;
