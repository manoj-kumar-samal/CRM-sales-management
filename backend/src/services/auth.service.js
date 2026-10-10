const User = require('../models/User');
const AppError = require('../utils/AppError');
const { ROLES } = require('../config/constants');
const {
  signAccessToken, signRefreshToken, verifyRefreshToken, hashToken, setAuthCookies, clearAuthCookies,
} = require('../utils/tokens');

const issueTokens = async (user, res) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save({ validateModifiedOnly: true });
  setAuthCookies(res, accessToken, refreshToken);
  return accessToken;
};

// Public registration ALWAYS creates a sales executive.
// Admins / managers are created by an admin (POST /users) or the seed script.
exports.register = async (data) => User.create({ ...data, role: ROLES.EXECUTIVE });

exports.login = async ({ email, password }, res) => {
  const user = await User.findOne({ email }).select('+password +refreshTokenHash');
  // Same message for "no such user" and "wrong password" so emails cannot be enumerated
  if (!user || !(await user.comparePassword(password))) throw new AppError('Invalid email or password', 401);
  if (!user.isActive) throw new AppError('Your account has been deactivated. Contact an admin.', 403);

  user.lastLoginAt = new Date();
  const accessToken = await issueTokens(user, res);
  return { user, accessToken };
};

// Refresh-token rotation: every refresh issues a new pair and invalidates the old refresh token.
exports.refresh = async (token, res) => {
  if (!token) throw new AppError('Refresh token missing', 401);
  const payload = verifyRefreshToken(token);
  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || !user.isActive || user.refreshTokenHash !== hashToken(token)) {
    throw new AppError('Invalid refresh token', 401);
  }
  const accessToken = await issueTokens(user, res);
  return { accessToken };
};

exports.logout = async (user, res) => {
  await User.updateOne({ _id: user._id }, { $unset: { refreshTokenHash: 1 } });
  clearAuthCookies(res);
};

exports.updateProfile = async (user, data) => {
  user.set(data);
  await user.save();
  return user;
};
