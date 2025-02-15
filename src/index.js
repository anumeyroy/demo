import dotEnv from 'dotenv';
import express from 'express';
// import cluster from 'node:cluster';
import chalk from 'chalk';
import connectMongoDB from './db/connectdb.js';

const app = express();
dotEnv.config();

const port = process.env.PORT || 3000;

connectMongoDB()
  .then(() =>
    app.listen(port, () => {
      console.log(chalk.bgGreen.bold(`server is listning on ${port}`));
    })
  )
  .catch((error) => console.log(chalk.bgRed('Failed to connect mongoDB')));
