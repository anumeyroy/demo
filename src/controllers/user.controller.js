import { asynchandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudnary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/apiResponce.js';

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
  console.log(req.files);
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

  const options = {
    httpOnly: true,
    secure: true,
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
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'User loged out successfuly'));
});

export { registerUser, loginUser, logOutUser };
