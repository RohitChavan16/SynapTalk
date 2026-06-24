import { logger } from '../lib/logger.js';

export const globalErrorHandler = (err, req, res, next) => {
  if (err.name === 'ValidationError') {
    err.statusCode = 400;
    err.isOperational = true;
    err.message = Object.values(err.errors).map(val => val.message).join(', ');
  }
  if (err.code === 11000) {
    err.statusCode = 400;
    err.isOperational = true;
    const field = Object.keys(err.keyValue)[0];
    err.message = `${field} already exists.`;
  }

  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else {
    if (err.isOperational) {
      res.status(err.statusCode).json({
        success: false,
        status: err.status,
        message: err.message,
      });
    } else {
      logger.error('ERROR 💥', err);
      res.status(500).json({
        success: false,
        status: 'error',
        message: 'Something went very wrong!',
      });
    }
  }
};
