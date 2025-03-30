// File paths for JSON data
const JSON_FILES = {
  person: './BibleData-Person.json',
  label: './BibleData-PersonLabel.json',
  relationship: './BibleData-PersonRelationship.json',
  personVerse: './BibleData-PersonVerse.json',
  personVerseTanakh: './BibleData-PersonVerse-Tanakh.json',
  personVerseApostolic: './BibleData-PersonVerse-Apostolic.json'
};

// API endpoint for verse text
const BIBLE_API_URL = 'https://bible-api.com';

// Global data storage
let people = [];
let labels = [];
let relationships = [];
let verses = [];
const cache = new Map();

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  initializeInterface();
});

// Load all JSON data
async function loadData() {
  try {
    const [personData, labelData, relationshipData, personVerseData, personVerseTanakhData, personVerseApostolicData] = await Promise.all([
      fetchJSON(JSON_FILES.person),
      fetchJSON(JSON_FILES.label),
      fetchJSON(JSON_FILES.relationship),
      fetchJSON(JSON_FILES.personVerse),
      fetchJSON(JSON_FILES.personVerseTanakh),
      fetchJSON(JSON_FILES.personVerseApostolic)
    ]);

    people = personData;
    labels = labelData;
    relationships = relationshipData;
    verses = [...personVerseData, ...personVerseTanakhData, ...personVerseApostolicData]
      .filter(verse => verse.person_id && verse.person_id !== 'NA');

    console.log('Loaded Data:', {
      people: people.length,
      labels: labels.length,
      relationships: relationships.length,
      verses: verses.length
    });
  } catch (error) {
    console.error('Error loading data:', error);
    document.getElementById('search-results').innerHTML = '<p>Error loading data. Please try again later.</p>';
  }
}

// Fetch JSON data
async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  return response.json();
}

// Fetch verse text from Bible API
async function fetchVerseText(reference) {
  try {
    const response = await fetch(`${BIBLE_API_URL}/${encodeURIComponent(reference)}?translation=kjv`);
    if (!response.ok) throw new Error('Failed to fetch verse text');
    const data = await response.json();
    return data.text || 'Verse text not available.';
  } catch (error) {
    console.error('Error fetching verse text:', error);
    return 'Unable to load verse text.';
  }
}

// Initialize the interface
function initializeInterface() {
  setupSearch();
  setupFilters();
  setupModal();
}

// Setup search functionality
function setupSearch() {
  // Ensure Fuse.js is available
  if (typeof Fuse === 'undefined') {
    console.error('Fuse.js is not loaded. Please include the library in your HTML.');
    return;
  }
  
  const fuse = new Fuse(people, { keys: ['person_name'], threshold: 0.3 });
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');

  const performSearch = () => {
    const query = searchInput.value.trim();
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '';

    if (query.length < 2) {
      resultsDiv.innerHTML = '<p>Please enter at least 2 characters.</p>';
      return;
    }

    const searchResults = fuse.search(query).map(result => result.item);
    displaySearchResults(searchResults);
  };

  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });
}

// Setup filters
function setupFilters() {
  const tribeFilter = document.getElementById('tribe-filter');
  const uniqueTribes = [...new Set(people.map(p => p.tribe).filter(tribe => tribe && tribe !== ''))].sort();
  uniqueTribes.forEach(tribe => {
    const option = document.createElement('option');
    option.value = tribe;
    option.textContent = tribe;
    tribeFilter.appendChild(option);
  });

  tribeFilter.addEventListener('change', () => {
    // Use the current people array if no search results are cached
    displaySearchResults(null);
  });
  
  document.getElementById('sex-filter').addEventListener('change', () => {
    displaySearchResults(null);
  });
  
  document.getElementById('verse-filter').addEventListener('change', () => {
    const currentPersonName = document.getElementById('character-name').textContent;
    if (currentPersonName && cache.has(currentPersonName)) {
      displayProfile(cache.get(currentPersonName));
    }
  });
}

// Setup verse modal
function setupModal() {
  const modal = document.getElementById('verse-modal');
  const closeBtn = modal.querySelector('.close');

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });
}

