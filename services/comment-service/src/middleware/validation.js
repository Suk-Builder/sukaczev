const Joi = require('joi');
const { CommentError } = require('./errorHandler');

const schemas = {
  createComment: Joi.object({
    videoId: Joi.string().uuid().required().messages({
      'string.guid': 'videoId must be a valid UUID',
      'any.required': 'videoId is required'
    }),
    userId: Joi.string().uuid().required().messages({
      'string.guid': 'userId must be a valid UUID',
      'any.required': 'userId is required'
    }),
    content: Joi.string().min(1).max(2000).required().messages({
      'string.min': 'Content cannot be empty',
      'string.max': 'Content must not exceed 2000 characters',
      'any.required': 'Content is required'
    }),
    parentId: Joi.string().uuid().allow(null).optional().messages({
      'string.guid': 'parentId must be a valid UUID'
    })
  }),

  getComments: Joi.object({
    videoId: Joi.string().uuid().required().messages({
      'string.guid': 'videoId must be a valid UUID',
      'any.required': 'videoId is required'
    }),
    page: Joi.number().integer().min(1).default(1),
    flat: Joi.string().valid('true', 'false').default('false'),
    sortBy: Joi.string().valid(
      'created_at DESC',
      'created_at ASC',
      'likes_count DESC',
      'likes_count ASC'
    ).default('created_at DESC')
  }),

  getReplies: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(50)
  }),

  toggleLike: Joi.object({
    userId: Joi.string().uuid().required()
  }),

  deleteComment: Joi.object({
    userId: Joi.string().uuid().optional()
  })
};

function validateBody(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next(new CommentError(`Unknown validation schema: ${schemaName}`, 500, 'VALIDATION_ERROR'));
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

function validateQuery(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next(new CommentError(`Unknown validation schema: ${schemaName}`, 500, 'VALIDATION_ERROR'));
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

function validateParams(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next(new CommentError(`Unknown validation schema: ${schemaName}`, 500, 'VALIDATION_ERROR'));
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

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  schemas
};
