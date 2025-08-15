const globalMiddleware = (req, res, next) => {
    // Example: Logging for every request
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);

    // Example: Add custom header to responses
    res.set('X-Powered-By', 'QMark Server');

    // Example: Authentication check (will run for all routes)
    // if (!req.headers['x-api-key']) {
    //     return res.status(401).json({ error: 'API key required' });
    // }

    next(); // Continue to next middleware/route
};

module.exports = globalMiddleware;