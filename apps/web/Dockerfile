FROM node:20-alpine AS builder
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY apps/web ./apps/web
ARG NEXT_PUBLIC_API_URL=http://localhost:5000/graphql
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
WORKDIR /workspace/apps/web
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=builder /workspace/package.json ./package.json
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/web ./apps/web
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@tool-doctor/web"]
