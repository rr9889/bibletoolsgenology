// JSON files (relative paths for GitHub)
const PERSON_FILE = './BibleData-Person.json';
const LABEL_FILE = './BibleData-PersonLabel.json';
const RELATIONSHIP_FILE = './BibleData-PersonRelationship.json';
const PERSONVERSE_FILE = './BibleData-PersonVerse.json';
const PERSONVERSE_TANAKH_FILE = './BibleData-PersonVerse-Tanakh.json';
const PERSONVERSE_APOSTOLIC_FILE = './BibleData-PersonVerse-Apostolic.json';
const BIBLEDATA_PERSON_FILE = './BibleData-PersonVerse.json';

// Data storage
let peopleData = [];
let labelData = [];
let relationshipData = [];
let personVerseData = [];
const peopleCache = new Map();

// Initialize the app
initApp();

async function initApp() {
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

  setupSearch();
}

// Load JSON data using Fetch API
async function loadJSONData(file) {
  try {
    const response = await fetch(file);
    if (!response.ok) throw new Error(`Failed to fetch ${file}: ${response.statusText}`);
    return await response.json();
  } catch (err) {
    console.error(err);
    return [];
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

    const results = fuse.search(query);
    const combinedResults = results.map(r => r.item);

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

// Fetch person details
async function fetchPersonDetails(person) {
  if (peopleCache.has(person.person_name)) {
    showPersonDetails(peopleCache.get(person.person_name));
    return;
  }

  const personIdLower = person.person_id.toLowerCase();
  const personLabels = labelData.filter(label => label.person_id.toLowerCase() === personIdLower);
  const personRelationships = relationshipData.filter(rel => 
    rel.person_id_1.toLowerCase() === personIdLower || rel.person_id_2.toLowerCase() === personIdLower
  );
  const personVerses = personVerseData.filter(pv => pv.person_id.toLowerCase() === personIdLower);

  // Find children from relationships (in addition to father/mother fields)
  const childrenFromRelationships = personRelationships
    .filter(rel => rel.person_id_1.toLowerCase() === personIdLower && (rel.relationship_type === 'father' || rel.relationship_type === 'mother'))
    .map(rel => {
      const child = peopleData.find(p => p.person_id.toLowerCase() === rel.person_id_2.toLowerCase());
      return child ? child.person_name : rel.person_id_2;
    });

  const combinedPerson = {
    person_name: person.person_name,
    person_id: person.person_id || 'Not listed',
    surname: person.surname || 'Not listed',
    unique_attribute: person.unique_attribute || 'Not listed',
    sex: person.sex || 'Unknown',
    tribe: person.tribe || 'Not listed',
    person_notes: person.person_notes || 'Not listed',
    person_instance: person.person_instance || 'Not listed',
    person_sequence: person.person_sequence || 'Not listed',
    father: person.father || 'Not listed',
    mother: person.mother || 'Not listed',
    firstVerse: person.firstVerse || 'Not listed',
    lastVerse: person.lastVerse || 'Not listed',
    children: [...new Set([...findChildren(person.person_name), ...childrenFromRelationships])], // Combine children from both sources
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
  const profileDiv = document.getElementById('profile');
  
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

  // Alternative names/titles (collapsible)
  if (person.labels && person.labels.length > 0) {
    profileHTML += `
      <h3><button class="collapsible">Alternative Names/Titles (${person.labels.length})</button></h3>
      <div class="collapsible-content"><ul>
    `;
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
    profileHTML += `</ul></div>`;
  } else {
    profileHTML += `<p>No alternative names or titles found.</p>`;
  }

  // Relationships (collapsible)
  if (person.relationships && person.relationships.length > 0) {
    profileHTML += `
      <h3><button class="collapsible">Relationships (${person.relationships.length})</button></h3>
      <div class="collapsible-content"><ul>
    `;
    person.relationships.forEach(rel => {
      const otherPersonId = rel.person_id_1.toLowerCase() === person.person_id.toLowerCase() ? rel.person_id_2 : rel.person_id_1;
      const otherPerson = peopleData.find(p => p.person_id.toLowerCase() === otherPersonId.toLowerCase());
      const otherPersonName = otherPerson ? otherPerson.person_name : otherPersonId;
      const role = rel.person_id_1.toLowerCase() === person.person_id.toLowerCase() ? rel.relationship_type : `is ${rel.relationship_type} of`;
      profileHTML += `
        <li>
          <strong>${role}</strong> ${otherPersonName}<br>
          <strong>Reference:</strong> ${rel.reference_id || 'Not listed'}<br>
          ${rel.relationship_notes ? `<strong>Notes:</strong> ${rel.relationship_notes}` : ''}
        </li>
      `;
    });
    profileHTML += `</ul></div>`;
  } else {
    profileHTML += `<p>No additional relationships found.</p>`;
  }

  // Verses mentioned (collapsible) with Tanakh/Apostolic distinction
  if (person.verses && person.verses.length > 0) {
    // Sort verses by person_verse_sequence
    const sortedVerses = person.verses.sort((a, b) => parseInt(a.person_verse_sequence) - parseInt(b.person_verse_sequence));
    const tanakhVerses = sortedVerses.filter(v => v.reference_id.startsWith('GEN') || v.reference_id.startsWith('EXO') /* Add more Tanakh books */);
    const apostolicVerses = sortedVerses.filter(v => v.reference_id.startsWith('MAT') || v.reference_id.startsWith('MAR') || v.reference_id.startsWith('1CO') /* Add more Apostolic books */);

    profileHTML += `
      <h3><button class="collapsible">Verses Mentioned (${sortedVerses.length})</button></h3>
      <div class="collapsible-content">
    `;

    if (tanakhVerses.length > 0) {
      profileHTML += `
        <h4>Tanakh (${tanakhVerses.length})</h4>
        <ul class="tanakh">
      `;
      tanakhVerses.forEach(verse => {
        profileHTML += `
          <li>
            ${verse.reference_id} (Label: ${verse.person_label})<br>
            ${verse.person_verse_notes ? `<strong>Notes:</strong> ${verse.person_verse_notes}` : ''}
          </li>
        `;
      });
      profileHTML += `</ul>`;
    }

    if (apostolicVerses.length > 0) {
      profileHTML += `
        <h4>Apostolic Writings (${apostolicVerses.length})</h4>
        <ul class="apostolic">
      `;
      apostolicVerses.forEach(verse => {
        profileHTML += `
          <li>
            ${verse.reference_id} (Label: ${verse.person_label})<br>
            ${verse.person_verse_notes ? `<strong>Notes:</strong> ${verse.person_verse_notes}` : ''}
          </li>
        `;
      });
      profileHTML += `</ul>`;
    }

    profileHTML += `</div>`;
  } else {
    profileHTML += `<p>No additional verses found.</p>`;
  }

  profileDiv.innerHTML = profileHTML;
  profileDiv.classList.add('active');

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
