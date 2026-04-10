import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const skills = [
    // Programming Languages
    { name: 'JavaScript', category: 'Programming', slug: 'javascript' },
    { name: 'TypeScript', category: 'Programming', slug: 'typescript' },
    { name: 'Python', category: 'Programming', slug: 'python' },
    { name: 'Java', category: 'Programming', slug: 'java' },
    { name: 'Go', category: 'Programming', slug: 'go' },
    { name: 'Rust', category: 'Programming', slug: 'rust' },
    { name: 'C++', category: 'Programming', slug: 'cpp' },
    { name: 'Swift', category: 'Programming', slug: 'swift' },
    { name: 'Kotlin', category: 'Programming', slug: 'kotlin' },
    { name: 'PHP', category: 'Programming', slug: 'php' },
    { name: 'Ruby', category: 'Programming', slug: 'ruby' },
    { name: 'Dart', category: 'Programming', slug: 'dart' },

    // Frontend
    { name: 'React', category: 'Frontend', slug: 'react' },
    { name: 'Next.js', category: 'Frontend', slug: 'nextjs' },
    { name: 'Vue.js', category: 'Frontend', slug: 'vuejs' },
    { name: 'Angular', category: 'Frontend', slug: 'angular' },
    { name: 'HTML/CSS', category: 'Frontend', slug: 'html-css' },
    { name: 'Tailwind CSS', category: 'Frontend', slug: 'tailwind' },
    { name: 'Svelte', category: 'Frontend', slug: 'svelte' },

    // Backend
    { name: 'Node.js', category: 'Backend', slug: 'nodejs' },
    { name: 'Express.js', category: 'Backend', slug: 'expressjs' },
    { name: 'FastAPI', category: 'Backend', slug: 'fastapi' },
    { name: 'Django', category: 'Backend', slug: 'django' },
    { name: 'Spring Boot', category: 'Backend', slug: 'spring-boot' },
    { name: 'GraphQL', category: 'Backend', slug: 'graphql' },
    { name: 'REST API Design', category: 'Backend', slug: 'rest-api' },

    // Mobile
    { name: 'React Native', category: 'Mobile', slug: 'react-native' },
    { name: 'Flutter', category: 'Mobile', slug: 'flutter' },
    { name: 'iOS Development', category: 'Mobile', slug: 'ios-dev' },
    { name: 'Android Development', category: 'Mobile', slug: 'android-dev' },

    // Database
    { name: 'PostgreSQL', category: 'Database', slug: 'postgresql' },
    { name: 'MySQL', category: 'Database', slug: 'mysql' },
    { name: 'MongoDB', category: 'Database', slug: 'mongodb' },
    { name: 'Redis', category: 'Database', slug: 'redis' },
    { name: 'Elasticsearch', category: 'Database', slug: 'elasticsearch' },
    { name: 'Firebase', category: 'Database', slug: 'firebase' },
    { name: 'Supabase', category: 'Database', slug: 'supabase' },

    // Cloud & DevOps
    { name: 'AWS', category: 'Cloud', slug: 'aws' },
    { name: 'Google Cloud', category: 'Cloud', slug: 'gcp' },
    { name: 'Azure', category: 'Cloud', slug: 'azure' },
    { name: 'Docker', category: 'DevOps', slug: 'docker' },
    { name: 'Kubernetes', category: 'DevOps', slug: 'kubernetes' },
    { name: 'CI/CD', category: 'DevOps', slug: 'cicd' },
    { name: 'Terraform', category: 'DevOps', slug: 'terraform' },
    { name: 'Linux', category: 'DevOps', slug: 'linux' },

    // AI / ML
    { name: 'Machine Learning', category: 'AI/ML', slug: 'machine-learning' },
    { name: 'Deep Learning', category: 'AI/ML', slug: 'deep-learning' },
    { name: 'NLP', category: 'AI/ML', slug: 'nlp' },
    { name: 'Computer Vision', category: 'AI/ML', slug: 'computer-vision' },
    { name: 'LLM / Prompt Engineering', category: 'AI/ML', slug: 'llm-prompt' },
    { name: 'Data Science', category: 'AI/ML', slug: 'data-science' },
    { name: 'TensorFlow', category: 'AI/ML', slug: 'tensorflow' },
    { name: 'PyTorch', category: 'AI/ML', slug: 'pytorch' },

    // Design
    { name: 'UI/UX Design', category: 'Design', slug: 'ui-ux-design' },
    { name: 'Figma', category: 'Design', slug: 'figma' },
    { name: 'Graphic Design', category: 'Design', slug: 'graphic-design' },
    { name: 'Product Design', category: 'Design', slug: 'product-design' },
    { name: 'Motion Design', category: 'Design', slug: 'motion-design' },
    { name: 'Brand Identity', category: 'Design', slug: 'brand-identity' },

    // Business & Product
    { name: 'Product Management', category: 'Business', slug: 'product-management' },
    { name: 'Project Management', category: 'Business', slug: 'project-management' },
    { name: 'Business Development', category: 'Business', slug: 'business-development' },
    { name: 'Sales', category: 'Business', slug: 'sales' },
    { name: 'Marketing', category: 'Business', slug: 'marketing' },
    { name: 'Growth Hacking', category: 'Business', slug: 'growth-hacking' },
    { name: 'SEO', category: 'Business', slug: 'seo' },
    { name: 'Content Writing', category: 'Business', slug: 'content-writing' },
    { name: 'Copywriting', category: 'Business', slug: 'copywriting' },
    { name: 'Finance & Accounting', category: 'Business', slug: 'finance-accounting' },

    // Blockchain / Web3
    { name: 'Solidity', category: 'Blockchain', slug: 'solidity' },
    { name: 'Smart Contracts', category: 'Blockchain', slug: 'smart-contracts' },
    { name: 'Web3.js / Ethers.js', category: 'Blockchain', slug: 'web3-ethers' },
    { name: 'DeFi', category: 'Blockchain', slug: 'defi' },
    { name: 'NFT Development', category: 'Blockchain', slug: 'nft-dev' },

    // Soft Skills / Other
    { name: 'Leadership', category: 'Soft Skills', slug: 'leadership' },
    { name: 'Public Speaking', category: 'Soft Skills', slug: 'public-speaking' },
    { name: 'Mentorship', category: 'Soft Skills', slug: 'mentorship' },
    { name: 'Research', category: 'Soft Skills', slug: 'research' },
    { name: 'Technical Writing', category: 'Soft Skills', slug: 'technical-writing' },
];

