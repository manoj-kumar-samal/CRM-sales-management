const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';
const ACCESS_MS = 15 * 60 * 1000;
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

const signAccessToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwt.accessSecret, { expiresIn: ACCESS_TTL });

const signRefreshToken = (user) =>
  jwt.sign({ sub: user._id.toString() }, env.jwt.refreshSecret, { expiresIn: REFRESH_TTL });

const verifyAccessToken = (token) => jwt.verify(token, env.jwt.accessSecret);
const verifyRefreshToken = (token) => jwt.verify(token, env.jwt.refreshSecret);

// Refresh tokens are stored hashed, so a database leak does not leak usable tokens.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: env.cookieSameSite,
  maxAge,
});

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, cookieOptions(ACCESS_MS));
  res.cookie('refreshToken', refreshToken, { ...cookieOptions(REFRESH_MS), path: '/api/v1/auth' });
};

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', cookieOptions(0));
  res.clearCookie('refreshToken', { ...cookieOptions(0), path: '/api/v1/auth' });
};

module.exports = {
  signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken,
  hashToken, setAuthCookies, clearAuthCookies,
};
