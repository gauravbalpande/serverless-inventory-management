// Copy this file to config.js and fill in your real values
// after deploying the backend stack.

window.APP_CONFIG = {
  API_BASE_URL: 'https://your-api-id.execute-api.your-region.amazonaws.com/prod',
  COGNITO_USER_POOL_ID: 'your_user_pool_id',
  COGNITO_CLIENT_ID: 'your_user_pool_client_id',
  COGNITO_REGION: 'us-east-1',
  // Required for Login (Hosted UI). Use stack output "CognitoDomain" (e.g. cloud-inventory-app.auth.us-east-1.amazoncognito.com)
  // Or set COGNITO_DOMAIN_PREFIX instead (e.g. cloud-inventory-app) and we build the domain from region.
  // COGNITO_DOMAIN: 'cloud-inventory-app.auth.us-east-1.amazoncognito.com',
  COGNITO_DOMAIN: 'inventory-login-gaurav.auth.us-east-1.amazoncognito.com'
  // COGNITO_DOMAIN_PREFIX: 'cloud-inventory-app'
};

