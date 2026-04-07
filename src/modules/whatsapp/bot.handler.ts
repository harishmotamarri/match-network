import prisma from '../../shared/database/prisma';
import { sessionManager, BotSession } from './session.manager';
import { MessageBuilder } from './message.builder';
import { matchingService } from '../matching/matching.service';
import { skillsService } from '../skills/skills.service';
import { userService } from '../users/user.service';
import { authService } from '../auth/auth.service';
import logger from '../../shared/logger';
import Groq from 'groq-sdk';
const CONNECTION_TYPE_MAP: Record<string, string> = {
    // Interactive list IDs (primary)
    'conn_1': 'COLLABORATION', 'conn_2': 'MENTORSHIP', 'conn_3': 'JOB',
    'conn_4': 'INTERNSHIP', 'conn_5': 'INVESTMENT', 'conn_6': 'NETWORKING',
    // Fallback text numbers
    '1': 'COLLABORATION', '2': 'MENTORSHIP', '3': 'JOB',
    '4': 'INTERNSHIP', '5': 'INVESTMENT', '6': 'NETWORKING',
};

const AVAILABILITY_MAP: Record<string, 'AVAILABLE' | 'BUSY' | 'AWAY'> = {
    // Interactive button IDs (primary)
    'avail_1': 'AVAILABLE', 'avail_2': 'BUSY', 'avail_3': 'AWAY',
    // Fallback text numbers
    '1': 'AVAILABLE', '2': 'BUSY', '3': 'AWAY',
};

const EXPERIENCE_MAP: Record<string, 'STUDENT' | 'JUNIOR' | 'MID' | 'SENIOR' | 'EXPERT'> = {
    // Interactive list IDs (primary)
    'exp_1': 'STUDENT', 'exp_2': 'JUNIOR', 'exp_3': 'MID', 'exp_4': 'SENIOR', 'exp_5': 'EXPERT',
    // Fallback text numbers
    '1': 'STUDENT', '2': 'JUNIOR', '3': 'MID', '4': 'SENIOR', '5': 'EXPERT',
};

export class BotHandler {

    async handle(phone: string, incomingMessage: string): Promise<string | any> {
        const msg = incomingMessage.trim().toLowerCase();
        const session = await sessionManager.get(phone);

        logger.info({ phone, state: session.state, msg }, 'WA message received');

        if (session.userId) {
            const user = await prisma.user.findUnique({
                where: { id: session.userId },
                select: { isActive: true }
            });
            if (user && !user.isActive) {
                return `🚫 Your account is currently suspended. Please contact support.`;
            }
        }

        try {
            return await this.route(session, msg, phone);
        } catch (err: any) {
            logger.error({ err, phone }, 'Bot handler error');
            return `❌ ${err.message || 'Something went wrong. Please try again.'}`;
        }
    }

    private async route(session: BotSession, msg: string, phone: string): Promise<string | any> {

        // ── GLOBAL ESCAPES — work from ANY state ─────────────────────────────────
        if (['menu', 'home', 'hi', 'hello', 'hey'].includes(msg)) {
            if (session.userId) return this.goToMenu(session);
            return this.handleIdle(session, phone, msg);
        }

        if (msg === 'cancel' || msg === '0') {
            if (session.userId) return this.goToMenu(session);
            return this.handleIdle(session, phone, msg);
        }

        if (msg === 'help') return this.helpMessage();

        // ── ADMIN COMMANDS ────────────────────────────────────────────────────────
        if (msg.startsWith('admin') && session.userId) {
            const user = await prisma.user.findUnique({
                where: { id: session.userId },
                select: { role: true },
            });
            if (user?.role === 'ADMIN') {
                return this.handleAdminCommand(session, msg);
            }
        }

        // ── STATE MACHINE ─────────────────────────────────────────────────────────
        switch (session.state) {
            case 'IDLE': return this.handleIdle(session, phone, msg);
            case 'AWAITING_NAME': return this.handleName(session, msg);
            case 'AWAITING_OTP': return this.handleOtp(session, msg);
            case 'MAIN_MENU': return this.handleMainMenu(session, msg);
            case 'AWAITING_MATCH_SKILLS': return this.handleMatchSkillSelection(session, msg);
            case 'AWAITING_CONNECTION_TYPE': return this.handleConnectionType(session, msg);
            case 'AWAITING_CONNECTION_NOTE': return this.handleConnectionNote(session, msg);
            case 'AWAITING_RESPOND_CHOICE': return this.handleRespondChoice(session, msg);
            case 'AWAITING_AVAILABILITY': return this.handleAvailability(session, msg);
            case 'PROFILE_SETUP_EXPERIENCE': return this.handleProfileExperience(session, msg);
            case 'PROFILE_SETUP_SKILLS': return this.handleProfileSkills(session, msg);
            case 'PROFILE_SETUP_LOCATION': return this.handleProfileLocation(session, msg);
            case 'PROFILE_SETUP_AVAILABILITY': return this.handleProfileAvailability(session, msg);
            default: return this.goToMenu(session);
        }
    }

