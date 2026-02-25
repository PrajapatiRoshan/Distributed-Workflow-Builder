module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'prettier',
    ],
    parserOptions: {
        project: ['./tsconfig.base.json', './services/*/tsconfig.json', './packages/*/tsconfig.json'],
        tsconfigRootDir: __dirname,
    },
    rules: {
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
    ignorePatterns: ['dist/', 'node_modules/', 'coverage/', 'frontend/'],
};
