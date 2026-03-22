import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const FASTAPI_URL = process.env.REACT_APP_FASTAPI_URL || 'http://localhost:8001';
const EXPRESS_URL = process.env.REACT_APP_EXPRESS_URL || 'http://localhost:8002';
const GO_URL = process.env.REACT_APP_GO_URL || 'http://localhost:8003';

function App() {
  const [services, setServices] = useState({
    fastapi: { status: 'checking...', data: null },
    express: { status: 'checking...', data: null },
    go: { status: 'checking...', data: null }
  });

  useEffect(() => {
    const checkServices = async () => {
      // Check FastAPI
      try {
        const fastApiRes = await axios.get(`${FASTAPI_URL}/health`);
        setServices(prev => ({
          ...prev,
          fastapi: { status: 'online', data: fastApiRes.data }
        }));
      } catch (err) {
        setServices(prev => ({
          ...prev,
          fastapi: { status: 'offline', data: null }
        }));
      }

      // Check Express
      try {
        const expressRes = await axios.get(`${EXPRESS_URL}/health`);
        setServices(prev => ({
          ...prev,
          express: { status: 'online', data: expressRes.data }
        }));
      } catch (err) {
        setServices(prev => ({
          ...prev,
          express: { status: 'offline', data: null }
        }));
      }

      // Check Go
      try {
        const goRes = await axios.get(`${GO_URL}/health`);
        setServices(prev => ({
          ...prev,
          go: { status: 'online', data: goRes.data }
        }));
      } catch (err) {
        setServices(prev => ({
          ...prev,
          go: { status: 'offline', data: null }
        }));
      }
    };

    checkServices();
    const interval = setInterval(checkServices, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 React Development Dashboard</h1>
        <p>Windows 11 Local Development Environment</p>
      </header>

      <main className="App-main">
        <section className="services-grid">
          <div className={`service-card ${services.fastapi.status}`}>
            <h2>🐍 FastAPI Service</h2>
            <p className="status">Status: {services.fastapi.status}</p>
            <p className="url">URL: {FASTAPI_URL}</p>
            {services.fastapi.data && (
              <pre>{JSON.stringify(services.fastapi.data, null, 2)}</pre>
            )}
          </div>

          <div className={`service-card ${services.express.status}`}>
            <h2>📦 Express Service</h2>
            <p className="status">Status: {services.express.status}</p>
            <p className="url">URL: {EXPRESS_URL}</p>
            {services.express.data && (
              <pre>{JSON.stringify(services.express.data, null, 2)}</pre>
            )}
          </div>

          <div className={`service-card ${services.go.status}`}>
            <h2>🔷 Go Service</h2>
            <p className="status">Status: {services.go.status}</p>
            <p className="url">URL: {GO_URL}</p>
            {services.go.data && (
              <pre>{JSON.stringify(services.go.data, null, 2)}</pre>
            )}
          </div>
        </section>

        <section className="info-section">
          <h2>📊 Database Connections</h2>
          <ul>
            <li><strong>PostgreSQL:</strong> localhost:5432</li>
            <li><strong>MongoDB:</strong> localhost:27017</li>
            <li><strong>Redis:</strong> localhost:6379</li>
          </ul>
        </section>

        <section className="info-section">
          <h2>🔧 Admin Tools</h2>
          <ul>
            <li><a href="http://localhost:8080" target="_blank" rel="noopener noreferrer">Adminer (PostgreSQL)</a></li>
            <li><a href="http://localhost:8081" target="_blank" rel="noopener noreferrer">Mongo Express</a></li>
            <li><a href="http://localhost:8082" target="_blank" rel="noopener noreferrer">Redis Commander</a></li>
          </ul>
        </section>
      </main>

      <footer className="App-footer">
        <p>Built with React 18 | Part of Win11 Dev Environment</p>
      </footer>
    </div>
  );
}

export default App;
