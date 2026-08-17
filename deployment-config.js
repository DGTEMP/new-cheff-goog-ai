const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DEPLOY_MODE = (process.env.DEPLOY_MODE || 'cloud').toLowerCase();
const SUPER_ADMIN_URL = (process.env.SUPER_ADMIN_URL || '').replace(/\/+$/, '');
const INSTANCE_SECRET = process.env.INSTANCE_SECRET || '';

let _instanceSecret = INSTANCE_SECRET;

function loadOrCreateSecret() {
  const secretPath = path.join(__dirname, '.instance-secret');
  if (_instanceSecret) return _instanceSecret;
  try {
    if (fs.existsSync(secretPath)) {
      _instanceSecret = fs.readFileSync(secretPath, 'utf8').trim();
      if (_instanceSecret) return _instanceSecret;
    }
  } catch (e) {}
  _instanceSecret = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(secretPath, _instanceSecret, 'utf8');
  } catch (e) {
    console.error('[Deployment] Não foi possível salvar .instance-secret:', e.message);
  }
  return _instanceSecret;
}

function loadOrCreateVersion() {
  const pkgPath = path.join(__dirname, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || '1.0.0';
  } catch (e) {
    return '1.0.0';
  }
}

const instanceSecret = loadOrCreateSecret();
const softwareVersion = loadOrCreateVersion();

module.exports = {
  isOnPremise: () => DEPLOY_MODE === 'on-premise',
  isCloud: () => DEPLOY_MODE === 'cloud',
  getDeployMode: () => DEPLOY_MODE,
  getSuperAdminUrl: () => SUPER_ADMIN_URL,
  getInstanceSecret: () => instanceSecret,
  getSoftwareVersion: () => softwareVersion,
  DEPLOY_MODE,
  SUPER_ADMIN_URL
};
