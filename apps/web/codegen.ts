import type { CodegenConfig } from '@graphql-codegen/cli';

/** Frontend API types are generated, never hand-written (CI fails if this output drifts). */
const config: CodegenConfig = {
  schema: '../../shared/graphql/schema.graphqls',
  documents: 'src/app/**/*.graphql',
  generates: {
    'src/app/api/generated/graphql.ts': {
      plugins: ['typescript-operations', 'typescript-apollo-angular'],
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        strictScalars: true,
        scalars: { DateTime: 'string' },
        addExplicitOverride: true,
      },
    },
  },
  hooks: { afterAllFileWrite: ['prettier --write'] },
};

export default config;
