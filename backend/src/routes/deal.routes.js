const router = require('express').Router();
const ctrl = require('../controllers/deal.controller');
const v = require('../validators/deal.validator');
const { idParams, timelineQuery } = require('../validators/common');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const { ADMIN, MANAGER } = ROLES;

router.use(protect);

router.route('/')
  .post(validate({ body: v.createDeal }), ctrl.createDeal)
  .get(validate({ query: v.listDeals }), ctrl.listDeals);

router.route('/:id')
  .get(validate({ params: idParams }), ctrl.getDeal)
  .patch(validate({ params: idParams, body: v.updateDeal }), ctrl.updateDeal);

router.patch('/:id/stage', validate({ params: idParams, body: v.changeStage }), ctrl.changeStage);
router.patch('/:id/assign', authorize(ADMIN, MANAGER), validate({ params: idParams, body: v.assign }), ctrl.assignDeal);
router.get('/:id/timeline', validate({ params: idParams, query: timelineQuery }), ctrl.getTimeline);

module.exports = router;
