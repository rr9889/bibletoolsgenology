// File paths (relative, since all files are in the same directory)
const CSV_PERSON_FILE = './BibleData-Person.csv';
const JSON_LABEL_FILE = './BibleData-PersonLabel.json';
const CSV_RELATIONSHIP_FILE = './BibleData-PersonRelationship.csv';
const CSV_PERSONVERSE_FILE = './BibleData-PersonVerse.csv';
const CSV_PERSONVERSE_APOSTOLIC_FILE = './BibleData-PersonVerseApostolic.csv';
const CSV_PERSONVERSE_TANAKH_FILE = './BibleData-PersonVerseTanakh.csv';
const CSV_EPOCH_FILE = './BibleData-Epoch.csv';
const CSV_EVENT_FILE = './BibleData-Event.csv';
const CSV_PLACEVERSE_FILE = './BibleData-PlaceVerse.csv';
const CSV_HITCHCOCKS_FILE = './HitchcocksBibleNamesDictionary.csv';

// Data storage
let peopleData = [];
let labelData = [];
let relationshipData = [];
let personVerseData = [];
let personVerseApostolicData = [];
let personVerseTanakhData = [];
let epochData = [];
let eventData = [];
let placeVerseData = [];
let hitchcocksData = [];
const peopleCache = new Map();

// Initialize the app
initApp();

async function initApp() {
  await Promise.all([
    loadCSVData(CSV_PERSON_FILE, data => peopleData = data),
    loadJSONData(),
    loadCSVData(CSV_RELATIONSHIP_FILE, data => relationshipData = data),
    loadCSVData(CSV_PERSONVERSE_FILE, data => personVerseData = data),
    loadCSVData(CSV_PERSONVERSE_APOSTOLIC_FILE, data => personVerseApostolicData = data),
    loadCSVData(CSV_PERSONVERSE_TANAKH_FILE, data => personVerseTanakhData = data),
    loadCSVData(CSV_EPOCH_FILE, data => epochData = data),
    loadCSVData(CSV_EVENT_FILE, data => eventData = data),
    loadCSVData(CSV_PLACEVERSE_FILE, data => placeVerseData = data),
    loadCSVData(CSV_HITCHCOCKS_FILE, data => hitchcocksData = data)
  ]);
  setupSearch();
}

// Load CSV data using PapaParse
async function loadCSVData(file, callback) {
  return new Promise((resolve) => {
    Papa.parse(file, {
      download: true,
      header: true,
      complete: (results) => {
        const data = results.data.filter(row => Object.keys(row).length > 0);
        callback(data);
        resolve();
      },
      error: (err) => {
        console.error(`Failed to load ${file}: ${err}`);
        callback([]);
        resolve();
      }
    });
  });
}