async function main() {
    console.log('🌱 Seeding skills...');

    let created = 0;
    let skipped = 0;

    for (const skill of skills) {
        const existing = await prisma.skill.findUnique({ where: { slug: skill.slug } });
        if (!existing) {
            await prisma.skill.create({ data: skill });
            created++;
        } else {
            skipped++;
        }
    }

    console.log(`✅ Seeding skills complete — ${created} created, ${skipped} already existed`);

    console.log('👤 Seeding dummy users and teammate requests...');
    const dummyUsers = [
        {
            phoneNumber: '+1234567890',
            name: 'John Doe',
            email: 'john@example.com',
            isVerified: true,
        },
        {
            phoneNumber: '+0987654321',
            name: 'Jane Smith',
            email: 'jane@example.com',
            isVerified: true,
        }
    ];

    for (const userData of dummyUsers) {
        const user = await prisma.user.upsert({
            where: { phoneNumber: userData.phoneNumber },
            update: {},
            create: userData,
        });

        const projects = [
            {
                title: `${user.name}'s Awesome Project`,
                description: 'This is a test project created via seed.ts to verify the browse projects feature.',
                requiredSkills: ['JavaScript', 'React', 'Node.js'],
                status: 'OPEN' as const,
            },
            {
                title: `Startup Idea by ${user.name}`,
                description: 'Looking for co-founders to build the next big thing in AI and networking.',
                requiredSkills: ['Python', 'Machine Learning', 'TypeScript'],
                status: 'OPEN' as const,
            }
        ];

        for (const project of projects) {
            const existingProject = await prisma.teammateRequest.findFirst({
                where: { title: project.title, creatorId: user.id }
            });

            if (!existingProject) {
                await prisma.teammateRequest.create({
                    data: {
                        ...project,
                        creatorId: user.id
                    }
                });
                console.log(`🚀 Created project: ${project.title}`);
            }
        }
    }

    console.log(`📊 Total skills in DB: ${await prisma.skill.count()}`);
    console.log(`📊 Total users in DB: ${await prisma.user.count()}`);
    console.log(`📊 Total projects in DB: ${await prisma.teammateRequest.count()}`);
}

main()
    .catch((err) => {
        console.error('❌ Seed failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
