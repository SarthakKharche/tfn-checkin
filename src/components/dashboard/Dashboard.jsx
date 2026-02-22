import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import Papa from 'papaparse';
import { formatDate, formatDateTime } from '../../lib/dateUtils';

const Dashboard = ({ activeEvent }) => {
    const [attendees, setAttendees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all'); // all, checked-in, pending, unregistered
    const [selectedQR, setSelectedQR] = useState(null);
    const [showAddOptionsModal, setShowAddOptionsModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showCSVModal, setShowCSVModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [attendeeToDelete, setAttendeeToDelete] = useState(null);

    // CSV Upload State
    const [csvFile, setCsvFile] = useState(null);
    const [csvData, setCsvData] = useState([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadResults, setUploadResults] = useState(null);
    const [newParticipant, setNewParticipant] = useState({
        name: '',
        prn: '',
        email: '',
        mobile: '',
        year: 'First Year'
    });

    const fetchAttendees = async () => {
        if (!activeEvent) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, 'attendees'),
                where('eventId', '==', activeEvent.id),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);
            setAttendees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Error fetching attendees:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttendees();
    }, [activeEvent]);

    const stats = {
        total: attendees.length,
        checkedIn: attendees.filter(a => a.checkedIn).length,
        pending: attendees.length - attendees.filter(a => a.checkedIn).length,
        rate: attendees.length > 0 ? Math.round((attendees.filter(a => a.checkedIn).length / attendees.length) * 100) : 0
    };

    const filteredAttendees = attendees.filter(a => {
        const matchesFilter =
            filter === 'all' ||
            (filter === 'checked-in' && a.checkedIn) ||
            (filter === 'pending' && !a.checkedIn) ||
            (filter === 'unregistered' && a.isUnregistered);

        const matchesSearch =
            (a.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.prn || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.email || '').toLowerCase().includes(searchTerm.toLowerCase());

        return matchesFilter && matchesSearch;
    });

    const handleManualCheckIn = async (attendeeId) => {
        try {
            await updateDoc(doc(db, 'attendees', attendeeId), {
                checkedIn: true,
                checkInTime: serverTimestamp()
            });
            await fetchAttendees();
        } catch (error) {
            console.error("Manual check-in error:", error);
        }
    };

    const handleResetCheckIn = async (attendeeId) => {
        try {
            setIsSubmitting(true);
            await updateDoc(doc(db, 'attendees', attendeeId), {
                checkedIn: false,
                checkInTime: null
            });
            setShowDeleteModal(false);
            setAttendeeToDelete(null);
            await fetchAttendees();
        } catch (error) {
            console.error("Reset check-in error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteAttendee = async (attendeeId) => {
        if (!window.confirm("Are you absolutely sure you want to delete this record entirely?")) return;
        try {
            setIsSubmitting(true);
            await deleteDoc(doc(db, 'attendees', attendeeId));
            setShowDeleteModal(false);
            setAttendeeToDelete(null);
            await fetchAttendees();
        } catch (error) {
            console.error("Delete attendee error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddUnregistered = async (e) => {
        e.preventDefault();
        if (!activeEvent) return;
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'attendees'), {
                ...newParticipant,
                eventId: activeEvent.id,
                checkedIn: true,
                checkInTime: serverTimestamp(),
                isUnregistered: true,
                createdAt: serverTimestamp()
            });
            setShowAddModal(false);
            setNewParticipant({ name: '', prn: '', email: '', mobile: '', year: 'First Year' });
            await fetchAttendees();
        } catch (error) {
            console.error("Error adding unregistered participant:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCSVSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setCsvFile(file);
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => setCsvData(results.data)
            });
        }
    };

    const handleCSVUpload = async () => {
        if (!activeEvent || csvData.length === 0) return;
        setIsSubmitting(true);
        let uploaded = 0;
        let skipped = 0;

        for (let i = 0; i < csvData.length; i++) {
            const row = csvData[i];
            const attendee = {
                name: row.Name || row.name || '',
                prn: row.PRN || row.prn || '',
                email: (row.Email || row.email || '').toLowerCase(),
                mobile: row.Mobile || row.mobile || '',
                year: row.Year || row.year || '',
                eventId: activeEvent.id,
                checkedIn: true,
                checkInTime: serverTimestamp(),
                isUnregistered: true,
                createdAt: serverTimestamp()
            };

            if (!attendee.name || (!attendee.prn && !attendee.email)) {
                skipped++;
                continue;
            }

            try {
                await addDoc(collection(db, 'attendees'), attendee);
                uploaded++;
            } catch (err) {
                console.error("CSV Upload row error:", err);
            }
            setUploadProgress(Math.round(((i + 1) / csvData.length) * 100));
        }

        setUploadResults({ uploaded, skipped });
        setIsSubmitting(false);
        await fetchAttendees();
    };

    const closeCSVModal = () => {
        setShowCSVModal(false);
        setCsvFile(null);
        setCsvData([]);
        setUploadProgress(0);
        setUploadResults(null);
    };

    const exportCSV = () => {
        if (filteredAttendees.length === 0) return;

        const headers = ["#", "Name", "PRN", "Email", "Mobile", "Year", "Status", "Check-In Time"];
        const rows = filteredAttendees.map((a, i) => [
            i + 1,
            a.name,
            a.prn || "",
            a.email,
            a.mobile,
            a.year,
            a.checkedIn ? "Checked In" : "Pending",
            a.isUnregistered ? `Unregistered (${formatDateTime(a.checkInTime)})` : formatDateTime(a.checkInTime)
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `checkin-report-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    return (
        <section className="page active">
            <div className="page-header">
                <h1><i className="fas fa-users"></i> Event Dashboard</h1>
                <p>Real-time overview for <strong>{activeEvent?.name}</strong>.</p>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-card-icon blue"><i className="fas fa-users"></i></div>
                    <div className="stat-card-info">
                        <span className="stat-card-number">{stats.total}</span>
                        <span className="stat-card-label">Total Registered</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon green"><i className="fas fa-user-check"></i></div>
                    <div className="stat-card-info">
                        <span className="stat-card-number">{stats.checkedIn}</span>
                        <span className="stat-card-label">Checked In</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon orange"><i className="fas fa-clock"></i></div>
                    <div className="stat-card-info">
                        <span className="stat-card-number">{stats.pending}</span>
                        <span className="stat-card-label">Pending</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon purple"><i className="fas fa-percentage"></i></div>
                    <div className="stat-card-info">
                        <span className="stat-card-number">{stats.rate}%</span>
                        <span className="stat-card-label">Check-In Rate</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-controls">
                <div className="search-box">
                    <i className="fas fa-search"></i>
                    <input
                        type="text"
                        placeholder="Search by name, PRN, or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
                    <button className={`filter-btn ${filter === 'checked-in' ? 'active' : ''}`} onClick={() => setFilter('checked-in')}>Checked In</button>
                    <button className={`filter-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>Pending</button>
                    <button className={`filter-btn ${filter === 'unregistered' ? 'active' : ''}`} onClick={() => setFilter('unregistered')}>Unregistered</button>
                </div>
                <button className="btn btn-primary" onClick={fetchAttendees}>
                    <i className="fas fa-sync-alt"></i> Refresh
                </button>
                <button className="btn btn-success" onClick={exportCSV}>
                    <i className="fas fa-download"></i> Export CSV
                </button>
                <button className="btn btn-primary" style={{ backgroundColor: '#6366f1' }} onClick={() => setShowAddOptionsModal(true)}>
                    <i className="fas fa-user-plus"></i> Add Unregistered
                </button>
            </div>

            <div className="table-container">
                {loading ? (
                    <div className="spinner" style={{ margin: '2rem auto' }}></div>
                ) : (
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Name</th>
                                    <th>PRN</th>
                                    <th>Email</th>
                                    <th>Mobile</th>
                                    <th>Year</th>
                                    <th>Status</th>
                                    <th>Check-In</th>
                                    <th>QR</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAttendees.length === 0 ? (
                                    <tr>
                                        <td colSpan="10" className="empty-state">
                                            <i className="fas fa-folder-open"></i>
                                            <p>No attendees found.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAttendees.map((a, i) => (
                                        <tr key={a.id}>
                                            <td data-label="#">{i + 1}</td>
                                            <td data-label="Name">{a.name}</td>
                                            <td data-label="PRN">{a.prn || '—'}</td>
                                            <td data-label="Email">{a.email}</td>
                                            <td data-label="Mobile">{a.mobile}</td>
                                            <td data-label="Year">{a.year}</td>
                                            <td data-label="Status">
                                                <span className={`status-badge ${a.checkedIn ? 'checked-in' : 'pending'}`}>
                                                    <i className={`fas ${a.checkedIn ? 'fa-check' : 'fa-clock'}`}></i> {a.checkedIn ? 'Checked In' : 'Pending'}
                                                </span>
                                            </td>
                                            <td data-label="Check-In">
                                                {a.isUnregistered ? (
                                                    <span className="status-badge" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                                                        Unregistered ({formatDateTime(a.checkInTime)})
                                                    </span>
                                                ) : (
                                                    formatDateTime(a.checkInTime)
                                                )}
                                            </td>
                                            <td data-label="QR">
                                                <div onClick={() => setSelectedQR(a)} className="qr-thumb">
                                                    <QRCodeSVG value={a.prn || a.email} size={36} />
                                                </div>
                                            </td>
                                            <td data-label="Action">
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                                                    {!a.checkedIn ? (
                                                        <button className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={() => handleManualCheckIn(a.id)}>
                                                            <i className="fas fa-user-check"></i> Check In
                                                        </button>
                                                    ) : (
                                                        <span className="status-badge checked-in" style={{ whiteSpace: 'nowrap' }}><i className="fas fa-check"></i> Done</span>
                                                    )}
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        style={{ padding: '0.4rem 0.6rem', minWidth: 'auto', flexShrink: 0 }}
                                                        onClick={() => { setAttendeeToDelete(a); setShowDeleteModal(true); }}
                                                        title="Delete or Reset Check-in"
                                                    >
                                                        <i className="fas fa-trash-alt"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedQR && (
                <div className="modal-overlay" onClick={() => setSelectedQR(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>QR Code — {selectedQR.prn || selectedQR.name}</h3>
                            <button className="modal-close" onClick={() => setSelectedQR(null)}><i className="fas fa-times"></i></button>
                        </div>
                        <div className="modal-body">
                            <div className="qr-display">
                                <QRCodeSVG value={selectedQR.prn || selectedQR.email} size={256} />
                            </div>
                            <p className="qr-prn">{selectedQR.prn || selectedQR.email}</p>
                        </div>
                    </div>
                </div>
            )}

            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><i className="fas fa-user-plus"></i> Add Unregistered Participant</h3>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}><i className="fas fa-times"></i></button>
                        </div>
                        <form onSubmit={handleAddUnregistered}>
                            <div className="modal-body">
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label>Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="form-control"
                                        value={newParticipant.name}
                                        onChange={e => setNewParticipant({ ...newParticipant, name: e.target.value })}
                                        placeholder="Enter full name"
                                    />
                                </div>
                                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                    <div className="form-group">
                                        <label>PRN (Optional)</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={newParticipant.prn}
                                            onChange={e => setNewParticipant({ ...newParticipant, prn: e.target.value })}
                                            placeholder="PRN"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Year</label>
                                        <select
                                            className="form-control"
                                            value={newParticipant.year}
                                            onChange={e => setNewParticipant({ ...newParticipant, year: e.target.value })}
                                        >
                                            <option value="First Year">First Year</option>
                                            <option value="Second Year">Second Year</option>
                                            <option value="Third Year">Third Year</option>
                                            <option value="Final Year">Final Year</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label>Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        className="form-control"
                                        value={newParticipant.email}
                                        onChange={e => setNewParticipant({ ...newParticipant, email: e.target.value })}
                                        placeholder="email@example.com"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Mobile Number</label>
                                    <input
                                        type="tel"
                                        required
                                        className="form-control"
                                        value={newParticipant.mobile}
                                        onChange={e => setNewParticipant({ ...newParticipant, mobile: e.target.value })}
                                        placeholder="10-digit number"
                                    />
                                </div>
                            </div>
                            <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb', padding: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Adding...' : 'Add & Check In'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAddOptionsModal && (
                <div className="modal-overlay" onClick={() => setShowAddOptionsModal(false)}>
                    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><i className="fas fa-user-plus"></i> Add Unregistered</h3>
                            <button className="modal-close" onClick={() => setShowAddOptionsModal(false)}><i className="fas fa-times"></i></button>
                        </div>
                        <div className="modal-body" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button className="btn btn-primary btn-lg" onClick={() => { setShowAddOptionsModal(false); setShowAddModal(true); }}>
                                <i className="fas fa-keyboard"></i> Manual Entry
                            </button>
                            <button className="btn btn-success btn-lg" onClick={() => { setShowAddOptionsModal(false); setShowCSVModal(true); }}>
                                <i className="fas fa-file-csv"></i> Upload CSV
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCSVModal && (
                <div className="modal-overlay" onClick={closeCSVModal}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><i className="fas fa-file-csv"></i> Upload Unregistered (CSV)</h3>
                            <button className="modal-close" onClick={closeCSVModal}><i className="fas fa-times"></i></button>
                        </div>
                        <div className="modal-body">
                            {!csvFile ? (
                                <div className="upload-area" onClick={() => document.getElementById('unregCsvInput').click()}>
                                    <i className="fas fa-cloud-upload-alt" style={{ fontSize: '3rem', marginBottom: '1rem' }}></i>
                                    <h3>Select Unregistered CSV</h3>
                                    <p>Headers: Name, PRN, Email, Mobile, Year</p>
                                    <input
                                        type="file"
                                        id="unregCsvInput"
                                        accept=".csv"
                                        style={{ display: 'none' }}
                                        onChange={handleCSVSelect}
                                    />
                                </div>
                            ) : (
                                <div className="upload-status">
                                    <div className="file-info" style={{ marginBottom: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: '8px' }}>
                                        <i className="fas fa-file-csv"></i> <strong>{csvFile.name}</strong> ({csvData.length} records found)
                                    </div>

                                    {isSubmitting && (
                                        <div className="progress-container" style={{ margin: '1rem 0' }}>
                                            <div className="progress-bar" style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div className="progress-fill" style={{ width: `${uploadProgress}%`, height: '100%', background: '#6366f1', transition: 'width 0.3s' }}></div>
                                            </div>
                                            <p style={{ textAlign: 'center', marginTop: '0.5rem' }}>Processing: {uploadProgress}%</p>
                                        </div>
                                    )}

                                    {uploadResults && (
                                        <div className="results" style={{ padding: '1rem', background: '#ecfdf5', borderRadius: '8px', color: '#065f46', marginBottom: '1rem' }}>
                                            <p><i className="fas fa-check-circle"></i> Successfully added & checked in <strong>{uploadResults.uploaded}</strong> participants.</p>
                                            {uploadResults.skipped > 0 && <p><i className="fas fa-exclamation-triangle"></i> Skipped <strong>{uploadResults.skipped}</strong> invalid records.</p>}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb', padding: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={closeCSVModal}>Close</button>
                            {csvFile && !uploadResults && (
                                <button className="btn btn-primary" onClick={handleCSVUpload} disabled={isSubmitting}>
                                    {isSubmitting ? 'Uploading...' : 'Start Upload'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {showDeleteModal && attendeeToDelete && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><i className="fas fa-exclamation-triangle" style={{ color: '#ef4444' }}></i> Action Required</h3>
                            <button className="modal-close" onClick={() => setShowDeleteModal(false)}><i className="fas fa-times"></i></button>
                        </div>
                        <div className="modal-body" style={{ padding: '2rem', textAlign: 'center' }}>
                            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                                What would you like to do with <strong>{attendeeToDelete.name}</strong>'s record?
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <button
                                    className="btn btn-warning btn-lg"
                                    style={{ width: '100%' }}
                                    onClick={() => handleResetCheckIn(attendeeToDelete.id)}
                                    disabled={isSubmitting}
                                >
                                    <i className="fas fa-undo"></i> Reset Check-in Status
                                </button>
                                <button
                                    className="btn btn-danger btn-lg"
                                    style={{ width: '100%' }}
                                    onClick={() => handleDeleteAttendee(attendeeToDelete.id)}
                                    disabled={isSubmitting}
                                >
                                    <i className="fas fa-trash-alt"></i> Delete Record Entirely
                                </button>
                            </div>
                        </div>
                        <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb', padding: '1rem', display: 'flex', justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default Dashboard;
