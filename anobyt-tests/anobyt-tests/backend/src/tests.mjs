// Server-side test config: only what is needed to validate + score a submission.
// Question text and test cases live in the frontend (src/data/tests.js).
export const TESTS = {
  'js-basics-1': {
    title: 'JavaScript Basics',
    durationSec: 20 * 60,
    questions: { sum: 30, reverse: 30, fizzbuzz: 40 }, // points per question
    // opensAt: '2026-10-10T09:00:00+05:30', closesAt: '2026-10-10T18:00:00+05:30',
  },
};
