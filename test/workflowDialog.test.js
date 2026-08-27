import { WorkflowDialog } from '../js/dialogs/workflowDialog.js';

/** テスト用のステップ配列を作る。 */
function makeSteps(titles) {
  return titles.map((title, i) => ({
    step: i + 1,
    title,
    memo: '',
    prompt: '',
    promptType: 'none',
    linkId: null
  }));
}

describe('WorkflowDialog.moveStep', () => {
  test('要素を下へ移動し step 番号を振り直す', () => {
    const steps = makeSteps(['A', 'B', 'C']);
    const moved = WorkflowDialog.moveStep(steps, 0, 2);
    expect(moved).toBe(true);
    expect(steps.map(s => s.title)).toEqual(['B', 'C', 'A']);
    expect(steps.map(s => s.step)).toEqual([1, 2, 3]);
  });

  test('要素を上へ移動する', () => {
    const steps = makeSteps(['A', 'B', 'C']);
    WorkflowDialog.moveStep(steps, 2, 0);
    expect(steps.map(s => s.title)).toEqual(['C', 'A', 'B']);
    expect(steps.map(s => s.step)).toEqual([1, 2, 3]);
  });

  test('範囲外・同一位置なら false を返し配列を変えない', () => {
    const steps = makeSteps(['A', 'B']);
    expect(WorkflowDialog.moveStep(steps, 0, 0)).toBe(false);
    expect(WorkflowDialog.moveStep(steps, 0, -1)).toBe(false);
    expect(WorkflowDialog.moveStep(steps, 0, 5)).toBe(false);
    expect(WorkflowDialog.moveStep(steps, -1, 1)).toBe(false);
    expect(steps.map(s => s.title)).toEqual(['A', 'B']);
  });
});

describe('WorkflowDialog._renderSteps 並べ替えボタン', () => {
  let dialog;
  let steps;

  beforeEach(() => {
    document.body.innerHTML = '<div id="wfStepsContainer"></div>';
    dialog = new WorkflowDialog(null, null, null, () => {});
    steps = makeSteps(['A', 'B', 'C']);
    dialog._renderSteps(steps, '');
  });

  test('先頭の▲は無効・末尾の▼は無効', () => {
    const rows = document.querySelectorAll('.wf-step-row');
    expect(rows[0].querySelector('.wf-step-move-up').disabled).toBe(true);
    expect(rows[0].querySelector('.wf-step-move-down').disabled).toBe(false);
    expect(rows[2].querySelector('.wf-step-move-down').disabled).toBe(true);
  });

  test('▼クリックで steps の順序が入れ替わり再描画される', () => {
    document.querySelectorAll('.wf-step-row')[0]
      .querySelector('.wf-step-move-down').click();
    expect(steps.map(s => s.title)).toEqual(['B', 'A', 'C']);
    expect(steps.map(s => s.step)).toEqual([1, 2, 3]);
    // 再描画後の Step ラベルも更新されている
    const nums = [...document.querySelectorAll('.wf-step-num')].map(n => n.textContent);
    expect(nums).toEqual(['Step 1', 'Step 2', 'Step 3']);
  });
});
