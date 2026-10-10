const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const v = require('../validators/auth.validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, validate({ body: v.register }), ctrl.register);
router.post('/login', authLimiter, validate({ body: v.login }), ctrl.login);
router.post('/refresh', authLimiter, ctrl.refresh);

router.post('/logout', protect, ctrl.logout);
router.get('/me', protect, ctrl.me);
router.patch('/me', protect, validate({ body: v.updateProfile }), ctrl.updateMe);

module.exports = router;
