import prisma from '../../shared/database/prisma';
import { sessionManager, BotSession } from './session.manager';
import { MessageBuilder } from './message.builder';
import { matchingService } from '../matching/matching.service';
import { skillsService } from '../skills/skills.service';
import { userService } from '../users/user.service';
import { authService } from '../auth/auth.service';
import logger from '../../shared/logger';

const CONNECTION_TYPE_MAP: Record<string, string> = {
    '1': 'COLLABORATION', '2': 'MENTORSHIP', '3': 'JOB',
    '4': 'INTERNSHIP', '5': 'INVESTMENT', '6': 'NETWORKING',
};

const AVAILABILITY_MAP: Record<string, 'AVAILABLE' | 'BUSY' | 'AWAY'> = {
    '1': 'AVAILABLE', '2': 'BUSY', '3': 'AWAY',
};

// ── NEW ──────────────────────────────────────────────────────────────────────
const EXPERIENCE_MAP: Record<string, 'STUDENT' | 'JUNIOR' | 'MID' | 'SENIOR' | 'EXPERT'> = {
    '1': 'STUDENT', '2': 'JUNIOR', '3': 'MID', '4': 'SENIOR', '5': 'EXPERT',
};
// ── END NEW ──────────────────────────────────────────────────────────────────

export class BotHandler {

    async handle(phone: string, incomingMessage: string): Promise<string> {
        const msg = incomingMessage.trim().toLowerCase();
        const session = await sessionManager.get(phone);

        logger.info({ phone, state: session.state, msg }, 'WA message received');

        try {
            return await this.route(session, msg, phone);
        } catch (err: any) {
            logger.error({ err, phone }, 'Bot handler error');
            return `❌ ${err.message || 'Something went wrong. Please try again.'}`;
        }
    }

