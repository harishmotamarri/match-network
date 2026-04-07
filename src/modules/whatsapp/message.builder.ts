export class MessageBuilder {

    // ── WELCOME ───────────────────────────────────────────────────────────────
    static welcome(name?: string): any {
        return name
            ? this.mainMenu(`👋 Welcome back, *${name}*!`)
            : `👋 *Welcome to Match Network!*\n\nThe professional networking platform built for builders, founders & collaborators.\n\nLet's get you started — what's your *full name*?`;
    }

    // ── MAIN MENU — Interactive List ──────────────────────────────────────────
    static mainMenu(prefixText?: string): any {
        const bodyText = prefixText
            ? `${prefixText}\n\nWhat would you like to do next?`
            : `🚀 *Match Network*\n\nYour professional network is one tap away.`;
        return {
            type: 'list',
            text: bodyText,
            buttonText: 'Open Menu',
            sections: [
                {
                    title: 'Networking & Growth',
                    rows: [
                        { id: '1', title: '🔍 Find Matches',       description: 'Discover your next collaborator' },
                        { id: '2', title: '🤝 My Connections',     description: 'View your network' },
                        { id: '3', title: '📬 Pending Requests',   description: 'Respond to incoming requests' },
                    ]
                },
                {
                    title: 'Account & Profile',
                    rows: [
                        { id: '4', title: '📅 Update Availability', description: 'Show if you\'re open to connect' },
                        { id: '5', title: '✨ Edit Profile',        description: 'Update your skills & info' },
                    ]
                }
            ]
        };
    }

    // ── OTP ───────────────────────────────────────────────────────────────────
    static otpSent(phone: string): string {
        return (
            `🔐 *Verification Code Sent*\n\n` +
            `We sent a 6-digit code to *+${phone}*.\n\n` +
            `Please enter the code below to verify your account:`
        );
    }

    // ── PROFILE SETUP ─────────────────────────────────────────────────────────
    static profileSetupWelcome(name: string): any {
        return {
            type: 'list',
            text: (
                `🎉 *Welcome, ${name}!*\n\n` +
                `Let's build your Match Network profile. This takes about 1 minute and helps us find you the *perfect matches*.\n\n` +
                `First, what's your experience level?`
            ),
            buttonText: 'Select Level',
            sections: [
                {
                    title: 'Experience Level',
                    rows: [
                        { id: 'exp_1', title: '🎓 Student',        description: 'Currently studying' },
                        { id: 'exp_2', title: '🌱 Junior',         description: '0–2 years experience' },
                        { id: 'exp_3', title: '🔧 Mid-level',      description: '2–5 years experience' },
                        { id: 'exp_4', title: '🚀 Senior',         description: '5–10 years experience' },
                        { id: 'exp_5', title: '🏆 Expert',         description: '10+ years experience' },
                    ]
                }
            ]
        };
    }

    // ── EXPERIENCE LEVEL — Interactive List ───────────────────────────────────
    static askExperienceLevel(): any {
        return {
            type: 'list',
            text: `💼 *What is your experience level?*\n\nThis helps us match you with the right people.`,
            buttonText: 'Select Level',
            sections: [
                {
                    title: 'Experience Level',
                    rows: [
                        { id: 'exp_1', title: '🎓 Student',        description: 'Currently studying' },
                        { id: 'exp_2', title: '🌱 Junior',         description: '0–2 years experience' },
                        { id: 'exp_3', title: '🔧 Mid-level',      description: '2–5 years experience' },
                        { id: 'exp_4', title: '🚀 Senior',         description: '5–10 years experience' },
                        { id: 'exp_5', title: '🏆 Expert',         description: '10+ years experience' },
                    ]
                }
            ]
        };
    }

    // ── SKILLS (free-form text) ───────────────────────────────────────────────
    static askProfileSkills(): string {
        return (
            `🛠 *What are your top skills?*\n\n` +
            `Type them separated by commas and we'll find you the perfect matches:\n\n` +
            `_e.g. React, Node.js, UI/UX Design, Sales_\n\n` +
            `_You can enter up to 10 skills_`
        );
    }

    static askSkills(): string {
        return (
            `🔍 *Which skills are you looking for?*\n\n` +
            `Type the skills you need in a collaborator, separated by commas:\n\n` +
            `_e.g. React, Marketing, Fundraising_`
        );
    }

    // ── LOCATION (free-form text) ─────────────────────────────────────────────
    static askLocation(): string {
        return (
            `📍 *Where are you based?*\n\n` +
            `Enter your city and we'll factor location into your matches:\n\n` +
            `_e.g. Mumbai, Bangalore, Hyderabad_\n\n` +
            `_Type *skip* to set this later_`
        );
    }

    // ── AVAILABILITY — Interactive Buttons ────────────────────────────────────
    static askProfileAvailability(): any {
        return {
            type: 'buttons',
            text: (
                `📅 *What's your current availability?*\n\n` +
                `Let potential matches know if you're open to connect right now.\n\n` +
                `🟢 *Available* — Actively looking\n` +
                `🟡 *Busy* — Open but selective\n` +
                `🔴 *Away* — Not available`
            ),
            buttons: [
                { id: 'avail_1', title: '🟢 Available' },
                { id: 'avail_2', title: '🟡 Busy' },
                { id: 'avail_3', title: '🔴 Away' },
            ]
        };
    }

    static availabilityMenu(): any {
        return {
            type: 'buttons',
            text: (
                `📅 *Update your availability*\n\n` +
                `Let your network know if you're open to new connections.\n\n` +
                `🟢 *Available* — Actively looking\n` +
                `🟡 *Busy* — Open but selective\n` +
                `🔴 *Away* — Not available`
            ),
            buttons: [
                { id: 'avail_1', title: '🟢 Available' },
                { id: 'avail_2', title: '🟡 Busy' },
                { id: 'avail_3', title: '🔴 Away' },
            ]
        };
    }

    // ── PROFILE COMPLETE ──────────────────────────────────────────────────────
    static profileComplete(name: string): any {
        return this.mainMenu(
            `✅ *Profile Complete!*\n\n` +
            `You're all set, *${name}*. Start discovering matches and growing your network 🚀`
        );
    }

    // ── CONNECTION TYPE — Interactive List ────────────────────────────────────
    static askConnectionType(): any {
        return {
            type: 'list',
            text: `🤝 *What kind of connection are you looking for?*\n\nSelect the option that best describes your goal.`,
            buttonText: 'Select Type',
            sections: [
                {
                    title: 'Connection Type',
                    rows: [
                        { id: 'conn_1', title: '💡 Collaboration',      description: 'Build a project or startup together' },
                        { id: 'conn_2', title: '🎓 Mentorship',         description: 'Learn from an experienced professional' },
                        { id: 'conn_3', title: '💼 Job Opportunity',    description: 'Hire or get hired' },
                        { id: 'conn_4', title: '📚 Internship',         description: 'Internship or work experience' },
                        { id: 'conn_5', title: '💰 Investment',         description: 'Raise or provide funding' },
                        { id: 'conn_6', title: '🌐 Networking',         description: 'Expand your professional circle' },
                    ]
                }
            ]
        };
    }

    // ── MATCH RESULTS — Interactive List ─────────────────────────────────────
    static matchResults(matches: any[]): any {
        if (matches.length === 0) {
            return this.mainMenu(`😔 *No matches found* for those skills right now.\n\nTry broader or different skills.`);
        }

        const rows = matches.map((m, i) => ({
            id: String(i + 1),
            title: m.name,
            description: `${Math.round(m.matchScore * 100)}% match · ${m.city || 'Remote'}`
        }));

        rows.push({ id: '0', title: '↩ Back to Menu', description: 'Return to main menu' });

        return {
            type: 'list',
            text: (
                `🎯 *${matches.length} Match${matches.length > 1 ? 'es' : ''} Found!*\n\n` +
                matches.map((m, i) =>
                    `*${i + 1}. ${m.name}*\n` +
                    `📍 ${m.city || 'Remote'} · ⚡ ${Math.round(m.matchScore * 100)}% match\n` +
                    `🛠 ${m.matchingSkills.join(', ')}`
                ).join('\n\n') +
                `\n\nSelect a profile below to send a connection request.`
            ),
            buttonText: 'View Matches',
            sections: [
                {
                    title: 'Select a Match',
                    rows
                }
            ]
        };
    }

    // ── CONNECTION SENT ───────────────────────────────────────────────────────
    static connectionSent(name: string): any {
        return this.mainMenu(
            `✅ *Request Sent!*\n\n` +
            `Your connection request has been sent to *${name}*.\n` +
            `They'll receive a WhatsApp notification shortly.`
        );
    }

    // ── PENDING REQUESTS ──────────────────────────────────────────────────────
    static pendingRequests(requests: any[]): any {
        if (requests.length === 0) {
            return this.mainMenu(`📭 *No Pending Requests*\n\nYou're all caught up! Find new matches to grow your network.`);
        }

        const rows = requests.map((r, i) => ({
            id: String(i + 1),
            title: r.requester.name,
            description: `${r.requester.profile?.city || 'Unknown'} · Tap to respond`
        }));
        rows.push({ id: '0', title: '↩ Back to Menu', description: 'Return to main menu' });

        return {
            type: 'list',
            text: (
                `📬 *${requests.length} Pending Request${requests.length > 1 ? 's' : ''}*\n\n` +
                requests.map((r, i) =>
                    `*${i + 1}. ${r.requester.name}*\n` +
                    `📍 ${r.requester.profile?.city || 'Unknown'}\n` +
                    `💬 "${r.note || 'No message attached'}"`
                ).join('\n\n') +
                `\n\nSelect a request to respond.`
            ),
            buttonText: 'View Requests',
            sections: [
                {
                    title: 'Incoming Requests',
                    rows
                }
            ]
        };
    }

    // ── MY CONNECTIONS ────────────────────────────────────────────────────────
    static myConnections(connections: any[], userId: string): any {
        if (connections.length === 0) {
            return this.mainMenu(`🕸 *No Connections Yet*\n\nStart finding matches to grow your professional network!`);
        }

        const others = connections.map(c =>
            c.requesterId === userId ? c.receiver : c.requester
        );

        return this.mainMenu(
            `🌐 *Your Network (${connections.length})*\n\n` +
            others.map((o, i) =>
                `*${i + 1}. ${o.name}*\n` +
                `📍 ${o.profile?.city || 'Unknown'} · ${o.profile?.experienceLevel || 'N/A'}`
            ).join('\n\n')
        );
    }
}