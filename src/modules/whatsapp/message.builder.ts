export class MessageBuilder {
    static welcome(name?: string): any {
        return name
            ? this.mainMenu(`👋 Welcome back, *${name}*!`)
            : `👋 Welcome to *Match Network*!\n\nConnect with collaborators, mentors & co-founders.\n\nWhat's your full name?`;
    }

    // ── NATIVE INTERACTIVE MENU ───────────────────────────────────────────────
    static mainMenu(prefixText?: string): any {
        const textStr = (prefixText ? prefixText + '\n\n' : '') + `What would you like to do?`;
        return {
            type: 'list',
            text: textStr,
            buttonText: 'Main Menu',
            sections: [
                {
                    title: 'Options',
                    rows: [
                        { id: '1', title: 'Find matches' },
                        { id: '2', title: 'My connections' },
                        { id: '3', title: 'Pending requests' },
                        { id: '4', title: 'Update availability' },
                        { id: '5', title: 'Edit my profile' }
                    ]
                }
            ]
        };
    }

    static otpSent(phone: string): string {
        return `📱 A verification code was sent to *+${phone}*.\n\nEnter the 6-digit code:`;
    }

    // ── NEW: profile setup messages ───────────────────────────────────────────

    static profileSetupWelcome(name: string): string {
        return (
            `🎉 Welcome, *${name}*! Let's set up your profile.\n\n` +
            `This takes about 1 minute and helps us find you great matches.\n\n` +
            this.askExperienceLevel()
        );
    }

    static askExperienceLevel(): string {
        return (
            `💼 *What's your experience level?*\n\n` +
            `1. 🎓 Student\n` +
            `2. 🌱 Junior (0–2 years)\n` +
            `3. 🔧 Mid-level (2–5 years)\n` +
            `4. 🚀 Senior (5–10 years)\n` +
            `5. 🏆 Expert (10+ years)\n\n` +
            `_Reply with a number_\n` +
            `_Type *cancel* to go back to menu_`
        );
    }

    static askProfileSkills(): string {
        return (
            `🛠 *What are your top skills?*\n\n` +
            `Type your skills, separated by commas:\n` +
            `_e.g. React, Node.js, Typescript, Design_\n\n` +
            `_Maximum 10 skills allowed_`
        );
    }

    static askLocation(): string {
        return (
            `📍 *Where are you based?*\n\n` +
            `Type your city name:\n` +
            `_e.g. Mumbai, Hyderabad, Bangalore_\n\n` +
            `Or type *skip* to set later.\n` +
            `_Type *cancel* to go back to menu_`
        );
    }

    static askProfileAvailability(): string {
        return (
            `📶 *What's your current availability?*\n\n` +
            `1. 🟢 Available — actively looking to connect\n` +
            `2. 🟡 Busy — open but selective\n` +
            `3. 🔴 Away — not available right now\n\n` +
            `_Reply with a number_\n` +
            `_Type *cancel* to go back to menu_`
        );
    }


    static profileComplete(name: string): any {
        return this.mainMenu(
            `✅ *Profile complete, ${name}!*\n\n` +
            `You're all set to start networking 🚀`
        );
    }

    // ── END NEW ───────────────────────────────────────────────────────────────

    static askSkills(): string {
        return (
            `🛠 *Which skills are you looking for?*\n\n` +
            `Type the skills separated by commas:\n` +
            `_e.g. React, UI Design, Marketing_`
        );
    }

    static askConnectionType(): string {
        return (
            `🤝 *What type of connection are you looking for?*\n\n` +
            `1. Collaboration\n` +
            `2. Mentorship\n` +
            `3. Job opportunity\n` +
            `4. Internship\n` +
            `5. Investment\n` +
            `6. Networking\n\n` +
            `_Reply with a number_\n` +
            `_Type *cancel* to go back to menu_`
        );
    }

    static matchResults(matches: any[]): any {
        if (matches.length === 0) {
            return this.mainMenu(`😔 No matches found for those skills right now.\n\nTry different skills.`);
        }
        let msg = `🎯 *Top ${matches.length} match(es) found:*\n\n`;
        matches.forEach((m, i) => {
            msg +=
                `*${i + 1}. ${m.name}*\n` +
                `📍 ${m.city || 'Location unknown'}\n` +
                `⚡ Match score: ${Math.round(m.matchScore * 100)}%\n` +
                `🛠 Skills: ${m.matchingSkills.join(', ')}\n` +
                `📶 ${m.availability}\n\n`;
        });
        msg += `Reply with a number to connect (e.g. _1_)\nOr *0* to go back to menu.`;
        return msg;
    }

    static connectionSent(name: string): any {
        return this.mainMenu(`✅ Connection request sent to *${name}*!\n\nThey'll be notified on WhatsApp.`);
    }

    static pendingRequests(requests: any[]): any {
        if (requests.length === 0) {
            return this.mainMenu(`📭 No pending requests right now.`);
        }
        let msg = `📬 *${requests.length} pending request(s):*\n\n`;
        requests.forEach((r, i) => {
            msg +=
                `*${i + 1}. ${r.requester.name}*\n` +
                `📍 ${r.requester.profile?.city || 'Unknown'}\n` +
                `📝 "${r.note || 'No message'}"\n\n`;
        });
        // ── SIMPLE INSTRUCTIONS ───────────────────────────────────────────────
        msg += `Reply with the *number* of the request you want to respond to.\n`;
        msg += `Or *0* for menu.`;
        return msg;
    }

    static myConnections(connections: any[], userId: string): any {
        if (connections.length === 0) {
            return this.mainMenu(`🕸 No connections yet.\n\nFind matches to grow your network!`);
        }
        let msg = `🌐 *Your Network (${connections.length}):*\n\n`;
        connections.forEach((c, i) => {
            const other = c.requesterId === userId ? c.receiver : c.requester;
            msg +=
                `${i + 1}. *${other.name}*\n` +
                `📍 ${other.profile?.city || 'Unknown'} · ${other.profile?.experienceLevel || 'N/A'}\n\n`;
        });
        return this.mainMenu(msg);
    }

    static availabilityMenu(): string {
        return (
            `📶 *Set your availability:*\n\n` +
            `1. 🟢 Available\n` +
            `2. 🟡 Busy\n` +
            `3. 🔴 Away\n\n` +
            `_Reply with a number_`
        );
    }
}