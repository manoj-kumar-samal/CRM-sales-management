const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const User = require('../models/User');
const { verifyAccessToken } = require('../utils/tokens');

// Reads the JWT from "Authorization: Bearer <token>" or from the httpOnly cookie.
const protect = asyncHandler(async (req, res, next) => {
  let token;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) token = header.split(' ')[1];
  else if (req.cookies && req.cookies.accessToken) token = req.cookies.accessToken;

  if (!token) throw new AppError('Authentication required. Please log in.', 401);

  const payload = verifyAccessToken(token); // throws JsonWebTokenError / TokenExpiredError -> 401
  const user = await User.findById(payload.sub);
  // Checked on every request so deactivating a user locks them out immediately.
  if (!user || !user.isActive) throw new AppError('User no longer exists or is deactivated', 401);

  req.user = user;
  next();
});

// Role-based access: authorize('admin', 'sales_manager')
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  next();
};

module.exports = { protect, authorize };
