// Enhanced Security with Two-Factor Authentication
// This file implements 2FA for the Legal AI Reach Out Platform

// Import required libraries
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import * as crypto from 'crypto';

// Two-Factor Authentication Class
class TwoFactorAuthentication {
  constructor() {
    this.secretKey = null;
    this.recoveryKeys = [];
    this.issuer = 'Legal AI Reach Out';
  }
  
  // Generate a new secret key for a user
  generateSecretKey(userId, email) {
    // Generate a random secret key
    const secretKey = crypto.randomBytes(20).toString('hex');
    
    // Create a new TOTP object
    const totp = new OTPAuth.TOTP({
      issuer: this.issuer,
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromHex(secretKey)
    });
    
    // Generate recovery keys
    const recoveryKeys = this.generateRecoveryKeys();
    
    return {
      secretKey: secretKey,
      uri: totp.toString(),
      recoveryKeys: recoveryKeys
    };
  }
  
  // Generate recovery keys
  generateRecoveryKeys(count = 8) {
    const recoveryKeys = [];
    
    for (let i = 0; i < count; i++) {
      // Generate a random 10-character recovery key
      const key = crypto.randomBytes(5).toString('hex').toUpperCase();
      
      // Format with a hyphen in the middle (XXXXX-XXXXX)
      recoveryKeys.push(`${key.substring(0, 5)}-${key.substring(5)}`);
    }
    
    return recoveryKeys;
  }
  
  // Generate QR code for the TOTP URI
  async generateQRCode(uri) {
    try {
      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(uri, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      
      return qrCodeDataURL;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return null;
    }
  }
  
  // Verify a TOTP token
  verifyToken(token, secretKey) {
    try {
      // Create a TOTP object with the user's secret key
      const totp = new OTPAuth.TOTP({
        issuer: this.issuer,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromHex(secretKey)
      });
      
      // Verify the token
      const delta = totp.validate({ token });
      
      // Delta will be null if the token is invalid
      // Otherwise, it will be the time step difference
      return delta !== null;
    } catch (error) {
      console.error('Error verifying token:', error);
      return false;
    }
  }
  
  // Verify a recovery key
  verifyRecoveryKey(providedKey, storedRecoveryKeys) {
    // Normalize the provided key
    const normalizedKey = providedKey.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Format the normalized key
    const formattedKey = normalizedKey.length >= 10 
      ? `${normalizedKey.substring(0, 5)}-${normalizedKey.substring(5, 10)}`
      : normalizedKey;
    
    // Check if the key exists in the stored recovery keys
    return storedRecoveryKeys.includes(formattedKey);
  }
  
  // Mark a recovery key as used
  markRecoveryKeyAsUsed(usedKey, storedRecoveryKeys) {
    // Return a new array without the used key
    return storedRecoveryKeys.filter(key => key !== usedKey);
  }
}

// IP-based Access Restrictions Class
class IPAccessRestrictions {
  constructor() {
    this.whitelistedIPs = [];
    this.blacklistedIPs = [];
    this.restrictionsByRole = {};
    this.geoRestrictions = {};
  }
  
  // Add an IP to the whitelist
  addToWhitelist(ip, note = '') {
    if (!this.isWhitelisted(ip)) {
      this.whitelistedIPs.push({
        ip: ip,
        added: new Date(),
        note: note
      });
      
      // Remove from blacklist if present
      this.removeFromBlacklist(ip);
      
      return true;
    }
    
    return false;
  }
  
  // Remove an IP from the whitelist
  removeFromWhitelist(ip) {
    const initialLength = this.whitelistedIPs.length;
    this.whitelistedIPs = this.whitelistedIPs.filter(item => item.ip !== ip);
    
    return initialLength !== this.whitelistedIPs.length;
  }
  
  // Check if an IP is whitelisted
  isWhitelisted(ip) {
    return this.whitelistedIPs.some(item => item.ip === ip);
  }
  
  // Add an IP to the blacklist
  addToBlacklist(ip, reason = '', expirationDate = null) {
    if (!this.isBlacklisted(ip)) {
      this.blacklistedIPs.push({
        ip: ip,
        added: new Date(),
        reason: reason,
        expires: expirationDate
      });
      
      // Remove from whitelist if present
      this.removeFromWhitelist(ip);
      
      return true;
    }
    
    return false;
  }
  
  // Remove an IP from the blacklist
  removeFromBlacklist(ip) {
    const initialLength = this.blacklistedIPs.length;
    this.blacklistedIPs = this.blacklistedIPs.filter(item => item.ip !== ip);
    
    return initialLength !== this.blacklistedIPs.length;
  }
  
  // Check if an IP is blacklisted
  isBlacklisted(ip) {
    // Remove expired blacklist entries
    this.cleanupExpiredBlacklist();
    
    return this.blacklistedIPs.some(item => item.ip === ip);
  }
  
