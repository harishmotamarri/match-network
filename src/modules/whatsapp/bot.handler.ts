import prisma from '../../shared/database/prisma';
import { sessionManager, BotSession } from './session.manager';
import { MessageBuilder } from './message.builder';
import { matchingService } from '../matching/matching.service';
import { skillsService } from '../skills/skills.service';
import { userService } from '../users/user.service';
import { authService } from '../auth/auth.service';
import { notificationService } from '../notifications/notification.service';
import { chatService } from '../chat/chat.service';
import { teammateService } from '../teammate/teammate.service';
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
                return (
                    `🚫 *Account Suspended*\n` +
                    `──────────────────────────\n\n` +
                    `Your account has been temporarily suspended.\n\n` +
                    `Please contact our support team to restore access.\n\n` +
                    `──────────────────────────\n` +
                    `_support@matchnetwork.in_`
                );
            }
        }

        try {
            return await this.route(session, msg, phone);
        } catch (err: any) {
            logger.error({ err, phone }, 'Bot handler error');
            return (
                `⚠️ *Something went wrong*\n\n` +
                `_${err.message || 'An unexpected error occurred.'}_\n\n` +
                `Please try again or type *menu* to start over.`
            );
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
            case 'AWAITING_CONNECTION_ACTION_PICK': return this.handleConnectionActionPick(session, msg);
            case 'AWAITING_CONNECTION_ACTION': return this.handleConnectionAction(session, msg);
            case 'AWAITING_RESPOND_MESSAGE': return this.handleRespondMessage(session, msg);
            case 'TEAMMATE_HUB': return this.handleTeammateAction(session, msg);
            case 'TEAMMATE_POST_TITLE': return this.handleTeammatePostTitle(session, msg);
            case 'TEAMMATE_POST_DESC': return this.handleTeammatePostDesc(session, msg);
            case 'TEAMMATE_BROWSE_PICK': return this.handleTeammateBrowsePick(session, msg);
            case 'TEAMMATE_DETAIL_ACTION': return this.handleTeammateDetailAction(session, msg);
            case 'CHATTING': return this.handleChat(session, msg);
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
            return (
                `⚠️ *Invalid Name*\n\n` +
                `Please enter your full name (between 2 and 100 characters).\n\n` +
                `_e.g. Rahul Sharma_`
            );
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
            return (
                `❌ *Verification Failed*\n\n` +
                `The code you entered is *invalid or expired*.\n\n` +
                `Please try again, or type *menu* to restart.`
            );
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
            case '5': return this.startEditProfile(session);
            case '6': return this.startTeammateHub(session);
            case '7': return this.startAiChat(session);
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
        const names = await skillsService.sanitizeSkills(msg);

        if (names.length === 0) {
            return (
                `⚠️ *No Valid Skills Found*\n\n` +
                `I couldn't identify any professional skills in your message.\n\n` +
                `Please try again with clear skill names separated by commas.\n\n` +
                `_e.g. React, Node.js, Project Management_`
            );
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
        // Check if user has completed profile setup
        const user = await prisma.user.findUnique({
            where: { id: session.userId! },
            include: { profile: true }
        });

        if (!user?.profile) {
            return MessageBuilder.mainMenu(
                `⚠️ *Profile Incomplete*\n\n` +
                `You need to complete your profile before you can find matches.\n\n` +
                `Tap *Edit Profile* (5) below to get started!`
            );
        }

        await sessionManager.patch(session.phoneNumber, {
            state: 'AWAITING_MATCH_SKILLS',
            tempData: { ...session.tempData },
        });

        return MessageBuilder.askSkills();
    }

    private async handleMatchSkillSelection(session: BotSession, msg: string): Promise<string | any> {
        const names = await skillsService.sanitizeSkills(msg);

        if (names.length === 0) {
            return (
                `⚠️ *No Valid Skills Found*\n\n` +
                `I couldn't identify any professional skills in your message.\n\n` +
                `Please type the skills you're looking for, separated by commas.\n\n` +
                `_e.g. React, Marketing, Fundraising_`
            );
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

        if (!matches || matches.length === 0) {
            return this.goToMenu(session);
        }

        if (selectedMatchIndex === null || selectedMatchIndex === undefined) {
            if (msg === '0') return this.goToMenu(session);

            const idx = parseInt(msg, 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= matches.length) {
                return (
                    `⚠️ *Invalid Selection*\n\n` +
                    `Please reply with a number *1–${matches.length}* to select a match.\n\n` +
                    `_Or type *0* to return to the menu._`
                );
            }

            await sessionManager.patch(session.phoneNumber, {
                tempData: { ...session.tempData, selectedMatchIndex: idx },
            });

            return (
                `✅ *Match Selected*\n` +
                `──────────────────────────\n\n` +
                `You've chosen to connect with *${matches[idx].name}*.\n\n` +
                `💬 *Add a personal note* _(optional)_\n` +
                `_e.g. "Looking for a React co-founder to build our MVP!"_\n\n` +
                `──────────────────────────\n` +
                `_Type your note or reply *skip* to send without one_`
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

        if (connections.length === 0) return MessageBuilder.myConnections([], session.userId!);

        await sessionManager.patch(session.phoneNumber, {
            state: 'AWAITING_CONNECTION_ACTION_PICK',
            tempData: { ...session.tempData, connections },
        });

        return MessageBuilder.myConnections(connections, session.userId!);
    }

    private async handleConnectionActionPick(session: BotSession, msg: string): Promise<string | any> {
        if (msg === '0') return this.goToMenu(session);

        const { connections } = session.tempData ?? {};
        if (!connections || connections.length === 0) return this.goToMenu(session);

        const idx = parseInt(msg, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= connections.length) {
            return (
                `⚠️ *Invalid Selection*\n\n` +
                `Please reply with a number *1–${connections.length}* to manage a connection.\n\n` +
                `_Or type *0* to return to the menu._`
            );
        }

        const picked = connections[idx];
        const other = picked.requesterId === session.userId ? picked.receiver : picked.requester;

        await sessionManager.patch(session.phoneNumber, {
            state: 'AWAITING_CONNECTION_ACTION',
            tempData: { ...session.tempData, selectedConnection: picked, otherUser: other },
        });

        return MessageBuilder.connectionActions(other.name);
    }

    private async handleConnectionAction(session: BotSession, msg: string): Promise<string | any> {
        if (msg === '0' || msg === 'back') return this.showMyConnections(session);

        const { selectedConnection, otherUser } = session.tempData ?? {};
        if (!selectedConnection || !otherUser) return this.goToMenu(session);

        switch (msg) {
            case '1': // Message
                return this.startChat(session, otherUser.id);

            case '2': // View Profile
                return MessageBuilder.publicProfile(otherUser);

            case '3': // Remove
                await matchingService.removeConnection(selectedConnection.id, session.userId!);
                return MessageBuilder.mainMenu(
                    `✅ *Connection Removed*\n\n` +
                    `*${otherUser.name}* has been removed from your network.`
                );

            default:
                return MessageBuilder.connectionActions(otherUser.name);
        }
    }

    private async startChat(session: BotSession, targetUserId: string): Promise<string | any> {
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            include: { profile: true }
        });

        if (!targetUser) return this.goToMenu(session);

        const status = await chatService.getOnlineStatus(targetUserId);

        await sessionManager.patch(session.phoneNumber, {
            state: 'CHATTING',
            tempData: {
                ...session.tempData,
                chatTargetId: targetUserId,
                chatTargetName: targetUser.name,
                chatTargetPhone: targetUser.phoneNumber
            }
        });

        return MessageBuilder.chatHeader(targetUser.name, status);
    }

    private async handleChat(session: BotSession, msg: string): Promise<string | any> {
        const { chatTargetId, chatTargetName, chatTargetPhone } = session.tempData ?? {};

        if (msg === '0' || msg.toLowerCase() === 'exit') {
            await sessionManager.patch(session.phoneNumber, { state: 'MAIN_MENU' });
            return this.showMyConnections(session);
        }

        // Save message
        await chatService.sendMessage({
            senderId: session.userId!,
            receiverId: chatTargetId,
            body: msg
        });

        // Check if target is a currently in a chat with THIS user
        const targetSession = await sessionManager.get(chatTargetPhone);
        const isTargetInChatWithMe =
            targetSession?.state === 'CHATTING' &&
            targetSession?.tempData?.chatTargetId === session.userId;

        if (isTargetInChatWithMe) {
            // Direct delivery
            await notificationService.notifyChatMessage(chatTargetPhone, session.tempData?.userName || 'Connection', msg, true);
        } else {
            // Background notification
            await notificationService.notifyChatMessage(chatTargetPhone, session.tempData?.userName || 'Connection', msg, false);
        }

        return `✅ _Delivered_`;
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

        // ── STEP 2: Response actions for picked request ───────────────────────
        if (selectedRequestIndex !== undefined && selectedRequestIndex !== null) {
            const picked = pendingRequests[selectedRequestIndex];

            switch (msg) {
                case '1': // Accept
                    await matchingService.respondToConnection(picked.id, session.userId!, 'ACCEPTED');
                    await sessionManager.patch(session.phoneNumber, { state: 'MAIN_MENU', tempData: {} });
                    return MessageBuilder.mainMenu(MessageBuilder.matchAccepted(picked.requester.name));

                case '2': // Reject
                    await matchingService.respondToConnection(picked.id, session.userId!, 'REJECTED');
                    await sessionManager.patch(session.phoneNumber, { state: 'MAIN_MENU', tempData: {} });
                    return MessageBuilder.mainMenu(MessageBuilder.matchDeclined(picked.requester.name));

                case '3': // Reply
                    await sessionManager.patch(session.phoneNumber, { state: 'AWAITING_RESPOND_MESSAGE' });
                    return (
                        `💬 *Reply to ${picked.requester.name}*\n\n` +
                        `Type your message below. It will be sent to them via WhatsApp.\n\n` +
                        `_Type *back* to return to options._`
                    );

                case '4': // View Profile
                    return MessageBuilder.publicProfile(picked.requester);

                case 'back':
                case '0':
                    // Reset selected request and show list again
                    await sessionManager.patch(session.phoneNumber, { 
                        tempData: { ...session.tempData, selectedRequestIndex: null } 
                    });
                    return this.showPendingRequests(session);

                default:
                    return MessageBuilder.requestActionOptions(picked.requester.name);
            }
        }

        // ── STEP 1: pick which request to respond to ──────────────────────────
        const idx = parseInt(msg, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= pendingRequests.length) {
            return (
                `⚠️ *Invalid Selection*\n\n` +
                `Please reply with a number *1–${pendingRequests.length}* to pick a request.\n\n` +
                `_Or type *0* to return to the menu._`
            );
        }

        const picked = pendingRequests[idx];
        await sessionManager.patch(session.phoneNumber, {
            tempData: { ...session.tempData, selectedRequestIndex: idx },
        });

        return MessageBuilder.requestActionOptions(picked.requester.name);
    }

    private async handleRespondMessage(session: BotSession, msg: string): Promise<string | any> {
        const { pendingRequests, selectedRequestIndex } = session.tempData ?? {};
        const picked = pendingRequests[selectedRequestIndex];

        if (msg.toLowerCase() === 'back') {
            await sessionManager.patch(session.phoneNumber, { state: 'AWAITING_RESPOND_CHOICE' });
            return MessageBuilder.requestActionOptions(picked.requester.name);
        }

        // Send WhatsApp reply
        await notificationService.notifyReplyReceived(
            picked.requester.phoneNumber,
            session.tempData?.userName || 'A Match Network user',
            msg
        );

        await sessionManager.patch(session.phoneNumber, { state: 'AWAITING_RESPOND_CHOICE' });

        return (
            `✅ *Message Sent*\n\n` +
            `Your message has been delivered to *${picked.requester.name}*.\n\n` +
            MessageBuilder.requestActionOptions(picked.requester.name).text
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
            `ℹ️ *How to use Match Network*\n\n` +
            `• *1–6* — Select a menu option\n` +
            `• *menu* or *hi* — Return to main menu\n` +
            `• *0* or *cancel* — Exit any flow\n` +
            `• *help* — See this message\n\n` +
            `🤖 *Spark AI Chat*:\n` +
            `Just type any question below (e.g. "How do I improve my profile?") and Spark will help you out!\n\n` +
            `_All commands work from anywhere, anytime._`
        );
    }
    // ── AI CHAT ───────────────────────────────────────────────────────────────
    private async startAiChat(session: BotSession): Promise<string> {
        return this.handleAiChat(session, "Hi Spark! I want to start a chat and learn how you can help me with my career and networking.");
    }

    private async handleAiChat(session: BotSession, msg: string): Promise<string> {
        try {
            const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

            // ── NEW: Real Platform Context ─────────────────────────────────────────
            const [user, topMembers] = await Promise.all([
                prisma.user.findUnique({
                    where: { id: session.userId! },
                    include: {
                        profile: true,
                        userSkills: { include: { skill: true } },
                    },
                }),
                matchingService.getSparkRecommendations(session.userId!)
            ]);

            const userContext = user
                ? `Name: ${user.name}, ` +
                `Skills: ${user.userSkills.map(s => s.skill.name).join(', ') || 'none set'}, ` +
                `Experience: ${user.profile?.experienceLevel || 'not set'}, ` +
                `City: ${user.profile?.city || 'not set'}`
                : 'New user';

            const communityContext = topMembers.length > 0
                ? topMembers.map(m => `• ${m.name} (${m.city}) - Skills: ${m.skills.join(', ')}`).join('\n')
                : 'Searching for top builders...';

            const response = await client.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                max_tokens: 350,
                messages: [
                    {
                        role: 'system',
                        content: `You are Spark, the Networking Concierge for Match Network — a professional platform on WhatsApp.
                        
Your goal: Help users connect, collaborate, and grow their professional network. Be proactive, results-oriented, and encouraging.

USER CONTEXT:
${userContext}

LIVE COMMUNITY SNEAK PEEK (PEOPLE THE USER SHOULD MEET):
${communityContext}

PLATFORM ACTIONS:
- Tap *1* → Search for people with specific skills
- Tap *2* → Manage your network connections
- Tap *3* → View pending requests
- Tap *4* → Update availability
- Tap *5* → Edit profile

YOUR EXTENDED CAPABILITIES:
1. **Suggest Connections**: Proactively suggest meeting the real people listed in the "COMMUNITY SNEAK PEEK". Mention them by name.
2. **Icebreaker Generation**: If a user asks how to connect, write 2 tailored message templates for them. One professional, one casual.
3. **Outreach Assistance**: Help users draft messages for specific roles (e.g. "Draft a message for a senior dev").
4. **Strategy Advice**: Suggest which skills to add or how to improve their bio based on their background.

STRICT FORMATTING RULES:
1. Use WhatsApp markdown: *bold* for emphasis, _italic_ for quotes/examples.
2. Emojis: Use 1-2 per paragraph to keep it friendly.
3. Length: Keep overall response under 220 words.
4. Actionable: Always tell the user exactly which button (1-5) to tap to find those types of people. 
5. Language: Respond in the same language as the user.`,
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

    // ── TEAMMATES ─────────────────────────────────────────────────────────────
    private async startTeammateHub(session: BotSession): Promise<any> {
        await sessionManager.patch(session.phoneNumber, { state: 'TEAMMATE_HUB' });
        return MessageBuilder.teammateHub();
    }

    private async handleTeammateAction(session: BotSession, msg: string): Promise<any> {
        if (msg === '0') return this.goToMenu(session);

        const choice = msg.toLowerCase();
        if (choice === 'team_browse' || choice === '1') return this.browseTeammateRequests(session);
        if (choice === 'team_post' || choice === '2') return this.startTeammatePost(session);
        if (choice === 'team_my' || choice === '3') return this.showMyTeammatePosts(session);

        return MessageBuilder.teammateHub();
    }

    private async startTeammatePost(session: BotSession): Promise<any> {
        await sessionManager.patch(session.phoneNumber, { state: 'TEAMMATE_POST_TITLE' });
        return `📢 *Let's find you a team!*\n\nWhat is your project's *Title*?\n_Example: "Frontend dev for Hackathon" or "AI Startup Co-founder"_`;
    }

    private async handleTeammatePostTitle(session: BotSession, msg: string): Promise<any> {
        if (msg === '0') return this.startTeammateHub(session);

        await sessionManager.patch(session.phoneNumber, {
            state: 'TEAMMATE_POST_DESC',
            tempData: { ...session.tempData, projectTitle: msg }
        });

        return `✅ *Title saved.*\n\nNow, describe the project and what you're looking for:\n_Mention stack, commitment, and goals._`;
    }

    private async handleTeammatePostDesc(session: BotSession, msg: string): Promise<any> {
        if (msg === '0') return this.startTeammateHub(session);

        await sessionManager.patch(session.phoneNumber, {
            state: 'TEAMMATE_POST_SKILLS',
            tempData: { ...session.tempData, projectDesc: msg }
        });

        return `✅ *Description saved.*\n\nList the *Required Skills* (comma separated):\n_Example: React, Node.js, UI Design_`;
    }

    private async handleTeammatePostSkills(session: BotSession, msg: string): Promise<any> {
        if (msg === '0') return this.startTeammateHub(session);

        const skills = await skillsService.sanitizeSkills(msg);
        const { projectTitle, projectDesc } = session.tempData ?? {};

        await teammateService.createRequest({
            creatorId: session.userId!,
            title: projectTitle,
            description: projectDesc,
            requiredSkills: skills
        });

        await sessionManager.patch(session.phoneNumber, { state: 'TEAMMATE_HUB' });
        return MessageBuilder.mainMenu(`🎉 *Project Posted Successfully!*\n\nOther builders can now see your request and apply.`);
    }

    private async browseTeammateRequests(session: BotSession): Promise<any> {
        const requests = await teammateService.getActiveRequests();
        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            include: { userSkills: { include: { skill: true } } }
        });

        const userSkills = user?.userSkills.map(s => s.skill.name) || [];

        await sessionManager.patch(session.phoneNumber, {
            state: 'TEAMMATE_BROWSE_PICK',
            tempData: { ...session.tempData, browsedRequests: requests }
        });

        return MessageBuilder.teammateList(requests, userSkills);
    }

    private async handleTeammateBrowsePick(session: BotSession, msg: string): Promise<any> {
        if (msg === '0') return this.startTeammateHub(session);

        const requests = session.tempData?.browsedRequests || [];
        const index = parseInt(msg.replace('req_', '')) || parseInt(msg) - 1;

        const req = requests[index];
        if (!req) return this.browseTeammateRequests(session);

        // Fetch full detail
        const fullReq = await teammateService.getRequestById(req.id);
        if (!fullReq) return this.browseTeammateRequests(session);

        await sessionManager.patch(session.phoneNumber, {
            state: 'TEAMMATE_DETAIL_ACTION',
            tempData: { ...session.tempData, selectedProjectId: req.id, posterId: fullReq.creatorId }
        });

        return MessageBuilder.teammateDetail(fullReq, fullReq.creatorId === session.userId);
    }

    private async handleTeammateDetailAction(session: BotSession, msg: string): Promise<any> {
        const { selectedProjectId, posterId } = session.tempData ?? {};

        if (msg === 'team_browse' || msg === 'back') return this.browseTeammateRequests(session);

        if (msg === 'req_apply' || msg === '1') {
            await teammateService.applyToRequest(selectedProjectId, session.userId!);
            
            // Notify Poster
            const poster = await prisma.user.findUnique({ where: { id: posterId } });
            if (poster) {
                await notificationService.notifyTeammateApplication(
                    poster.phoneNumber,
                    session.tempData?.userName || 'A builder',
                    "Interested in your project!"
                );
            }
            return `✅ *Application Sent!*\n\nThe poster has been notified. They can start a chat with you if interested.`;
        }

        if (msg === 'req_chat' || msg === '2') {
            return this.startChat(session, posterId);
        }

        if (msg === 'req_close' && posterId === session.userId) {
            await teammateService.closeRequest(selectedProjectId, session.userId!);
            return MessageBuilder.mainMenu(`✅ *Project Closed.*\n\nYour post is no longer visible to other builders.`);
        }

        return this.browseTeammateRequests(session);
    }

    private async showMyTeammatePosts(session: BotSession): Promise<any> {
        const all = await teammateService.getActiveRequests();
        const myPosts = all.filter(r => r.creatorId === session.userId);

        await sessionManager.patch(session.phoneNumber, {
            state: 'TEAMMATE_BROWSE_PICK',
            tempData: { ...session.tempData, browsedRequests: myPosts }
        });

        return MessageBuilder.teammateList(myPosts, []);
    }

}

export const botHandler = new BotHandler();