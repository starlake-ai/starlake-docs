const matter = require('gray-matter');
const fs = require('fs');
const path = require('path');

const iconMap = {
  snowflake: '/img/icons/snowflake.svg',
  databricks: '/img/icons/databricks.svg',
  bigquery: '/img/icons/bigquery.svg',
  aws: '/img/icons/aws.svg',
  azure: '/img/icons/azure.svg',
  gcp: '/img/icons/gcp.svg',
  starlake: '/img/icons/starlake.png',
  default: '/img/icons/default.svg'
};

function parseMarkdownSections(content) {
  const sections = [];
  const lines = content.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    const sectionMatch = line.match(/^##\s+(.+)$/);
    
    if (sectionMatch) {
      if (currentSection) {
        sections.push({
          id: sections.length + 1,
          label: currentSection,
          content: currentContent.join('\n').trim()
        });
      }
      
      currentSection = sectionMatch[1];
      currentContent = [];
    } else {
      if (currentSection) {
        currentContent.push(line);
      }
    }
  }
  
  if (currentSection) {
    sections.push({
      id: sections.length + 1,
      label: currentSection,
      content: currentContent.join('\n').trim()
    });
  }
  
  return sections;
}

function parseGuidesFiles() {
  const guidesDir = path.join(process.cwd(), 'src/data/guides');
  const folders = fs.readdirSync(guidesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  const guides = [];
  const categories = new Set();
  
  folders.forEach(folder => {
    const folderPath = path.join(guidesDir, folder);
    const files = fs.readdirSync(folderPath);
    
    const mdFile = files.find(file => file.endsWith('.md'));
    
    if (mdFile) {
      const filePath = path.join(folderPath, mdFile);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { data, content } = matter(fileContent);
      
      const sections = parseMarkdownSections(content);
      
      if (data.tags) {
        const tagList = Array.isArray(data.tags) ? data.tags : data.tags.split(',').map(tag => tag.trim());
        tagList.forEach(tag => categories.add(tag));
      }
      
      guides.push({
        id: data.id,
        title: data.title,
        description: data.description || data.summary,
        summary: data.summary,
        author: data.author,
        categories: data.tags ? (Array.isArray(data.tags) ? data.tags : data.tags.split(',').map(tag => tag.trim())) : [],
        icon: iconMap[data.icon] || iconMap.default,
        status: data.status,
        tags: data.tags ? (Array.isArray(data.tags) ? data.tags : data.tags.split(',').map(tag => tag.trim())) : [],
        level: data.level || 'Beginner',
        content: content.trim(),
        tabs: sections
      });
    }
  });
  
  return {
    guides,
    categories: Array.from(categories).sort()
  };
}

function generateGuidesJSON() {
  const data = parseGuidesFiles();
  
  const outputPath = path.join(process.cwd(), 'src/data/guides-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  
  console.log('✅ Guides data generated successfully!');
  console.log(`📁 Output: ${outputPath}`);
  console.log(`📊 Found ${data.guides.length} guides`);
  console.log(`🏷️  Categories: ${data.categories.join(', ')}`);
  
  return data;
}

if (require.main === module) {
  generateGuidesJSON();
}

module.exports = { generateGuidesJSON, parseGuidesFiles };
