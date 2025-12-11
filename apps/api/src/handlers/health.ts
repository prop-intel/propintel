import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';

export const handler: APIGatewayProxyHandlerV2 = async (): Promise<APIGatewayProxyResultV2> => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'healthy',
      service: 'propintel-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env.STAGE || 'dev',
    }),
  };
};

