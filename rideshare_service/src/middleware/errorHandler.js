export default function errorHandler(error, req, res, next) {
    console.error(error);
    const statusCode = Number(error.statusCode || error.status || 500);
    res.status(statusCode).json({ success: false, message: error.message || 'Internal server error' });
}
