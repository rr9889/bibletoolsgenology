// JSON files (relative paths for GitHub)
const PERSON_FILE = './BibleData-Person.json';
const LABEL_FILE = './BibleData-PersonLabel.json';
const RELATIONSHIP_FILE = './BibleData-PersonRelationship.json';
const PERSONVERSE_FILE = './BibleData-PersonVerse.json';
const PERSONVERSE_TANAKH_FILE = './BibleData-PersonVerse-Tanakh.json';
const PERSONVERSE_APOSTOLIC_FILE = './BibleData-PersonVerse-Apostolic.json';
const BIBLEDATA_PERSON_FILE = './BibleData-PersonVerse.json';

// API endpoint for verse text
const BIBLE_API_URL = 'https://bible-api.com';

// Data storage
let peopleData = [];
let labelData = [];
let relationshipData = [];
let personVerseData = [];
const peopleCache = new Map();

// Initialize the app
initApp();

async function initApp() {
  // Load all JSON files
  const [personData, labelDataResult, relationshipDataResult, personVerseDataResult, personVerseTanakhData, personVerseApostolicData, bibleDataPersonResult] = await Promise.all([
    loadJSONData(PERSON_FILE),
    loadJSONData(LABEL_FILE),
    loadJSONData(RELATIONSHIP_FILE),
    loadJSONData(PERSONVERSE_FILE),
    loadJSONData(PERSONVERSE_TANAKH_FILE),
    loadJSONData(PERSONVERSE_APOSTOLIC_FILE),
    loadJSONData(BIBLEDATA_PERSON_FILE)
  ]);

  peopleData = personData;
  labelData = labelDataResult;
  relationshipData = relationshipDataResult;

  // Combine all person-verse data and filter out "NA" entries
  personVerseData = [
    ...personVerseDataResult,
    ...personVerseTanakhData,
    ...personVerseApostolicData,
    ...bibleDataPersonResult
  ].filter(entry => entry.person_id !== "NA");

  console.log('People Data:', peopleData.length, 'entries');
  console.log('Label Data:', labelData.length, 'entries');
  console.log('Relationship Data:', relationshipData.length, 'entries');
  console.log('Person Verse Data:', personVerseData.length, 'entries');

  setupFilters();
  setupSearch();
  setupModal();
}

// Load JSON data using Fetch API
async function loadJSONData(file) {
  try {
    const response = await fetch(file);
    if (!response.ok) throw new Error(`Failed to fetch ${file}: ${response.statusText}`);
    const data = await response.json();
    console.log(`Loaded ${file}:`, data.length, 'entries');
    return data;
  } catch (err) {
    console.error(err);
    return [];
  }
}

// Fetch verse text from Bible-api
async function fetchBibleApiVerse(passage, translation = 'kjv') {
  try {
    const response = await fetch(`${BIBLE_API_URL}/${encodeURIComponent(passage)}?translation=${translation}`);
    if (!response.ok) throw new Error('Failed to fetch from Bible-api');
    const data = await response.json();
    return data.text || 'Verse text not available.';
  } catch (err) {
    console.error('Bible-api Error:', err);
    return 'Error fetching verse text.';
  }
}

// Setup filters
function setupFilters() {
  const tribeFilter = document.getElementById('tribe-filter');
  const tribes = [...new Set(peopleData.map(person => person.tribe).filter(tribe => tribe && tribe !== ''))];
  tribes.forEach(tribe => {
    const option = document.createElement('option');
    option.value = tribe;
    option.textContent = tribe;
    tribeFilter.appendChild(option);
  });

  // Add event listeners for filters
  tribeFilter.addEventListener('change', filterResults);
  document.getElementById('sex-filter').addEventListener('change', filterResults);
  document.getElementById('verse-filter').addEventListener('change', () => {
    const selectedPerson = peopleCache.get(document.getElementById('profile-name').textContent);
    if (selectedPerson) showPersonDetails(selectedPerson);
  });
}

// Setup search functionality using Fuse.js
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

    const results = fuse.search(query);
    const combinedResults = results.map(r => r.item);
    filterResults(combinedResults);
  });

  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') searchBtn.click();
  });
}

