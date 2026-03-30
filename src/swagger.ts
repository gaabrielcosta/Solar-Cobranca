import swaggerJsdoc from 'swagger-jsdoc'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ACELIVRE Solar Cobrança API',
      version: '1.0.0',
      description: 'API de gestão de energia solar compartilhada',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/modules/**/*.controller.ts', './src/main.ts'],
}

export const swaggerSpec = swaggerJsdoc(options)