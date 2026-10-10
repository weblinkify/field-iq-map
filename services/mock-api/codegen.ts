import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: '../../shared/graphql/schema.graphqls',
  generates: {
    'src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        strictScalars: true,
        scalars: { DateTime: { input: 'Date', output: 'Date' } },
        mappers: {
          Sensor: '../domain/model.js#SensorModel',
          Site: '../domain/model.js#SiteModel',
          Alert: '../domain/model.js#AlertModel',
        },
      },
    },
  },
  hooks: { afterAllFileWrite: ['prettier --write'] },
};

export default config;