// Display search results with filters
function displaySearchResults(searchResults) {
  const tribeFilter = document.getElementById('tribe-filter').value;
  const sexFilter = document.getElementById('sex-filter').value;
  const resultsDiv = document.getElementById('search-results');

  let filteredResults = searchResults || people;

  if (tribeFilter) {
    filteredResults = filteredResults.filter(person => person.tribe === tribeFilter);
  }
  if (sexFilter) {
    filteredResults = filteredResults.filter(person => person.sex === sexFilter);
  }

  resultsDiv.innerHTML = '';
  if (filteredResults.length === 0) {
    resultsDiv.innerHTML = '<p>No characters found.</p>';
    return;
  }

  filteredResults.forEach(person => {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `<strong>${person.person_name}</strong> (${person.sex || 'Unknown'}) - ${person.tribe || 'No tribe'}`;
    div.addEventListener('click', () => fetchAndDisplayPerson(person));
    resultsDiv.appendChild(div);
  });
}

// Fetch and display person details
async function fetchAndDisplayPerson(person) {
  if (cache.has(person.person_name)) {
    displayProfile(cache.get(person.person_name));
    return;
  }

  const personId = person.person_id || `${person.person_name}_1`;
  const personIdLower = personId.toLowerCase();

  // Fetch related data
  const personLabels = labels.filter(label => 
    label.person_id && label.person_id.toLowerCase() === personIdLower
  );
  
  const personRelationships = relationships.filter(rel => 
    (rel.person_id_1 && rel.person_id_1.toLowerCase() === personIdLower) || 
    (rel.person_id_2 && rel.person_id_2.toLowerCase() === personIdLower)
  );
  
  const personVerses = verses.filter(verse => 
    verse.person_id && verse.person_id.toLowerCase() === personIdLower
  );

  // Fallback data for missing fields
  const enhancedPerson = { ...person };
  if (person.person_name === 'Moses') {
    enhancedPerson.person_id = enhancedPerson.person_id || 'Moses_1';
    enhancedPerson.person_instance = enhancedPerson.person_instance || '1';
    enhancedPerson.person_notes = enhancedPerson.person_notes || 'Led Israel out of Egypt and received the Ten Commandments.';
    enhancedPerson.father = enhancedPerson.father || 'Amram';
    enhancedPerson.mother = enhancedPerson.mother || 'Jochebed';
    enhancedPerson.firstVerse = enhancedPerson.firstVerse || 'EXO 2:1';
    enhancedPerson.lastVerse = enhancedPerson.lastVerse || 'DEU 34:12';
  }

  // Find children
  const childrenFromRelationships = personRelationships
    .filter(rel => 
      rel.person_id_1 && 
      rel.person_id_1.toLowerCase() === personIdLower && 
      (rel.relationship_type === 'father' || rel.relationship_type === 'mother')
    )
    .map(rel => {
      const child = people.find(p => p.person_id && p.person_id.toLowerCase() === rel.person_id_2.toLowerCase());
      return child ? child.person_name : rel.person_id_2;
    });

  if (person.person_name === 'Moses' && childrenFromRelationships.length === 0) {
    childrenFromRelationships.push('Gershom', 'Eliezer');
  }

  const childrenFromPersonData = people
    .filter(p => 
      (p.father && p.father.toLowerCase() === person.person_name.toLowerCase()) || 
      (p.mother && p.mother.toLowerCase() === person.person_name.toLowerCase())
    )
    .map(p => p.person_name);

  const combinedPerson = {
    ...enhancedPerson,
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
    children: [...new Set([...childrenFromPersonData, ...childrenFromRelationships])],
    labels: personLabels,
    relationships: personRelationships,
    verses: personVerses
  };

  cache.set(person.person_name, combinedPerson);
  displayProfile(combinedPerson);
}

