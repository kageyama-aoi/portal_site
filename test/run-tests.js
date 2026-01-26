// test/run-tests.js
import { dataManagerTests } from './dataManager.test.js';
import { uiTests } from './ui.test.js';

const resultsList = document.getElementById('results');
const summaryDiv = document.getElementById('summary');
let totalTests = 0;
let passedTests = 0;

// シンプルなアサーション関数
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// テストスイートを実行する関数
function runTestSuite({ name, fn }) {
  const tests = [];
  let beforeEachFn = () => {};

  const testCollector = (test) => {
    tests.push(test);
  };
  
  const beforeEachCollector = (fn) => {
    beforeEachFn = fn;
  };

  // テスト定義関数を呼び出して、テストケースを収集
  fn({ 
    test: testCollector, 
    assert,
    beforeEach: beforeEachCollector
  });
  
  const groupLi = document.createElement('li');
  groupLi.innerHTML = `<h3>${name}</h3>`;
  resultsList.appendChild(groupLi);

  // 収集したテストを実行
  tests.forEach(testCase => {
    totalTests++;
    const li = document.createElement('li');
    li.className = 'test-case';
    try {
      beforeEachFn(); // 各テストの前にsetupを実行
      testCase.fn();
      li.classList.add('pass');
      li.textContent = `✅ PASS: ${testCase.name}`;
      passedTests++;
    } catch (e) {
      li.classList.add('fail');
      li.innerHTML = `
        <div class="summary">❌ FAIL: ${testCase.name}</div>
        <div class="error">${e.stack || e.message}</div>
      `;
    }
    resultsList.appendChild(li);
  });
}

// すべてのテストスイートを実行
function runAllTests() {
  const allTests = [dataManagerTests, uiTests];
  allTests.forEach(runTestSuite);

  // 最終結果を表示
  summaryDiv.textContent = `Complete: ${passedTests} / ${totalTests} passed.`;
  summaryDiv.className = `summary ${passedTests === totalTests ? 'pass' : 'fail'}`;
  
  // UIテストで表示したかもしれないDOMを非表示に戻す
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    appRoot.style.display = 'none';
  }
}

// 実行開始
runAllTests();