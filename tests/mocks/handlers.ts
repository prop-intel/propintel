import { http, HttpResponse } from 'msw';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const handlers = [
  http.get(`${API_URL}/health`, () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_URL}/jobs`, async ({ request }) => {
    const body = await request.json() as { targetUrl: string; config?: Record<string, unknown> };
    return HttpResponse.json({
      success: true,
      data: {
        job: {
          id: 'test-job-id',
          userId: 'test-user-id',
          targetUrl: body.targetUrl,
          status: 'pending',
          config: body.config,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    }, { status: 201     });
  }),

  http.get(`${API_URL}/jobs/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        job: {
          id: params.id,
          userId: 'test-user-id',
          targetUrl: 'https://example.com',
          status: 'completed',
          progress: {
            pagesCrawled: 10,
            pagesTotal: 10,
            currentPhase: 'completed',
          },
          metrics: {
            apiCallsCount: 5,
            storageUsedBytes: 1024,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: 5000,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }),

  http.get(`${API_URL}/jobs`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        jobs: [],
        total: 0,
        limit: 20,
        offset: 0,
      },
    });
  }),

  http.get(`${API_URL}/dashboard/summary`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        overview: {
          totalJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          averageScore: 0,
        },
        recentJobs: [],
        topDomains: [],
        alerts: [],
      },
    });
  }),
];
