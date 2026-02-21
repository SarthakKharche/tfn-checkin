import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, writeBatch, where, serverTimestamp } from 'firebase/firestore';

const EventsManager = ({ activeEvent, setActiveEvent }) => {
    const [events, setEvents] = useState([]);
    const [eventName, setEventName] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventDesc, setEventDesc] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchEvents = async () => {
        const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const eventsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEvents(eventsList);
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const createEvent = async (e) => {
        e.preventDefault();
        if (!eventName || !eventDate) return;

        try {
            setLoading(true);
            await addDoc(collection(db, 'events'), {
                name: eventName,
                date: eventDate,
                description: eventDesc,
                createdAt: serverTimestamp()
            });
            setEventName('');
            setEventDate('');
            setEventDesc('');
            fetchEvents();
        } catch (error) {
            console.error("Error creating event:", error);
            alert("Error creating event");
        } finally {
            setLoading(false);
        }
    };

    const deleteEvent = async (eventId, e) => {
        e.stopPropagation();
        if (!window.confirm("Delete this event and all its attendees? This cannot be undone.")) return;

        try {
            // Delete all attendees for this event first
            const attendeesQ = query(collection(db, 'attendees'), where('eventId', '==', eventId));
            const attendeesSnap = await getDocs(attendeesQ);
            const batch = writeBatch(db);
            attendeesSnap.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();

            // Delete the event
            await deleteDoc(doc(db, 'events', eventId));
            if (activeEvent?.id === eventId) setActiveEvent(null);
            fetchEvents();
        } catch (error) {
            console.error("Error deleting event:", error);
        }
    };

    return (
        <section className="page active">
            <div className="page-header">
                <h1><i className="fas fa-calendar-alt"></i> Event Management</h1>
                <p>Create and manage events for digital check-in.</p>
            </div>

            <div className="card add-event-card">
                <h3><i className="fas fa-plus-circle"></i> Create New Event</h3>
                <form className="add-event-form" onSubmit={createEvent}>
                    <div className="form-group">
                        <label>Event Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Annual Tech Summit 2024"
                            value={eventName}
                            onChange={(e) => setEventName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="event-form-row">
                        <div className="form-group">
                            <label>Event Date</label>
                            <input
                                type="date"
                                value={eventDate}
                                onChange={(e) => setEventDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group" style={{ opacity: 0, pointerEvents: 'none' }}>
                            <label>Hidden</label>
                            <input type="text" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Description (Optional)</label>
                        <input
                            type="text"
                            placeholder="Briefly describe the event..."
                            value={eventDesc}
                            onChange={(e) => setEventDesc(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-check"}></i>
                        {loading ? ' Creating...' : ' Create Event'}
                    </button>
                </form>
            </div>

            <div className="events-list-section">
                <h3><i className="fas fa-list-ul"></i> Existing Events</h3>
                <div className="events-grid">
                    {events.length === 0 ? (
                        <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No events found. Create one above to get started.
                        </div>
                    ) : (
                        events.map((event) => (
                            <div
                                key={event.id}
                                className={`event-card ${activeEvent?.id === event.id ? 'selected' : ''}`}
                                onClick={() => setActiveEvent(event)}
                            >
                                <div className="event-card-body">
                                    <div className="event-card-icon">
                                        <i className="fas fa-calendar-stars"></i>
                                    </div>
                                    <div className="event-card-info">
                                        <h4>{event.name}</h4>
                                        <div className="event-card-date">
                                            <i className="fas fa-calendar-day"></i> {new Date(event.date).toLocaleDateString()}
                                        </div>
                                        <div className="event-card-desc">{event.description || 'No description provided.'}</div>
                                    </div>
                                    {activeEvent?.id === event.id && (
                                        <div className="event-active-badge">
                                            <i className="fas fa-check-circle"></i> Active
                                        </div>
                                    )}
                                </div>
                                <div className="event-card-actions">
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => setActiveEvent(event)}
                                    >
                                        <i className="fas fa-hand-pointer"></i> {activeEvent?.id === event.id ? 'Selected' : 'Select'}
                                    </button>
                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={(e) => deleteEvent(event.id, e)}
                                    >
                                        <i className="fas fa-trash-alt"></i> Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </section>
    );
};

export default EventsManager;
