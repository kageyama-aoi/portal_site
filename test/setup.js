// test/setup.js
// Jestのテスト環境全体でTextEncoderとTextDecoderをグローバルに定義する

const { TextEncoder, TextDecoder } = require('util');

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// その他のグローバルなセットアップもここに追加できます