  // Clean up expired blacklist entries
  cleanupExpiredBlacklist() {
    const now = new Date();
    this.blacklistedIPs = this.blacklistedIPs.filter(item => {
      return !item.expires || new Date(item.expires) > now;
    });
  }
  
  // Set IP restrictions for a specific role
  setRoleRestrictions(role, restrictions) {
    this.restrictionsByRole[role] = restrictions;
  }
  
  // Get IP restrictions for a specific role
  getRoleRestrictions(role) {
    return this.restrictionsByRole[role] || null;
  }
  
  // Check if an IP is allowed for a specific role
  isAllowedForRole(ip, role) {
    // Check if IP is blacklisted
    if (this.isBlacklisted(ip)) {
      return false;
    }
    
    // Check if IP is whitelisted
    if (this.isWhitelisted(ip)) {
      return true;
    }
    
    // Check role-specific restrictions
    const roleRestrictions = this.getRoleRestrictions(role);
    
    if (!roleRestrictions) {
      // No specific restrictions for this role
      return true;
    }
    
    if (roleRestrictions.allowedIPs && roleRestrictions.allowedIPs.length > 0) {
      // Only allow specific IPs for this role
      return roleRestrictions.allowedIPs.includes(ip);
    }
    
    if (roleRestrictions.blockedIPs && roleRestrictions.blockedIPs.includes(ip)) {
      // IP is specifically blocked for this role
      return false;
    }
    
    // No specific restrictions apply
    return true;
  }
  
  // Set geo-restrictions
  setGeoRestrictions(countryCode, restrictions) {
    this.geoRestrictions[countryCode] = restrictions;
  }
  
  // Get geo-restrictions for a country
  getGeoRestrictions(countryCode) {
    return this.geoRestrictions[countryCode] || null;
  }
  
  // Check if access is allowed based on geo-location
  isAllowedByGeo(countryCode, role) {
    // Get country-specific restrictions
    const countryRestrictions = this.getGeoRestrictions(countryCode);
    
    if (!countryRestrictions) {
      // No specific restrictions for this country
      return true;
    }
    
    if (countryRestrictions.blockedRoles && countryRestrictions.blockedRoles.includes(role)) {
      // Role is blocked for this country
      return false;
    }
    
    if (countryRestrictions.allowedRoles && countryRestrictions.allowedRoles.length > 0) {
      // Only specific roles are allowed for this country
      return countryRestrictions.allowedRoles.includes(role);
    }
    
    // No specific role restrictions apply
    return !countryRestrictions.blocked;
  }
}

// Secure Session Management Class
class SecureSessionManager {
  constructor() {
    this.sessions = {};
    this.sessionDuration = 30 * 60 * 1000; // 30 minutes in milliseconds
    this.cleanupInterval = null;
  }
  
  // Initialize session manager
  initialize() {
    // Set up periodic cleanup of expired sessions
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000); // Run every 5 minutes
    
    console.log('Secure session manager initialized');
  }
  
  // Stop session manager
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  // Create a new session
  createSession(userId, userAgent, ip) {
    // Generate a secure random session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    // Create session object
    const session = {
      id: sessionId,
      userId: userId,
      userAgent: userAgent,
      ip: ip,
      created: new Date(),
      lastActivity: new Date(),
      expires: new Date(Date.now() + this.sessionDuration),
      twoFactorAuthenticated: false
    };
    
    // Store the session
    this.sessions[sessionId] = session;
    
    return sessionId;
  }
  
  // Get a session by ID
  getSession(sessionId) {
    const session = this.sessions[sessionId];
    
    if (!session) {
      return null;
    }
    
    // Check if session has expired
    if (new Date() > new Date(session.expires)) {
      this.destroySession(sessionId);
      return null;
    }
    
    return session;
  }
  
  // Update session activity
  updateSessionActivity(sessionId) {
    const session = this.getSession(sessionId);
    
    if (session) {
      session.lastActivity = new Date();
      session.expires = new Date(Date.now() + this.sessionDuration);
      return true;
    }
    
    return false;
  }
  
  // Mark session as 2FA authenticated
  markAs2FAAuthenticated(sessionId) {
    const session = this.getSession(sessionId);
    
    if (session) {
      session.twoFactorAuthenticated = true;
      return true;
    }
    
    return false;
  }
  
  // Check if session is 2FA authenticated
  is2FAAuthenticated(sessionId) {
    const session = this.getSession(sessionId);
    return session ? session.twoFactorAuthenticated : false;
  }
  
  // Destroy a session
  destroySession(sessionId) {
    if (this.sessions[sessionId]) {
      delete this.sessions[sessionId];
      return true;
    }
    
    return false;
  }
  
  // Get all sessions for a user
  getUserSessions(userId) {
    return Object.values(this.sessions).filter(session => session.userId === userId);
  }
  
  // Destroy all sessions for a user
  destroyUserSessions(userId) {
    const userSessions = this.getUserSessions(userId);
    
    for (const session of userSessions) {
      this.destroySession(session.id);
    }
    
    return userSessions.length;
  }
  
