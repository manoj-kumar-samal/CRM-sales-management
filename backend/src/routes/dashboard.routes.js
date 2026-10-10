const router = require('express').Router();
const ctrl = require('../controllers/dashboard.controller');
const { rangeQuery } = require('../validators/dashboard.validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.use(protect);

// Stats and pipeline are scoped by role inside the service (admin: all, manager: team, executive: own)
router.get('/stats', validate({ query: rangeQuery }), ctrl.getStats);
router.get('/pipeline', validate({ query: rangeQuery }), ctrl.getPipeline);
router.get('/team-performance', authorize(ROLES.ADMIN, ROLES.MANAGER), validate({ query: rangeQuery }), ctrl.getTeamPerformance);

module.exports = router;
