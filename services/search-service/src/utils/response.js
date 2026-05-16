/**
 * Standardized API response helper
 */
class ApiResponse {
  /**
   * Success response
   */
  static success(res, data = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Error response
   */
  static error(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
    };

    if (errors) {
      response.errors = errors;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Paginated response
   */
  static paginated(res, data, pagination, message = 'Success') {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.pageSize),
        hasNext: pagination.page < Math.ceil(pagination.total / pagination.pageSize),
        hasPrev: pagination.page > 1,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = ApiResponse;