    // ── IDLE ──────────────────────────────────────────────────────────────────
    private async handleIdle(session: BotSession, phone: string, _msg: string): Promise<string | any> {
        const existing = await prisma.user.findUnique({ where: { phoneNumber: phone } });

        if (existing) {
            await authService.sendOtp(phone);
            await sessionManager.patch(phone, {
                state: 'AWAITING_OTP',
                tempData: { phoneNumber: phone, isExisting: true },
            });
            return MessageBuilder.otpSent(phone);
        }

        await sessionManager.patch(phone, { state: 'AWAITING_NAME' });
        return MessageBuilder.welcome();
    }

    // ── NEW USER: collect name ────────────────────────────────────────────────
    private async handleName(session: BotSession, msg: string): Promise<string> {
        if (msg.length < 2 || msg.length > 100) {
            return `Please enter a valid name (2–100 characters):`;
        }

        const phone = session.phoneNumber;
        await authService.sendOtp(phone);

        await sessionManager.patch(phone, {
            state: 'AWAITING_OTP',
            tempData: { name: msg, phoneNumber: phone, isExisting: false },
        });

        return MessageBuilder.otpSent(phone);
    }

    // ── OTP ───────────────────────────────────────────────────────────────────
    // ── UPDATED: new users go to profile setup, existing go to menu ──────────
    private async handleOtp(session: BotSession, msg: string): Promise<string> {
        const { name, phoneNumber, isExisting } = session.tempData ?? {};

        try {
            const { user, isNewUser } = await authService.verifyOtpAndLogin(
                phoneNumber,
                msg,
                isExisting ? undefined : name
            );

            if (isNewUser) {
                // Route new users into profile setup
                await sessionManager.patch(session.phoneNumber, {
                    state: 'PROFILE_SETUP_EXPERIENCE',
                    userId: user.id,
                    tempData: {
                        userName: user.name,
                    },
                });

                return MessageBuilder.profileSetupWelcome(user.name);
            }

            // Existing users go straight to menu
            await sessionManager.patch(session.phoneNumber, {
                state: 'MAIN_MENU',
                userId: user.id,
                tempData: {},
            });

            return MessageBuilder.welcome(user.name);
        } catch {
            return `❌ Invalid or expired code. Try again, or type *menu* to restart.`;
        }
    }
    // ── END UPDATED ───────────────────────────────────────────────────────────

    // ── MAIN MENU ─────────────────────────────────────────────────────────────
    // ── UPDATED: added case '5' for Edit Profile ──────────────────────────────
    private async handleMainMenu(session: BotSession, msg: string): Promise<string | any> {
        switch (msg) {
            case '1': return this.startFindMatches(session);
            case '2': return this.showMyConnections(session);
            case '3': return this.showPendingRequests(session);
            case '4': return this.startUpdateAvailability(session);
            case '5': return this.startEditProfile(session);  // ← NEW
            default:
                if (session.userId) {
                    return this.handleAiChat(session, msg);
                }
                return this.goToMenu(session);
        }
    }
    // ── END UPDATED ───────────────────────────────────────────────────────────

    // ── NEW: PROFILE SETUP FLOW ───────────────────────────────────────────────

    private async startEditProfile(session: BotSession): Promise<string | any> {
        const allSkills = await skillsService.getAllSkills();

        await sessionManager.patch(session.phoneNumber, {
            state: 'PROFILE_SETUP_EXPERIENCE',
            tempData: { allSkills, isEditing: true },
        });

        return MessageBuilder.askExperienceLevel();
    }

