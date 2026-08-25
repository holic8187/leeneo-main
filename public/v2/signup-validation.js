'use strict';

(function registerSignupValidation(root) {
  const MIN_PASSWORD_LENGTH = 6;
  const MAX_PASSWORD_LENGTH = 72;

  function normalizePasswordInput(value = '') {
    return String(value).normalize('NFC');
  }

  function getPasswordValidationState(passwordValue = '', confirmationValue = '') {
    const password = normalizePasswordInput(passwordValue);
    const confirmation = normalizePasswordInput(confirmationValue);
    if (!password) {
      return { valid: false, message: '비밀번호를 입력해주세요.', password, confirmation };
    }
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      return {
        valid: false,
        message: `비밀번호는 ${MIN_PASSWORD_LENGTH}~${MAX_PASSWORD_LENGTH}자로 입력해주세요.`,
        password,
        confirmation
      };
    }
    if (!confirmation) {
      return {
        valid: false,
        message: '비밀번호 확인을 입력해주세요.',
        password,
        confirmation
      };
    }
    if (password !== confirmation) {
      return {
        valid: false,
        message: '비밀번호가 일치하지 않습니다.',
        password,
        confirmation
      };
    }
    return {
      valid: true,
      message: '비밀번호가 일치합니다.',
      password,
      confirmation
    };
  }

  const api = Object.freeze({
    MIN_PASSWORD_LENGTH,
    MAX_PASSWORD_LENGTH,
    normalizePasswordInput,
    getPasswordValidationState
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.V2SignupValidation = api;
}(typeof window !== 'undefined' ? window : globalThis));
