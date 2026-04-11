import redis from '../../shared/cache/redis';

export type BotState =
    | 'IDLE'
    | 'AWAITING_NAME'
    | 'AWAITING_OTP'
    | 'MAIN_MENU'
    | 'AWAITING_MATCH_SKILLS'
    | 'AWAITING_CONNECTION_TYPE'
    | 'AWAITING_CONNECTION_NOTE'
    | 'AWAITING_RESPOND_CHOICE'
    | 'AWAITING_AVAILABILITY'
    // ── NEW: profile setup flow ──────────────────
    | 'PROFILE_SETUP_EXPERIENCE'
    | 'PROFILE_SETUP_SKILLS'
    | 'PROFILE_SETUP_LOCATION'
    | 'PROFILE_SETUP_AVAILABILITY'
    // ── NEW: connection management ───────────────
    | 'AWAITING_CONNECTION_ACTION_PICK'
    | 'AWAITING_CONNECTION_ACTION'
    | 'AWAITING_RESPOND_MESSAGE'
    // ── NEW: Find Teammates ──────────────────────
    | 'TEAMMATE_HUB'
    | 'TEAMMATE_POST_TITLE'
    | 'TEAMMATE_POST_DESC'
    | 'TEAMMATE_POST_SKILLS'
    | 'TEAMMATE_POST_CONFIRM'
    | 'TEAMMATE_BROWSE_PICK'
    | 'TEAMMATE_DETAIL_ACTION'
    | 'TEAMMATE_APPLICATION_PICK'
    | 'TEAMMATE_APPLICATION_ACTION'
    | 'CHATTING';

export interface BotSession {
    state: BotState;
    userId?: string;
    phoneNumber: string;
    tempData?: Record<string, any>;
}

const SESSION_TTL = 60 * 30; // 30 minutes

export class SessionManager {
    private key(phone: string) {
        return `wa:session:${phone}`;
    }

    async get(phone: string): Promise<BotSession> {
        const raw = await redis.get(this.key(phone));
        if (raw) return JSON.parse(raw);
        return { state: 'IDLE', phoneNumber: phone };
    }

    async set(session: BotSession): Promise<void> {
        await redis.setex(this.key(session.phoneNumber), SESSION_TTL, JSON.stringify(session));
    }

    async clear(phone: string): Promise<void> {
        await redis.del(this.key(phone));
    }

    async patch(phone: string, updates: Partial<BotSession>): Promise<BotSession> {
        const session = await this.get(phone);
        const updated = { ...session, ...updates };
        await this.set(updated);
        return updated;
    }
}

export const sessionManager = new SessionManager();