import {
  normalizeWorkflowContent,
  workflowContentHash,
  verificationCode,
  ensureVersionFields,
  bumpRevIfContentChanged
} from '../js/workflowVersion.js';

function wf(overrides = {}) {
  return {
    id: 'wf_1',
    title: 'テストフロー',
    description: '説明',
    freq: 'rare',
    tags: ['a'],
    steps: [
      { step: 1, title: 'ステップ1', memo: '', prompt: '', promptType: 'none', linkId: null }
    ],
    ...overrides
  };
}

describe('workflowContentHash / normalizeWorkflowContent', () => {
  test('同じ内容なら同じハッシュ、8文字の英数字', () => {
    const h1 = workflowContentHash(wf());
    const h2 = workflowContentHash(wf());
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-z0-9]{8}$/);
  });

  test('freq / tags を変えてもハッシュは変わらない', () => {
    const base = workflowContentHash(wf());
    expect(workflowContentHash(wf({ freq: 'daily' }))).toBe(base);
    expect(workflowContentHash(wf({ tags: ['x', 'y', 'z'] }))).toBe(base);
  });

  test('title / description / steps を変えるとハッシュが変わる', () => {
    const base = workflowContentHash(wf());
    expect(workflowContentHash(wf({ title: '別タイトル' }))).not.toBe(base);
    expect(workflowContentHash(wf({ description: '別の説明' }))).not.toBe(base);
    expect(workflowContentHash(wf({
      steps: [{ step: 1, title: '変更', memo: '', prompt: '', promptType: 'none', linkId: null }]
    }))).not.toBe(base);
  });

  test('ステップの並べ替えでハッシュが変わる', () => {
    const a = wf({ steps: [
      { step: 1, title: 'A', memo: '', prompt: '', promptType: 'none', linkId: null },
      { step: 2, title: 'B', memo: '', prompt: '', promptType: 'none', linkId: null }
    ] });
    const b = wf({ steps: [
      { step: 1, title: 'B', memo: '', prompt: '', promptType: 'none', linkId: null },
      { step: 2, title: 'A', memo: '', prompt: '', promptType: 'none', linkId: null }
    ] });
    expect(workflowContentHash(a)).not.toBe(workflowContentHash(b));
  });
});

describe('verificationCode', () => {
  test('R{rev}-{MMDD}-{4文字} 形式で、16進8桁は含まない', () => {
    const code = verificationCode(3, 'abcd1234', '2026-08-27T00:00:00Z');
    expect(code).toMatch(/^R3-\d{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  test('rev と hash が同じなら安定、違えば変わる', () => {
    const c1 = verificationCode(3, 'abcd1234', '2026-08-27');
    const c2 = verificationCode(3, 'abcd1234', '2026-08-27');
    const c3 = verificationCode(4, 'abcd1234', '2026-08-27');
    expect(c1).toBe(c2);
    expect(c1).not.toBe(c3);
  });

  test('rev 未指定でも 1 として扱う', () => {
    expect(verificationCode(undefined, 'x')).toMatch(/^R1-/);
  });
});

describe('ensureVersionFields', () => {
  test('rev 無しなら rev:1 / updatedAt / contentHash を補完し true を返す', () => {
    const w = wf();
    delete w.rev;
    expect(ensureVersionFields(w, '2026-01-01T00:00:00Z')).toBe(true);
    expect(w.rev).toBe(1);
    expect(w.updatedAt).toBe('2026-01-01T00:00:00Z');
    expect(w.contentHash).toMatch(/^[a-z0-9]{8}$/);
  });

  test('すべて揃っていれば false（冪等）', () => {
    const w = wf();
    ensureVersionFields(w);
    expect(ensureVersionFields(w)).toBe(false);
  });
});

describe('bumpRevIfContentChanged', () => {
  test('初回（contentHash 未設定）は rev を上げずハッシュだけ記録', () => {
    const w = wf();
    delete w.contentHash;
    w.rev = 1;
    expect(bumpRevIfContentChanged(w)).toBe(false);
    expect(w.rev).toBe(1);
    expect(w.contentHash).toMatch(/^[a-z0-9]{8}$/);
  });

  test('内容が変わっていなければ rev 据え置き', () => {
    const w = wf();
    ensureVersionFields(w);
    expect(bumpRevIfContentChanged(w)).toBe(false);
    expect(w.rev).toBe(1);
  });

  test('内容が変わったら rev+1・updatedAt 更新', () => {
    const w = wf();
    ensureVersionFields(w);
    w.steps.push({ step: 2, title: '追加', memo: '', prompt: '', promptType: 'none', linkId: null });
    const changed = bumpRevIfContentChanged(w, '2026-09-01T00:00:00Z');
    expect(changed).toBe(true);
    expect(w.rev).toBe(2);
    expect(w.updatedAt).toBe('2026-09-01T00:00:00Z');
  });

  test('freq だけ変えても rev は上がらない', () => {
    const w = wf();
    ensureVersionFields(w);
    w.freq = 'daily';
    expect(bumpRevIfContentChanged(w)).toBe(false);
    expect(w.rev).toBe(1);
  });
});
