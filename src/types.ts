export type CLILambdaOptions = {
    key: string,
    host: string,
    output: string,
}

export type CLIThemeOptions = CLILambdaOptions & {
    input: string,
    types: ThemeTemplateType[]
}

export type LambdaOptions = {
    apiKey: string,
    host: string,
    output: string,
}

export type ThemeOptions = LambdaOptions & {
    input: string,
    types: ThemeTemplateType[]
}

export const themeTemplateTypes = ['templates', 'messages', 'stylesheet'] as const;
export type ThemeTemplateType = typeof themeTemplateTypes[number];
