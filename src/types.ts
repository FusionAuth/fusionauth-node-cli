export type CLIOptions = {
    input: string,
    output: string,
    key?: string,
    host?: string,
    types: TemplateType[]
}

export type Options = {
    input: string,
    output: string,
    apiKey: string,
    host: string,
    types: TemplateType[]
}

export const templateTypes = ['templates', 'messages', 'stylesheet'] as const;
export type TemplateType = typeof templateTypes[number];
