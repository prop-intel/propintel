/**
 * AWS service mocks for testing
 */

import { vi } from "vitest";

// Mock AWS SDK clients
export const mockS3Client = {
  putObject: vi.fn(),
  getObject: vi.fn(),
  deleteObject: vi.fn(),
};

export const mockSQSClient = {
  sendMessage: vi.fn(),
  receiveMessage: vi.fn(),
  deleteMessage: vi.fn(),
};

export const mockECSClient = {
  runTask: vi.fn(),
  describeTasks: vi.fn(),
  stopTask: vi.fn(),
};

// Reset all mocks
export function resetAwsMocks() {
  mockS3Client.putObject.mockReset();
  mockS3Client.getObject.mockReset();
  mockS3Client.deleteObject.mockReset();
  mockSQSClient.sendMessage.mockReset();
  mockSQSClient.receiveMessage.mockReset();
  mockSQSClient.deleteMessage.mockReset();
  mockECSClient.runTask.mockReset();
  mockECSClient.describeTasks.mockReset();
  mockECSClient.stopTask.mockReset();
}