    private async handleProfileExperience(session: BotSession, msg: string): Promise<string | any> {
        const level = EXPERIENCE_MAP[msg];

        if (!level) {
            return MessageBuilder.askExperienceLevel();
        }

        await sessionManager.patch(session.phoneNumber, {
            state: 'PROFILE_SETUP_SKILLS',
            tempData: { ...session.tempData, experienceLevel: level },
        });

        return MessageBuilder.askProfileSkills();
    }

    private async handleProfileSkills(session: BotSession, msg: string): Promise<string | any> {
        const names = msg.split(',').filter(s => s.trim().length > 0).map(s => s.trim());

        if (names.length === 0) {
            return `Please enter at least one skill:`;
        }

        if (names.length > 10) {
            return `Maximum 10 skills allowed. Please narrow down your selection:`;
        }

        const selectedSkillIds = await skillsService.ensureSkillsExist(names);

        await sessionManager.patch(session.phoneNumber, {
            state: 'PROFILE_SETUP_LOCATION',
            tempData: { ...session.tempData, selectedSkillIds },
        });

        return MessageBuilder.askLocation();
    }

    private async handleProfileLocation(session: BotSession, msg: string): Promise<string> {
        const city = msg === 'skip' ? null : msg;

        await sessionManager.patch(session.phoneNumber, {
            state: 'PROFILE_SETUP_AVAILABILITY',
            tempData: { ...session.tempData, city },
        });

        return MessageBuilder.askProfileAvailability();
    }

    private async handleProfileAvailability(session: BotSession, msg: string): Promise<string | any> {
        const availability = AVAILABILITY_MAP[msg];

        if (!availability) {
            return MessageBuilder.askProfileAvailability();
        }

        const { experienceLevel, selectedSkillIds, city, userName } = session.tempData ?? {};

        // Guard against missing/empty selectedSkillIds (session expired or data lost)
        if (!selectedSkillIds || selectedSkillIds.length === 0) {
            await sessionManager.patch(session.phoneNumber, {
                state: 'MAIN_MENU',
                tempData: {},
            });
            return MessageBuilder.mainMenu(`⚠️ Your session expired and skill selections were lost. Please restart profile setup.`);
        }

        // Save profile fields
        await userService.updateProfile(session.userId!, {
            experienceLevel,
            location: city ?? undefined,
            city: city ?? undefined,
        });

        // Save availability separately
        await userService.updateAvailability(session.userId!, availability);

        // Clear old skills, insert new ones
        await prisma.userSkill.deleteMany({ where: { userId: session.userId! } });
        for (const skillId of selectedSkillIds) {
            await skillsService.addUserSkill(session.userId!, skillId, 3);
        }

        await sessionManager.patch(session.phoneNumber, {
            state: 'MAIN_MENU',
            tempData: {},
        });

        const name = userName || 'there';
        return MessageBuilder.profileComplete(name);
    }
    // ── END NEW ───────────────────────────────────────────────────────────────

    // ── FIND MATCHES ──────────────────────────────────────────────────────────
    private async startFindMatches(session: BotSession): Promise<string | any> {
        await sessionManager.patch(session.phoneNumber, {
            state: 'AWAITING_MATCH_SKILLS',
            tempData: { ...session.tempData },
        });

        return MessageBuilder.askSkills();
    }

    private async handleMatchSkillSelection(session: BotSession, msg: string): Promise<string | any> {
        const names = msg.split(',').filter(s => s.trim().length > 0).map(s => s.trim());

        if (names.length === 0) {
            return `Please enter at least one skill:`;
        }

        const selectedSkillIds = await skillsService.ensureSkillsExist(names);

        await sessionManager.patch(session.phoneNumber, {
            state: 'AWAITING_CONNECTION_TYPE',
            tempData: { ...session.tempData, selectedSkillIds },
        });

        return MessageBuilder.askConnectionType();
    }

    private async handleConnectionType(session: BotSession, msg: string): Promise<string | any> {
        const connectionType = CONNECTION_TYPE_MAP[msg];
        if (!connectionType) {
            return MessageBuilder.askConnectionType();
        }

        const { selectedSkillIds } = session.tempData ?? {};

        const matches = await matchingService.findMatches({
            requesterId: session.userId!,
            requiredSkillIds: selectedSkillIds,
            connectionType,
        });

        await sessionManager.patch(session.phoneNumber, {
            state: matches.length > 0 ? 'AWAITING_CONNECTION_NOTE' : 'MAIN_MENU',
            tempData: {
                ...session.tempData,
                connectionType,
                matches,
                selectedMatchIndex: null,
            },
        });

        return MessageBuilder.matchResults(matches);
    }

