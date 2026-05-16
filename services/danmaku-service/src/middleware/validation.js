const Joi = require('joi');
const { DanmakuError } = require('./errorHandler');

// Validation schemas
const schemas = {
  sendDanmaku: Joi.object({
    videoId: Joi.string().uuid().required().messages({
      'string.guid': 'videoId must be a valid UUID',
      'any.required': 'videoId is required'
    }),
    userId: Joi.string().uuid().required().messages({
      'string.guid': 'userId must be a valid UUID',
      'any.required': 'userId is required'
    }),
    content: Joi.string().min(1).max(100).required().messages({
      'string.min': 'Content cannot be empty',
      'string.max': 'Content must not exceed 100 characters',
      'any.required': 'Content is required'
    }),
    timePoint: Joi.number().min(0).required().messages({
      'number.min': 'timePoint must be non-negative',
      'any.required': 'timePoint is required'
    }),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#FFFFFF').messages({
      'string.pattern.base': 'Color must be a valid hex color (e.g., #FFFFFF)'
    }),
    type: Joi.number().valid(0, 1, 2).default(0).messages({
      'any.only': 'Type must be 0 (scroll), 1 (top), or 2 (bottom)'
    }),
    fontSize: Joi.number().integer().min(10).max(100).default(25).messages({
      'number.min': 'fontSize must be at least 10',
      'number.max': 'fontSize must not exceed 100'
    })
  }),

  getDanmakus: Joi.object({
    videoId: Joi.string().uuid().required().messages({
      'string.guid': 'videoId must be a valid UUID',
      'any.required': 'videoId is required'
    }),
    start: Joi.number().min(0).default(0).messages({
      'number.min': 'start must be non-negative'
    }),
    end: Joi.number().min(0).default(300).messages({
      'number.min': 'end must be non-negative'
    }),
    limit: Joi.number().integer().min(1).max(1000).default(500).messages({
      'number.max': 'limit must not exceed 1000'
    }),
    offset: Joi.number().integer().min(0).default(0)
  }),

  getStats: Joi.object({
    videoId: Joi.string().uuid().required()
  }),

  videoJoin: Joi.object({
    videoId: Joi.string().uuid().required()
  }),

  socketDanmakuSend: Joi.object({
    videoId: Joi.string().uuid().required(),
    userId: Joi.string().uuid().required(),
    content: Joi.string().min(1).max(100).required(),
    timePoint: Joi.number().min(0).required(),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#FFFFFF'),
    type: Joi.number().valid(0, 1, 2).default(0),
    fontSize: Joi.number().integer().min(10).max(100).default(25)
  }),

  socketHistoryRequest: Joi.object({
    videoId: Joi.string().uuid().required(),
    start: Joi.number().min(0).default(0),
    end: Joi.number().min(0).default(300)
  })
};

/**
 * Validate request body against schema
 * @param {string} schemaName - Name of schema to use
 */
function validateBody(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next(new DanmakuError(`Unknown validation schema: ${schemaName}`, 500, 'VALIDATION_ERROR'));
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));

      return res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details,
          status: 400
        }
      });
    }

    req.validatedBody = value;
    next();
  };
}

/**
 * Validate request query against schema
 * @param {string} schemaName - Name of schema to use
 */
function validateQuery(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next(new DanmakuError(`Unknown validation schema: ${schemaName}`, 500, 'VALIDATION_ERROR'));
    }

    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));

      return res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details,
          status: 400
        }
      });
    }

    req.validatedQuery = value;
    next();
  };
}

/**
 * Validate request params against schema
 * @param {string} schemaName - Name of schema to use
 */
function validateParams(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next(new DanmakuError(`Unknown validation schema: ${schemaName}`, 500, 'VALIDATION_ERROR'));
    }

    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));

      return res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details,
          status: 400
        }
      });
    }

    req.validatedParams = value;
    next();
  };
}

/**
 * Socket validation helper (returns validation result instead of middleware)
 * @param {string} schemaName - Name of schema
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result
 */
function validateSocketData(schemaName, data) {
  const schema = schemas[schemaName];
  if (!schema) {
    return { error: true, message: `Unknown schema: ${schemaName}` };
  }

  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });

  if (error) {
    return {
      error: true,
      message: error.details.map(d => d.message).join(', '),
      details: error.details
    };
  }

  return { error: false, value };
}

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  validateSocketData,
  schemas
};
