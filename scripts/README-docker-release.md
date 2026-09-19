# Backend and frontend Docker update

This workflow updates only `aiexcel-backend:latest` and `aiexcel-frontend:latest`.

## Build on Windows

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-docker-release.ps1
```

The script defaults to `https://registry.npmmirror.com` for more reliable Docker builds in China. To use the official registry:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-docker-release.ps1 -NpmRegistry https://registry.npmjs.org
```

By default npm traffic inside the build container uses the host proxy at `host.docker.internal:7890`. Disable it when no local proxy is running:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-docker-release.ps1 -NpmProxy ""
```

Output:

```text
release/aiexcel-app-<timestamp>/
  aiexcel-app-images.tar
  deploy-app-images.sh
  MANIFEST.txt
  SHA256SUMS
```

The default target is `linux/amd64`. Use `-Platform linux/arm64` only for an ARM64 production server.

## Update production

Upload the generated files into the production project directory:

```bash
chmod +x deploy-app-images.sh
./deploy-app-images.sh ./docker-compose.prod.yml
```

Older release bundles created on Windows may contain CRLF in `SHA256SUMS`. Fix such a bundle once with:

```bash
sed -i 's/\r$//' SHA256SUMS
```

Manual equivalent:

```bash
sha256sum --check SHA256SUMS
docker load -i aiexcel-app-images.tar
docker compose -f docker-compose.prod.yml run --rm --no-deps backend npm run prisma:migrate:deploy --workspace backend
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate backend frontend
docker compose -f docker-compose.prod.yml ps backend frontend
```

Production ports remain `3210:3000` for backend and `3211:3001` for frontend. Local frontend development remains on port `3002`.
