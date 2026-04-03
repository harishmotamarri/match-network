import redis from '../cache/redis';

const OTP_TTL_SECONDS = 300; // 5 minutes
const MAX_ATTEMPTS = 3;

export const generateOtp = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const saveOtp = async (phone: string, otp: string): Promise<void> => {
    await redis.setex(`otp:${phone}`, OTP_TTL_SECONDS, otp);
    await redis.setex(`otp_attempts:${phone}`, OTP_TTL_SECONDS, '0');
};

export const verifyOtp = async (
    phone: string,
    inputOtp: string
): Promise<{ valid: boolean; reason?: string }> => {
    const attempts = parseInt((await redis.get(`otp_attempts:${phone}`)) || '0');

    if (attempts >= MAX_ATTEMPTS) {
        await redis.del(`otp:${phone}`, `otp_attempts:${phone}`);
        return { valid: false, reason: 'Too many attempts. Request a new OTP.' };
    }

    const storedOtp = await redis.get(`otp:${phone}`);

    if (!storedOtp) {
        return { valid: false, reason: 'OTP expired or not found.' };
    }

    if (storedOtp !== inputOtp) {
        await redis.incr(`otp_attempts:${phone}`);
        return { valid: false, reason: 'Invalid OTP.' };
    }

    // OTP is correct — clean up
    await redis.del(`otp:${phone}`, `otp_attempts:${phone}`);
    return { valid: true };
};