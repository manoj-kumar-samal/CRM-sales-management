const router = require('express').Router();
const ctrl = require('../controllers/activity.controller');
const v = require('../validators/activity.validator');
const { idParams } = require('../validators/common');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .post(validate({ body: v.createActivity }), ctrl.createActivity)
  .get(validate({ query: v.listActivities }), ctrl.listActivities);

router.route('/:id')
  .get(validate({ params: idParams }), ctrl.getActivity)
  .patch(validate({ params: idParams, body: v.updateActivity }), ctrl.updateActivity)
  .delete(validate({ params: idParams }), ctrl.deleteActivity);

router.patch('/:id/complete', validate({ params: idParams }), ctrl.completeActivity);

module.exports = router;
