export const config = {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-prod',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',

    // ── WhatsApp (Meta Cloud API) ──────────────────────────
    metaWaToken: process.env.META_WA_TOKEN ?? '',
    metaPhoneNumberId: process.env.META_WA_PHONE_NUMBER_ID ?? '',
    metaVerifyToken: process.env.META_WA_VERIFY_TOKEN ?? 'matchnetwork_verify',
    metaAppSecret: process.env.META_APP_SECRET ?? '',   // for payload verification later

    // ── SMS (Generic HTTP Gateway) ────────────────────────
    smsGatewayUrl: process.env.SMS_GATEWAY_URL ?? '',
    smsApiKey: process.env.SMS_API_KEY ?? '',
    smsSenderId: process.env.SMS_SENDER_ID ?? 'MATCHNET',
};