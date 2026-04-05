import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Company from '../models/Company.js';
import Job from '../models/Job.js';

dotenv.config();

const seedJobs = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jobhub');
    console.log('Connected to MongoDB');

    // Don't delete existing data - just add jobs if none exist
    const existingJobs = await Job.countDocuments();
    if (existingJobs > 0) {
      console.log(`Already have ${existingJobs} jobs in database`);
    }

    // Get users directly from MongoDB user collection
    const db = mongoose.connection.db;
    const usersCollection = db.collection('user');
    const users = await usersCollection.find({}).toArray();
    console.log(`Found ${users.length} users`);

    const employerUsers = users.filter(u => u.metadata?.role === 'employer' || (u.email && u.email.includes('employer')));
    console.log(`Found ${employerUsers.length} employer users`);

    // Get or create employer user IDs for each company (need unique ones due to unique index)
    let employerUserIds = [];
    if (employerUsers.length >= 8) {
      employerUserIds = employerUsers.slice(0, 8).map(u => u._id);
    } else {
      // Get existing employer user IDs
      const existingIds = employerUsers.map(u => u._id);
      
      // Need to create additional employer users for unique companies
      const needed = 8 - existingIds.length;
      const newUserIds = [];
      for (let i = 0; i < needed; i++) {
        newUserIds.push(new mongoose.Types.ObjectId());
      }
      
      if (newUserIds.length > 0) {
        const usersCollection = db.collection('user');
        await usersCollection.insertMany(newUserIds.map((id, i) => ({
          _id: id,
          email: `employer${existingIds.length + i + 1}@jobhub.com`,
          emailVerified: true,
          name: `Employer ${existingIds.length + i + 1}`,
          image: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { role: 'employer' }
        })));
        console.log(`Created ${newUserIds.length} additional employer users`);
      }
      
      employerUserIds = [...existingIds, ...newUserIds];
    }

    const companies = [
      { userId: employerUserIds[0], name: 'TechCorp Solutions', description: 'Leading provider of enterprise software solutions, serving Fortune 500 companies with cutting-edge technology.', industry: 'Technology', size: '201-500', headquarters: 'San Francisco, CA', website: 'https://techcorp.example.com', foundedYear: 2010, specializations: ['Cloud Computing', 'AI/ML', 'Enterprise Software'], verified: true, status: 'approved' },
      { userId: employerUserIds[1], name: 'FinanceFlow Inc', description: 'Modern fintech company revolutionizing personal and business finance with innovative digital solutions.', industry: 'Finance', size: '51-200', headquarters: 'New York, NY', website: 'https://financeflow.example.com', foundedYear: 2018, specializations: ['Digital Banking', 'Payment Processing', 'Blockchain'], verified: true, status: 'approved' },
      { userId: employerUserIds[2], name: 'HealthPlus Medical', description: 'Healthcare technology company focused on improving patient outcomes through digital innovation.', industry: 'Healthcare', size: '501-1000', headquarters: 'Boston, MA', website: 'https://healthplus.example.com', foundedYear: 2015, specializations: ['Telemedicine', 'Health Analytics', 'Medical Devices'], verified: true, status: 'approved' },
      { userId: employerUserIds[3], name: 'DesignStudio Creative', description: 'Award-winning design agency creating memorable digital experiences for brands worldwide.', industry: 'Media', size: '11-50', headquarters: 'Los Angeles, CA', website: 'https://designstudio.example.com', foundedYear: 2019, specializations: ['UI/UX Design', 'Brand Identity', 'Motion Graphics'], verified: true, status: 'approved' },
      { userId: employerUserIds[4], name: 'DataDriven Analytics', description: 'Data analytics consultancy helping businesses make smarter decisions through actionable insights.', industry: 'Consulting', size: '51-200', headquarters: 'Chicago, IL', website: 'https://datadriven.example.com', foundedYear: 2017, specializations: ['Business Intelligence', 'Predictive Analytics', 'Data Visualization'], verified: false, status: 'approved' },
      { userId: employerUserIds[5], name: 'GreenEnergy Solutions', description: 'Sustainable energy company developing clean technology solutions for a greener future.', industry: 'Technology', size: '201-500', headquarters: 'Austin, TX', website: 'https://greenenergy.example.com', foundedYear: 2014, specializations: ['Solar Energy', 'Energy Storage', 'Smart Grids'], verified: true, status: 'approved' },
      { userId: employerUserIds[6], name: 'EduSmart Platform', description: 'EdTech company creating interactive learning experiences for students and educators.', industry: 'Education', size: '51-200', headquarters: 'Seattle, WA', website: 'https://edusmart.example.com', foundedYear: 2020, specializations: ['E-Learning', 'Adaptive Learning', 'Educational Games'], verified: true, status: 'approved' },
      { userId: employerUserIds[7], name: 'RetailPro Systems', description: 'Retail technology provider helping stores optimize operations and enhance customer experiences.', industry: 'Retail', size: '201-500', headquarters: 'Miami, FL', website: 'https://retailpro.example.com', foundedYear: 2012, specializations: ['POS Systems', 'Inventory Management', 'CRM'], verified: false, status: 'approved' }
    ];

    const createdCompanies = await Company.insertMany(companies);
    console.log(`Created ${createdCompanies.length} companies`);

    // Map company index to user ID for job postedBy
    const companyToUserMap = createdCompanies.map((c, i) => ({
      companyId: c._id,
      userId: employerUserIds[i]
    }));

    const jobData = [
      {
        title: 'Senior Full Stack Developer',
        description: 'Join our engineering team to build scalable web applications. You will work with modern technologies including React, Node.js, and cloud infrastructure.',
        requirements: [
          '5+ years of full-stack development experience',
          'Proficiency in React, Node.js, TypeScript',
          'Experience with cloud platforms (AWS/GCP)',
          'Strong understanding of system design'
        ],
        skills: ['React', 'Node.js', 'TypeScript', 'AWS', 'PostgreSQL', 'MongoDB'],
        company: createdCompanies[0]._id,
        postedBy: employerUserIds[0],
        location: 'Remote',
        city: 'San Francisco',
        country: 'USA',
        salary: { min: 120000, max: 180000 },
        type: 'Full-time',
        category: 'Engineering',
        experienceLevel: 'Senior',
        status: 'approved',
        applicationDeadline: new Date('2026-05-31')
      },
      {
        title: 'Frontend Developer',
        description: 'We are looking for a talented frontend developer to create beautiful, responsive user interfaces.',
        requirements: [
          '3+ years of frontend development experience',
          'Expert knowledge of React and modern CSS',
          'Experience with state management',
          'Eye for design and UX'
        ],
        skills: ['React', 'CSS', 'JavaScript', 'Tailwind', 'Figma'],
        company: createdCompanies[0]._id,
        postedBy: employerUserIds[0],
        location: 'Hybrid',
        city: 'San Francisco',
        country: 'USA',
        salary: { min: 90000, max: 140000 },
        type: 'Full-time',
        category: 'Engineering',
        experienceLevel: 'Mid',
        status: 'approved',
        applicationDeadline: new Date('2026-05-15')
      },
      {
        title: 'Backend Engineer',
        description: 'Build robust APIs and microservices to power our platform. Work with high-scale distributed systems.',
        requirements: [
          '4+ years of backend development experience',
          'Strong Node.js or Python skills',
          'Experience with microservices architecture',
          'Database design expertise'
        ],
        skills: ['Node.js', 'Python', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes'],
        company: createdCompanies[1]._id,
        postedBy: employerUserIds[1],
        location: 'Remote',
        city: 'New York',
        country: 'USA',
        salary: { min: 110000, max: 160000 },
        type: 'Full-time',
        category: 'Engineering',
        experienceLevel: 'Senior',
        status: 'approved',
        applicationDeadline: new Date('2026-05-20')
      },
      {
        title: 'DevOps Engineer',
        description: 'Lead our infrastructure modernization initiative. Implement CI/CD pipelines and cloud infrastructure.',
        requirements: [
          '3+ years of DevOps experience',
          'Strong AWS or GCP experience',
          'Experience with Kubernetes and Docker',
          'Infrastructure as Code expertise'
        ],
        skills: ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'Jenkins', 'Python'],
        company: createdCompanies[1]._id,
        postedBy: employerUserIds[1],
        location: 'Hybrid',
        city: 'New York',
        country: 'USA',
        salary: { min: 100000, max: 150000 },
        type: 'Full-time',
        category: 'Operations',
        experienceLevel: 'Mid',
        status: 'approved',
        applicationDeadline: new Date('2026-05-25')
      },
      {
        title: 'UI/UX Designer',
        description: 'Create intuitive and beautiful user experiences for our mobile and web applications.',
        requirements: [
          '4+ years of UI/UX design experience',
          'Strong portfolio demonstrating design skills',
          'Proficiency in Figma and design systems',
          'User research and testing experience'
        ],
        skills: ['Figma', 'UI Design', 'UX Research', 'Prototyping', 'Design Systems'],
        company: createdCompanies[3]._id,
        postedBy: employerUserIds[3],
        location: 'On-site',
        city: 'Los Angeles',
        country: 'USA',
        salary: { min: 80000, max: 120000 },
        type: 'Full-time',
        category: 'Design',
        experienceLevel: 'Mid',
        status: 'approved',
        applicationDeadline: new Date('2026-05-10')
      },
      {
        title: 'Data Analyst',
        description: 'Analyze business data and create actionable insights. Build dashboards and reports.',
        requirements: [
          '2+ years of data analysis experience',
          'Strong SQL skills',
          'Experience with BI tools',
          'Python or R knowledge'
        ],
        skills: ['SQL', 'Python', 'Tableau', 'Excel', 'Statistical Analysis'],
        company: createdCompanies[4]._id,
        postedBy: employerUserIds[3],
        location: 'Hybrid',
        city: 'Chicago',
        country: 'USA',
        salary: { min: 70000, max: 100000 },
        type: 'Full-time',
        category: 'Finance',
        experienceLevel: 'Entry',
        status: 'approved',
        applicationDeadline: new Date('2026-05-30')
      },
      {
        title: 'Product Manager',
        description: 'Lead product strategy and roadmap for our B2B solutions. Work closely with engineering and design.',
        requirements: [
          '5+ years of product management experience',
          'Technical background preferred',
          'Experience with agile methodologies',
          'Strong communication skills'
        ],
        skills: ['Product Strategy', 'Agile', 'Jira', 'User Research', 'Roadmapping'],
        company: createdCompanies[2]._id,
        postedBy: employerUserIds[3],
        location: 'Remote',
        city: 'Boston',
        country: 'USA',
        salary: { min: 130000, max: 180000 },
        type: 'Full-time',
        category: 'Operations',
        experienceLevel: 'Senior',
        status: 'approved',
        applicationDeadline: new Date('2026-05-28')
      },
      {
        title: 'Marketing Manager',
        description: 'Develop and execute marketing strategies to drive brand awareness and lead generation.',
        requirements: [
          '4+ years of marketing experience',
          'Digital marketing expertise',
          'Experience with marketing automation',
          'Data-driven approach'
        ],
        skills: ['Digital Marketing', 'SEO', 'Google Analytics', 'HubSpot', 'Content Strategy'],
        company: createdCompanies[5]._id,
        postedBy: employerUserIds[3],
        location: 'Hybrid',
        city: 'Austin',
        country: 'USA',
        salary: { min: 80000, max: 120000 },
        type: 'Full-time',
        category: 'Marketing',
        experienceLevel: 'Mid',
        status: 'approved',
        applicationDeadline: new Date('2026-05-18')
      },
      {
        title: 'Sales Representative',
        description: 'Drive new business development and manage client relationships in the enterprise market.',
        requirements: [
          '3+ years of B2B sales experience',
          'Proven track record of meeting targets',
          'Excellent presentation skills',
          'CRM experience'
        ],
        skills: ['B2B Sales', 'Salesforce', 'Lead Generation', 'Negotiation', 'Presentation'],
        company: createdCompanies[7]._id,
        postedBy: employerUserIds[3],
        location: 'On-site',
        city: 'Miami',
        country: 'USA',
        salary: { min: 60000, max: 120000 },
        type: 'Full-time',
        category: 'Sales',
        experienceLevel: 'Mid',
        status: 'approved',
        applicationDeadline: new Date('2026-05-22')
      },
      {
        title: 'Machine Learning Engineer',
        description: 'Build and deploy ML models to power our AI-driven features. Work with large-scale data.',
        requirements: [
          '3+ years of ML engineering experience',
          'Strong Python and ML frameworks',
          'Experience with deep learning',
          'Cloud ML platform knowledge'
        ],
        skills: ['Python', 'TensorFlow', 'PyTorch', 'AWS SageMaker', 'MLOps'],
        company: createdCompanies[0]._id,
        postedBy: employerUserIds[0],
        location: 'Remote',
        city: 'San Francisco',
        country: 'USA',
        salary: { min: 140000, max: 200000 },
        type: 'Full-time',
        category: 'Engineering',
        experienceLevel: 'Senior',
        status: 'approved',
        applicationDeadline: new Date('2026-06-01')
      },
      {
        title: 'HR Coordinator',
        description: 'Support our growing team with recruitment, onboarding, and HR operations.',
        requirements: [
          '2+ years of HR experience',
          'Strong organizational skills',
          'Experience with ATS systems',
          'Good communication abilities'
        ],
        skills: ['Recruitment', 'Onboarding', 'HRIS', 'Employee Relations', 'Excel'],
        company: createdCompanies[6]._id,
        postedBy: employerUserIds[3],
        location: 'Hybrid',
        city: 'Seattle',
        country: 'USA',
        salary: { min: 50000, max: 70000 },
        type: 'Full-time',
        category: 'HR',
        experienceLevel: 'Entry',
        status: 'approved',
        applicationDeadline: new Date('2026-05-12')
      },
      {
        title: 'Mobile Developer (React Native)',
        description: 'Build cross-platform mobile applications for iOS and Android.',
        requirements: [
          '3+ years of mobile development experience',
          'React Native expertise',
          'Published apps in app stores',
          'Understanding of native modules'
        ],
        skills: ['React Native', 'TypeScript', 'iOS', 'Android', 'Redux'],
        company: createdCompanies[2]._id,
        postedBy: employerUserIds[3],
        location: 'Remote',
        city: 'Boston',
        country: 'USA',
        salary: { min: 100000, max: 150000 },
        type: 'Full-time',
        category: 'Engineering',
        experienceLevel: 'Mid',
        status: 'approved',
        applicationDeadline: new Date('2026-05-26')
      },
      {
        title: 'Cybersecurity Analyst',
        description: 'Protect our infrastructure and data. Implement security measures and conduct assessments.',
        requirements: [
          '3+ years of cybersecurity experience',
          'Security certifications preferred',
          'Experience with SIEM tools',
          'Incident response knowledge'
        ],
        skills: ['Security Analysis', 'SIEM', 'Penetration Testing', 'Compliance', 'Firewalls'],
        company: createdCompanies[1]._id,
        postedBy: employerUserIds[1],
        location: 'Hybrid',
        city: 'New York',
        country: 'USA',
        salary: { min: 110000, max: 160000 },
        type: 'Full-time',
        category: 'Operations',
        experienceLevel: 'Mid',
        status: 'approved',
        applicationDeadline: new Date('2026-05-30')
      },
      {
        title: 'Content Writer',
        description: 'Create engaging content for our blog, marketing materials, and social media.',
        requirements: [
          '2+ years of content writing experience',
          'Strong portfolio of written work',
          'SEO knowledge',
          'Ability to adapt tone and style'
        ],
        skills: ['Content Writing', 'SEO', 'Copywriting', 'Social Media', 'WordPress'],
        company: createdCompanies[6]._id,
        postedBy: employerUserIds[3],
        location: 'Remote',
        city: 'Seattle',
        country: 'USA',
        salary: { min: 45000, max: 65000 },
        type: 'Full-time',
        category: 'Marketing',
        experienceLevel: 'Entry',
        status: 'approved',
        applicationDeadline: new Date('2026-05-14')
      },
      {
        title: 'QA Engineer',
        description: 'Ensure software quality through comprehensive testing strategies.',
        requirements: [
          '3+ years of QA experience',
          'Automated testing skills',
          'Experience with testing frameworks',
          'Strong analytical skills'
        ],
        skills: ['Selenium', 'Cypress', 'Jest', 'API Testing', 'Test Planning'],
        company: createdCompanies[5]._id,
        postedBy: employerUserIds[3],
        location: 'Hybrid',
        city: 'Austin',
        country: 'USA',
        salary: { min: 70000, max: 100000 },
        type: 'Full-time',
        category: 'Engineering',
        experienceLevel: 'Mid',
        status: 'approved',
        applicationDeadline: new Date('2026-05-20')
      },
      {
        title: 'Graphic Designer',
        description: 'Create visual assets for marketing campaigns, social media, and brand materials.',
        requirements: [
          '3+ years of graphic design experience',
          'Proficient in Adobe Creative Suite',
          'Strong portfolio',
          'Motion graphics experience is a plus'
        ],
        skills: ['Adobe Photoshop', 'Illustrator', 'InDesign', 'Motion Graphics', 'Branding'],
        company: createdCompanies[3]._id,
        postedBy: employerUserIds[3],
        location: 'Remote',
        city: 'Los Angeles',
        country: 'USA',
        salary: { min: 55000, max: 80000 },
        type: 'Full-time',
        category: 'Design',
        experienceLevel: 'Mid',
        status: 'approved',
        applicationDeadline: new Date('2026-05-16')
      }
    ];

    const createdJobs = await Job.insertMany(jobData);
    console.log(`Created ${createdJobs.length} jobs`);

    for (const company of createdCompanies) {
      const jobCount = await Job.countDocuments({ company: company._id });
      console.log(`Company "${company.name}" has ${jobCount} jobs`);
    }

    console.log('\nSeed completed successfully!');
    console.log(`Total companies: ${createdCompanies.length}`);
    console.log(`Total jobs: ${createdJobs.length}`);

    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
};

seedJobs();