// Filter search results based on tribe and sex
function filterResults(preFilteredResults) {
  const tribeFilter = document.getElementById('tribe-filter').value;
  const sexFilter = document.getElementById('sex-filter').value;
  const resultsDiv = document.getElementById('results');

  let filteredResults = preFilteredResults || peopleData;

  if (tribeFilter) {
    filteredResults = filteredResults.filter(person => person.tribe === tribeFilter);
  }
  if (sexFilter) {
    filteredResults = filteredResults.filter(person => person.sex === sexFilter);
  }

  resultsDiv.innerHTML = '';
  if (filteredResults.length === 0) {
    resultsDiv.innerHTML = '<p>No biblical figures found.</p>';
    return;
  }

  filteredResults.forEach(person => {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `<strong>${person.person_name}</strong> (${person.sex || 'Unknown'}) - ${person.tribe || 'No tribe'}`;
    div.addEventListener('click', () => fetchPersonDetails(person));
    resultsDiv.appendChild(div);
  });
}

// Setup verse modal
function setupModal() {
  const modal = document.getElementById('verse-modal');
  const closeBtn = document.getElementsByClassName('close')[0];

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });
}

// Fetch person details
async function fetchPersonDetails(person) {
  if (peopleCache.has(person.person_name)) {
    showPersonDetails(peopleCache.get(person.person_name));
    return;
  }

  const personIdLower = person.person_id ? person.person_id.toLowerCase() : `${person.person_name.toLowerCase()}_1`;
  const personLabels = labelData.filter(label => label.person_id.toLowerCase() === personIdLower);
  const personRelationships = relationshipData.filter(rel => 
    rel.person_id_1.toLowerCase() === personIdLower || rel.person_id_2.toLowerCase() === personIdLower
  );
  const personVerses = personVerseData.filter(pv => pv.person_id.toLowerCase() === personIdLower);

  // Fallback for missing data (e.g., for Moses)
  let enhancedPerson = { ...person };
  if (person.person_name === 'Moses') {
    enhancedPerson.person_id = enhancedPerson.person_id || 'Moses_1';
    enhancedPerson.person_instance = enhancedPerson.person_instance || '1';
    enhancedPerson.person_notes = enhancedPerson.person_notes || 'Key figure in leading Israel out of Egypt in the Exodus.';
    enhancedPerson.father = enhancedPerson.father || 'Amram';
    enhancedPerson.mother = enhancedPerson.mother || 'Jochebed';
    enhancedPerson.firstVerse = enhancedPerson.firstVerse || 'EXO 2:1';
    enhancedPerson.lastVerse = enhancedPerson.lastVerse || 'DEU 34:12';
  }

  const childrenFromRelationships = personRelationships
    .filter(rel => rel.person_id_1.toLowerCase() === personIdLower && (rel.relationship_type === 'father' || rel.relationship_type === 'mother'))
    .map(rel => {
      const child = peopleData.find(p => p.person_id.toLowerCase() === rel.person_id_2.toLowerCase());
      return child ? child.person_name : rel.person_id_2;
    });

  if (person.person_name === 'Moses' && childrenFromRelationships.length === 0) {
    childrenFromRelationships.push('Gershom', 'Eliezer');
  }

  const combinedPerson = {
    person_name: enhancedPerson.person_name,
    person_id: enhancedPerson.person_id || 'Not listed',
    surname: enhancedPerson.surname || 'Not listed',
    unique_attribute: enhancedPerson.unique_attribute || 'Not listed',
    sex: enhancedPerson.sex || 'Unknown',
    tribe: enhancedPerson.tribe || 'Not listed',
    person_notes: enhancedPerson.person_notes || 'Not listed',
    person_instance: enhancedPerson.person_instance || 'Not listed',
    person_sequence: enhancedPerson.person_sequence || 'Not listed',
    father: enhancedPerson.father || 'Not listed',
    mother: enhancedPerson.mother || 'Not listed',
    firstVerse: enhancedPerson.firstVerse || 'Not listed',
    lastVerse: enhancedPerson.lastVerse || 'Not listed',
    children: [...new Set([...findChildren(enhancedPerson.person_name), ...childrenFromRelationships])],
    labels: personLabels,
    relationships: personRelationships,
    verses: personVerses
  };

  peopleCache.set(person.person_name, combinedPerson);
  showPersonDetails(combinedPerson);
}