  // Clean up expired sessions
  cleanupExpiredSessions() {
    const now = new Date();
    let expiredCount = 0;
    
    for (const sessionId in this.sessions) {
      const session = this.sessions[sessionId];
      
      if (now > new Date(session.expires)) {
        this.destroySession(sessionId);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      console.log(`Cleaned up ${expiredCount} expired sessions`);
    }
    
    return expiredCount;
  }
}

// Rate Limiting Class
class RateLimiter {
  constructor() {
    this.limits = {};
    this.requests = {};
  }
  
  // Set rate limit for a specific endpoint
  setLimit(endpoint, limit, windowMs) {
    this.limits[endpoint] = {
      limit: limit,
      windowMs: windowMs
    };
  }
  
  // Check if a request is allowed
  isAllowed(endpoint, ip) {
    // Get the limit configuration for this endpoint
    const limitConfig = this.limits[endpoint];
    
    if (!limitConfig) {
      // No limit configured for this endpoint
      return true;
    }
    
    // Create a key for this endpoint and IP
    const key = `${endpoint}:${ip}`;
    
    // Get or initialize request tracking for this key
    if (!this.requests[key]) {
      this.requests[key] = {
        count: 0,
        resetAt: Date.now() + limitConfig.windowMs
      };
    }
    
    // Check if the window has expired and reset if needed
    if (Date.now() > this.requests[key].resetAt) {
      this.requests[key] = {
        count: 0,
        resetAt: Date.now() + limitConfig.windowMs
      };
    }
    
    // Increment the request count
    this.requests[key].count++;
    
    // Check if the limit has been exceeded
    return this.requests[key].count <= limitConfig.limit;
  }
  
  // Get remaining requests for an endpoint and IP
  getRemainingRequests(endpoint, ip) {
    // Get the limit configuration for this endpoint
    const limitConfig = this.limits[endpoint];
    
    if (!limitConfig) {
      // No limit configured for this endpoint
      return Infinity;
    }
    
    // Create a key for this endpoint and IP
    const key = `${endpoint}:${ip}`;
    
    // If no requests have been made yet, return the full limit
    if (!this.requests[key]) {
      return limitConfig.limit;
    }
    
    // Check if the window has expired and reset if needed
    if (Date.now() > this.requests[key].resetAt) {
      this.requests[key] = {
        count: 0,
        resetAt: Date.now() + limitConfig.windowMs
      };
      return limitConfig.limit;
    }
    
    // Calculate remaining requests
    return Math.max(0, limitConfig.limit - this.requests[key].count);
  }
  
  // Get time until reset for an endpoint and IP
  getTimeUntilReset(endpoint, ip) {
    // Create a key for this endpoint and IP
    const key = `${endpoint}:${ip}`;
    
    // If no requests have been made yet, return 0
    if (!this.requests[key]) {
      return 0;
    }
    
    // Calculate time until reset
    return Math.max(0, this.requests[key].resetAt - Date.now());
  }
}

// Export the classes
export const twoFactorAuth = new TwoFactorAuthentication();
export const ipAccessRestrictions = new IPAccessRestrictions();
export const secureSessionManager = new SecureSessionManager();
export const rateLimiter = new RateLimiter();

// Initialize the session manager
secureSessionManager.initialize();

// Example usage:
/*
// Two-Factor Authentication
const userId = 'user123';
const email = 'user@example.com';
const twoFactorData = twoFactorAuth.generateSecretKey(userId, email);
console.log('Secret Key:', twoFactorData.secretKey);
console.log('Recovery Keys:', twoFactorData.recoveryKeys);

// Generate QR code
const qrCode = await twoFactorAuth.generateQRCode(twoFactorData.uri);
// Display QR code to user

// Verify token
const isValid = twoFactorAuth.verifyToken('123456', twoFactorData.secretKey);
console.log('Token valid:', isValid);

// IP Access Restrictions
ipAccessRestrictions.addToWhitelist('192.168.1.1', 'Office IP');
ipAccessRestrictions.setRoleRestrictions('investor', {
  allowedIPs: ['192.168.1.1', '10.0.0.1']
});
const isAllowed = ipAccessRestrictions.isAllowedForRole('192.168.1.1', 'investor');
console.log('IP allowed for role:', isAllowed);

// Secure Session Management
const sessionId = secureSessionManager.createSession(userId, 'Mozilla/5.0...', '192.168.1.1');
secureSessionManager.markAs2FAAuthenticated(sessionId);
const session = secureSessionManager.getSession(sessionId);
console.log('Session:', session);

// Rate Limiting
rateLimiter.setLimit('/api/login', 5, 60000); // 5 requests per minute
const loginAllowed = rateLimiter.isAllowed('/api/login', '192.168.1.1');
console.log('Login allowed:', loginAllowed);
*/