    private async route(session: BotSession, msg: string, phone: string): Promise<string> {

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
    private async handleIdle(session: BotSession, phone: string, _msg: string): Promise<string> {
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
                const allSkills = await skillsService.getAllSkills();

                await sessionManager.patch(session.phoneNumber, {
                    state: 'PROFILE_SETUP_EXPERIENCE',
                    userId: user.id,
                    tempData: {
                        userName: user.name,
                        allSkills,
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
    private async handleMainMenu(session: BotSession, msg: string): Promise<string> {
        switch (msg) {
            case '1': return this.startFindMatches(session);
            case '2': return this.showMyConnections(session);
            case '3': return this.showPendingRequests(session);
            case '4': return this.startUpdateAvailability(session);
            case '5': return this.startEditProfile(session);  // ← NEW
            default:
                return `Please reply with a number 1–5.\n\n${MessageBuilder.mainMenu()}`;
        }
    }
    // ── END UPDATED ───────────────────────────────────────────────────────────

    // ── NEW: PROFILE SETUP FLOW ───────────────────────────────────────────────

    private async startEditProfile(session: BotSession): Promise<string> {
        const allSkills = await skillsService.getAllSkills();

        await sessionManager.patch(session.phoneNumber, {
            state: 'PROFILE_SETUP_EXPERIENCE',
            tempData: { allSkills, isEditing: true },
        });

        return MessageBuilder.askExperienceLevel();
    }

    private async handleProfileExperience(session: BotSession, msg: string): Promise<string> {
        const level = EXPERIENCE_MAP[msg];

        if (!level) {
            return `Please reply with a number 1–5.\n\n${MessageBuilder.askExperienceLevel()}`;
        }

        const { allSkills } = session.tempData ?? {};

        await sessionManager.patch(session.phoneNumber, {
            state: 'PROFILE_SETUP_SKILLS',
            tempData: { ...session.tempData, experienceLevel: level },
        });

        return MessageBuilder.askProfileSkills(allSkills);
    }

    private async handleProfileSkills(session: BotSession, msg: string): Promise<string> {
        const { allSkills } = session.tempData ?? {};

        const indices = msg.split(',').map(s => parseInt(s.trim(), 10) - 1);
        const valid = indices.filter((i: number) => i >= 0 && i < allSkills.length);

        if (valid.length === 0) {
            return `Please enter valid numbers from the list (e.g. _1, 3, 7_):`;
        }

        if (valid.length > 10) {
            return `Maximum 10 skills allowed. Please narrow down your selection:`;
        }

        const selectedSkills = valid.map((i: number) => allSkills[i]);

        await sessionManager.patch(session.phoneNumber, {
            state: 'PROFILE_SETUP_LOCATION',
            tempData: { ...session.tempData, selectedSkills },
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

    private async handleProfileAvailability(session: BotSession, msg: string): Promise<string> {
        const availability = AVAILABILITY_MAP[msg];

        if (!availability) {
            return `Please reply 1, 2, or 3.\n\n${MessageBuilder.askProfileAvailability()}`;
        }

        const { experienceLevel, selectedSkills, city, userName } = session.tempData ?? {};

        // Guard against missing/empty selectedSkills (session expired or data lost)
        if (!selectedSkills || selectedSkills.length === 0) {
            await sessionManager.patch(session.phoneNumber, {
                state: 'MAIN_MENU',
                tempData: {},
            });
            return `⚠️ Your session expired and skill selections were lost. Please type *menu* to restart profile setup.`;
        }

        // Save profile fields
        await userService.updateProfile(session.userId!, {
            experienceLevel,
            location: city ?? undefined,
            city: city ?? undefined,
        });

        // Save availability separately
        await userService.updateAvailability(session.userId!, availability);

        // Re-fetch current skills from DB to get valid IDs (session-cached UUIDs may be stale)
        const currentSkills = await skillsService.getAllSkills();
        const skillsByName = new Map<string, { id: string; name: string }>(
            currentSkills.map((s: any) => [s.name, s])
        );

        // Clear old skills, insert new ones
        await prisma.userSkill.deleteMany({ where: { userId: session.userId! } });
        for (const skill of selectedSkills) {
            const current = skillsByName.get(skill.name);
            if (current) {
                await skillsService.addUserSkill(session.userId!, current.id, 3);
            }
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
    private async startFindMatches(session: BotSession): Promise<string> {
        const skills = await skillsService.getAllSkills();
        const listed = skills.slice(0, 20);

        await sessionManager.patch(session.phoneNumber, {
            state: 'AWAITING_MATCH_SKILLS',
            tempData: { ...session.tempData, skillList: listed },
        });

        return MessageBuilder.askSkills(listed);
    }

    private async handleMatchSkillSelection(session: BotSession, msg: string): Promise<string> {
        const { skillList } = session.tempData ?? {};
        if (!skillList) return this.goToMenu(session);

        const indices = msg.split(',').map(s => parseInt(s.trim(), 10) - 1);
        const valid = indices.filter(i => i >= 0 && i < skillList.length);

        if (valid.length === 0) {
            return `Please enter valid numbers from the list (e.g. _1, 3_):`;
        }

        const selectedSkillIds = valid.map((i: number) => skillList[i].id);

        await sessionManager.patch(session.phoneNumber, {
            state: 'AWAITING_CONNECTION_TYPE',
            tempData: { ...session.tempData, selectedSkillIds },
        });

        return MessageBuilder.askConnectionType();
    }

    private async handleConnectionType(session: BotSession, msg: string): Promise<string> {
        const connectionType = CONNECTION_TYPE_MAP[msg];
        if (!connectionType) {
            return `Please reply with a number 1–6.\n\n${MessageBuilder.askConnectionType()}`;
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
    private async showMyConnections(session: BotSession): Promise<string> {
        const connections = await matchingService.getMyConnections(session.userId!);
        return MessageBuilder.myConnections(connections, session.userId!);
    }

    // ── PENDING REQUESTS ──────────────────────────────────────────────────────
    private async showPendingRequests(session: BotSession): Promise<string> {
        const pending = await matchingService.getPendingRequests(session.userId!);

        if (pending.length === 0) return MessageBuilder.pendingRequests([]);

        await sessionManager.patch(session.phoneNumber, {
            state: 'AWAITING_RESPOND_CHOICE',
            tempData: { ...session.tempData, pendingRequests: pending },
        });

        return MessageBuilder.pendingRequests(pending);
    }

    private async handleRespondChoice(session: BotSession, msg: string): Promise<string> {
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

            return `${reply}\n\n${MessageBuilder.mainMenu()}`;
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

    private async handleAvailability(session: BotSession, msg: string): Promise<string> {
        const status = AVAILABILITY_MAP[msg];
        if (!status) {
            return `Please reply 1, 2, or 3.\n\n${MessageBuilder.availabilityMenu()}`;
        }

        await userService.updateAvailability(session.userId!, status);

        await sessionManager.patch(session.phoneNumber, { state: 'MAIN_MENU' });
        return `✅ Availability set to *${status}*.\n\n${MessageBuilder.mainMenu()}`;
    }

    // ── HELPERS ───────────────────────────────────────────────────────────────
    private async goToMenu(session: BotSession): Promise<string> {
        await sessionManager.patch(session.phoneNumber, { state: 'MAIN_MENU' });
        return MessageBuilder.mainMenu();
    }

    private helpMessage(): string {
        return (
            `ℹ️ *Match Network Help*\n\n` +
            `• Type *menu* or *hi* — go to main menu\n` +
            `• Type *0* or *cancel* — exit current flow\n` +
            `• Type *help* — see this message\n\n` +
            `_These commands work from anywhere, anytime._\n\n` +
            `${MessageBuilder.mainMenu()}`
        );
    }

    // ── ADMIN BOT COMMANDS ────────────────────────────────────────────────────
    private async handleAdminCommand(session: BotSession, msg: string): Promise<string> {
        const { adminService } = await import('../admin/admin.service');

        // "admin stats"
        if (msg === 'admin stats') {
            const stats = await adminService.getStats();
            return (
                `📊 *Match Network Stats*\n\n` +
                `👥 Total Users: ${stats.totalUsers}\n` +
                `✅ Active: ${stats.activeUsers}\n` +
                `🚫 Blocked: ${stats.blockedUsers}\n\n` +
                `🤝 Total Connections: ${stats.totalConnections}\n` +
                `✅ Accepted: ${stats.acceptedConnections}\n` +
                `⏳ Pending: ${stats.pendingConnections}\n\n` +
                `🛠 Skills in DB: ${stats.totalSkills}`
            );
        }

        // "admin broadcast Title | Message"
        if (msg.startsWith('admin broadcast ')) {
            const parts = msg.replace('admin broadcast ', '').split('|');
            if (parts.length < 2) {
                return `Format: _admin broadcast Title | Message_\nExample: _admin broadcast Update | We have new features!_`;
            }
            const title = parts[0].trim();
            const message = parts[1].trim();
            const result = await adminService.broadcast(session.userId!, title, message, 'ALL');
            return `📢 Broadcast sent!\n✅ Delivered: ${result.sentCount}\n❌ Failed: ${result.failCount}`;
        }

        // "admin block <userId>"
        if (msg.startsWith('admin block ')) {
            const userId = msg.replace('admin block ', '').trim();
            const user = await adminService.blockUser(userId);
            return `🚫 *${user.name}* has been blocked.`;
        }

        // "admin unblock <userId>"
        if (msg.startsWith('admin unblock ')) {
            const userId = msg.replace('admin unblock ', '').trim();
            const user = await adminService.unblockUser(userId);
            return `✅ *${user.name}* has been unblocked.`;
        }

        // Admin help
        return (
            `🔧 *Admin Commands*\n\n` +
            `• *admin stats* — view platform stats\n` +
            `• *admin broadcast Title | Message* — message all users\n` +
            `• *admin block <userId>* — block a user\n` +
            `• *admin unblock <userId>* — unblock a user\n\n` +
            `_These commands only work for admin accounts._`
        );
    }
}

export const botHandler = new BotHandler();