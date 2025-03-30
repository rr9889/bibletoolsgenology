// Local CSV file
const CSV_FILE = 'BibleData-Person.csv';

// Data storage
let peopleData = [];
const peopleCache = new Map();

// Initialize the app
initApp();

async function initApp() {
  await loadCSVData();
  setupSearch();
}

// Load CSV data using PapaParse
async function loadCSVData() {
  return new Promise((resolve) => {
    Papa.parse(CSV_FILE, {
      download: true,
      header: true,
      complete: (results) => {
        // Filter out rows without a name
        peopleData = results.data.filter(row => row.name);
        resolve();
      },
      error: (err) => {
        console.error(`Failed to load ${CSV_FILE}: ${err}`);
        resolve(); // Continue even if CSV fails
      }
    });
  });
}

// Set up search functionality using Fuse.js
function setupSearch() {
  const fuse = new Fuse(peopleData, { keys: ['name'], threshold: 0.3 });
  const searchInput = document.getElementById('search');
  const searchBtn = document.getElementById('search-btn');
  const resultsDiv = document.getElementById('results');

  searchBtn.addEventListener('click', function() {
    const query = searchInput.value.trim();
    resultsDiv.innerHTML = '';
    if (query.length < 2) {
      resultsDiv.innerHTML = '<p>Please enter at least 2 characters.</p>';
      return;
    }

    // Search using Fuse.js over the CSV data
    const csvResults = fuse.search(query);
    const combinedResults = csvResults.map(r => r.item);

    if (combinedResults.length === 0) {
      resultsDiv.innerHTML = '<p>No biblical figures found.</p>';
      return;
    }

    combinedResults.forEach(person => {
      const div = document.createElement('div');
      div.className = 'result-item';
      div.innerHTML = `<strong>${person.name}</strong> (${person.sex || 'Unknown'})`;
      div.addEventListener('click', () => fetchPersonDetails(person));
      resultsDiv.appendChild(div);
    });
  });

  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') searchBtn.click();
  });
}

// Fetch person details using CSV data only
async function fetchPersonDetails(person) {
  if (peopleCache.has(person.name)) {
    showPersonDetails(peopleCache.get(person.name));
    return;
  }

  // Find the corresponding record from the CSV data
  const csvPerson = peopleData.find(p => p.name === person.name) || {};

  const combinedPerson = {
    name: person.name,
    sex: csvPerson.sex || 'Unknown',
    father: csvPerson.father || 'Not listed',
    mother: csvPerson.mother || 'Not listed',
    firstVerse: csvPerson.firstVerse || 'Not listed',
    lastVerse: csvPerson.lastVerse || 'Not listed',
    children: findChildren(person.name)
  };

  peopleCache.set(person.name, combinedPerson);
  showPersonDetails(combinedPerson);
}

// Find children by looking for records where the person is listed as father or mother
function findChildren(name) {
  return peopleData
    .filter(p => p.father === name || p.mother === name)
    .map(p => p.name);
}

// Display person details in the profile section
function showPersonDetails(person) {
  const profileDiv = document.getElementById('profile');
  profileDiv.innerHTML = `
    <h2>${person.name}</h2>
    <p><strong>Sex:</strong> ${person.sex}</p>
    <p><strong>Father:</strong> ${person.father}</p>
    <p><strong>Mother:</strong> ${person.mother}</p>
    <p><strong>Children:</strong> ${person.children.length ? person.children.join(', ') : 'None listed'}</p>
    <p><strong>First Verse:</strong> ${person.firstVerse}</p>
    <p><strong>Last Verse:</strong> ${person.lastVerse}</p>
  `;
  profileDiv.classList.add('active');

  drawFamilyTree(person);
}

// Draw a family tree using D3.js
function drawFamilyTree(person) {
  const treeDiv = document.getElementById('family-tree');
  treeDiv.innerHTML = '';

  const treeData = { name: person.name, children: [] };
  if (person.father && person.father !== 'Not listed') treeData.children.push({ name: `${person.father} (Father)` });
  if (person.mother && person.mother !== 'Not listed') treeData.children.push({ name: `${person.mother} (Mother)` });
  person.children.forEach(child => treeData.children.push({ name: `${child} (Child)` }));

  const width = 800, height = 400;
  const svg = d3.select('#family-tree')
                .append('svg')
                .attr('width', width)
                .attr('height', height);
  const g = svg.append('g').attr('transform', 'translate(20, 20)');

  const treeLayout = d3.tree().size([width - 40, height - 40]);
  const root = d3.hierarchy(treeData);
  treeLayout(root);

  // Draw links
  g.selectAll('.link')
    .data(root.links())
    .enter()
    .append('path')
    .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y))
    .attr('fill', 'none')
    .attr('stroke', '#8b5a2b')
    .attr('stroke-width', 2);

  // Draw nodes
  const node = g.selectAll('.node')
    .data(root.descendants())
    .enter()
    .append('g')
    .attr('transform', d => `translate(${d.x},${d.y})`);
    
  node.append('circle')
    .attr('r', 6)
    .attr('fill', '#4a2c0d');
    
  node.append('text')
    .attr('dy', '.35em')
    .attr('x', d => d.children ? -10 : 10)
    .attr('text-anchor', d => d.children ? 'end' : 'start')
    .text(d => d.data.name)
    .attr('fill', '#4a2c0d');
}