    private async handleConnectionNote(session: BotSession, msg: string): Promise<string> {
        const { matches, connectionType, selectedMatchIndex } = session.tempData ?? {};

        if (selectedMatchIndex === null || selectedMatchIndex === undefined) {
            if (msg === '0') return this.goToMenu(session);

            const idx = parseInt(msg, 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= matches.length) {
                return `Please reply with a number 1–${matches.length}, or *0* for menu.`;
            }

            await sessionManager.patch(session.phoneNumber, {
                tempData: { ...session.tempData, selectedMatchIndex: idx },
            });

            return (
                `You selected *${matches[idx].name}*.\n\n` +
                `Add a short note (optional):\n_"Looking for a React co-founder!"_\n\n` +
                `Or reply *skip* to send without a note.`
            );
        }

        const note = msg === 'skip' ? undefined : msg;
        const match = matches[selectedMatchIndex];

        await matchingService.createConnectionRequest(
            session.userId!,
            match.userId,
            connectionType,
            match.matchScore,
            note
        );

        await sessionManager.patch(session.phoneNumber, {
            state: 'MAIN_MENU',
            tempData: {},
        });

        return MessageBuilder.connectionSent(match.name);
    }

    // ── MY CONNECTIONS ────────────────────────────────────────────────────────
    private async showMyConnections(session: BotSession): Promise<string | any> {
        const connections = await matchingService.getMyConnections(session.userId!);
        return MessageBuilder.myConnections(connections, session.userId!);
    }

    // ── PENDING REQUESTS ──────────────────────────────────────────────────────
    private async showPendingRequests(session: BotSession): Promise<string | any> {
        const pending = await matchingService.getPendingRequests(session.userId!);

        if (pending.length === 0) return MessageBuilder.pendingRequests([]);

        await sessionManager.patch(session.phoneNumber, {
            state: 'AWAITING_RESPOND_CHOICE',
            tempData: { ...session.tempData, pendingRequests: pending },
        });

        return MessageBuilder.pendingRequests(pending);
    }

    private async handleRespondChoice(session: BotSession, msg: string): Promise<string | any> {
        if (msg === '0') return this.goToMenu(session);

        const { pendingRequests, selectedRequestIndex } = session.tempData ?? {};

        // ── STEP 2: user already picked a request, now 1=accept or 2=reject ──
        if (selectedRequestIndex !== undefined && selectedRequestIndex !== null) {
            if (msg !== '1' && msg !== '2') {
                return `Please reply *1* to accept or *2* to reject. Or *0* for menu.`;
            }

            const connection = pendingRequests[selectedRequestIndex];
            const status = msg === '1' ? 'ACCEPTED' : 'REJECTED';

            await matchingService.respondToConnection(connection.id, session.userId!, status);

            await sessionManager.patch(session.phoneNumber, {
                state: 'MAIN_MENU',
                tempData: {},
            });

            const reply = status === 'ACCEPTED'
                ? `🎉 You're now connected with *${connection.requester.name}*!`
                : `✅ Request from *${connection.requester.name}* declined.`;

            return MessageBuilder.mainMenu(reply);
        }

        // ── STEP 1: pick which request to respond to ──────────────────────────
        const idx = parseInt(msg, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= pendingRequests.length) {
            return `Please reply with a number 1–${pendingRequests.length}. Or *0* for menu.`;
        }

        await sessionManager.patch(session.phoneNumber, {
            tempData: { ...session.tempData, selectedRequestIndex: idx },
        });

        const picked = pendingRequests[idx];
        return (
            `You selected *${picked.requester.name}*'s request.\n\n` +
            `Reply:\n` +
            `*1* ✅ Accept\n` +
            `*2* ❌ Reject\n\n` +
            `Or *0* for menu.`
        );
    }

    // ── AVAILABILITY ──────────────────────────────────────────────────────────
    private async startUpdateAvailability(session: BotSession): Promise<string> {
        await sessionManager.patch(session.phoneNumber, { state: 'AWAITING_AVAILABILITY' });
        return MessageBuilder.availabilityMenu();
    }

