FROM denoland/deno:latest
ARG VERSION
# ENV DENO_DEPLOYMENT_ID=${VERSION}
ENV PORT=3000

WORKDIR /app

COPY . .
RUN deno cache main.ts

EXPOSE 3000

CMD ["run", "-A", "main.ts"]