import { asynchandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudnary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/apiResponce.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findOne(userId);

    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      'Something went wrong while generating Access & refresh token'
    );
  }
};

const options = {
  httpOnly: true,
  secure: true,
};

const registerUser = asynchandler(async (req, res) => {
  //get userdetails from frontend
  //validation
  //is user already exits
  //check for image

  const { fullName, email, username, password } = req.body;
  if (
    [fullName, email, username, password].some((field) => field?.trim() === '')
  ) {
    throw new ApiError(400, 'All fields are required!');
  }

  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existingUser) {
    throw new ApiError(409, 'user with username or email already exists');
  }
  const avatarLocalPath = req.files?.avatar[0]?.path;

  const coverImageLocalPath = req.files?.coverImage[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, 'Avatar file is required');
  }
  const avatar = await uploadOnCloudnary(avatarLocalPath);
  const coverImage = await uploadOnCloudnary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, 'Failed to upload avatar');
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || '',
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findOne(user._id).select([
    '-password',
    '-refreshToken',
  ]);

  if (!createdUser) {
    throw new ApiError(500, 'Failed to register user');
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, 'User registerd successfuly'));
});

const loginUser = asynchandler(async (req, res) => {
  const { email, username, password } = req.body;
  if ((!email && !password) || (!username && !password)) {
    throw new ApiError(500, 'All fields are required!');
  }
  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!existingUser) {
    throw new ApiError(401, 'invailid User or password');
  }
  const isValidpassword = await existingUser.isCorrectPassword(password);

  if (isValidpassword !== true) {
    throw new ApiError(401, 'invailid User or password', ['hello']);
  }

  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(existingUser._id);

  existingUser.refreshToken = refreshToken;

  const responseUser = {
    _id: existingUser._id,
    username: existingUser.username,
    email: existingUser.email,
    fullName: existingUser.fullName,
    avatar: existingUser.avatar,
    coverImage: existingUser.coverImage,
    watchHistory: existingUser.watchHistory,
    isActive: true,
  };

  return res
    .status(202)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: responseUser, accessToken, refreshToken },
        'User loged in successfuly'
      )
    );
});

const logOutUser = asynchandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        refreshToken: '',
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'User loged out successfuly'));
});

const refreshAccessToken = asynchandler(async (req, res) => {
  const userRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!userRefreshToken) {
    throw new ApiError(401, 'Invailid token1');
  }

  try {
    const decodedToken = jwt.verify(
      userRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, 'invailid token2');
    }

    if (userRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, 'invailid token3');
    }

    const { accessToken, refreshToken } =
      await generateAccessTokenAndRefreshToken(user?._id);

    return res
      .status(200)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          'Token refreshed successfuly'
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || 'Failed to refresh token');
  }
});

const changePassword = asynchandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, 'All fields are required');
  }

  try {
    const user = await User.findById(req.user?._id);

    if (!user) {
      throw new ApiError(401, 'invailid credencials');
    }

    const isCorrectPassword = await user.isCorrectPassword(oldPassword);

    if (isCorrectPassword !== true) {
      throw new ApiError(401, 'invailid credencials');
    }

    {
      user.password = newPassword;
      user.refreshToken = '';
    }

    await user.save({ validateBeforeSave: false }, { new: true });

    return res
      .status(200)
      .clearCookie('accessToken', options)
      .clearCookie('refreshToken', options)
      .json(new ApiResponse(200, {}, 'Password changed successfully'));
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid credencials');
  }
});

const updateUser = asynchandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, 'All fields are required');
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select(['_id', 'fullName', 'email']);

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'User updated successfuly'));
});

const getChannelProfile = asynchandler(async (req, res) => {
  const { username } = req.params;

  if (!username) {
    throw new ApiError(400, 'username is required');
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'channel',
        as: 'subcribers',
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'subscriber',
        as: 'subcribedTo',
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: '$subscribers',
        },
        subscribeToCount: {
          $size: '$subcribedTo',
        },
      },
      isSubscribed: {
        $cond: {
          if: { $in: [req.user?._id, '$subscribers.subscriber'] },
          then: true,
          else: false,
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscriberCount: 1,
        subscribeToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel) {
    throw new ApiError(400, 'channel does not exists');
  }
  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], 'user channel fetched successfuly'));
});

const getWatchHistory = asynchandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: 'videos',
        localField: 'watchHistory',
        foreignField: '_id',
        as: 'watchHistory',
        pipeline: [
          {
            $lookup: {
              from: 'users',
              localField: 'owner',
              foreignField: '_id',
              as: 'owner',
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: '$owner',
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        'Watch history fetched successfuly'
      )
    );
});

export {
  registerUser,
  loginUser,
  logOutUser,
  refreshAccessToken,
  changePassword,
  updateUser,
  getChannelProfile,
  getWatchHistory,
};
