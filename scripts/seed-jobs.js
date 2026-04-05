import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Company from '../src/models/Company.js';
import Job from '../src/models/Job.js';
import UserProfile from '../src/models/UserProfile.js';

dotenv.config();

const seedJobs = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/jobhub_v2');
    console.log('Connected to MongoDB');

    await Job.deleteMany({});
    await Company.deleteMany({});
    await UserProfile.deleteMany({});
    console.log('Cleared existing data');

    // Use placeholder IDs that match the format expected by the application
    // In a real app, these would come from Better-Auth user IDs
    const employerIds = ['seed_employer_1', 'seed_employer_2', 'seed_employer_3'];

    const companies = await Company.create([
      {
        userId: employerIds[0],
        name: 'TechCorp Inc.',
        description: 'TechCorp is a leading technology company specializing in cloud solutions, artificial intelligence, and enterprise software. We foster innovation and provide excellent career growth opportunities.',
        industry: 'Technology',
        size: '501-1000',
        headquarters: 'San Francisco, CA',
        website: 'https://techcorp.com',
        foundedYear: 2010,
        specializations: ['Cloud Computing', 'AI', 'Enterprise Software', 'DevOps'],
        socialLinks: { linkedin: 'https://linkedin.com/company/techcorp', twitter: 'https://twitter.com/techcorp' },
        verified: true,
        verifiedAt: new Date(),
        status: 'approved',
        analytics: { totalViews: 1500, totalApplications: 45, profileViews: 200 }
      },
      {
        userId: employerIds[1],
        name: 'StartupXYZ',
        description: 'StartupXYZ is a fast-growing fintech startup revolutionizing payment solutions. Join us to build the future of digital payments!',
        industry: 'Finance',
        size: '51-200',
        headquarters: 'New York, NY',
        website: 'https://startupxyz.io',
        foundedYear: 2020,
        specializations: ['Fintech', 'Mobile Payments', 'Blockchain'],
        socialLinks: { linkedin: 'https://linkedin.com/company/startupxyz', twitter: 'https://twitter.com/startupxyz' },
        verified: true,
        verifiedAt: new Date(),
        status: 'approved',
        analytics: { totalViews: 800, totalApplications: 32, profileViews: 120 }
      },
      {
        userId: employerIds[2],
        name: 'Global Finance Corp',
        description: 'Global Finance Corp is a worldwide leader in investment banking and financial services. We offer competitive salaries and comprehensive benefits.',
        industry: 'Finance',
        size: '1000+',
        headquarters: 'London, UK',
        website: 'https://globalfinance.com',
        foundedYear: 1995,
        specializations: ['Investment Banking', 'Wealth Management', 'Asset Management'],
        socialLinks: { linkedin: 'https://linkedin.com/company/globalfinance' },
        verified: true,
        verifiedAt: new Date(),
        status: 'approved',
        analytics: { totalViews: 2000, totalApplications: 78, profileViews: 350 }
      },
    ]);
    console.log(`Created ${companies.length} companies`);

    const jobData = [
      {
        title: 'Senior Full Stack Developer',
        description: `We are looking for an experienced Full Stack Developer to join our engineering team. You will work on cutting-edge projects using modern technologies.

Responsibilities:
- Design and develop scalable web applications
- Collaborate with product and design teams
- Write clean, maintainable code
- Mentor junior developers
- Participate in code reviews and technical planning

Requirements:
- 5+ years of experience in web development
- Proficiency in React, Node.js, and TypeScript
- Experience with cloud platforms (AWS/GCP)
- Strong problem-solving skills
- Excellent communication skills`,
        requirements: ['5+ years experience', 'React/Node.js', 'TypeScript', 'Cloud platforms', "Bachelor's degree"],
        skills: ['React', 'Node.js', 'TypeScript', 'AWS', 'GraphQL', 'PostgreSQL'],
        location: 'Remote',
        type: 'Full-time',
        category: 'Technology',
        experienceLevel: 'Senior',
        salaryMin: 120000,
        salaryMax: 160000,
        postedBy: employerIds[0],
        company: companies[0]._id,
        status: 'approved',
        isActive: true,
        views: 156,
        applicationsCount: 12
      },
      {
        title: 'Frontend Developer - React',
        description: `Join our frontend team to build beautiful, responsive web applications. You'll work closely with designers to implement pixel-perfect UIs.

Responsibilities:
- Build React components and features
- Optimize application performance
- Write unit and integration tests
- Collaborate with UX/UI designers
- Contribute to design system development

Requirements:
- 3+ years of React experience
- Strong JavaScript/TypeScript skills
- Experience with CSS frameworks (Tailwind, Styled Components)
- Understanding of web accessibility
- Portfolio of recent projects`,
        requirements: ['3+ years React', 'TypeScript', 'CSS frameworks', 'Portfolio'],
        skills: ['React', 'TypeScript', 'Tailwind CSS', 'Jest', 'Figma'],
        location: 'San Francisco, CA',
        type: 'Full-time',
        category: 'Technology',
        experienceLevel: 'Mid',
        salaryMin: 90000,
        salaryMax: 130000,
        postedBy: employerIds[0],
        company: companies[0]._id,
        status: 'approved',
        isActive: true,
        views: 98,
        applicationsCount: 8
      },
      {
        title: 'Backend Engineer - Node.js',
        description: `We're seeking a Backend Engineer to design and implement robust APIs and microservices. You'll work on high-traffic systems serving millions of users.

Responsibilities:
- Design and build RESTful APIs
- Optimize database queries and schema
- Implement authentication and authorization
- Write comprehensive documentation
- Mentor junior engineers

Requirements:
- 4+ years of backend development experience
- Expert in Node.js and Express
- Experience with PostgreSQL and Redis
- Knowledge of microservices architecture
- Strong debugging and troubleshooting skills`,
        requirements: ['4+ years backend', 'Node.js', 'PostgreSQL', 'Microservices'],
        skills: ['Node.js', 'Express', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes'],
        location: 'Remote',
        type: 'Full-time',
        category: 'Technology',
        experienceLevel: 'Senior',
        salaryMin: 130000,
        salaryMax: 170000,
        postedBy: employerIds[0],
        company: companies[0]._id,
        status: 'approved',
        isActive: true,
        views: 145,
        applicationsCount: 15
      },
      {
        title: 'Junior Software Developer',
        description: `Great opportunity for recent graduates to start their career in tech! You'll receive training and mentorship while working on real projects.

Responsibilities:
- Learn and implement new technologies
- Fix bugs and implement small features
- Write automated tests
- Participate in team meetings and code reviews

Requirements:
- Bachelor's degree in Computer Science or related field
- Basic understanding of JavaScript/Python
- Eagerness to learn and grow
- Good communication skills`,
        requirements: ["Bachelor's degree", 'Basic programming', 'Eagerness to learn'],
        skills: ['JavaScript', 'Python', 'Git', 'HTML/CSS'],
        location: 'New York, NY',
        type: 'Full-time',
        category: 'Technology',
        experienceLevel: 'Entry',
        salaryMin: 60000,
        salaryMax: 80000,
        postedBy: employerIds[1],
        company: companies[1]._id,
        status: 'approved',
        isActive: true,
        views: 234,
        applicationsCount: 45
      },
      {
        title: 'DevOps Engineer',
        description: `Join our infrastructure team to build and maintain our cloud-native platform. You'll work with cutting-edge DevOps tools and practices.

Responsibilities:
- Manage Kubernetes clusters and CI/CD pipelines
- Implement infrastructure as code (Terraform)
- Monitor and optimize system performance
- Ensure security best practices
- On-call rotation for production incidents

Requirements:
- 3+ years of DevOps experience
- Strong knowledge of AWS/GCP
- Experience with Kubernetes and Docker
- Familiarity with monitoring tools (Prometheus, Grafana)
- Scripting skills (Bash, Python)`,
        requirements: ['3+ years DevOps', 'Kubernetes', 'AWS', 'Terraform'],
        skills: ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'Jenkins', 'Prometheus'],
        location: 'Remote',
        type: 'Full-time',
        category: 'Technology',
        experienceLevel: 'Mid',
        salaryMin: 100000,
        salaryMax: 140000,
        postedBy: employerIds[1],
        company: companies[1]._id,
        status: 'approved',
        isActive: true,
        views: 112,
        applicationsCount: 9
      },
      {
        title: 'Product Manager',
        description: `Lead product initiatives for our payment platform. Work with engineering, design, and business teams to deliver exceptional user experiences.

Responsibilities:
- Define product roadmap and strategy
- Write detailed requirements and user stories
- Conduct user research and analyze metrics
- Coordinate product launches
- Manage stakeholder expectations

Requirements:
- 5+ years of product management experience
- Experience in fintech or payments industry
- Strong analytical and communication skills
- Technical background preferred
- Experience with Agile methodologies`,
        requirements: ['5+ years PM', 'Fintech experience', 'Technical background', 'Agile'],
        skills: ['Product Strategy', 'Agile', 'Data Analysis', 'Jira', 'Figma'],
        location: 'New York, NY',
        type: 'Full-time',
        category: 'Technology',
        experienceLevel: 'Senior',
        salaryMin: 140000,
        salaryMax: 180000,
        postedBy: employerIds[1],
        company: companies[1]._id,
        status: 'approved',
        isActive: true,
        views: 89,
        applicationsCount: 11
      },
      {
        title: 'Data Scientist',
        description: `Join our data science team to build ML models that power our financial products. Work with petabytes of data to derive insights and build predictive models.

Responsibilities:
- Develop and deploy machine learning models
- Analyze large datasets to identify patterns
- Create data visualizations and reports
- Collaborate with engineering teams
- Stay current with latest ML research

Requirements:
- MS/PhD in Data Science, Statistics, or related field
- Proficiency in Python and ML frameworks
- Experience with SQL and big data tools
- Strong statistical background
- Published research or portfolio projects`,
        requirements: ['MS/PhD', 'Python', 'ML frameworks', 'SQL', 'Statistics'],
        skills: ['Python', 'TensorFlow', 'PyTorch', 'SQL', 'Spark', 'Tableau'],
        location: 'Remote',
        type: 'Full-time',
        category: 'Technology',
        experienceLevel: 'Mid',
        salaryMin: 110000,
        salaryMax: 150000,
        postedBy: employerIds[2],
        company: companies[2]._id,
        status: 'approved',
        isActive: true,
        views: 178,
        applicationsCount: 22
      },
      {
        title: 'Investment Banking Analyst',
        description: `Join our investment banking division to work on M&A transactions and capital raising deals for major corporate clients.

Responsibilities:
- Analyze financial statements and valuation models
- Prepare pitch decks and investment memoranda
- Conduct market research and industry analysis
- Support deal execution teams
- Manage client relationships

Requirements:
- Bachelor's degree in Finance, Economics, or related field
- Strong Excel and PowerPoint skills
- Excellent analytical and communication skills
- Ability to work long hours in a fast-paced environment
- Relevant internship experience preferred`,
        requirements: ['Finance degree', 'Excel/PowerPoint', 'Analytical skills', 'Fast-paced'],
        skills: ['Financial Modeling', 'Excel', 'PowerPoint', 'Valuation', 'M&A'],
        location: 'London, UK',
        type: 'Full-time',
        category: 'Finance',
        experienceLevel: 'Entry',
        salaryMin: 70000,
        salaryMax: 90000,
        postedBy: employerIds[2],
        company: companies[2]._id,
        status: 'approved',
        isActive: true,
        views: 267,
        applicationsCount: 56
      },
      {
        title: 'UX Designer',
        description: `Design intuitive and beautiful user experiences for our web and mobile applications. Work closely with product and engineering teams.

Responsibilities:
- Create wireframes, prototypes, and high-fidelity designs
- Conduct user research and usability testing
- Maintain and evolve design system
- Collaborate with developers for implementation
- Present designs to stakeholders

Requirements:
- 3+ years of UX design experience
- Strong portfolio demonstrating design process
- Proficiency in Figma and design tools
- Understanding of user-centered design principles
- Experience with design systems`,
        requirements: ['3+ years UX', 'Figma', 'Portfolio', 'User research'],
        skills: ['Figma', 'Sketch', 'Adobe XD', 'User Research', 'Prototyping'],
        location: 'San Francisco, CA',
        type: 'Full-time',
        category: 'Design',
        experienceLevel: 'Mid',
        salaryMin: 95000,
        salaryMax: 135000,
        postedBy: employerIds[0],
        company: companies[0]._id,
        status: 'approved',
        isActive: true,
        views: 134,
        applicationsCount: 18
      },
      {
        title: 'Marketing Manager',
        description: `Lead marketing initiatives to drive brand awareness and lead generation. Own the marketing strategy across multiple channels.

Responsibilities:
- Develop and execute marketing campaigns
- Manage social media and content strategy
- Analyze marketing metrics and ROI
- Collaborate with sales team
- Manage marketing budget

Requirements:
- 5+ years of marketing experience
- Experience in B2B tech marketing
- Strong analytical and project management skills
- Excellent written and verbal communication
- Experience with marketing automation tools`,
        requirements: ['5+ years marketing', 'B2B', 'Analytics', 'Automation tools'],
        skills: ['Digital Marketing', 'SEO', 'Content Strategy', 'Google Analytics', 'HubSpot'],
        location: 'New York, NY',
        type: 'Full-time',
        category: 'Marketing',
        experienceLevel: 'Senior',
        salaryMin: 100000,
        salaryMax: 140000,
        postedBy: employerIds[1],
        company: companies[1]._id,
        status: 'approved',
        isActive: true,
        views: 87,
        applicationsCount: 7
      },
      {
        title: 'Part-time Intern - Software Engineering',
        description: `Gain real-world experience as a software engineering intern. Perfect for students looking to explore the tech industry.

Responsibilities:
- Assist with bug fixes and small features
- Write automated tests
- Participate in code reviews
- Learn from experienced engineers

Requirements:
- Currently enrolled in CS or related program
- Basic programming knowledge
- Eager to learn
- Available for 20 hours/week`,
        requirements: ['CS student', 'Basic programming', 'Eager to learn'],
        skills: ['Programming Basics', 'Git', 'Communication'],
        location: 'Remote',
        type: 'Internship',
        category: 'Technology',
        experienceLevel: 'Entry',
        salaryMin: 20000,
        salaryMax: 30000,
        postedBy: employerIds[0],
        company: companies[0]._id,
        status: 'approved',
        isActive: true,
        views: 345,
        applicationsCount: 67
      },
      {
        title: 'QA Engineer',
        description: `Join our quality assurance team to ensure our products meet the highest standards. You'll test web and mobile applications.

Responsibilities:
- Write and execute test plans
- Identify and document bugs
- Perform regression testing
- Collaborate with developers
- Implement automated testing frameworks

Requirements:
- 2+ years of QA experience
- Experience with Selenium or similar tools
- Understanding of SDLC
- Detail-oriented with strong analytical skills
- Basic scripting knowledge`,
        requirements: ['2+ years QA', 'Selenium', 'SDLC', 'Detail-oriented'],
        skills: ['Selenium', 'Cypress', 'Jest', 'Jira', 'API Testing'],
        location: 'Remote',
        type: 'Full-time',
        category: 'Technology',
        experienceLevel: 'Mid',
        salaryMin: 70000,
        salaryMax: 95000,
        postedBy: employerIds[1],
        company: companies[1]._id,
        status: 'approved',
        isActive: true,
        views: 76,
        applicationsCount: 5
      }
    ];

    const jobs = await Job.insertMany(jobData);
    console.log(`Created ${jobs.length} jobs`);

    // Create sample user profiles (without userId linking for now)
    const profiles = await UserProfile.create([
      { userId: 'seed_candidate_1', role: 'candidate', bio: 'Full-stack developer with 5 years of experience', skills: ['JavaScript', 'React', 'Node.js', 'Python', 'AWS'], location: 'San Francisco, CA', isProfileComplete: true, profileCompletionScore: 80 },
      { userId: 'seed_candidate_2', role: 'candidate', bio: 'Creative UX designer passionate about user experience', skills: ['Figma', 'Sketch', 'User Research', 'Prototyping'], location: 'New York, NY', isProfileComplete: true, profileCompletionScore: 70 },
      { userId: 'seed_candidate_3', role: 'candidate', bio: 'Data analyst with expertise in SQL and Python', skills: ['Python', 'SQL', 'Tableau', 'Statistics'], location: 'Chicago, IL', isProfileComplete: true, profileCompletionScore: 60 },
    ]);
    console.log(`Created ${profiles.length} user profiles`);

    console.log('\n=== Seed Data Summary ===');
    console.log(`Companies: ${companies.length}`);
    console.log(`Jobs: ${jobs.length}`);
    console.log(`Profiles: ${profiles.length}`);
    console.log('\nJob Titles:');
    jobs.forEach((job, i) => console.log(`  ${i + 1}. ${job.title} (${job.company.name})`));

    console.log('\nSeed data created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedJobs();