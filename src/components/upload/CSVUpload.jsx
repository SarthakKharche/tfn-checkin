import React, { useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import Papa from 'papaparse';

const CSVUpload = ({ activeEvent }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [parsedData, setParsedData] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const findValue = (row, field) => {
        const mappings = {
            name: ['name', 'full name', 'student name', 'candidate name', 'attendee name'],
            prn: ['prn', 'roll no', 'roll number', 'prn number', 'id number', 'registration number'],
            email: ['email', 'email address', 'email id'],
            mobile: ['mobile', 'mobile number', 'phone', 'contact', 'telephone'],
            year: ['year', 'class', 'branch', 'batch']
        };
        const keys = mappings[field] || [field];
        const actualKey = Object.keys(row).find(k =>
            keys.includes((k || '').toLowerCase().trim())
        );
        return actualKey ? (row[actualKey] || '').toString().trim() : '';
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            processFile(file);
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            processFile(file);
        } else {
            alert("Please upload a valid CSV file.");
        }
    };

    const processFile = (file) => {
        setSelectedFile(file);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setParsedData(results.data);
            }
        });
    };

    const handleUpload = async () => {
        if (!activeEvent || parsedData.length === 0) return;

        setUploading(true);
        let uploaded = 0;
        let skipped = 0;
        let failed = 0;

        for (let i = 0; i < parsedData.length; i++) {
            const row = parsedData[i];
            const attendee = {
                name: findValue(row, 'name'),
                prn: findValue(row, 'prn'),
                email: findValue(row, 'email').toLowerCase(),
                mobile: findValue(row, 'mobile'),
                year: findValue(row, 'year') || 'First Year',
                eventId: activeEvent.id,
                checkedIn: false,
                createdAt: serverTimestamp()
            };

            if (!attendee.name || (!attendee.prn && !attendee.email)) {
                skipped++;
                continue;
            }

            try {
                // Check for duplicates in current event
                const q = query(
                    collection(db, 'attendees'),
                    where('eventId', '==', activeEvent.id),
                    where('prn', '==', attendee.prn)
                );
                const dupSnap = await getDocs(q);

                if (dupSnap.empty) {
                    await addDoc(collection(db, 'attendees'), attendee);
                    uploaded++;
                } else {
                    skipped++;
                }
            } catch (err) {
                console.error("Upload error:", err);
                failed++;
            }

            setProgress(Math.round(((i + 1) / parsedData.length) * 100));
        }

        setResults({ uploaded, skipped, failed });
        setUploading(false);
    };

    const clearFile = () => {
        setSelectedFile(null);
        setParsedData([]);
        setResults(null);
        setProgress(0);
    };

    return (
        <section className="page active">
            <div className="page-header">
                <h1><i className="fas fa-file-upload"></i> Upload Beneficiaries</h1>
                <p>Import attendee registration data from a CSV file for <strong>{activeEvent?.name}</strong>.</p>
            </div>

            <div className="card info-card">
                <h3><i className="fas fa-info-circle"></i> CSV Format Requirements</h3>
                <p>Your file should have the following headers (case-insensitive):</p>
                <div className="csv-columns">
                    <span className="badge">Name</span>
                    <span className="badge">PRN</span>
                    <span className="badge">Email</span>
                    <span className="badge">Mobile</span>
                    <span className="badge">Year</span>
                </div>
            </div>

            {!selectedFile ? (
                <div
                    className={`upload-area ${isDragOver ? 'dragover' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => document.getElementById('csvInput').click()}
                >
                    <div className="upload-icon">
                        <i className="fas fa-cloud-upload-alt"></i>
                    </div>
                    <h3>Click or Drag CSV file here</h3>
                    <p>Maximum file size: 5MB</p>
                    <input
                        type="file"
                        id="csvInput"
                        accept=".csv"
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                    />
                </div>
            ) : (
                <div className="file-info">
                    <i className="fas fa-file-csv"></i>
                    <span>Selected: {selectedFile.name} ({parsedData.length} records)</span>
                    <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={clearFile}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            )}

            {parsedData.length > 0 && !results && (
                <button className="btn btn-primary btn-lg" onClick={handleUpload} disabled={uploading || !activeEvent}>
                    <i className={uploading ? "fas fa-spinner fa-spin" : "fas fa-cogs"}></i>
                    {uploading ? ' Processing...' : ' Process & Upload to Firebase'}
                </button>
            )}

            {uploading && (
                <div className="progress-container">
                    <div className="progress-header">
                        <span>Uploading data...</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            )}

            {results && (
                <div className="results-container">
                    <div className="results-header">
                        <h3><i className="fas fa-check-circle"></i> Upload Complete</h3>
                    </div>
                    <div className="results-stats">
                        <div className="stat">
                            <span className="stat-number">{results.uploaded}</span>
                            <span className="stat-label">Uploaded</span>
                        </div>
                        <div className="stat">
                            <span className="stat-number">{results.skipped}</span>
                            <span className="stat-label">Skipped (Dup/Invalid)</span>
                        </div>
                        <div className="stat">
                            <span className="stat-number">{results.failed}</span>
                            <span className="stat-label">Errors</span>
                        </div>
                    </div>
                    <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={clearFile}>
                        <i className="fas fa-redo"></i> Done, upload another
                    </button>
                </div>
            )}

            {parsedData.length > 0 && !results && (
                <div className="table-container">
                    <h3><i className="fas fa-table"></i> Data Preview (First 5 records)</h3>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>PRN</th>
                                    <th>Email</th>
                                    <th>Mobile</th>
                                    <th>Year</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsedData.slice(0, 5).map((row, i) => (
                                    <tr key={i}>
                                        <td>{findValue(row, 'name')}</td>
                                        <td>{findValue(row, 'prn')}</td>
                                        <td>{findValue(row, 'email')}</td>
                                        <td>{findValue(row, 'mobile')}</td>
                                        <td>{findValue(row, 'year')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
    );
};

export default CSVUpload;
