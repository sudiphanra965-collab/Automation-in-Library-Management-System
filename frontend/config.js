// config.js - Centralized configuration for the Library System
// Update SERVER_IP with your computer's IP address if it changes

const CONFIG = {
  // Your computer's local network IP address
  // Find this by running: ipconfig (Windows) or ifconfig (Mac/Linux)
  SERVER_IP: '10.237.19.96',
  
  // Server ports
  HTTP_PORT: 5000,
  HTTPS_PORT: 5443,
  
  // Get the appropriate base URL for API calls
  getAPIBase: function() {
    // If already on the server port, use relative URLs
    if (window.location.origin.includes(`:${this.HTTP_PORT}`)) {
      return '';
    }
    
    // If on localhost (desktop), use localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `http://localhost:${this.HTTP_PORT}`;
    }
    
    // For mobile/external access, use the server IP
    return `http://${this.SERVER_IP}:${this.HTTP_PORT}`;
  }
};

// Make CONFIG globally available
window.CONFIG = CONFIG;
