import { Router } from 'express';
import {
  changePassword,
  getChannelProfile,
  getWatchHistory,
  loginUser,
  logOutUser,
  refreshAccessToken,
  registerUser,
  updateUser,
} from '../controllers/user.controller.js';
import { upload } from '../middlewares/multer.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.route('/register').post(
  upload.fields([
    {
      name: 'avatar',
      maxCount: 1,
    },
    {
      name: 'coverImage',
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route('/login').post(loginUser);
export default router;

//secured routes
router.route('/logout').post(verifyJWT, logOutUser);
router.route('/change-password').patch(verifyJWT, changePassword);
router.route('/update').patch(verifyJWT, updateUser);
router.route('/channel/:username').get(verifyJWT, getChannelProfile);
router.route('/history').get(verifyJWT, getWatchHistory);
router.route('/refresh-token').patch(refreshAccessToken);
