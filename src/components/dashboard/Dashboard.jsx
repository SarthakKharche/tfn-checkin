import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';

const Dashboard = ({ activeEvent }) => {
    const [attendees, setAttendees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all'); // all, checked-in, pending
    const [selectedQR, setSelectedQR] = useState(null);

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
            (filter === 'pending' && !a.checkedIn);

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
            a.checkInTime ? (a.checkInTime.toDate?.() || new Date(a.checkInTime)).toLocaleString() : ""
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
                </div>
                <button className="btn btn-primary" onClick={fetchAttendees}>
                    <i className="fas fa-sync-alt"></i> Refresh
                </button>
                <button className="btn btn-success" onClick={exportCSV}>
                    <i className="fas fa-download"></i> Export CSV
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
                                            <td data-label="Check-In">{a.checkInTime ? (a.checkInTime.toDate?.() || new Date(a.checkInTime)).toLocaleString() : '—'}</td>
                                            <td data-label="QR">
                                                <div onClick={() => setSelectedQR(a)} className="qr-thumb">
                                                    <QRCodeSVG value={a.prn || a.email} size={36} />
                                                </div>
                                            </td>
                                            <td data-label="Action">
                                                {!a.checkedIn ? (
                                                    <button className="btn btn-primary btn-sm" onClick={() => handleManualCheckIn(a.id)}>
                                                        <i className="fas fa-user-check"></i> Check In
                                                    </button>
                                                ) : (
                                                    <span className="status-badge checked-in"><i className="fas fa-check"></i> Done</span>
                                                )}
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
        </section>
    );
};

export default Dashboard;
