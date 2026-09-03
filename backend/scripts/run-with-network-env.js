const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    parsed[key] = value;
  }

  return parsed;
}

function shouldUseProxy(mode, nodeEnv) {
  return mode === 'on' || (mode === 'development' && nodeEnv === 'development');
}

const backendRoot = path.resolve(__dirname, '..');
const envFilePath = path.join(backendRoot, '.env');
const fileEnv = loadEnvFile(envFilePath);
const mergedEnv = {
  ...process.env,
  ...fileEnv,
};

const nodeEnv = mergedEnv.NODE_ENV || 'development';
const proxyMode = mergedEnv.OUTBOUND_PROXY_MODE || 'off';
const proxyUrl = mergedEnv.OUTBOUND_PROXY_URL || '';
const noProxy = mergedEnv.OUTBOUND_NO_PROXY || '127.0.0.1,localhost';

if (shouldUseProxy(proxyMode, nodeEnv) && proxyUrl) {
  mergedEnv.HTTP_PROXY = proxyUrl;
  mergedEnv.HTTPS_PROXY = proxyUrl;
  mergedEnv.ALL_PROXY = proxyUrl;
  mergedEnv.NO_PROXY = noProxy;
  mergedEnv.NODE_USE_ENV_PROXY = '1';
  console.log(
    `[network] outbound proxy enabled. mode=${proxyMode} env=${nodeEnv} proxy=${proxyUrl}`,
  );
} else {
  console.log(`[network] outbound proxy disabled. mode=${proxyMode} env=${nodeEnv}`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('[network] missing command to run');
  process.exit(1);
}

const child = spawn(args[0], args.slice(1), {
  cwd: backendRoot,
  env: mergedEnv,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
