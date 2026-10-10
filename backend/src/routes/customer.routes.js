const router = require('express').Router();
const ctrl = require('../controllers/customer.controller');
const v = require('../validators/customer.validator');
const { idParams, timelineQuery } = require('../validators/common');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const { ADMIN, MANAGER } = ROLES;

router.use(protect);

router.route('/')
  .post(validate({ body: v.createCustomer }), ctrl.createCustomer)
  .get(validate({ query: v.listCustomers }), ctrl.listCustomers);

router.route('/:id')
  .get(validate({ params: idParams }), ctrl.getCustomer)
  .patch(validate({ params: idParams, body: v.updateCustomer }), ctrl.updateCustomer)
  .delete(authorize(ADMIN), validate({ params: idParams }), ctrl.deleteCustomer);

router.patch('/:id/assign', authorize(ADMIN, MANAGER), validate({ params: idParams, body: v.assign }), ctrl.assignCustomer);
router.get('/:id/timeline', validate({ params: idParams, query: timelineQuery }), ctrl.getTimeline);

module.exports = router;
