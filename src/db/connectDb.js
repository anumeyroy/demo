import mongoose from 'mongoose';
import chalk from 'chalk';

const connectMongoDB = async () => {
  try {
    const connectDb = await mongoose.connect(process.env.MONGO_URI);
    console.log(
      chalk.bgGreen.yellow.bold(
        'mongoDB connected!! on host: ',
        connectDb.connection.host
      )
    );
  } catch (error) {
    console.log(chalk.bgRed(error));
  }
};

export default connectMongoDB;
