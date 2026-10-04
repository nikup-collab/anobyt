// Question text + test cases (client side). Points live in backend/src/tests.mjs.
export const TESTS = {
  'js-basics-1': {
    title: 'JavaScript Basics',
    blurb: '3 short problems, 20 minutes. Write plain JavaScript functions.',
    durationSec: 20 * 60,
    questions: [
      {
        id: 'sum', title: 'Sum of an array', points: 30, fn: 'sumArray',
        prompt: 'Return the sum of all numbers in the array. An empty array returns 0.',
        starter: 'function sumArray(nums) {\n  // your code\n}',
        cases: [
          { input: [[1, 2, 3]], expected: 6 },
          { input: [[]], expected: 0 },
          { input: [[-5, 5, 10]], expected: 10 },
          { input: [[100]], expected: 100 },
        ],
      },
      {
        id: 'reverse', title: 'Reverse a string', points: 30, fn: 'reverseString',
        prompt: 'Return the string reversed.',
        starter: 'function reverseString(s) {\n  // your code\n}',
        cases: [
          { input: ['abc'], expected: 'cba' },
          { input: [''], expected: '' },
          { input: ['a'], expected: 'a' },
          { input: ['Anobyt'], expected: 'tybonA' },
        ],
      },
      {
        id: 'fizzbuzz', title: 'FizzBuzz', points: 40, fn: 'fizzBuzz',
        prompt: 'For a number n, return an array of strings for 1..n: "Fizz" for multiples of 3, "Buzz" for 5, "FizzBuzz" for both, otherwise the number as a string.',
        starter: 'function fizzBuzz(n) {\n  // your code\n}',
        cases: [
          { input: [3], expected: ['1', '2', 'Fizz'] },
          { input: [5], expected: ['1', '2', 'Fizz', '4', 'Buzz'] },
          { input: [15], expected: ['1','2','Fizz','4','Buzz','Fizz','7','8','Fizz','Buzz','11','Fizz','13','14','FizzBuzz'] },
          { input: [1], expected: ['1'] },
        ],
      },
    ],
  },
};
