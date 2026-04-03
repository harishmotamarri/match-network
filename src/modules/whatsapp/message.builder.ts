export class MessageBuilder {
    static welcome(name?: string): string {
        return name
            ? `👋 Welcome back, *${name}*!\n\n${this.mainMenu()}`
            : `👋 Welcome to *Match Network*!\n\nConnect with collaborators, mentors & co-founders.\n\nWhat's your full name?`;
    }

    // ── UPDATED: added option 5 ───────────────────────────────────────────────
    static mainMenu(): string {
        return (
            `What would you like to do?\n\n` +
            `1️⃣  Find matches\n` +
            `2️⃣  My connections\n` +
            `3️⃣  Pending requests\n` +
            `4️⃣  Update availability\n` +
            `5️⃣  Edit my profile\n\n` +
            `_Reply with a number, or just ask me anything!_\n` +
            `_Type *help* for assistance_`
        );
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

    static askProfileSkills(skillList: Array<{ id: string; name: string; category: string }>): string {
        let msg = `🛠 *What are your top skills?*\n\nPick up to 10 (comma-separated):\n\n`;

        let currentCategory = '';
        skillList.forEach((s, i) => {
            if (s.category !== currentCategory) {
                currentCategory = s.category;
                msg += `\n*${currentCategory}*\n`;
            }
            msg += `${i + 1}. ${s.name}\n`;
        });

        msg += `\nExample: _1, 3, 7_`;
        return msg;
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


    static profileComplete(name: string): string {
        return (
            `✅ *Profile complete, ${name}!*\n\n` +
            `You're all set to start networking 🚀\n\n` +
            this.mainMenu()
        );
    }

    // ── END NEW ───────────────────────────────────────────────────────────────

    static askSkills(skillList: Array<{ id: string; name: string; category: string }>): string {
        let msg = `🛠 *Which skills are you looking for?*\n\nReply with numbers separated by commas:\n\n`;
        skillList.forEach((s, i) => {
            msg += `${i + 1}. ${s.name} _(${s.category})_\n`;
        });
        msg += `\nExample: _1, 3, 5_`;
        return msg;
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

    static matchResults(matches: any[]): string {
        if (matches.length === 0) {
            return `😔 No matches found for those skills right now.\n\nTry different skills.\n\n${this.mainMenu()}`;
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

    static connectionSent(name: string): string {
        return `✅ Connection request sent to *${name}*!\n\nThey'll be notified on WhatsApp.\n\n${this.mainMenu()}`;
    }

    static pendingRequests(requests: any[]): string {
        if (requests.length === 0) {
            return `📭 No pending requests right now.\n\n${this.mainMenu()}`;
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

    static myConnections(connections: any[], userId: string): string {
        if (connections.length === 0) {
            return `🕸 No connections yet.\n\nFind matches to grow your network!\n\n${this.mainMenu()}`;
        }
        let msg = `🌐 *Your Network (${connections.length}):*\n\n`;
        connections.forEach((c, i) => {
            const other = c.requesterId === userId ? c.receiver : c.requester;
            msg +=
                `${i + 1}. *${other.name}*\n` +
                `📍 ${other.profile?.city || 'Unknown'} · ${other.profile?.experienceLevel || 'N/A'}\n\n`;
        });
        return msg + `\n${this.mainMenu()}`;
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