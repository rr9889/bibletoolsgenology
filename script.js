// Local CSV and JSON files (relative paths for GitHub)
const CSV_FILE = './BibleData-Person.csv';
const JSON_FILE = './BibleData-PersonLabel.json';

// Data storage
let peopleData = []; // From CSV
let labelData = [];  // From JSON
const peopleCache = new Map();

// Initialize the app
initApp();

async function initApp() {
  await Promise.all([loadCSVData(), loadJSONData()]);
  setupSearch();
}

// Load CSV data using PapaParse
async function loadCSVData() {
  return new Promise((resolve) => {
    Papa.parse(CSV_FILE, {
      download: true,
      header: true,
      complete: (results) => {
        // Filter out rows without a person_name
        peopleData = results.data.filter(row => row.person_name);
        resolve();
      },
      error: (err) => {
        console.error(`Failed to load ${CSV_FILE}: ${err}`);
        resolve(); // Continue even if CSV fails
      }
    });
  });
}

// Load JSON data using Fetch API
async function loadJSONData() {
  try {
    const response = await fetch(JSON_FILE);
    if (!response.ok) throw new Error(`Failed to fetch ${JSON_FILE}: ${response.statusText}`);
    labelData = await response.json();
  } catch (err) {
    console.error(err);
    labelData = []; // Fallback to empty array if JSON fails
  }
}

// Set up search functionality using Fuse.js
function setupSearch() {
  const fuse = new Fuse(peopleData, { keys: ['person_name'], threshold: 0.3 });
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
      div.innerHTML = `<strong>${person.person_name}</strong> (${person.sex || 'Unknown'})`;
      div.addEventListener('click', () => fetchPersonDetails(person));
      resultsDiv.appendChild(div);
    });
  });

  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') searchBtn.click();
  });
}

// Fetch person details using CSV and JSON data
async function fetchPersonDetails(person) {
  if (peopleCache.has(person.person_name)) {
    showPersonDetails(peopleCache.get(person.person_name));
    return;
  }

  // Find the corresponding record from the CSV data
  const csvPerson = peopleData.find(p => p.person_name === person.person_name) || {};

  // Find all labels from the JSON data using person_id
  const personLabels = labelData.filter(label => label.person_id === csvPerson.person_id);

  const combinedPerson = {
    person_name: person.person_name,
    person_id: csvPerson.person_id || 'Not listed',
    surname: csvPerson.surname || 'Not listed',
    unique_attribute: csvPerson.unique_attribute || 'Not listed',
    sex: csvPerson.sex || 'Unknown',
    tribe: csvPerson.tribe || 'Not listed',
    person_notes: csvPerson.person_notes || 'Not listed',
    person_instance: csvPerson.person_instance || 'Not listed',
    person_sequence: csvPerson.person_sequence || 'Not listed',
    father: csvPerson.father || 'Not listed',
    mother: csvPerson.mother || 'Not listed',
    firstVerse: csvPerson.firstVerse || 'Not listed',
    lastVerse: csvPerson.lastVerse || 'Not listed',
    children: findChildren(person.person_name),
    labels: personLabels // Add the labels from JSON
  };

  peopleCache.set(person.person_name, combinedPerson);
  showPersonDetails(combinedPerson);
}

// Find children by looking for records where the person is listed as father or mother
function findChildren(name) {
  return peopleData
    .filter(p => p.father === name || p.mother === name)
    .map(p => p.person_name);
}

// Display person details in the profile section
function showPersonDetails(person) {
  const profileDiv = document.getElementById('profile');
  
  // Basic info from CSV
  let profileHTML = `
    <h2>${person.person_name}</h2>
    <p><strong>ID:</strong> ${person.person_id}</p>
    <p><strong>Surname:</strong> ${person.surname}</p>
    <p><strong>Unique Attribute:</strong> ${person.unique_attribute}</p>
    <p><strong>Sex:</strong> ${person.sex}</p>
    <p><strong>Tribe:</strong> ${person.tribe}</p>
    <p><strong>Notes:</strong> ${person.person_notes}</p>
    <p><strong>Instance:</strong> ${person.person_instance}</p>
    <p><strong>Sequence:</strong> ${person.person_sequence}</p>
    <p><strong>Father:</strong> ${person.father}</p>
    <p><strong>Mother:</strong> ${person.mother}</p>
    <p><strong>Children:</strong> ${person.children.length ? person.children.join(', ') : 'None listed'}</p>
    <p><strong>First Verse:</strong> ${person.firstVerse}</p>
    <p><strong>Last Verse:</strong> ${person.lastVerse}</p>
  `;

  // Add alternative names/titles from JSON
  if (person.labels && person.labels.length > 0) {
    profileHTML += `<h3>Alternative Names/Titles</h3><ul>`;
    person.labels.forEach(label => {
      profileHTML += `
        <li>
          <strong>${label.english_label}</strong> (${label.label_type})<br>
          <strong>Hebrew:</strong> ${label.hebrew_label} (${label.hebrew_label_transliterated}) - ${label.hebrew_label_meaning || 'No meaning provided'} [Strong's ${label.hebrew_strongs_number || 'N/A'}]<br>
          <strong>Greek:</strong> ${label.greek_label} (${label.greek_label_transliterated}) - ${label.greek_label_meaning || 'No meaning provided'} [Strong's ${label.greek_strongs_number || 'N/A'}]<br>
          <strong>Reference:</strong> ${label.label_reference_id}<br>
          <strong>Given by God:</strong> ${label.label_given_by_god === 'Y' ? 'Yes' : 'No'}<br>
          ${label.label_notes ? `<strong>Notes:</strong> ${label.label_notes}` : ''}
        </li>
      `;
    });
    profileHTML += `</ul>`;
  } else {
    profileHTML += `<p>No alternative names or titles found.</p>`;
  }

  profileDiv.innerHTML = profileHTML;
  profileDiv.classList.add('active');

  drawFamilyTree(person);
}

// Draw a family tree using D3.js
function drawFamilyTree(person) {
  const treeDiv = document.getElementById('family-tree');
  treeDiv.innerHTML = '';

  const treeData = { name: person.person_name, children: [] };
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