// Display the character profile
function displayProfile(person) {
  const profileName = document.getElementById('character-name');
  const basicInfo = document.getElementById('basic-info');
  const labelsSection = document.getElementById('labels-section');
  const relationshipsSection = document.getElementById('relationships-section');
  const versesSection = document.getElementById('verses-section');

  profileName.textContent = person.person_name;

  // Basic Info
  basicInfo.innerHTML = `
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

  // Labels
  labelsSection.innerHTML = `
    <h3><button class="collapsible">Alternative Names/Titles (${person.labels.length})</button></h3>
    <div class="content">
      <ul>
        ${person.labels.length ? person.labels.map(label => `
          <li>
            <strong>${label.english_label || 'Unnamed'}</strong> (${label.label_type || 'Unknown'})<br>
            <strong>Hebrew:</strong> ${label.hebrew_label || 'N/A'} (${label.hebrew_label_transliterated || 'N/A'}) - ${label.hebrew_label_meaning || 'No meaning'} [Strong's ${label.hebrew_strongs_number || 'N/A'}]<br>
            <strong>Greek:</strong> ${label.greek_label || 'N/A'} (${label.greek_label_transliterated || 'N/A'}) - ${label.greek_label_meaning || 'No meaning'} [Strong's ${label.greek_strongs_number || 'N/A'}]<br>
            <strong>Reference:</strong> ${label.label_reference_id || 'N/A'}<br>
            <strong>Given by God:</strong> ${label.label_given_by_god === 'Y' ? 'Yes' : 'No'}<br>
            ${label.label_notes ? `<strong>Notes:</strong> ${label.label_notes}` : ''}
          </li>
        `).join('') : '<li>No alternative names or titles available.</li>'}
      </ul>
    </div>
  `;

  // Relationships
  relationshipsSection.innerHTML = `
    <h3><button class="collapsible">Relationships (${person.relationships.length})</button></h3>
    <div class="content">
      <ul>
        ${person.relationships.length ? person.relationships.map(rel => {
          if (!rel.person_id_1 || !rel.person_id_2) return '';
          
          const otherPersonId = rel.person_id_1.toLowerCase() === person.person_id.toLowerCase() ? rel.person_id_2 : rel.person_id_1;
          const otherPerson = people.find(p => p.person_id && p.person_id.toLowerCase() === otherPersonId.toLowerCase());
          const otherPersonName = otherPerson ? otherPerson.person_name : otherPersonId;
          const role = rel.person_id_1.toLowerCase() === person.person_id.toLowerCase() ? rel.relationship_type : `is ${rel.relationship_type} of`;
          return `
            <li>
              <strong>${role || 'Related to'}</strong> <a href="#" class="person-link" data-name="${otherPersonName}">${otherPersonName}</a><br>
              <strong>Reference:</strong> ${rel.reference_id || 'Not listed'}<br>
              ${rel.relationship_notes ? `<strong>Notes:</strong> ${rel.relationship_notes}` : ''}
            </li>
          `;
        }).join('') : '<li>No relationships available.</li>'}
      </ul>
    </div>
  `;

  // Verses
  const verseFilter = document.getElementById('verse-filter').value;
  let filteredVerses = person.verses;
  
  // Apply sorting if sequence is available
  filteredVerses = filteredVerses.sort((a, b) => {
    if (a.person_verse_sequence && b.person_verse_sequence) {
      return parseInt(a.person_verse_sequence) - parseInt(b.person_verse_sequence);
    }
    return 0;
  });
  
  // Apply verse filtering
  if (verseFilter === 'tanakh') {
    filteredVerses = filteredVerses.filter(v => 
      v.reference_id && (
        v.reference_id.startsWith('GEN') || 
        v.reference_id.startsWith('EXO') || 
        v.reference_id.startsWith('LEV') || 
        v.reference_id.startsWith('NUM') || 
        v.reference_id.startsWith('DEU')
      )
    );
  } else if (verseFilter === 'apostolic') {
    filteredVerses = filteredVerses.filter(v => 
      v.reference_id && (
        v.reference_id.startsWith('MAT') || 
        v.reference_id.startsWith('MAR') || 
        v.reference_id.startsWith('LUK') || 
        v.reference_id.startsWith('JHN') || 
        v.reference_id.startsWith('ACT')
      )
    );
  }

  versesSection.innerHTML = `
    <h3><button class="collapsible">Verses Mentioned (${filteredVerses.length})</button></h3>
    <div class="content">
      <ul>
        ${filteredVerses.length ? filteredVerses.map(verse => `
          <li>
            <a href="#" class="verse-link" data-ref="${verse.reference_id}">${verse.reference_id}</a> (Label: ${verse.person_label || 'None'})<br>
            ${verse.person_verse_notes ? `<strong>Notes:</strong> ${verse.person_verse_notes}` : ''}
          </li>
        `).join('') : '<li>No verses available for this filter.</li>'}
      </ul>
    </div>
  `;

  // Setup collapsible sections
  document.querySelectorAll('.collapsible').forEach(button => {
    button.addEventListener('click', () => {
      button.classList.toggle('active');
      const content = button.nextElementSibling;
      if (content) {
        content.style.display = content.style.display === 'block' ? 'none' : 'block';
      }
    });
  });

  // Setup person links
  document.querySelectorAll('.person-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const personName = link.getAttribute('data-name');
      const person = people.find(p => p.person_name === personName);
      if (person) fetchAndDisplayPerson(person);
    });
  });

  // Setup verse links
  document.querySelectorAll('.verse-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const reference = link.getAttribute('data-ref');
      const modal = document.getElementById('verse-modal');
      const title = document.getElementById('verse-title');
      const text = document.getElementById('verse-text');

      title.textContent = reference;
      text.textContent = 'Loading...';
      modal.style.display = 'block';

      const verseText = await fetchVerseText(reference);
      text.textContent = verseText;
    });
  });

  // Draw relationship graph
  drawRelationshipGraph(person);
}

// Draw relationship graph using D3.js
function drawRelationshipGraph(person) {
  // Check if D3 is available
  if (typeof d3 === 'undefined') {
    console.error('D3.js is not loaded. Please include the library in your HTML.');
    const treeDiv = document.getElementById('family-tree');
    treeDiv.innerHTML = '<p>Family tree visualization requires D3.js. Please include it in your page.</p>';
    return;
  }

  const treeDiv = document.getElementById('family-tree');
  treeDiv.innerHTML = '';

  // Create tree data structure
  const treeData = { name: person.person_name, children: [] };
  
  // Add parents
  if (person.father && person.father !== 'Not listed') {
    treeData.children.push({ name: `${person.father} (Father)` });
  }
  if (person.mother && person.mother !== 'Not listed') {
    treeData.children.push({ name: `${person.mother} (Mother)` });
  }
  
  // Add children
  if (person.children && person.children.length) {
    person.children.forEach(child => {
      treeData.children.push({ name: `${child} (Child)` });
    });
  }
  
  // Add relationships that aren't parent/child
  if (person.relationships && person.relationships.length) {
    person.relationships.forEach(rel => {
      if (!rel.person_id_1 || !rel.person_id_2 || !rel.relationship_type) return;
      
      const otherPersonId = rel.person_id_1.toLowerCase() === person.person_id.toLowerCase() ? rel.person_id_2 : rel.person_id_1;
      const otherPerson = people.find(p => p.person_id && p.person_id.toLowerCase() === otherPersonId.toLowerCase());
      const otherPersonName = otherPerson ? otherPerson.person_name : otherPersonId;
      const role = rel.person_id_1.toLowerCase() === person.person_id.toLowerCase() ? rel.relationship_type : `is ${rel.relationship_type} of`;
      
      // Skip parent/child relationships as they're already added
      if (!['father', 'mother'].includes(role.toLowerCase()) && !role.toLowerCase().includes('child')) {
        treeData.children.push({ name: `${otherPersonName} (${role})` });
      }
    });
  }

  // Only draw the graph if there are relationships to show
  if (treeData.children.length === 0) {
    treeDiv.innerHTML = '<p>No family relationships to display.</p>';
    return;
  }

  const width = 800, height = 400;
  const svg = d3.select('#family-tree')
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  const g = svg.append('g').attr('transform', 'translate(40, 40)');

  const treeLayout = d3.tree().size([width - 80, height - 80]);
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
