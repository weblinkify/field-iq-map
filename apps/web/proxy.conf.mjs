// ng serve proxy: same-origin /api and /graphql like nginx does in Docker.
// API_TARGET=http://localhost:4000 for the mock API, default is the Spring Boot API.
const target = process.env.API_TARGET ?? 'http://localhost:8080';

export default {
  '/api': { target, changeOrigin: true },
  '/graphql': { target, changeOrigin: true },
};
