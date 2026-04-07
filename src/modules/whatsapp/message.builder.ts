export class MessageBuilder {
    static welcome(name?: string): any {
        return name
            ? this.mainMenu(`👋 Welcome back, *${name}*!`)
            : `👋 Welcome to *Match Network*!\n\nConnect with collaborators, mentors & co-founders.\n\nWhat's your full name?`;
    }

    // ── PREMIUM TEXT MENU ─────────────────────────────────────────────────────
    static mainMenu(prefixText?: string): string {
        const header = prefixText ? `${prefixText}\n\n` : '';
        return (
            header +
            `────── *MATCH NETWORK* ──────\n\n` +
            `*Networking*\n` +
            `🔍  *1.* Find your next match\n` +
            `🤝  *2.* View my connections\n` +
            `📬  *3.* See pending requests\n\n` +
            `*Profile Settings*\n` +
            `📅  *4.* Update availability\n` +
            `✨  *5.* Edit my profile\n\n` +
            `──────────────────────────\n` +
            `_Reply with a number (1-5) to proceed_`
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
            `────── *EXPERIENCE LEVEL* ──────\n\n` +
            `💼 What's your professional experience?\n\n` +
            `🎓  *1.* Student\n` +
            `      _Still studying or just graduated_\n\n` +
            `🌱  *2.* Junior (0–2 years)\n` +
            `      _Early stage in your career_\n\n` +
            `🔧  *3.* Mid-level (2–5 years)\n` +
            `      _Solid professional experience_\n\n` +
            `🚀  *4.* Senior (5–10 years)\n` +
            `      _Deep expertise and leadership_\n\n` +
            `🏆  *5.* Expert (10+ years)\n` +
            `      _Industry veteran_\n\n` +
            `────────────────────────────\n` +
            `_Reply with a number (1-5) or type *cancel*_`
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
            `────── *AVAILABILITY* ──────\n\n` +
            `Let matches know if you're open to connect right now:\n\n` +
            `🟢  *1.* Available\n` +
            `      _Actively looking for connections_\n\n` +
            `🟡  *2.* Busy\n` +
            `      _Open, but responses may be slow_\n\n` +
            `🔴  *3.* Away\n` +
            `      _Not taking new connections_\n\n` +
            `────────────────────────\n` +
            `_Reply with a number (1-3) or type *cancel*_`
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
            `────── *CONNECTION TYPE* ──────\n\n` +
            `🤝 What are you primarily looking for?\n\n` +
            `💡  *1.* Collaboration (Projects/Startup)\n` +
            `🎓  *2.* Mentorship\n` +
            `💼  *3.* Job opportunity\n` +
            `📚  *4.* Internship\n` +
            `💰  *5.* Investment\n` +
            `🌐  *6.* General Networking\n\n` +
            `───────────────────────────\n` +
            `_Reply with a number (1-6) or type *cancel*_`
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
            `────── *AVAILABILITY* ──────\n\n` +
            `Let matches know if you're open to connect right now:\n\n` +
            `🟢  *1.* Available\n` +
            `      _Actively looking for connections_\n\n` +
            `🟡  *2.* Busy\n` +
            `      _Open, but responses may be slow_\n\n` +
            `🔴  *3.* Away\n` +
            `      _Not taking new connections_\n\n` +
            `────────────────────────\n` +
            `_Reply with a number (1-3)_`
        );
    }
}