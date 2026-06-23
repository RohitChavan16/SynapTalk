import { RateLimiterMemory } from 'rate-limiter-flexible';

// Global Rate Limiter: 100 requests per minute per IP
export const globalLimiter = new RateLimiterMemory({
  points: 100,
  duration: 60,
});

// Strict Rate Limiter for Auth/OTP: 5 requests per minute per IP
export const strictLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
});

// AI Rate Limiter: 5 requests per minute per user
export const aiLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
});

export const globalRateLimitMiddleware = (req, res, next) => {
  globalLimiter.consume(req.ip)
    .then(() => {
      next();
    })
    .catch(() => {
      res.status(429).json({ success: false, message: 'Too Many Requests' });
    });
};

export const strictRateLimitMiddleware = (req, res, next) => {
  strictLimiter.consume(req.ip)
    .then(() => {
      next();
    })
    .catch(() => {
      res.status(429).json({ success: false, message: 'Too Many Requests for this endpoint. Please try again later.' });
    });
};

export const aiRateLimitMiddleware = (req, res, next) => {
  const key = req.user ? req.user._id.toString() : req.ip;
  aiLimiter.consume(key)
    .then(() => {
      next();
    })
    .catch(() => {
      res.status(429).json({ success: false, message: 'AI limit reached. Try again later.' });
    });
};
