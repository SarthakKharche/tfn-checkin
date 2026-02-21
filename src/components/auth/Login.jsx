import React, { useState } from 'react';
import { auth } from '../../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

const Login = (props) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            console.error("Login error:", err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError('Invalid email or password');
            } else {
                setError('An error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-icon">
                        <i className="fas fa-user-shield"></i>
                    </div>
                    <h1>TFN Digital Check-In</h1>
                    <p>Administrator Access Only</p>
                </div>

                <form onSubmit={handleLogin} autoComplete="off">
                    <div className="form-group">
                        <label htmlFor="loginEmail">
                            <i className="fas fa-envelope"></i> Email Address
                        </label>
                        <input
                            type="email"
                            id="loginEmail"
                            placeholder="admin@tfn.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="loginPassword">
                            <i className="fas fa-lock"></i> Password
                        </label>
                        <div className="password-wrapper">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="loginPassword"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                    </div>

                    <div className="login-error">
                        {error && error}
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={loading}
                    >
                        {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sign-in-alt"></i>}
                        {loading ? ' Authenticating...' : ' Login to Dashboard'}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.2rem' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>Participant?</p>
                        <button
                            type="button"
                            className="btn btn-success"
                            style={{ width: '100%', justifyContent: 'center' }}
                            onClick={props.onGetQR}
                        >
                            <i className="fas fa-qrcode"></i> Get My QR Code
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
};

export default Login;
