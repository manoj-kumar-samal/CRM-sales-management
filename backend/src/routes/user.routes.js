const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const v = require('../validators/user.validator');
const { idParams } = require('../validators/common');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.use(protect);

// Managers need the list of executives they can assign work to
router.get('/assignable', authorize(ROLES.ADMIN, ROLES.MANAGER), ctrl.listAssignable);

// Everything else is admin only
router.use(authorize(ROLES.ADMIN));

router.route('/')
  .post(validate({ body: v.createUser }), ctrl.createUser)
  .get(validate({ query: v.listUsers }), ctrl.listUsers);

router.route('/:id')
  .get(validate({ params: idParams }), ctrl.getUser)
  .patch(validate({ params: idParams, body: v.updateUser }), ctrl.updateUser)
  .delete(validate({ params: idParams }), ctrl.deleteUser);

router.patch('/:id/status', validate({ params: idParams, body: v.setStatus }), ctrl.setStatus);

module.exports = router;