    private async handleAvailability(session: BotSession, msg: string): Promise<string | any> {
        const status = AVAILABILITY_MAP[msg];
        if (!status) {
            return MessageBuilder.availabilityMenu();
        }

        await userService.updateAvailability(session.userId!, status);

        await sessionManager.patch(session.phoneNumber, { state: 'MAIN_MENU' });
        return MessageBuilder.mainMenu(`✅ Availability set to *${status}*.`);
    }

    // ── HELPERS ───────────────────────────────────────────────────────────────
    private async goToMenu(session: BotSession): Promise<string | any> {
        await sessionManager.patch(session.phoneNumber, { state: 'MAIN_MENU' });
        return MessageBuilder.mainMenu();
    }

    private helpMessage(): any {
        return MessageBuilder.mainMenu(
            `ℹ️ *Match Network Help*\n\n` +
            `• Type *menu* or *hi* — go to main menu\n` +
            `• Type *0* or *cancel* — exit current flow\n` +
            `• Type *help* — see this message\n\n` +
            `_These commands work from anywhere, anytime._`
        );
    }
    // ── AI CHAT ───────────────────────────────────────────────────────────────
    private async handleAiChat(session: BotSession, msg: string): Promise<string> {
        try {
            const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

            // Get user context for personalized responses
            const user = await prisma.user.findUnique({
                where: { id: session.userId! },
                include: {
                    profile: true,
                    userSkills: { include: { skill: true } },
                },
            });

            const userContext = user
                ? `Name: ${user.name}, ` +
                `Skills: ${user.userSkills.map(s => s.skill.name).join(', ') || 'none set'}, ` +
                `Experience: ${user.profile?.experienceLevel || 'not set'}, ` +
                `City: ${user.profile?.city || 'not set'}, ` +
                `Availability: ${user.profile?.availability || 'not set'}`
                : 'New user';

            const response = await client.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                max_tokens: 350,
                messages: [
                    {
                        role: 'system',
                        content: `You are Spark, the AI assistant for Match Network — a WhatsApp-based professional networking platform for builders, founders, and collaborators.

Current user: ${userContext}

Platform actions:
- Tap *1* → Find matches by skill
- Tap *2* → View my connections
- Tap *3* → Respond to pending requests
- Tap *4* → Update availability
- Tap *5* → Edit my profile
- Type *menu* → Return to main menu
- Type *help* → Get help

Matching algorithm weights: Skill similarity (35%), Location (20%), Experience (15%), Reputation (15%), Availability (10%), Interests (5%).

You help users with: networking tips, writing strong profiles, choosing relevant skills, explaining how matching works, career advice, collaboration strategies.

STRICT FORMATTING RULES — follow every rule without exception:
1. Always use WhatsApp markdown: *bold* for key terms, _italic_ for examples/quotes
2. Use relevant emojis naturally (1-2 per paragraph max)
3. Keep replies under 180 words — be concise and high-value
4. Start every response with a 1-line summary sentence
5. Use bullet points (•) for lists, never numbered lists
6. If the user wants to perform an action, tell them exactly which option to tap
7. Never fabricate features that don't exist on the platform
8. End with a brief encouragement or next-step nudge
9. Respond in the same language the user writes in`,
                    },
                    {
                        role: 'user',
                        content: msg,
                    },
                ],
            });

            const aiReply = response.choices[0]?.message?.content?.trim() ??
                `I didn't quite get that. Type *menu* to see what I can do!`;

