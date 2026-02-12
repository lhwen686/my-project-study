import { describe, expect, it } from 'vitest';

import { buildTemplatePreview, getTemplateFields } from './templates';

describe('template card helpers', () => {
  it('builds anatomy preview', () => {
    const fields = getTemplateFields('anatomy');
    const preview = buildTemplatePreview('anatomy', fields, {
      结构名: '海马',
      位置: '颞叶内侧',
      支配: '边缘系统',
      血供: '后大脑动脉分支',
      临床要点: '与记忆形成相关',
    });

    expect(preview.front).toContain('海马');
    expect(preview.back).toContain('临床要点');
  });

  it('builds biochem preview', () => {
    const fields = getTemplateFields('biochem');
    const preview = buildTemplatePreview('biochem', fields, {
      通路步骤: '糖酵解',
      限速酶: 'PFK-1',
    });

    expect(preview.front).toContain('糖酵解');
    expect(preview.back).toContain('PFK-1');
  });

  it('parses custom fields and builds custom preview', () => {
    const fields = getTemplateFields('custom', '字段A,字段B;字段C');
    const preview = buildTemplatePreview('custom', fields, { 字段A: '值A' });

    expect(fields).toEqual(['字段A', '字段B', '字段C']);
    expect(preview.front).toContain('值A');
    expect(preview.back).toContain('字段B');
  });
});