// Find children from BibleData-Person.json
function findChildren(name) {
  return peopleData
    .filter(p => (p.father || '').toLowerCase() === name.toLowerCase() || (p.mother || '').toLowerCase() === name.toLowerCase())
    .map(p => p.person_name);
}

// Display person details
function showPersonDetails(person) {
  const profileName = document.getElementById('profile-name');
  const basicInfoDiv = document.getElementById('basic-info');
  const labelsSection = document.getElementById('labels-section');
  const relationshipsSection = document.getElementById('relationships-section');
  const versesSection = document.getElementById('verses-section');

  profileName.textContent = person.person_name;

  // Basic Info
  basicInfoDiv.innerHTML = `
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

  // Alternative names/titles
  labelsSection.innerHTML = `
    <h3><button class="collapsible">Alternative Names/Titles (${person.labels.length})</button></h3>
    <div class="collapsible-content"><ul>
      ${person.labels.length > 0 ? person.labels.map(label => `
        <li>
          <strong>${label.english_label}</strong> (${label.label_type})<br>
          <strong>Hebrew:</strong> ${label.hebrew_label} (${label.hebrew_label_transliterated}) - ${label.hebrew_label_meaning || 'No meaning provided'} [Strong's ${label.hebrew_strongs_number || 'N/A'}]<br>
          <strong>Greek:</strong> ${label.greek_label} (${label.greek_label_transliterated}) - ${label.greek_label_meaning || 'No meaning provided'} [Strong's ${label.greek_strongs_number || 'N/A'}]<br>
          <strong>Reference:</strong> ${label.label_reference_id}<br>
          <strong>Given by God:</strong> ${label.label_given_by_god === 'Y' ? 'Yes' : 'No'}<br>
          ${label.label_notes ? `<strong>Notes:</strong> ${label.label_notes}` : ''}
        </li>
      `).join('') : '<li>No alternative names or titles found.</li>'}
    </ul></div>
  `;

  // Relationships
  relationshipsSection.innerHTML = `
    <h3><button class="collapsible">Relationships (${person.relationships.length})</button></h3>
    <div class="collapsible-content"><ul>
      ${person.relationships.length > 0 ? person.relationships.map(rel => {
        const otherPersonId = rel.person_id_1.toLowerCase() === person.person_id.toLowerCase() ? rel.person_id_2 : rel.person_id_1;
        const otherPerson = peopleData.find(p => p.person_id.toLowerCase() === otherPersonId.toLowerCase());
        const otherPersonName = otherPerson ? otherPerson.person_name : otherPersonId;
        const role = rel.person_id_1.toLowerCase() === person.person_id.toLowerCase() ? rel.relationship_type : `is ${rel.relationship_type} of`;
        return `
          <li>
            <strong>${role}</strong> <a href="#" class="person-link" data-person="${otherPersonName}">${otherPersonName}</a><br>
            <strong>Reference:</strong> ${rel.reference_id || 'Not listed'}<br>
            ${rel.relationship_notes ? `<strong>Notes:</strong> ${rel.relationship_notes}` : ''}
          </li>
        `;
      }).join('') : '<li>No additional relationships found.</li>'}
    </ul></div>
  `;

  // Verses mentioned with filter
  const verseFilter = document.getElementById('verse-filter').value;
  let filteredVerses = person.verses.sort((a, b) => parseInt(a.person_verse_sequence) - parseInt(b.person_verse_sequence));
  if (verseFilter === 'tanakh') {
    filteredVerses = filteredVerses.filter(v => v.reference_id.startsWith('GEN') || v.reference_id.startsWith('EXO') || v.reference_id.startsWith('LEV') || v.reference_id.startsWith('NUM') || v.reference_id.startsWith('DEU'));
  } else if (verseFilter === 'apostolic') {
    filteredVerses = filteredVerses.filter(v => v.reference_id.startsWith('MAT') || v.reference_id.startsWith('MAR') || v.reference_id.startsWith('LUK') || v.reference_id.startsWith('JHN') || v.reference_id.startsWith('ACT'));
  }

  versesSection.innerHTML = `
    <h3><button class="collapsible">Verses Mentioned (${filteredVerses.length})</button></h3>
    <div class="collapsible-content"><ul>
      ${filteredVerses.length > 0 ? filteredVerses.map(verse => `
        <li>
          <a href="#" class="verse-link" data-verse="${verse.reference_id}">${verse.reference_id}</a> (Label: ${verse.person_label})<br>
          ${verse.person_verse_notes ? `<strong>Notes:</strong> ${verse.person_verse_notes}` : ''}
        </li>
      `).join('') : '<li>No verses found for the selected filter.</li>'}
    </ul></div>
  `;

  // Add event listeners for collapsible sections
  const collapsibles = document.getElementsByClassName('collapsible');
  for (let i = 0; i < collapsibles.length; i++) {
    collapsibles[i].addEventListener('click', function() {
      this.classList.toggle('active');
      const content = this.nextElementSibling;
      if (content.style.display === 'block') {
        content.style.display = 'none';
      } else {
        content.style.display = 'block';
      }
    });
  }

  // Add event listeners for person links
  const personLinks = document.getElementsByClassName('person-link');
  for (let i = 0; i < personLinks.length; i++) {
    personLinks[i].addEventListener('click', function(e) {
      e.preventDefault();
      const personName = this.getAttribute('data-person');
      const relatedPerson = peopleData.find(p => p.person_name === personName);
      if (relatedPerson) fetchPersonDetails(relatedPerson);
    });
  }

  // Add event listeners for verse links
  const verseLinks = document.getElementsByClassName('verse-link');
  for (let i = 0; i < verseLinks.length; i++) {
    verseLinks[i].addEventListener('click', async function(e) {
      e.preventDefault();
      const verseRef = this.getAttribute('data-verse');
      const modal = document.getElementById('verse-modal');
      const modalTitle = document.getElementById('verse-modal-title');
      const modalText = document.getElementById('verse-modal-text');

      modalTitle.textContent = verseRef;
      modalText.textContent = 'Loading verse text...';
      modal.style.display = 'block';

      const verseText = await fetchBibleApiVerse(verseRef);
      modalText.textContent = verseText;
    });
  }

  drawFamilyTree(person);
}

// Draw family tree using D3.js
function drawFamilyTree(person) {
  const treeDiv = document.getElementById('family-tree');
  treeDiv.innerHTML = '';

  const treeData = { name: person.person_name, children: [] };
  if (person.father && person.father !== 'Not listed') treeData.children.push({ name: `${person.father} (Father)` });
  if (person.mother && person.mother !== 'Not listed') treeData.children.push({ name: `${person.mother} (Mother)` });
  person.children.forEach(child => treeData.children.push({ name: `${child} (Child)` }));
  person.relationships.forEach(rel => {
    const otherPersonId = rel.person_id_1.toLowerCase() === person.person_id.toLowerCase() ? rel.person_id_2 : rel.person_id_1;
    const otherPerson = peopleData.find(p => p.person_id.toLowerCase() === otherPersonId.toLowerCase());
    const otherPersonName = otherPerson ? otherPerson.person_name : otherPersonId;
    const role = rel.person_id_1.toLowerCase() === person.person_id.toLowerCase() ? rel.relationship_type : `is ${rel.relationship_type} of`;
    if (role !== 'father' && role !== 'mother' && !role.includes('child')) {
      treeData.children.push({ name: `${otherPersonName} (${role})` });
    }
  });

  const width = 800, height = 400;
  const svg = d3.select('#family-tree')
                .append('svg')
                .attr('width', width)
                .attr('height', height);
  const g = svg.append('g').attr('transform', 'translate(20, 20)');

  const treeLayout = d3.tree().size([width - 40, height - 40]);
  const root = d3.hierarchy(treeData);
  treeLayout(root);

  g.selectAll('.link')
    .data(root.links())
    .enter()
    .append('path')
    .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y))
    .attr('fill', 'none')
    .attr('stroke', '#8b5a2b')
    .attr('stroke-width', 2);

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