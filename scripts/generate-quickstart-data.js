const matter = require('gray-matter');
const fs = require('fs');
const path = require('path');

// Icon mapping for different platforms
const iconMap = {
  snowflake: '❄️',
  databricks: '🔷',
  bigquery: '🔍',
  aws: '☁️',
  azure: '🔵',
  gcp: '🔴',
  default: '📋'
};

function parseQuickstartFiles() {
  const quickstartDir = path.join(process.cwd(), 'src/data/quickstart');
  const files = fs.readdirSync(quickstartDir);
  
  const quickstarts = [];
  const categories = new Set();
  
  files.forEach(file => {
    if (file.endsWith('.md')) {
      const filePath = path.join(quickstartDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { data, content } = matter(fileContent);
      
      // Parse categories
      if (data.categories) {
        const categoryList = data.categories.split(',').map(cat => cat.trim());
        categoryList.forEach(cat => categories.add(cat));
      }
      
      quickstarts.push({
        id: data.id,
        title: data.title,
        description: data.description,
        summary: data.summary,
        author: data.author,
        categories: data.categories ? data.categories.split(',').map(cat => cat.trim()) : [],
        icon: data.icon || 'default',
        iconSymbol: iconMap[data.icon] || iconMap.default,
        status: data.status,
        tags: data.tags ? data.tags.split(',').map(tag => tag.trim()) : [],
        content: content.trim(),
        tabs: data.tabs || []
      });
    }
  });
  
  return {
    quickstarts,
    categories: Array.from(categories).sort()
  };
}

function generateQuickstartJSON() {
  const data = parseQuickstartFiles();
  
  // Write to JSON file
  const outputPath = path.join(process.cwd(), 'src/data/quickstart-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  
  console.log('✅ Quickstart data generated successfully!');
  console.log(`📁 Output: ${outputPath}`);
  console.log(`📊 Found ${data.quickstarts.length} quickstarts`);
  console.log(`🏷️  Categories: ${data.categories.join(', ')}`);
  
  return data;
}

// Run if called directly
if (require.main === module) {
  generateQuickstartJSON();
}

module.exports = { generateQuickstartJSON, parseQuickstartFiles };
