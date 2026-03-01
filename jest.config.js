// jest.config.js
module.exports = {
  // すべてのテストファイルをCommonJSとして扱うデフォルトの動作を変更し、
  // 特定のファイル拡張子をES Modulesとして扱うようにJestに指示します。
  // これにより、import/export構文が認識されるようになります。
  extensionsToTreatAsEsm: ['.jsx', '.ts', '.tsx'],
  
  // Jestがテストファイルと依存関係を変換する方法を定義します。
  // *.jsファイルをbabel-jestを使って変換するように設定することで、
  // ES Modules構文や他のモダンなJavaScript構文がJestで認識されるようになります。
  transform: {
    '^.+\.js$': 'babel-jest',
  },
  
  // import.meta.url を使用している場合に、Node.jsの__dirname/__filenameのような挙動をエミュレートするために
  // JSDOM環境では必要となる可能性があります。
  // 現状はテストファイル内で直接パスを解決しているので、この設定は不要かもしれませんが、
  // より堅牢な設定として含めておきます。
  // ただし、ui.test.jsでfs.readFileSyncを使用しているため、Node.js環境での実行を前提としています。
  testEnvironment: 'jsdom',
  setupFiles: ['./test/setup.js'],
  
  // モジュール解決のエイリアスなどを設定する場合
  // moduleNameMapper: {
  //   '^@/(.*)$': '<rootDir>/src/$1',
  // },
};
