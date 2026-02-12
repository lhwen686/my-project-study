export type TemplateKind = 'none' | 'anatomy' | 'biochem' | 'custom';

export type TemplatePreview = { front: string; back: string };

export const ANATOMY_FIELDS = ['结构名', '位置', '支配', '血供', '临床要点'] as const;
export const BIOCHEM_FIELDS = ['通路步骤', '限速酶', '调控', '抑制剂', '相关疾病'] as const;

export function getTemplateFields(kind: TemplateKind, customFieldsText = ''): string[] {
  if (kind === 'anatomy') return [...ANATOMY_FIELDS];
  if (kind === 'biochem') return [...BIOCHEM_FIELDS];
  if (kind === 'custom') {
    return customFieldsText
      .split(/[;,，]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

export function buildTemplatePreview(kind: TemplateKind, fields: string[], values: Record<string, string>): TemplatePreview {
  if (kind === 'none') return { front: '', back: '' };

  if (kind === 'anatomy') {
    const title = values['结构名']?.trim() || '未命名结构';
    return {
      front: `解剖模板｜${title}`,
      back: `结构名：${values['结构名'] || '-'}\n位置：${values['位置'] || '-'}\n支配：${values['支配'] || '-'}\n血供：${values['血供'] || '-'}\n临床要点：${values['临床要点'] || '-'}`,
    };
  }

  if (kind === 'biochem') {
    const pathway = values['通路步骤']?.trim() || '未命名通路';
    return {
      front: `生化模板｜${pathway}`,
      back: `通路步骤：${values['通路步骤'] || '-'}\n限速酶：${values['限速酶'] || '-'}\n调控：${values['调控'] || '-'}\n抑制剂：${values['抑制剂'] || '-'}\n相关疾病：${values['相关疾病'] || '-'}`,
    };
  }

  const effectiveFields = fields.length > 0 ? fields : ['问题', '答案'];
  const first = values[effectiveFields[0]]?.trim() || '自定义模板';
  return {
    front: `自定义模板｜${first}`,
    back: effectiveFields.map((field) => `${field}：${values[field] || '-'}`).join('\n'),
  };
}