// Load JSON data using Fetch API
async function loadJSONData() {
  try {
    const response = await fetch(JSON_LABEL_FILE);
    if (!response.ok) throw new Error(`Failed to fetch ${JSON_LABEL_FILE}: ${response.statusText}`);
    labelData = await response.json();
  } catch (err) {
    console.error(err);
    labelData = [];
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

// Fetch person details using all data sources
async function fetchPersonDetails(person) {
  if (peopleCache.has(person.person_name)) {
    showPersonDetails(peopleCache.get(person.person_name));
    return;
  }

  const csvPerson = peopleData.find(p => p.person_name === person.person_name) || {};
  const personLabels = labelData.filter(label => label.person_id === csvPerson.person_id);
  const personRelationships = relationshipData.filter(rel => rel.person_id_1 === csvPerson.person_id || rel.person_id_2 === csvPerson.person_id);
  const personVerses = personVerseData.filter(pv => pv.person_id === csvPerson.person_id);
  const personVersesApostolic = personVerseApostolicData.filter(pv => pv.person_id === csvPerson.person_id);
  const personVersesTanakh = personVerseTanakhData.filter(pv => pv.person_id === csvPerson.person_id);

  // Find the epoch (based on firstVerse)
  let personEpoch = 'Not listed';
  if (csvPerson.firstVerse) {
    const verseParts = csvPerson.firstVerse.split('.');
    if (verseParts.length >= 2) {
      const bookChapter = `${verseParts[0]} ${verseParts[1]}`;
      const epoch = epochData.find(e => e.first_reference_id && e.first_reference_id.startsWith(bookChapter));
      if (epoch) personEpoch = epoch.epoch_name || 'Not listed';
    }
  }

  // Find events (cross-reference person verses with event verses)
  const personEventVerses = personVerses.map(pv => pv.verse_id);
  const personEvents = eventData.filter(event => event.first_reference_id && personEventVerses.includes(event.first_reference_id));

  // Find associated places (cross-reference person verses with place verses)
  const personPlaces = [];
  personVerses.forEach(pv => {
    const matchingPlaces = placeVerseData.filter(pv2 => pv2.verse_id === pv.verse_id);
    matchingPlaces.forEach(place => {
      if (!personPlaces.includes(place.place_id)) personPlaces.push(place.place_id);
    });
  });

  // Find name meaning from Hitchcock's dictionary
  const nameMeaning = hitchcocksData.find(h => h.name && h.name.toLowerCase() === person.person_name.toLowerCase());

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
    labels: personLabels,
    relationships: personRelationships,
    verses: personVerses,
    versesApostolic: personVersesApostolic,
    versesTanakh: personVersesTanakh,
    epoch: personEpoch,
    events: personEvents,
    places: personPlaces,
    nameMeaning: nameMeaning ? nameMeaning.meaning : 'Not listed'
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
  
  let profileHTML = `
    <h2>${person.person_name}</h2>
    <p><strong>ID:</strong> ${person.person_id}</p>
    <p><strong>Name Meaning:</strong> ${person.nameMeaning}</p>
    <p><strong>Surname:</strong> ${person.surname}</p>
    <p><strong>Unique Attribute:</strong> ${person.unique_attribute}</p>
    <p><strong>Sex:</strong> ${person.sex}</p>
    <p><strong>Tribe:</strong> ${person.tribe}</p>
    <p><strong>Epoch:</strong> ${person.epoch}</p>
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
      const otherPersonId = rel.person_id_1 === person.person_id ? rel.person_id_2 : rel.person_id_1;
      const otherPerson = peopleData.find(p => p.person_id === otherPersonId);
      const otherPersonName = otherPerson ? otherPerson.person_name : otherPersonId;
      const role = rel.person_id_1 === person.person_id ? rel.relationship_type : `is ${rel.relationship_type} of`;
      profileHTML += `
        <li>
          <strong>${role}</strong> ${otherPersonName}<br>
          <strong>Reference:</strong> ${rel.relationship_reference_id || 'Not listed'}<br>
          ${rel.relationship_notes ? `<strong>Notes:</strong> ${rel.relationship_notes}` : ''}
        </li>
      `;
    });
    profileHTML += `</ul></div>`;
  } else {
    profileHTML += `<p>No additional relationships found.</p>`;
  }

  // Events (collapsible)
  if (person.events && person.events.length > 0) {
    profileHTML += `
      <h3><button class="collapsible">Events (${person.events.length})</button></h3>
      <div class="collapsible-content"><ul>
    `;
    person.events.forEach(event => {
      profileHTML += `
        <li>
          ${event.event_name || 'Unnamed Event'}<br>
          <strong>Reference:</strong> ${event.first_reference_id || 'Not listed'}<br>
          ${event.event_notes ? `<strong>Notes:</strong> ${event.event_notes}` : ''}
        </li>
      `;
    });
    profileHTML += `</ul></div>`;
  } else {
    profileHTML += `<p>No events found.</p>`;
  }

  // Associated Places (collapsible)
  if (person.places && person.places.length > 0) {
    profileHTML += `
      <h3><button class="collapsible">Associated Places (${person.places.length})</button></h3>
      <div class="collapsible-content"><ul>
    `;
    person.places.forEach(placeId => {
      profileHTML += `<li>${placeId}</li>`;
    });
    profileHTML += `</ul></div>`;
  } else {
    profileHTML += `<p>No associated places found.</p>`;
  }

  // Verses Mentioned - Tanakh (collapsible)
  if (person.versesTanakh && person.versesTanakh.length > 0) {
    profileHTML += `
      <h3><button class="collapsible">Verses Mentioned (Tanakh) (${person.versesTanakh.length})</button></h3>
      <div class="collapsible-content"><ul>
    `;
    person.versesTanakh.forEach(verse => {
      profileHTML += `
        <li>
          ${verse.verse_id}<br>
          ${verse.person_verse_notes ? `<strong>Notes:</strong> ${verse.person_verse_notes}` : ''}
        </li>
      `;
    });
    profileHTML += `</ul></div>`;
  } else {
    profileHTML += `<p>No verses found in Tanakh.</p>`;
  }

  // Verses Mentioned - Apostolic (collapsible)
  if (person.versesApostolic && person.versesApostolic.length > 0) {
    profileHTML += `
      <h3><button class="collapsible">Verses Mentioned (Apostolic) (${person.versesApostolic.length})</button></h3>
      <div class="collapsible-content"><ul>
    `;
    person.versesApostolic.forEach(verse => {
      profileHTML += `
        <li>
          ${verse.verse_id}<br>
          ${verse.person_verse_notes ? `<strong>Notes:</strong> ${verse.person_verse_notes}` : ''}
        </li>
      `;
    });
    profileHTML += `</ul></div>`;
  } else {
    profileHTML += `<p>No verses found in Apostolic books.</p>`;
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
