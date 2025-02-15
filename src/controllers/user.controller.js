import { asynchandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudnary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/apiResponce.js';

const registerUser = asynchandler(async (req, res) => {
  //get userdetails from frontend
  //validation
  //is user already exits
  //check for image

  const { fullName, email, username, password } = req.body;
  if (
    [fullName, email, username, password].some((field) => field?.trim() === '')
  ) {
    throw new ApiError(400, 'All fields are required');
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

export { registerUser };
