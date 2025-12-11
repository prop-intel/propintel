import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';

// ===================
// HTML Handler (Swagger UI)
// ===================

export const html: APIGatewayProxyHandlerV2 = async (): Promise<APIGatewayProxyResultV2> => {
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>PropIntel API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css">
    <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5.9.0/favicon-32x32.png" sizes="32x32" />
    <style>
      body { margin: 0; padding: 0; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
    <script>
    window.onload = function() {
        window.ui = SwaggerUIBundle({
            url: "/openapi.json",
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
            ],
            layout: "StandaloneLayout"
        });
    };
    </script>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
    },
    body: htmlContent,
  };
};

// ===================
// OpenAPI Spec Handler
// ===================

export const openapi: APIGatewayProxyHandlerV2 = async (): Promise<APIGatewayProxyResultV2> => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Allow CORS for local dev testing if needed
    },
    body: JSON.stringify(SPEC),
  };
};

// Inlined Spec to avoid runtime file reads and bundling issues
const SPEC = {
  "openapi": "3.0.0",
  "info": {
    "title": "PropIntel API",
    "description": "AEO/LLMEO/SEO Crawler and Analysis API.",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://{apiId}.execute-api.us-west-2.amazonaws.com",
      "description": "Production API",
      "variables": {
        "apiId": {
          "default": "wy3hcfsec6",
          "description": "The ID of your API Gateway"
        }
      }
    }
  ],
  "security": [
    {
      "ApiKeyAuth": []
    }
  ],
  "paths": {
    "/jobs": {
      "post": {
        "summary": "Create a new crawl job",
        "operationId": "createJob",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateJobRequest"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Job created successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "job": {
                          "$ref": "#/components/schemas/Job"
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/BadRequest"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "429": {
            "$ref": "#/components/responses/TooManyRequests"
          }
        }
      },
      "get": {
        "summary": "List jobs",
        "operationId": "listJobs",
        "parameters": [
          {
            "name": "limit",
            "in": "query",
            "schema": {
              "type": "integer",
              "default": 20
            }
          },
          {
            "name": "lastKey",
            "in": "query",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "List of jobs",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": { "type": "boolean", "example": true },
                    "data": {
                      "type": "object",
                      "properties": {
                        "jobs": { "type": "array", "items": { "$ref": "#/components/schemas/Job" } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/jobs/{id}": {
      "get": {
        "summary": "Get job status",
        "operationId": "getJob",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Job details",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "job": {
                          "$ref": "#/components/schemas/Job"
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/jobs/{id}/report": {
      "get": {
        "summary": "Get analysis report",
        "operationId": "getReport",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          },
          {
            "name": "format",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "json",
                "md"
              ],
              "default": "json"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Analysis report",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Report"
                }
              },
              "text/markdown": {
                "schema": {
                  "type": "string"
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/health": {
      "get": {
        "summary": "Health check",
        "operationId": "healthCheck",
        "security": [],
        "responses": {
          "200": {
            "description": "API is healthy",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status": {
                      "type": "string",
                      "example": "healthy"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "ApiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "X-Api-Key"
      }
    },
    "responses": {
      "BadRequest": {
        "description": "Invalid request",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Error"
            }
          }
        }
      },
      "Unauthorized": {
        "description": "Missing or invalid API key",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Error"
            }
          }
        }
      },
      "NotFound": {
        "description": "Resource not found",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Error"
            }
          }
        }
      },
      "TooManyRequests": {
        "description": "Rate limit exceeded",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Error"
            }
          }
        }
      }
    },
    "schemas": {
      "Error": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean",
            "example": false
          },
          "error": {
            "type": "object",
            "properties": {
              "code": {
                "type": "string"
              },
              "message": {
                "type": "string"
              }
            }
          }
        }
      },
      "CreateJobRequest": {
        "type": "object",
        "required": [
          "targetUrl"
        ],
        "properties": {
          "targetUrl": {
            "type": "string",
            "format": "uri",
            "example": "https://example.com"
          },
          "config": {
            "$ref": "#/components/schemas/CrawlConfig"
          },
          "competitors": {
            "type": "array",
            "items": {
              "type": "string",
              "format": "uri"
            }
          },
          "authConfig": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "enum": [
                  "basic",
                  "cookie"
                ]
              },
              "credentials": {
                "type": "object",
                "additionalProperties": {
                  "type": "string"
                }
              }
            }
          }
        }
      },
      "CrawlConfig": {
        "type": "object",
        "properties": {
          "maxPages": {
            "type": "integer",
            "default": 50
          },
          "maxDepth": {
            "type": "integer",
            "default": 3
          },
          "pageTimeout": {
            "type": "integer",
            "default": 30000
          }
        }
      },
      "Job": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "status": {
            "type": "string",
            "enum": [
              "pending",
              "queued",
              "crawling",
              "analyzing",
              "completed",
              "failed",
              "blocked"
            ]
          },
          "targetUrl": {
            "type": "string"
          },
          "progress": {
            "type": "object",
            "properties": {
              "pagesCrawled": {
                "type": "integer"
              },
              "pagesTotal": {
                "type": "integer"
              },
              "currentPhase": {
                "type": "string"
              }
            }
          }
        }
      },
      "Report": {
        "type": "object",
        "properties": {
          "meta": {
            "type": "object",
            "properties": {
              "jobId": {
                "type": "string"
              },
              "domain": {
                "type": "string"
              }
            }
          },
          "scores": {
            "type": "object",
            "properties": {
              "aeoVisibilityScore": {
                "type": "integer",
                "description": "0-100 AEO Visibility"
              },
              "llmeoScore": {
                "type": "integer",
                "description": "0-100 LLMEO Score"
              },
              "seoScore": {
                "type": "integer",
                "description": "0-100 SEO Score"
              },
              "overallScore": {
                "type": "integer",
                "description": "Weighted interaction"
              }
            }
          },
          "aeoAnalysis": {
            "type": "object",
            "properties": {
              "visibilityScore": {
                "type": "integer"
              },
              "citationRate": {
                "type": "number"
              },
              "gaps": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "query": {
                      "type": "string"
                    },
                    "winningDomain": {
                      "type": "string"
                    },
                    "suggestedAction": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "recommendations": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Recommendation"
            }
          }
        }
      },
      "Recommendation": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "priority": {
            "type": "string",
            "enum": [
              "high",
              "medium",
              "low"
            ]
          },
          "category": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "impact": {
            "type": "string"
          },
          "codeSnippet": {
            "type": "string"
          }
        }
      }
    }
  }
};
