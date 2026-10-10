const router = require('express').Router();
const ctrl = require('../controllers/lead.controller');
const v = require('../validators/lead.validator');
const { idParams, timelineQuery } = require('../validators/common');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const { ADMIN, MANAGER } = ROLES;

router.use(protect); // every lead route needs a logged-in user; data scoping happens in the service

router.route('/')
  .post(validate({ body: v.createLead }), ctrl.createLead)
  .get(validate({ query: v.listLeads }), ctrl.listLeads);

router.route('/:id')
  .get(validate({ params: idParams }), ctrl.getLead)
  .patch(validate({ params: idParams, body: v.updateLead }), ctrl.updateLead)
  .delete(authorize(ADMIN, MANAGER), validate({ params: idParams }), ctrl.deleteLead);

router.patch('/:id/status', validate({ params: idParams, body: v.updateStatus }), ctrl.updateStatus);
router.patch('/:id/assign', authorize(ADMIN, MANAGER), validate({ params: idParams, body: v.assign }), ctrl.assignLead);
router.post('/:id/convert', validate({ params: idParams, body: v.convert }), ctrl.convertLead);
router.get('/:id/timeline', validate({ params: idParams, query: timelineQuery }), ctrl.getTimeline);

module.exports = router;
