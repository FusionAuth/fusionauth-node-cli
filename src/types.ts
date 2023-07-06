export type CLILambdaOptions = {
    key?: string,
    host?: string,
}

export type CLIThemeOptions = CLILambdaOptions & {
    input: string,
    output: string,
    types: TemplateType[]
}

export type LambdaOptions = {
    apiKey: string,
    host: string,
}

export type ThemeOptions = LambdaOptions & {
    input: string,
    output: string,
    types: TemplateType[]
}

export const templateTypes = ['templates', 'messages', 'stylesheet'] as const;
export type TemplateType = typeof templateTypes[number];
