/**
 * User test fixtures
 */

import { faker } from '@faker-js/faker';

export function createUserFixture(overrides?: {
  email?: string;
  name?: string;
  password?: string;
}) {
  return {
    email: overrides?.email || faker.internet.email(),
    name: overrides?.name || faker.person.fullName(),
    password: overrides?.password || faker.internet.password({ length: 12 }),
  };
}

export function createUserFixtures(count: number) {
  return Array.from({ length: count }, () => createUserFixture());
}
