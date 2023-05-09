export const templateTypes = ['templates', 'messages', 'stylesheet'] as const;

export type TemplateType = typeof templateTypes[number];
