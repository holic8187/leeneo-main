'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getPasswordValidationState
} = require('../../public/v2/signup-validation');

test('signup UI distinguishes password length from confirmation mismatch', () => {
  assert.deepEqual(
    getPasswordValidationState('1', '1'),
    {
      valid: false,
      message: '비밀번호는 6~72자로 입력해주세요.',
      password: '1',
      confirmation: '1'
    }
  );
  assert.equal(getPasswordValidationState('123456', '123456').valid, true);
  assert.equal(
    getPasswordValidationState('123456', '654321').message,
    '비밀번호가 일치하지 않습니다.'
  );
});

test('signup UI normalizes visually identical passwords before comparison', () => {
  const composed = 'café12';
  const decomposed = composed.normalize('NFD');
  assert.equal(getPasswordValidationState(composed, decomposed).valid, true);
});
