import { User } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import { asynchandler } from '../utils/asyncHandler.js';
import jwt from 'jsonwebtoken';

const verifyJWT = asynchandler(async (req, _, next) => {
  try {
    const accessToken =
      req.cookies?.accessToken ||
      req.header('Authorization')?.replace('Bearer ', '');

    if (!accessToken) {
      throw new ApiError(401, 'Unautorized user');
    }

    const decodedToken = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id).select([
      '-password',
      '-refreshToken',
    ]);

    if (!user) {
      throw new ApiError(400, 'invalid Token');
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invailid access token');
  }
});

export { verifyJWT };