            return (
                `🤖 *Spark AI*\n` +
                `────────────────────────\n\n` +
                aiReply +
                `\n\n────────────────────────\n` +
                `_Tap *1–5* to navigate · Type *menu* for options_`
            );

        } catch (err) {
            logger.error({ err }, 'AI chat error');
            return `Sorry, I couldn't process that right now. Type *menu* to see what I can do!`;
        }
    }
    // ── END AI CHAT ───────────────────────────────────────────────────────────
    // ── ADMIN BOT COMMANDS ────────────────────────────────────────────────────
    private async handleAdminCommand(session: BotSession, msg: string): Promise<string> {
        const { adminService } = await import('../admin/admin.service');

        // ── admin stats ───────────────────────────────────────────────────────
        if (msg === 'admin stats') {
            const stats = await adminService.getStats();
            const activeRate = stats.totalUsers > 0
                ? Math.round((stats.activeUsers / stats.totalUsers) * 100)
                : 0;
            const acceptRate = stats.totalConnections > 0
                ? Math.round((stats.acceptedConnections / stats.totalConnections) * 100)
                : 0;
            return (
                `⚙️ *Admin Dashboard*\n` +
                `──────────────────────────\n\n` +
                `👥 *User Stats*\n` +
                `   Total Users:    ${stats.totalUsers}\n` +
                `   ✅ Active:       ${stats.activeUsers}  _(${activeRate}%)_\n` +
                `   🚫 Blocked:     ${stats.blockedUsers}\n\n` +
                `🤝 *Connection Stats*\n` +
                `   Total:          ${stats.totalConnections}\n` +
                `   ✅ Accepted:    ${stats.acceptedConnections}  _(${acceptRate}%)_\n` +
                `   ⏳ Pending:     ${stats.pendingConnections}\n\n` +
                `🛠 *Platform*\n` +
                `   Skills in DB:  ${stats.totalSkills}\n\n` +
                `──────────────────────────\n` +
                `_Last updated: just now_`
            );
        }

        // ── admin broadcast ───────────────────────────────────────────────────
        if (msg.startsWith('admin broadcast ')) {
            const parts = msg.replace('admin broadcast ', '').split('|');
            if (parts.length < 2) {
                return (
                    `📢 *Broadcast — Format Error*\n` +
                    `──────────────────────────\n\n` +
                    `Correct format:\n` +
                    `_admin broadcast Title | Message_\n\n` +
                    `Example:\n` +
                    `_admin broadcast New Feature | We just launched skill filters! 🎉_\n\n` +
                    `──────────────────────────\n` +
                    `_Message will be sent to all active users_`
                );
            }
            const title = parts[0].trim();
            const message = parts[1].trim();
            const result = await adminService.broadcast(session.userId!, title, message, 'ALL');
            return (
                `📢 *Broadcast Sent!*\n` +
                `──────────────────────────\n\n` +
                `📌 Title:     *${title}*\n` +
                `💬 Message: _${message}_\n\n` +
                `📊 *Delivery Report*\n` +
                `   ✅ Delivered:  ${result.sentCount}\n` +
                `   ❌ Failed:     ${result.failCount}\n\n` +
                `──────────────────────────\n` +
                `_Broadcast complete_`
            );
        }

        // ── admin block ───────────────────────────────────────────────────────
        if (msg.startsWith('admin block ')) {
            const identifier = msg.replace('admin block ', '').trim();
            const user = await adminService.blockUser(identifier);
            return (
                `🚫 *User Blocked*\n` +
                `──────────────────────────\n\n` +
                `👤 Name:   *${user.name}*\n` +
                `📱 Phone:  _${user.phoneNumber}_\n\n` +
                `This user can no longer interact with the bot.\n\n` +
                `──────────────────────────\n` +
                `_Use *admin unblock <phone>* to restore access_`
            );
        }

        // ── admin unblock ─────────────────────────────────────────────────────
        if (msg.startsWith('admin unblock ')) {
            const identifier = msg.replace('admin unblock ', '').trim();
            const user = await adminService.unblockUser(identifier);
            return (
                `✅ *User Unblocked*\n` +
                `──────────────────────────\n\n` +
                `👤 Name:   *${user.name}*\n` +
                `📱 Phone:  _${user.phoneNumber}_\n\n` +
                `This user can now access the platform again.\n\n` +
                `──────────────────────────\n` +
                `_Access fully restored_`
            );
        }

        // ── default: admin command reference ─────────────────────────────────
        return (
            `⚙️ *Admin Command Center*\n` +
            `──────────────────────────\n\n` +
            `📊 *Reports*\n` +
            `   *admin stats*\n` +
            `   _View platform-wide analytics_\n\n` +
            `📢 *Broadcast*\n` +
            `   *admin broadcast Title | Message*\n` +
            `   _Send a message to all active users_\n\n` +
            `🚫 *Moderation*\n` +
            `   *admin block <phone>*\n` +
            `   _Suspend a user's access_\n\n` +
            `   *admin unblock <phone>*\n` +
            `   _Restore a user's access_\n\n` +
            `──────────────────────────\n` +
            `_🔒 Admin-only · These commands are private_`
        );
    }
}

export const botHandler = new BotHandler();